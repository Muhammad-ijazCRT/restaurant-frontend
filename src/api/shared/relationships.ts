import { apiRequest } from "@/api/client";

export const relationshipKeys = {
  all: () => ["/api/relationships"] as const,
  detail: (id: string) => ["/api/relationships", id] as const,
  orderSheet: (id: string) => ["/api/relationships", id, "order-sheet"] as const,
  adminOrders: (id: string) => ["/api/admin/relationships", id, "orders"] as const,
} as const;

export const relationshipPaths = {
  all: "/api/relationships",
  detail: (id: string) => `/api/relationships/${id}`,
  orderSheet: (id: string) => `/api/relationships/${id}/order-sheet`,
  orderSheetItem: (relationshipId: string, productId: string) =>
    `/api/relationships/${relationshipId}/order-sheet/${productId}`,
} as const;

export const relationshipApi = {
  create: (data: unknown) => apiRequest("POST", relationshipPaths.all, data),
  update: (id: string, data: unknown) =>
    apiRequest("PATCH", relationshipPaths.detail(id), data),
  delete: (id: string) => apiRequest("DELETE", relationshipPaths.detail(id)),
  addOrderSheetItem: (relationshipId: string, data: unknown) =>
    apiRequest("POST", relationshipPaths.orderSheet(relationshipId), data),
  removeOrderSheetItem: (relationshipId: string, productId: string) =>
    apiRequest("DELETE", relationshipPaths.orderSheetItem(relationshipId, productId)),
};
