/**
 * Fire-and-forget RunPod scale-up (min=0 → worker) before the user sends a chat turn.
 * Safe to call multiple times; the API skips when workers are already live.
 */
let lastWarmAt = 0;
const WARM_COOLDOWN_MS = 45_000;

export type WarmCoachResult = {
  provider?: string;
  alreadyWarm?: boolean;
  warming?: boolean;
};

async function postWarm(reason: string): Promise<WarmCoachResult | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "warm", reason }),
      keepalive: true,
    });
    if (!res.ok) return null;
    return (await res.json()) as WarmCoachResult;
  } catch {
    return null;
  }
}

export function warmCoachLlm(reason = "journey"): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastWarmAt < WARM_COOLDOWN_MS) return;
  lastWarmAt = now;
  void postWarm(reason);
}

/** Same warm kick, but returns the API payload (for live-model toasts). */
export async function warmCoachLlmStatus(reason = "journey"): Promise<WarmCoachResult | null> {
  if (typeof window === "undefined") return null;
  lastWarmAt = Date.now();
  return postWarm(reason);
}
