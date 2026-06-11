import { Link, useLocation } from "@/lib/wouter-compat";
import {
  LayoutDashboard,
  Building2,
  UtensilsCrossed,
  Link2,
  ClipboardList,
} from "lucide-react";
import { clearAuthSession, getUserData } from "@/lib/portal-auth";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { PortalShell } from "@/components/shared/portal-shell";
import { PortalSidebarBrand } from "@/components/shared/rodex-brand";

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

  const activeItem =
    navItems.find(
      (item) =>
        location === item.path ||
        (item.path !== "/super-admin/dashboard" && location.startsWith(item.path)),
    ) ?? navItems[0];

  function handleLogout() {
    clearAuthSession();
    navigate("/super-admin/login");
  }

  return (
    <PortalShell
      testId="admin-layout"
      sidebarWidthClass="lg:w-[240px]"
      brand={<PortalSidebarBrand subtitle="Admin Console" href="/super-admin/dashboard" />}
      nav={
        <>
          {navItems.map((item) => {
            const isActive =
              location === item.path ||
              (item.path !== "/super-admin/dashboard" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={`mb-0.5 flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
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
        </>
      }
      footer={
        <>
          <p className="text-xs text-muted-foreground">Controlled Commerce</p>
          <p className="text-xs text-muted-foreground/60">Admin Foundation v1</p>
        </>
      }
      headerTitle={
        <span className="truncate font-semibold text-foreground">{activeItem.label}</span>
      }
      headerActions={
        <>
          <NotificationBell />
          <ProfileMenu
            user={user}
            roleLabel="Super Admin"
            onLogout={handleLogout}
            profileHref="/super-admin/profile"
            settingsHref="/super-admin/settings"
          />
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
