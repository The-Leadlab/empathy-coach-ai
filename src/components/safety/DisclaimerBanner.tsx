import { useState } from "react";
import { Shield, X } from "lucide-react";
import { CRISIS_LINES_SHORT } from "@/lib/crisisResources";

export default function DisclaimerBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-[hsl(var(--sidebar-background))] px-4 py-2 text-sm text-white">
      <div className="flex min-w-0 flex-1 items-start gap-2 py-2">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-white" strokeWidth={2} />
        <div className="min-w-0">
          <p className="font-medium">This AI is a training simulation and not therapy.</p>
          <p className="mt-1 hidden text-white sm:block">{CRISIS_LINES_SHORT}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-white transition-colors duration-150 hover:bg-white/10 active:scale-[0.96]"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
