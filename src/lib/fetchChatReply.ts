export type ChatApiPayload = {
  userMessage?: string;
  chatHistory?: { role: string; content: string }[];
  possibleCrisisLanguage?: boolean;
  journeyContext?: unknown;
  mode?: string;
  regenerationContext?: unknown;
  conversationSnippet?: string;
  provider?: "fallback" | "runpod";
  cancelJobId?: string;
  /** 2 = resubmit after the server rejected the first reply (leaked reasoning / no question). */
  guardAttempt?: 1 | 2;
  /** Both primary attempts were rejected: fallback gets one try, then a templated question. */
  guardRejected?: boolean;
};

/** Phase One intake state tracked by the server; persisted in generation_metadata.phaseOne. */
export type PhaseOneState = {
  captured: Partial<Record<"situation" | "trigger" | "rule" | "belief" | "strength" | "coping", string | number>>;
  asking: string;
  /** Set when the user confirms the Reflective Handshake summary. */
  handshakeConfirmed?: boolean;
};

type CoachGuard = { jsonMode: boolean; phaseOne: boolean; element: string | null; crisis: boolean };

export type ChatReplyOk = { ok: true; reply: string; provider?: string; phaseOne?: PhaseOneState | null };
export type ChatReplyErr = { ok: false; error: string; retryable?: boolean };
export type ChatReplyResult = ChatReplyOk | ChatReplyErr;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function friendlyChatError(raw: string | undefined, status?: number): string {
  const text = String(raw || "").trim();
  if (!text) return "The coach is unavailable right now. Please try again.";
  if (/maximum context length|context length is|input_tokens|too many tokens/i.test(text)) {
    return "That message was too large for the coach model — please try again.";
  }
  if (text.startsWith("{") || text.startsWith("{'")) {
    try {
      const normalized = text.replace(/'/g, '"');
      const parsed = JSON.parse(normalized) as { error?: { message?: string } | string; message?: string };
      const msg =
        typeof parsed.error === "object" && parsed.error?.message
          ? parsed.error.message
          : typeof parsed.error === "string"
            ? parsed.error
            : parsed.message;
      if (msg && /maximum context length|context length is/i.test(msg)) {
        return "That message was too large for the coach model — please try again.";
      }
    } catch {
      // fall through
    }
    return status === 400
      ? "The coach could not process that message — please try again."
      : "The coach is unavailable right now. Please try again.";
  }
  return text.length < 220 ? text : "The coach is unavailable right now. Please try again.";
}

const TERMINAL_FAIL = new Set(["FAILED", "CANCELLED", "CANCELED", "TIMED_OUT", "TIMEOUT"]);

const PHASE_ONE_KEYS = ["situation", "trigger", "rule", "belief", "strength", "coping"] as const;

/** Model-extracted values only fill gaps; what the server captured from the user's own words wins. */
export function mergePhaseOneState(state: PhaseOneState, stateUpdate: unknown): PhaseOneState {
  const fromModel: PhaseOneState["captured"] = {};
  const raw = (stateUpdate as { captured?: Record<string, unknown> } | null)?.captured;
  if (raw && typeof raw === "object") {
    for (const key of PHASE_ONE_KEYS) {
      const v = raw[key];
      if (key === "strength") {
        const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
        if (Number.isFinite(n) && n >= 0 && n <= 100) fromModel.strength = n;
      } else if (typeof v === "string" && v.trim()) {
        fromModel[key] = v.trim().slice(0, 300);
      }
    }
  }
  return { captured: { ...fromModel, ...state.captured }, asking: state.asking };
}

function guardQuery(guard: CoachGuard | null | undefined, attempt: number): string {
  if (!guard) return "";
  const q = new URLSearchParams({ attempt: String(attempt) });
  if (guard.jsonMode) q.set("json", "1");
  if (guard.phaseOne) q.set("intake", "1");
  if (guard.element) q.set("el", guard.element);
  if (guard.crisis) q.set("crisis", "1");
  return `&${q.toString()}`;
}

export async function cancelChatJob(jobId: string): Promise<void> {
  if (!jobId) return;
  try {
    await fetch(`/api/chat?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
  } catch {
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "cancel", jobId }),
      });
    } catch {
      // best-effort
    }
  }
}

async function requestFallback(
  payload: ChatApiPayload,
  cancelJobId: string | undefined,
  signal?: AbortSignal,
  guardRejected = false,
): Promise<ChatReplyResult> {
  if (cancelJobId) await cancelChatJob(cancelJobId);
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, provider: "fallback", cancelJobId, guardRejected }),
    signal,
  });
  let data: { reply?: string; error?: string; provider?: string; phaseOne?: PhaseOneState | null };
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: "The coach is unavailable right now. Please try again.", retryable: true };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: friendlyChatError(data.error, response.status),
      retryable: true,
    };
  }
  return { ok: true, reply: data.reply ?? "", provider: data.provider || "fallback", phaseOne: data.phaseOne ?? null };
}

async function pollRunPodJob(
  jobId: string,
  payload: ChatApiPayload,
  submitted: { guard?: CoachGuard | null; phaseOne?: PhaseOneState | null },
  opts?: {
    onWarmingChange?: (warming: boolean) => void;
    onElapsed?: (ms: number) => void;
    signal?: AbortSignal;
  },
): Promise<ChatReplyResult> {
  const attempt = payload.guardAttempt ?? 1;
  const started = Date.now();
  const maxWaitMs = 300_000;
  const pollIntervalMs = 4_000;
  let unknownStreak = 0;

  while (Date.now() - started < maxWaitMs) {
    if (opts?.signal?.aborted) {
      await cancelChatJob(jobId);
      throw new DOMException("Aborted", "AbortError");
    }

    await sleep(pollIntervalMs, opts?.signal);
    const waitedMs = Date.now() - started;
    opts?.onElapsed?.(waitedMs);

    try {
      const pollRes = await fetch(
        `/api/chat?jobId=${encodeURIComponent(jobId)}&waitedMs=${waitedMs}${guardQuery(submitted.guard, attempt)}`,
        { signal: opts?.signal },
      );
      const pollData: {
        status?: string;
        reply?: string;
        error?: string;
        retryable?: boolean;
        fallback?: boolean;
        guardRejected?: boolean;
        regenerate?: boolean;
        stateUpdate?: unknown;
        provider?: string;
      } = await pollRes.json();

      if (pollRes.ok && pollData.regenerate) {
        return fetchChatReply({ ...payload, guardAttempt: 2 }, opts);
      }
      if (pollRes.ok && pollData.guardRejected) {
        opts?.onWarmingChange?.(false);
        return requestFallback(payload, undefined, opts?.signal, true);
      }
      if (pollRes.ok && pollData.status === "COMPLETED") {
        return {
          ok: true,
          reply: pollData.reply ?? "",
          provider: pollData.provider || "runpod",
          phaseOne: submitted.phaseOne ? mergePhaseOneState(submitted.phaseOne, pollData.stateUpdate) : null,
        };
      }

      const status = String(pollData.status || "").toUpperCase();
      if (TERMINAL_FAIL.has(status) || pollData.fallback) {
        if (pollData.fallback) {
          opts?.onWarmingChange?.(false);
          // Warming handoff: keep the RunPod job so the GPU finishes booting for later turns.
          // Only cancel on real terminal failures below.
          const cancelId = TERMINAL_FAIL.has(status) ? jobId : undefined;
          return requestFallback(payload, cancelId, opts?.signal);
        }
        return {
          ok: false,
          error: friendlyChatError(pollData.error, pollRes.status),
          retryable: true,
        };
      }

      if (!pollRes.ok && !pollData.retryable) {
        return {
          ok: false,
          error: friendlyChatError(pollData.error, pollRes.status),
          retryable: true,
        };
      }

      if (!status || status === "UNKNOWN") {
        unknownStreak += 1;
        if (unknownStreak >= 8) {
          return requestFallback(payload, jobId, opts?.signal).catch(() => ({
            ok: false as const,
            error: "The coach did not respond. Please try again.",
            retryable: true,
          }));
        }
      } else {
        unknownStreak = 0;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      // Transient poll failure — keep waiting while RunPod may still be booting.
    }
  }

  await cancelChatJob(jobId);
  const fallbackAttempt = await requestFallback(payload, undefined, opts?.signal).catch(() => null);
  if (fallbackAttempt?.ok) return fallbackAttempt;

  return {
    ok: false,
    error: "The coach did not respond in time. Please try again.",
    retryable: true,
  };
}

/**
 * Calls /api/chat. RunPod chat uses async submit + poll; falls back to OpenAI-compatible host when queued too long.
 */
export async function fetchChatReply(
  payload: ChatApiPayload,
  opts?: {
    onWarmingChange?: (warming: boolean) => void;
    onElapsed?: (ms: number) => void;
    signal?: AbortSignal;
  },
): Promise<ChatReplyResult> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: opts?.signal,
    });

    let data: {
      reply?: string;
      error?: string;
      retryable?: boolean;
      jobId?: string;
      provider?: string;
      fallback?: boolean;
      guard?: CoachGuard | null;
      phaseOne?: PhaseOneState | null;
    };
    try {
      data = await response.json();
    } catch {
      return {
        ok: false,
        error: "Connection lost. Please try again.",
        retryable: true,
      };
    }

    if (response.status === 202 && data.jobId) {
      opts?.onWarmingChange?.(true);
      try {
        return await pollRunPodJob(data.jobId, payload, { guard: data.guard, phaseOne: data.phaseOne }, opts);
      } finally {
        opts?.onWarmingChange?.(false);
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: friendlyChatError(data.error, response.status),
        retryable: data.retryable !== false,
      };
    }

    return { ok: true, reply: data.reply ?? "", provider: data.provider, phaseOne: data.phaseOne ?? null };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Cancelled.", retryable: false };
    }
    return {
      ok: false,
      error: "Connection lost. Please try again.",
      retryable: true,
    };
  }
}
