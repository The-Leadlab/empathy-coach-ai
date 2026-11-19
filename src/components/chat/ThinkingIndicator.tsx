import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ThinkingIndicatorProps = {
  className?: string;
  /** Kept for callers; waiting copy is always "Thinking". */
  isWarming?: boolean;
  /** Elapsed ms from parent poll (optional). */
  elapsedMs?: number;
  onRetry?: () => void;
  onCancel?: () => void;
};

/**
 * Waiting state: "Thinking" + elapsed time.
 */
export default function ThinkingIndicator({
  className,
  isWarming = false,
  elapsedMs,
  onRetry,
  onCancel,
}: ThinkingIndicatorProps) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    setElapsedSec(0);
    const tick = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, [isWarming]);

  const sec = typeof elapsedMs === "number" ? Math.floor(elapsedMs / 1000) : elapsedSec;

  const title = sec < 8 ? "Thinking" : sec < 25 ? "Still thinking" : "Taking a bit longer";

  let hint: string | null = null;
  if (sec >= 90) {
    hint = "This is taking longer than usual.";
  } else if (sec >= 25) {
    hint = "Longer replies can take a moment.";
  }

  const showActions = sec >= 90 && (onRetry || onCancel);

  return (
    <div
      className={cn("flex justify-start", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="rounded-2xl rounded-tl-md px-4 py-2.5 text-sm max-w-[85%] min-w-[11rem] bg-muted/80 text-foreground border border-border/50">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <span>{title}</span>
          <span className="text-xs tabular-nums text-muted-foreground/70">{sec}s</span>
          <span className="inline-flex items-center gap-0.5" aria-hidden>
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/80" />
            <span className="thinking-dot thinking-dot-delay-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/80" />
            <span className="thinking-dot thinking-dot-delay-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/80" />
          </span>
        </div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground/80 leading-snug">{hint}</p> : null}
        {showActions ? (
          <div className="mt-2 flex gap-2">
            {onRetry ? (
              <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            {onCancel ? (
              <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null}
        <span className="sr-only">The coach is thinking.</span>
      </div>
    </div>
  );
}
