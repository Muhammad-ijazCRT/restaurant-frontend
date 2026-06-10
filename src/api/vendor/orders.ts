import { apiRequest } from "@/api/client";

export const vendorOrderKeys = {
  list: (vendorId: string) => ["/api/vendors", vendorId, "orders"] as const,
  detail: (vendorId: string, orderId: string) =>
    ["/api/vendors", vendorId, "orders", orderId] as const,
  fulfillments: (vendorId: string, orderId: string) =>
    ["/api/vendors", vendorId, "orders", orderId, "fulfillments"] as const,
} as const;

export const vendorOrderPaths = {
  list: (vendorId: string) => `/api/vendors/${vendorId}/orders`,
  detail: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}`,
  approve: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/approve`,
  reject: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/reject`,
  assign: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/assign`,
  picking: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/picking`,
  approvePicking: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/approve-picking`,
  substitutions: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/substitutions`,
  deliver: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/deliver`,
  resolveIssue: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/resolve-issue`,
  fulfillments: (vendorId: string, orderId: string) =>
    `/api/vendors/${vendorId}/orders/${orderId}/fulfillments`,
} as const;

export const vendorOrderApi = {
  approve: (vendorId: string, orderId: string, data?: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.approve(vendorId, orderId), data),
  reject: (vendorId: string, orderId: string, data?: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.reject(vendorId, orderId), data),
  assign: (vendorId: string, orderId: string, data: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.assign(vendorId, orderId), data),
  picking: (vendorId: string, orderId: string, data: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.picking(vendorId, orderId), data),
  approvePicking: (vendorId: string, orderId: string, data?: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.approvePicking(vendorId, orderId), data),
  createSubstitution: (vendorId: string, orderId: string, data: unknown) =>
    apiRequest("POST", vendorOrderPaths.substitutions(vendorId, orderId), data),
  deliver: (vendorId: string, orderId: string, data?: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.deliver(vendorId, orderId), data),
  resolveIssue: (vendorId: string, orderId: string, data: unknown) =>
    apiRequest("PATCH", vendorOrderPaths.resolveIssue(vendorId, orderId), data),
};
