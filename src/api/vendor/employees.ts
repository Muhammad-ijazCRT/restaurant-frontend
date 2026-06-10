import { apiRequest } from "@/api/client";

export const vendorEmployeeKeys = {
  list: (vendorId: string) => ["/api/vendors", vendorId, "employees"] as const,
  permissions: (vendorId: string, employeeId: string) =>
    ["/api/vendors", vendorId, "employees", employeeId, "permissions"] as const,
  assignments: (vendorId: string, employeeId: string) =>
    ["/api/vendors", vendorId, "employees", employeeId, "assignments"] as const,
  cutoffSettings: (vendorId: string) =>
    ["/api/vendors", vendorId, "cutoff-settings"] as const,
} as const;

export const vendorEmployeePaths = {
  list: (vendorId: string) => `/api/vendors/${vendorId}/employees`,
  create: (vendorId: string) => `/api/vendors/${vendorId}/employees`,
  update: (vendorId: string, employeeId: string) =>
    `/api/vendors/${vendorId}/employees/${employeeId}`,
  delete: (vendorId: string, employeeId: string) =>
    `/api/vendors/${vendorId}/employees/${employeeId}`,
  permissions: (vendorId: string, employeeId: string) =>
    `/api/vendors/${vendorId}/employees/${employeeId}/permissions`,
  assignments: (vendorId: string, employeeId: string) =>
    `/api/vendors/${vendorId}/employees/${employeeId}/assignments`,
  cutoffSettings: (vendorId: string) => `/api/vendors/${vendorId}/cutoff-settings`,
} as const;

export const vendorEmployeeApi = {
  create: (vendorId: string, data: unknown) =>
    apiRequest("POST", vendorEmployeePaths.create(vendorId), data),
  update: (vendorId: string, employeeId: string, data: unknown) =>
    apiRequest("PATCH", vendorEmployeePaths.update(vendorId, employeeId), data),
  delete: (vendorId: string, employeeId: string) =>
    apiRequest("DELETE", vendorEmployeePaths.delete(vendorId, employeeId)),
  updatePermissions: (vendorId: string, employeeId: string, data: unknown) =>
    apiRequest("PATCH", vendorEmployeePaths.permissions(vendorId, employeeId), data),
  updateAssignments: (vendorId: string, employeeId: string, data: unknown) =>
    apiRequest("PATCH", vendorEmployeePaths.assignments(vendorId, employeeId), data),
  updateCutoffSettings: (vendorId: string, data: unknown) =>
    apiRequest("PUT", vendorEmployeePaths.cutoffSettings(vendorId), data),
};
