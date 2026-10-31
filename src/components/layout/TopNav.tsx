import { Link, useLocation } from "react-router-dom";
import { BookOpen, Bot, HeartHandshake, LayoutDashboard, LogIn, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const navTabs = [
  { to: "/testing/journeys", icon: Bot, label: "Journeys" },
  { to: "/testing/library", icon: BookOpen, label: "Library" },
  { to: "/testing/profile", icon: LayoutDashboard, label: "Profile" },
  { to: "/testing/resources", icon: HeartHandshake, label: "Resources" },
  { to: "/testing/settings", icon: Settings, label: "Settings" },
];

export default function TopNav() {
  const location = useLocation();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[hsl(var(--sidebar-background))] text-white pt-[env(safe-area-inset-top)]">
      <div className="container flex h-14 items-center justify-between gap-3 px-4">
        <Link to="/testing" className="flex min-h-11 items-center gap-2 font-display font-bold text-white">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" aria-hidden />
          <span className="text-lg">ShiftED</span>
          <span className="text-lg text-white/90">AI</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navTabs.map((item) => {
            const active =
              location.pathname === item.to ||
              (item.to !== "/testing" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white transition-colors duration-150",
                  active ? "bg-white/15" : "hover:bg-white/10",
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-[10rem] truncate text-sm text-white lg:inline" title={user.email}>
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white transition-colors duration-150 hover:bg-white/10 active:scale-[0.96]"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <Link
              to="/testing/login"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10 active:scale-[0.96]"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
