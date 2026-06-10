export const VENDOR_SECTION_IDS = {
  dashboard: "vendor-dashboard",
  restaurants: "vendor-restaurants",
  submitted: "vendor-submitted",
  delivered: "vendor-delivered",
  approval: "vendor-approval",
  disputed: "vendor-disputed",
  invoiced: "vendor-invoiced",
  orders: "vendor-orders",
  products: "vendor-products",
  settings: "vendor-settings",
} as const;

export type VendorSectionId = (typeof VENDOR_SECTION_IDS)[keyof typeof VENDOR_SECTION_IDS];

export interface VendorNavItem {
  id: VendorSectionId;
  label: string;
  group?: "overview" | "orders" | "catalog";
}

export const VENDOR_NAV_ITEMS: VendorNavItem[] = [
  { id: VENDOR_SECTION_IDS.dashboard, label: "Dashboard", group: "overview" },
  { id: VENDOR_SECTION_IDS.restaurants, label: "My Restaurants", group: "overview" },
  { id: VENDOR_SECTION_IDS.submitted, label: "Submitted Orders", group: "orders" },
  { id: VENDOR_SECTION_IDS.delivered, label: "Delivered", group: "orders" },
  { id: VENDOR_SECTION_IDS.approval, label: "Needs Approval", group: "orders" },
  { id: VENDOR_SECTION_IDS.disputed, label: "Disputed", group: "orders" },
  { id: VENDOR_SECTION_IDS.invoiced, label: "Invoiced", group: "orders" },
  { id: VENDOR_SECTION_IDS.orders, label: "Order History", group: "orders" },
  { id: VENDOR_SECTION_IDS.products, label: "Product Catalog", group: "catalog" },
  { id: VENDOR_SECTION_IDS.settings, label: "Cutoff Settings", group: "overview" },
];

export const VENDOR_SECTION_COUNTS: Partial<Record<VendorSectionId, keyof VendorPortalCounts>> = {
  [VENDOR_SECTION_IDS.restaurants]: "restaurants",
  [VENDOR_SECTION_IDS.submitted]: "submitted",
  [VENDOR_SECTION_IDS.delivered]: "delivered",
  [VENDOR_SECTION_IDS.approval]: "approval",
  [VENDOR_SECTION_IDS.disputed]: "disputed",
  [VENDOR_SECTION_IDS.invoiced]: "invoiced",
  [VENDOR_SECTION_IDS.orders]: "orders",
  [VENDOR_SECTION_IDS.products]: "products",
};

export interface VendorPortalCounts {
  restaurants: number;
  submitted: number;
  delivered: number;
  approval: number;
  disputed: number;
  invoiced: number;
  orders: number;
  products: number;
}
