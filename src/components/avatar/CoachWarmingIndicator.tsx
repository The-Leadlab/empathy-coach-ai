import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

/** Shown while RunPod cold-starts (scale-to-zero). Progress eases toward ~90% over ~3 minutes. */
export default function CoachWarmingIndicator() {
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const target = Math.min(90, 6 + (elapsed / 180_000) * 84);
      setProgress(target);
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-foreground">Thinking…</p>
          <Progress value={progress} className="h-1.5 bg-primary/15" />
        </div>
      </div>
      <span className="sr-only">The coach is thinking.</span>
    </div>
  );
}
