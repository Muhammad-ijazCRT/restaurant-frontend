import type { LucideIcon } from "lucide-react";
import { Building2, Inbox, LayoutDashboard, Package, Truck, UserCircle } from "lucide-react";
import { VENDOR_SECTION_IDS, type VendorSectionId } from "@/lib/vendor-portal-sections";

export interface VendorPortalLabels {
  sidebarTitle: string;
  roleLabel: string;
  footerRole: string;
}

export type VendorSidebarLink = {
  id: VendorSectionId | "shipping" | "employees";
  label: string;
  icon: LucideIcon;
  href: string;
};

const ALL_VENDOR_SIDEBAR_LINKS: VendorSidebarLink[] = [
  { id: VENDOR_SECTION_IDS.dashboard, label: "Dashboard", icon: LayoutDashboard, href: "/vendor/portal" },
  { id: VENDOR_SECTION_IDS.restaurants, label: "Relationships", icon: Building2, href: "/vendor/relationships" },
  { id: VENDOR_SECTION_IDS.orders, label: "Orders", icon: Inbox, href: "/vendor/orders" },
  { id: "shipping", label: "Shipping", icon: Truck, href: "/vendor/shipping" },
  { id: VENDOR_SECTION_IDS.products, label: "Product Catalog", icon: Package, href: "/vendor/products" },
  { id: "employees", label: "Employees", icon: UserCircle, href: "/vendor/employees" },
];

const SALES_REP_ALLOWED_ROUTE_PREFIXES = [
  "/vendor/portal",
  "/vendor/relationships",
  "/vendor/orders",
  "/vendor/products",
  "/vendor/profile",
  "/vendor/settings",
];

const WAREHOUSE_ALLOWED_ROUTE_PREFIXES = [
  "/vendor/portal",
  "/vendor/orders",
  "/vendor/products",
  "/vendor/profile",
  "/vendor/settings",
];

export function getVendorPortalLabels(role: string | null): VendorPortalLabels {
  switch (role) {
    case "vendor_admin":
    case "vendor":
      return {
        sidebarTitle: "Vendor Admin Portal",
        roleLabel: "Vendor Owner",
        footerRole: "Vendor Owner",
      };
    case "manager":
      return {
        sidebarTitle: "Vendor Manager Portal",
        roleLabel: "Vendor Manager",
        footerRole: "Manager",
      };
    case "sales_representative":
      return {
        sidebarTitle: "Vendor Sales Representative Portal",
        roleLabel: "Sales Representative",
        footerRole: "Sales Representative",
      };
    case "warehouse_worker":
    case "warehouse":
      return {
        sidebarTitle: "Vendor Warehouse Portal",
        roleLabel: "Vendor Warehouse",
        footerRole: "Vendor Warehouse",
      };
    case "driver":
      return {
        sidebarTitle: "Driver Portal",
        roleLabel: "Driver",
        footerRole: "Driver",
      };
    default:
      return {
        sidebarTitle: "Vendor Console",
        roleLabel: "Vendor Portal",
        footerRole: "Vendor",
      };
  }
}

export function canManageVendorEmployees(role: string | null): boolean {
  return role === "vendor_admin" || role === "vendor";
}

export function isWarehouseWorkerRole(role: string | null): boolean {
  return role === "warehouse_worker" || role === "warehouse";
}

export function getVendorSidebarLinks(role: string | null): VendorSidebarLink[] {
  if (role === "sales_representative") {
    return ALL_VENDOR_SIDEBAR_LINKS.filter((link) =>
      [
        VENDOR_SECTION_IDS.dashboard,
        VENDOR_SECTION_IDS.restaurants,
        VENDOR_SECTION_IDS.orders,
        VENDOR_SECTION_IDS.products,
      ].includes(link.id as VendorSectionId),
    );
  }

  if (isWarehouseWorkerRole(role)) {
    return ALL_VENDOR_SIDEBAR_LINKS.filter((link) =>
      [VENDOR_SECTION_IDS.dashboard, VENDOR_SECTION_IDS.orders, VENDOR_SECTION_IDS.products].includes(
        link.id as VendorSectionId,
      ),
    );
  }

  if (role === "manager") {
    return ALL_VENDOR_SIDEBAR_LINKS.filter((link) => link.id !== "shipping");
  }

  return ALL_VENDOR_SIDEBAR_LINKS;
}

export function canAccessVendorSettings(role: string | null): boolean {
  return (
    role === "vendor_admin" ||
    role === "vendor" ||
    role === "manager" ||
    role === "sales_representative" ||
    role === "warehouse_worker" ||
    role === "warehouse"
  );
}

export function canManageVendorProducts(role: string | null): boolean {
  return !isWarehouseWorkerRole(role);
}

export function isVendorRouteAllowed(role: string | null, path: string): boolean {
  if (role === "sales_representative") {
    return SALES_REP_ALLOWED_ROUTE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }
  if (isWarehouseWorkerRole(role)) {
    return WAREHOUSE_ALLOWED_ROUTE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }
  return true;
}
