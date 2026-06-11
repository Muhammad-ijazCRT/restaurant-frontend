import { useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { useVendorPortalNav } from "@/contexts/vendor-portal-nav-context";
import { VENDOR_SECTION_IDS, type VendorSectionId } from "@/lib/vendor-portal-sections";
import { vendorKeys } from "@/api/vendor/vendors";
import type { Vendor } from "@shared/schema";
import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PortalRoleSwitcher } from "@/components/shared/portal-role-switcher";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { getUserData, getUserRole, resolveRoleHomePath } from "@/lib/portal-auth";
import { PortalShell } from "@/components/shared/portal-shell";
import { PortalSidebarBrand } from "@/components/shared/rodex-brand";
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
    queryKey: vendorKeys.detail(vendorId),
    enabled: !!vendorId,
  });

  const [hashSection, setHashSection] = useState<VendorSectionId | null>(null);

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "") as VendorSectionId;
      setHashSection(Object.values(VENDOR_SECTION_IDS).includes(hash) ? hash : null);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

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
              : location === "/vendor/portal" && hashSection
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
    <PortalShell
      testId="vendor-layout"
      sidebarWidthClass="lg:w-[300px]"
      brand={<PortalSidebarBrand subtitle={portalLabels.sidebarTitle} href="/vendor/portal" />}
      nav={
        <>
          {sidebarLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item)}
                className={`mb-1 flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-left text-base transition-colors ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                data-testid={`nav-vendor-${item.id}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </>
      }
      footer={
        <>
          <p className="text-sm font-medium text-foreground">
            {vendor?.name?.split(/\s+/).slice(0, 2).join(" ") ?? "Loading..."}
          </p>
          <p className="text-xs text-muted-foreground">{portalLabels.footerRole}</p>
        </>
      }
      headerTitle={
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="hidden h-4 w-4 shrink-0 text-primary sm:block" />
          <span className="hidden truncate text-muted-foreground sm:inline">{vendor?.name ?? "Vendor"}</span>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="truncate font-semibold text-foreground">{activePageLabel}</span>
        </div>
      }
      headerActions={
        <>
          <PortalRoleSwitcher />
          <NotificationBell />
          <ProfileMenu
            user={user}
            roleLabel={portalLabels.roleLabel}
            onLogout={logout}
            profileHref="/vendor/profile"
            settingsHref={canAccessVendorSettings(role) ? "/vendor/settings" : undefined}
          />
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
