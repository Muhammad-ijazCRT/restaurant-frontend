import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Inbox,
  LayoutDashboard,
  ShoppingCart,
  UserCircle,
} from "lucide-react";

export type RestaurantNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
};

const ALL_RESTAURANT_NAV_ITEMS: RestaurantNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/restaurant/portal" },
  { id: "relationships", label: "Relationships", icon: Building2, href: "/restaurant/relationships" },
  { id: "place-order", label: "Place Order", icon: ShoppingCart, href: "/restaurant/place-order" },
  { id: "orders", label: "Orders", icon: Inbox, href: "/restaurant/orders" },
  { id: "employees", label: "Employees", icon: UserCircle, href: "/restaurant/employees" },
];

const EMPLOYEE_ALLOWED_ROUTE_PREFIXES = [
  "/restaurant/portal",
  "/restaurant/relationships",
  "/restaurant/place-order",
  "/restaurant/orders",
  "/restaurant/employees",
  "/restaurant/profile",
  "/restaurant/settings",
  "/restaurant/vendor",
];

export function getRestaurantPortalLabels(role: string | null) {
  switch (role) {
    case "restaurant_manager":
      return {
        sidebarTitle: "Restaurant Console",
        roleLabel: "Restaurant Manager",
        footerRole: "Restaurant Manager",
      };
    case "restaurant_employee":
      return {
        sidebarTitle: "Restaurant Console",
        roleLabel: "Restaurant Employee",
        footerRole: "Restaurant Employee",
      };
    default:
      return {
        sidebarTitle: "Restaurant Console",
        roleLabel: "Restaurant Owner",
        footerRole: "Restaurant Owner",
      };
  }
}

export function isRestaurantOwner(role: string | null): boolean {
  return role === "restaurant";
}

export function canManageRestaurantEmployees(role: string | null): boolean {
  return isRestaurantOwner(role);
}

export function canAccessRestaurantSettings(role: string | null): boolean {
  return (
    role === "restaurant" ||
    role === "restaurant_manager" ||
    role === "restaurant_employee"
  );
}

export function canReviewRestaurantOrders(role: string | null): boolean {
  return role === "restaurant" || role === "restaurant_manager";
}

export function isRestaurantEmployee(role: string | null): boolean {
  return role === "restaurant_employee";
}

export function getRestaurantNavItems(role: string | null): RestaurantNavItem[] {
  if (isRestaurantEmployee(role)) {
    return ALL_RESTAURANT_NAV_ITEMS.filter((item) => item.id !== "employees");
  }
  return ALL_RESTAURANT_NAV_ITEMS;
}

export function isRestaurantRouteAllowed(role: string | null, path: string): boolean {
  if (isRestaurantOwner(role)) return true;
  if (isRestaurantEmployee(role) && path.startsWith("/restaurant/employees")) return false;
  return EMPLOYEE_ALLOWED_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
