import { Link, useLocation } from "@/lib/wouter-compat";
import {
  LayoutDashboard,
  Building2,
  UtensilsCrossed,
  Link2,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuthSession } from "@/lib/portal-auth";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { getUserData } from "@/lib/portal-auth";

const navItems = [
  { path: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/vendors", label: "Vendors", icon: Building2 },
  { path: "/admin/restaurants", label: "Restaurants", icon: UtensilsCrossed },
  { path: "/admin/relationships", label: "Relationships", icon: Link2 },
  { path: "/admin/activity-log", label: "Activity Log", icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const user = getUserData();

  function handleLogout() {
    clearAuthSession();
    navigate("/super-admin/login");
  }

  return (
    <div className="h-full bg-background flex overflow-hidden" data-testid="admin-layout">
      <aside className="w-[240px] h-full border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground" data-testid="text-app-title">
            Admin Console
          </span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              location === item.path ||
              (item.path !== "/super-admin/dashboard" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-3 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground">Controlled Commerce</p>
          <p className="text-xs text-muted-foreground/60">Admin Foundation v1</p>
        </div>
      </aside>
      <div className="fixed right-6 top-4 z-20 flex items-center gap-2">
        <NotificationBell />
        <ProfileMenu
          user={user}
          roleLabel="Super Admin"
          onLogout={handleLogout}
          profileHref="/super-admin/profile"
          settingsHref="/super-admin/settings"
        />
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
