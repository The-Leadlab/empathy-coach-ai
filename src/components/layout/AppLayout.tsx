import { Outlet, useLocation } from "react-router-dom";
import TopNav from "./TopNav";
import AppFooter from "./AppFooter";
import MobileNav from "./MobileNav";
import DisclaimerBanner from "../safety/DisclaimerBanner";
import { cn } from "@/lib/utils";
import { useActivityTracker } from "@/hooks/useActivityTracker";

export default function AppLayout() {
  const { pathname } = useLocation();
  useActivityTracker();
  const fullBleed =
    pathname.startsWith("/testing/avatar/session") ||
    /^\/testing\/journeys\/[^/]+$/.test(pathname);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <TopNav />
      <DisclaimerBanner />
      <main
        className={cn(
          "flex-1 overflow-x-hidden bg-background text-foreground",
          fullBleed
            ? "lg:mx-2 lg:mb-2 lg:rounded-2xl max-w-none"
            : "mx-auto w-full max-w-6xl lg:mb-4 lg:rounded-2xl",
        )}
      >
        <Outlet />
      </main>
      <AppFooter />
      <MobileNav />
    </div>
  );
}
