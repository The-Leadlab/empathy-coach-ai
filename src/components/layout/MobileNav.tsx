import { Link, useLocation } from "react-router-dom";
import { BookOpen, Bot, HeartHandshake, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/testing/journeys", icon: Bot, label: "Journeys" },
  { to: "/testing/library", icon: BookOpen, label: "Library" },
  { to: "/testing/profile", icon: LayoutDashboard, label: "Profile" },
  { to: "/testing/resources", icon: HeartHandshake, label: "Help" },
  { to: "/testing/settings", icon: Settings, label: "Settings" },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[hsl(var(--sidebar-background))] pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {navItems.map((item) => {
          const active =
            location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-white transition-colors duration-150",
                active ? "bg-white/15" : "hover:bg-white/10",
              )}
            >
              <item.icon className="w-5 h-5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
