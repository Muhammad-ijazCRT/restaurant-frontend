import { apiRequest } from "@/api/client";

export const adminVendorKeys = {
  list: (includeArchived = true) =>
    includeArchived
      ? (["/api/vendors?includeArchived=true"] as const)
      : (["/api/vendors"] as const),
  completeness: () => ["/api/vendors/completeness"] as const,
  detail: (id: string) => ["/api/vendors", id] as const,
  products: (vendorId: string, includeArchived = false) =>
    includeArchived
      ? (["/api/vendors", vendorId, "products?includeArchived=true"] as const)
      : (["/api/vendors", vendorId, "products"] as const),
} as const;

export const adminVendorPaths = {
  list: "/api/vendors",
  listArchived: "/api/vendors?includeArchived=true",
  completeness: "/api/vendors/completeness",
  detail: (id: string) => `/api/vendors/${id}`,
  archive: (id: string) => `/api/vendors/${id}/archive`,
  restore: (id: string) => `/api/vendors/${id}/restore`,
  products: (vendorId: string) => `/api/vendors/${vendorId}/products`,
  product: (vendorId: string, productId: string) =>
    `/api/vendors/${vendorId}/products/${productId}`,
  productArchive: (vendorId: string, productId: string) =>
    `/api/vendors/${vendorId}/products/${productId}/archive`,
  productImport: (vendorId: string) => `/api/vendors/${vendorId}/products/import`,
  productReorder: (vendorId: string) => `/api/vendors/${vendorId}/products/reorder`,
} as const;

export const adminVendorApi = {
  create: (data: unknown) => apiRequest("POST", adminVendorPaths.list, data),
  update: (id: string, data: unknown) => apiRequest("PATCH", adminVendorPaths.detail(id), data),
  archive: (id: string) => apiRequest("PATCH", adminVendorPaths.archive(id)),
  restore: (id: string) => apiRequest("PATCH", adminVendorPaths.restore(id)),
  delete: (id: string) => apiRequest("DELETE", adminVendorPaths.detail(id)),
  createProduct: (vendorId: string, data: unknown) =>
    apiRequest("POST", adminVendorPaths.products(vendorId), data),
  updateProduct: (vendorId: string, productId: string, data: unknown) =>
    apiRequest("PATCH", adminVendorPaths.product(vendorId, productId), data),
  importProducts: (vendorId: string, rows: unknown) =>
    apiRequest("POST", adminVendorPaths.productImport(vendorId), { rows }),
  archiveProduct: (vendorId: string, productId: string) =>
    apiRequest("PATCH", adminVendorPaths.productArchive(vendorId, productId)),
  reorderProducts: (vendorId: string, items: unknown) =>
    apiRequest("POST", adminVendorPaths.productReorder(vendorId), { items }),
};
