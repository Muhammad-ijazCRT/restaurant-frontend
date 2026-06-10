export const adminDashboardKeys = {
  stats: () => ["/api/admin/stats"] as const,
  recentActivity: () => ["/api/admin/recent-activity"] as const,
  activityLog: (query?: string) =>
    query ? ([`/api/admin/activity-log?${query}`] as const) : (["/api/admin/activity-log"] as const),
  activityLogsAll: () => ["/api/activity-logs/all"] as const,
  adminOrder: (orderId: string) => ["/api/admin/orders", orderId] as const,
} as const;

export const adminDashboardPaths = {
  stats: "/api/admin/stats",
  recentActivity: "/api/admin/recent-activity",
  activityLog: "/api/admin/activity-log",
  order: (orderId: string) => `/api/admin/orders/${orderId}`,
} as const;
