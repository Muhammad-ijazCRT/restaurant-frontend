export const contactPaths = {
  submit: "/api/contact",
  detail: (id: string) => `/api/admin/contact-submissions/${id}`,
} as const;

export const contactKeys = {
  detail: (id: string) => [contactPaths.detail(id)] as const,
} as const;

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
};
