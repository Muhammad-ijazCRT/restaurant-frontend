import { useEffect } from "react";
import { Link, useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { vendorKeys } from "@/api/vendor/vendors";
import type { Vendor } from "@shared/schema";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { clearAuthSession, getUserData, getUserRole, resolveRoleHomePath } from "@/lib/portal-auth";
import {
  canAccessShippingSettings,
  getShippingNavItems,
  getShippingPortalLabels,
  isShippingRouteAllowed,
} from "@/lib/shipping-portal-labels";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PortalRoleSwitcher } from "@/components/shared/portal-role-switcher";
import { PortalPageContainer } from "@/components/shared/portal-page-container";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { PortalSidebarBrand } from "@/components/shared/rodex-brand";

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  const { vendorId } = useVendorAuth();
  const [location, navigate] = useLocation();
  const role = getUserRole();
  const user = getUserData();
  const portalLabels = getShippingPortalLabels(role);
  const navItems = getShippingNavItems(role);
  const { data: vendor } = useQuery<Vendor>({
    queryKey: vendorKeys.detail(vendorId),
    enabled: !!vendorId,
  });
  const activeItem = navItems.find(
    (item) => location === item.href || location.startsWith(`${item.href}/`),
  );
  const vendorName =
    vendor?.name ?? (typeof user?.vendor_name === "string" ? user.vendor_name : "Vendor");

  useEffect(() => {
    if (!role || isShippingRouteAllowed(role, location)) return;
    navigate(resolveRoleHomePath(role));
  }, [role, location, navigate]);

  function handleLogout() {
    localStorage.removeItem("vendor_portal_id");
    clearAuthSession();
    navigate("/vendor/login");
  }

  return (
    <div className="flex h-full overflow-hidden bg-background" data-testid="shipping-layout">
      <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <PortalSidebarBrand
            subtitle={portalLabels.consoleLabel}
            href={resolveRoleHomePath(role ?? "")}
          />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`mb-1 flex cursor-pointer items-center gap-3 rounded-md px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
          <div className="text-sm">
            <span className="text-muted-foreground">{vendorName}</span>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="font-semibold">{activeItem?.label ?? "Dashboard"}</span>
          </div>
          <div className="flex items-center gap-2">
            <PortalRoleSwitcher />
            <NotificationBell />
            <ProfileMenu
              user={user}
              roleLabel={portalLabels.profileRoleLabel}
              onLogout={handleLogout}
              profileHref="/shipping-company/profile"
              settingsHref={
                canAccessShippingSettings(role) ? "/shipping-company/settings" : undefined
              }
            />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
          <PortalPageContainer>{children}</PortalPageContainer>
        </main>
      </div>
    </div>
  );
}
