import { useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { useVendorPortalNav } from "@/contexts/vendor-portal-nav-context";
import { VENDOR_SECTION_IDS, type VendorSectionId } from "@/lib/vendor-portal-sections";
import type { Vendor } from "@shared/schema";
import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PortalRoleSwitcher } from "@/components/shared/portal-role-switcher";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { getUserData, getUserRole, resolveRoleHomePath } from "@/lib/portal-auth";
import {
  canAccessVendorSettings,
  getVendorPortalLabels,
  getVendorSidebarLinks,
  isVendorRouteAllowed,
} from "@/lib/vendor-portal-labels";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { vendorId, logout } = useVendorAuth();
  const user = getUserData();
  const role = getUserRole();
  const portalLabels = getVendorPortalLabels(role);
  const sidebarLinks = useMemo(() => getVendorSidebarLinks(role), [role]);
  const [location, navigate] = useLocation();
  const portalNav = useVendorPortalNav();

  useEffect(() => {
    if (role === "driver") {
      navigate(resolveRoleHomePath(role));
      return;
    }
    if (!role || isVendorRouteAllowed(role, location)) return;
    navigate("/vendor/portal");
  }, [role, location, navigate]);

  const { data: vendor } = useQuery<Vendor>({
    queryKey: ["/api/vendors", vendorId],
    enabled: !!vendorId,
  });

  const hashSection = window.location.hash.replace("#", "") as VendorSectionId;
  const routeSection =
    location.startsWith("/vendor/relationships")
      ? VENDOR_SECTION_IDS.restaurants
      : location.startsWith("/vendor/orders")
        ? VENDOR_SECTION_IDS.orders
        : location.startsWith("/vendor/shipping")
          ? ("shipping" as any)
          : location.startsWith("/vendor/products")
            ? VENDOR_SECTION_IDS.products
            : location.startsWith("/vendor/employees")
              ? ("employees" as any)
              : location === "/vendor/portal" && Object.values(VENDOR_SECTION_IDS).includes(hashSection)
                ? hashSection
                : VENDOR_SECTION_IDS.dashboard;
  const activeSection = portalNav?.activeSection ?? routeSection;
  const activePageLabel = sidebarLinks.find((item) => item.id === activeSection)?.label ?? "Dashboard";

  function handleNavClick(item: (typeof sidebarLinks)[number]) {
    if (Object.values(VENDOR_SECTION_IDS).includes(item.id as VendorSectionId)) {
      portalNav?.setActiveSection(item.id as VendorSectionId);
    }
    navigate(item.href);
  }

  return (
    <div className="h-full bg-background flex overflow-hidden" data-testid="vendor-layout">
      <aside className="w-[300px] h-full border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
        <div className="h-12 flex items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="min-w-0">
            <p className="text-base font-semibold text-sidebar-foreground">{portalLabels.sidebarTitle}</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {sidebarLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-base transition-colors text-left mb-1 ${
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                data-testid={`nav-vendor-${item.id}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-sidebar-border mt-auto">
          <p className="text-sm font-medium text-foreground">{vendor?.name?.split(/\s+/).slice(0, 2).join(" ") ?? "Loading..."}</p>
          <p className="text-xs text-muted-foreground">{portalLabels.footerRole}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-12 border-b border-border bg-background flex items-center px-8 shrink-0 gap-4">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground truncate">{vendor?.name ?? "Vendor"}</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-foreground truncate">{activePageLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <PortalRoleSwitcher />
            <NotificationBell />
            <ProfileMenu
              user={user}
              roleLabel={portalLabels.roleLabel}
              onLogout={logout}
              profileHref="/vendor/profile"
              settingsHref={canAccessVendorSettings(role) ? "/vendor/settings" : undefined}
            />
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto bg-muted/40">{children}</main>
      </div>
    </div>
  );
}
