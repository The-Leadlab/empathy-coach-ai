/**
 * Fire-and-forget RunPod scale-up (min=0 → worker) before the user sends a chat turn.
 * Safe to call multiple times; the API skips when workers are already live.
 */
let lastWarmAt = 0;
const WARM_COOLDOWN_MS = 45_000;

export function warmCoachLlm(reason = "journey"): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastWarmAt < WARM_COOLDOWN_MS) return;
  lastWarmAt = now;

  void fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "warm", reason }),
    keepalive: true,
  }).catch(() => {
    /* warm is best-effort */
  });
}
