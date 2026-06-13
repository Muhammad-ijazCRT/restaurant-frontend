import type { LucideIcon } from "lucide-react";
import { ClipboardList, LayoutDashboard, Package, Truck, Warehouse } from "lucide-react";

export type ShippingNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const DRIVER_ALLOWED_ROUTE_PREFIXES = [
  "/shipping-company/dashboard",
  "/shipping-company/orders",
  "/shipping-company/profile",
  "/shipping-company/settings",
];

export function getShippingPortalLabels(role: string | null) {
  switch (role) {
    case "driver":
      return {
        consoleLabel: "Vendor Portal",
        roleLabel: "Vendor Driver",
        profileRoleLabel: "Vendor Driver",
      };
    case "warehouse_worker":
    case "warehouse":
      return {
        consoleLabel: "Vendor Portal",
        roleLabel: "Vendor Warehouse",
        profileRoleLabel: "Warehouse",
      };
    case "manager":
      return {
        consoleLabel: "Shipping Console",
        roleLabel: "Manager",
        profileRoleLabel: "Manager",
      };
    case "vendor_admin":
      return {
        consoleLabel: "Shipping Console",
        roleLabel: "Vendor Admin",
        profileRoleLabel: "Vendor Admin",
      };
    default:
      return {
        consoleLabel: "Shipping Console",
        roleLabel: "Shipping Team",
        profileRoleLabel: "Shipping Team",
      };
  }
}

export function getShippingNavItems(role: string | null): ShippingNavItem[] {
  const dashboard = {
    href: "/shipping-company/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  };

  if (role === "driver") {
    return [
      dashboard,
      { href: "/shipping-company/orders", label: "Deliveries", icon: Truck },
    ];
  }

  if (role === "vendor_admin" || role === "manager") {
    return [
      dashboard,
      { href: "/shipping-company/orders", label: "Orders", icon: ClipboardList },
      { href: "/shipping-company/catalog", label: "Catalog", icon: Package },
    ];
  }

  if (role === "warehouse_worker" || role === "warehouse") {
    return [
      dashboard,
      { href: "/shipping-company/orders", label: "Warehouse Orders", icon: Warehouse },
    ];
  }

  return [dashboard];
}

export function canAccessShippingSettings(role: string | null): boolean {
  return (
    role === "vendor_admin" ||
    role === "manager" ||
    role === "driver"
  );
}

export function isShippingRouteAllowed(role: string | null, path: string): boolean {
  if (role === "warehouse_worker" || role === "warehouse") return false;
  if (role !== "driver") return true;
  return DRIVER_ALLOWED_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
