import { apiRequest } from "@/api/client";

export const adminRestaurantKeys = {
  list: (includeArchived = true) =>
    includeArchived
      ? (["/api/restaurant-orgs?includeArchived=true"] as const)
      : (["/api/restaurant-orgs"] as const),
  completeness: () => ["/api/restaurant-orgs/completeness"] as const,
  detail: (id: string) => ["/api/restaurant-orgs", id] as const,
  catalog: (restaurantId: string, vendorId: string) =>
    ["/api/restaurant-orgs", restaurantId, "catalog", vendorId] as const,
} as const;

export const adminRestaurantPaths = {
  list: "/api/restaurant-orgs",
  listArchived: "/api/restaurant-orgs?includeArchived=true",
  completeness: "/api/restaurant-orgs/completeness",
  detail: (id: string) => `/api/restaurant-orgs/${id}`,
  archive: (id: string) => `/api/restaurant-orgs/${id}/archive`,
  restore: (id: string) => `/api/restaurant-orgs/${id}/restore`,
  catalog: (restaurantId: string, vendorId: string) =>
    `/api/restaurant-orgs/${restaurantId}/catalog/${vendorId}`,
} as const;

export const adminRestaurantApi = {
  create: (data: unknown) => apiRequest("POST", adminRestaurantPaths.list, data),
  update: (id: string, data: unknown) =>
    apiRequest("PATCH", adminRestaurantPaths.detail(id), data),
  archive: (id: string) => apiRequest("PATCH", adminRestaurantPaths.archive(id)),
  restore: (id: string) => apiRequest("PATCH", adminRestaurantPaths.restore(id)),
  delete: (id: string) => apiRequest("DELETE", adminRestaurantPaths.detail(id)),
};
