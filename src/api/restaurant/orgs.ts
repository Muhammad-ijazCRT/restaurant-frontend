export const restaurantOrgKeys = {
  list: (includeArchived = false) =>
    includeArchived
      ? (["/api/restaurant-orgs?includeArchived=true"] as const)
      : (["/api/restaurant-orgs"] as const),
  detail: (id: string) => ["/api/restaurant-orgs", id] as const,
  orders: (restaurantId: string) =>
    ["/api/restaurant-orgs", restaurantId, "orders"] as const,
  catalog: (restaurantId: string, vendorId: string) =>
    ["/api/restaurant-orgs", restaurantId, "catalog", vendorId] as const,
  vendor: (restaurantId: string, vendorId: string) =>
    ["/api/restaurant-orgs", restaurantId, "vendors", vendorId] as const,
} as const;

export const restaurantOrgPaths = {
  list: "/api/restaurant-orgs",
  detail: (id: string) => `/api/restaurant-orgs/${id}`,
  orders: (restaurantId: string) => `/api/restaurant-orgs/${restaurantId}/orders`,
  payOrder: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}/pay`,
} as const;
