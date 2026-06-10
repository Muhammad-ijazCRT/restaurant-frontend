export const attachmentKeys = {
  list: (entityType: string, entityId: string) =>
    ["/api/attachments", entityType, entityId] as const,
  view: (id: string) => ["/api/attachments", id, "view"] as const,
} as const;

export const attachmentPaths = {
  list: (entityType: string, entityId: string) =>
    `/api/attachments/${entityType}/${entityId}`,
  create: (entityType: string, entityId: string) =>
    `/api/attachments/${entityType}/${entityId}`,
  view: (id: string) => `/api/attachments/${id}/view`,
  download: (id: string) => `/api/attachments/${id}/download`,
  delete: (id: string) => `/api/attachments/${id}`,
} as const;
