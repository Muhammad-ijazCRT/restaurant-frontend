export const notesKeys = {
  list: (entityType: string, entityId: string) =>
    ["/api/notes", entityType, entityId] as const,
} as const;

export const notesPaths = {
  list: (entityType: string, entityId: string) =>
    `/api/notes/${entityType}/${entityId}`,
  create: (entityType: string, entityId: string) =>
    `/api/notes/${entityType}/${entityId}`,
  delete: (id: string) => `/api/notes/${id}`,
} as const;
