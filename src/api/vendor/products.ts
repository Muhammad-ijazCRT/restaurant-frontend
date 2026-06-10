import { apiRequest } from "@/api/client";

export const vendorProductKeys = {
  list: (vendorId: string, includeArchived = false) =>
    includeArchived
      ? (["/api/vendors", vendorId, "products?includeArchived=true"] as const)
      : (["/api/vendors", vendorId, "products"] as const),
} as const;

export const vendorProductPaths = {
  list: (vendorId: string) => `/api/vendors/${vendorId}/products`,
  create: (vendorId: string) => `/api/vendors/${vendorId}/products`,
  update: (vendorId: string, productId: string) =>
    `/api/vendors/${vendorId}/products/${productId}`,
  archive: (vendorId: string, productId: string) =>
    `/api/vendors/${vendorId}/products/${productId}/archive`,
  import: (vendorId: string) => `/api/vendors/${vendorId}/products/import`,
  reorder: (vendorId: string) => `/api/vendors/${vendorId}/products/reorder`,
} as const;

export const vendorProductApi = {
  create: (vendorId: string, data: unknown) =>
    apiRequest("POST", vendorProductPaths.create(vendorId), data),
  update: (vendorId: string, productId: string, data: unknown) =>
    apiRequest("PATCH", vendorProductPaths.update(vendorId, productId), data),
  archive: (vendorId: string, productId: string) =>
    apiRequest("PATCH", vendorProductPaths.archive(vendorId, productId)),
  import: (vendorId: string, rows: unknown) =>
    apiRequest("POST", vendorProductPaths.import(vendorId), { rows }),
};
