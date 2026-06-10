import { apiRequest } from "@/api/client";

export const restaurantOrderKeys = {
  list: (restaurantId: string) =>
    ["/api/restaurant-orgs", restaurantId, "orders"] as const,
  detail: (restaurantId: string, orderId: string) =>
    ["/api/restaurant-orgs", restaurantId, "orders", orderId] as const,
  draft: (restaurantId: string, vendorId: string) =>
    ["/api/restaurant-orgs", restaurantId, "draft-order", vendorId] as const,
  submitted: (restaurantId: string, vendorId: string) =>
    ["/api/restaurant-orgs", restaurantId, "submitted-order", vendorId] as const,
  submittedList: (restaurantId: string, vendorId: string) =>
    ["/api/restaurant-orgs", restaurantId, "submitted-orders", vendorId] as const,
  submittedAll: (restaurantId: string) =>
    ["/api/restaurant-orgs", restaurantId, "submitted-orders"] as const,
} as const;

export const restaurantOrderPaths = {
  list: (restaurantId: string) => `/api/restaurant-orgs/${restaurantId}/orders`,
  create: (restaurantId: string) => `/api/restaurant-orgs/${restaurantId}/orders`,
  detail: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}`,
  update: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}`,
  delete: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}`,
  pay: (restaurantId: string, orderId: string) =>
    `/api/restaurant-orgs/${restaurantId}/orders/${orderId}/pay`,
} as const;

export const restaurantOrderApi = {
  create: (restaurantId: string, data: unknown) =>
    apiRequest("POST", restaurantOrderPaths.create(restaurantId), data),
  update: (restaurantId: string, orderId: string, data: unknown) =>
    apiRequest("PATCH", restaurantOrderPaths.update(restaurantId, orderId), data),
  delete: (restaurantId: string, orderId: string) =>
    apiRequest("DELETE", restaurantOrderPaths.delete(restaurantId, orderId)),
  pay: (restaurantId: string, orderId: string, data?: unknown) =>
    apiRequest("PATCH", restaurantOrderPaths.pay(restaurantId, orderId), data),
};
