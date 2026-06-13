export const profileKeys = {
  profile: () => ["/api/profile"] as const,
  notifications: () => ["/api/notifications"] as const,
  notificationClear: () => ["/api/notifications/clear"] as const,
} as const;

export const profilePaths = {
  profile: "/api/profile",
  changePassword: "/api/profile/password",
  notifications: "/api/notifications",
  notificationClear: "/api/notifications/clear",
} as const;
