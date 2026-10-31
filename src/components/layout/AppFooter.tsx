import { Shield, ExternalLink } from "lucide-react";
import { CRISIS_RESOURCES } from "@/lib/crisisResources";

export default function AppFooter() {
  return (
    <footer className="mt-auto bg-background pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-6">
      <div className="container px-4 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span>
              This AI is a <strong className="text-foreground">training simulation</strong> and not therapy.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            {CRISIS_RESOURCES.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-sm text-foreground hover:underline"
                aria-label={`${link.name} — ${link.desc} (opens in new tab)`}
              >
                {link.name}
                <ExternalLink className="w-3 h-3" aria-hidden />
              </a>
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm text-foreground">
          If you're in crisis, please reach out to the resources above. ShiftED AI is for practice and development only.
        </p>
      </div>
    </footer>
  );
}
