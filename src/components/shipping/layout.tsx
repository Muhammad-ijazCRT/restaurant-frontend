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
import { PortalShell } from "@/components/shared/portal-shell";
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
    <PortalShell
      testId="shipping-layout"
      sidebarWidthClass="lg:w-[280px]"
      brand={
        <PortalSidebarBrand
          subtitle={portalLabels.consoleLabel}
          href={resolveRoleHomePath(role ?? "")}
        />
      }
      nav={
        <>
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
        </>
      }
      headerTitle={
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden truncate text-muted-foreground sm:inline">{vendorName}</span>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="truncate font-semibold">{activeItem?.label ?? "Dashboard"}</span>
        </div>
      }
      headerActions={
        <>
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
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
