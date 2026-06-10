export const vendorKeys = {
  detail: (id: string) => ["/api/vendors", id] as const,
  employeeDashboard: (vendorId: string, period?: string) =>
    period
      ? (["/api/vendors", vendorId, "employee-dashboard", period] as const)
      : (["/api/vendors", vendorId, "employee-dashboard"] as const),
} as const;

export const vendorPaths = {
  detail: (id: string) => `/api/vendors/${id}`,
  employeeDashboard: (vendorId: string) => `/api/vendors/${vendorId}/employee-dashboard`,
  employeeDashboardWithPeriod: (vendorId: string, period: string) =>
    `/api/vendors/${vendorId}/employee-dashboard?period=${period}`,
} as const;
