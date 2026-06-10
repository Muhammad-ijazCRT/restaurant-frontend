import { apiRequest } from "@/api/client";

export const restaurantEmployeeKeys = {
  list: (restaurantId: string) =>
    ["/api/restaurant-orgs", restaurantId, "employees"] as const,
  permissions: (restaurantId: string, employeeId: string) =>
    ["/api/restaurant-orgs", restaurantId, "employees", employeeId, "permissions"] as const,
} as const;

export const restaurantEmployeePaths = {
  list: (restaurantId: string) => `/api/restaurant-orgs/${restaurantId}/employees`,
  create: (restaurantId: string) => `/api/restaurant-orgs/${restaurantId}/employees`,
  update: (restaurantId: string, employeeId: string) =>
    `/api/restaurant-orgs/${restaurantId}/employees/${employeeId}`,
  delete: (restaurantId: string, employeeId: string) =>
    `/api/restaurant-orgs/${restaurantId}/employees/${employeeId}`,
  permissions: (restaurantId: string, employeeId: string) =>
    `/api/restaurant-orgs/${restaurantId}/employees/${employeeId}/permissions`,
} as const;

export const restaurantEmployeeApi = {
  create: (restaurantId: string, data: unknown) =>
    apiRequest("POST", restaurantEmployeePaths.create(restaurantId), data),
  update: (restaurantId: string, employeeId: string, data: unknown) =>
    apiRequest("PATCH", restaurantEmployeePaths.update(restaurantId, employeeId), data),
  delete: (restaurantId: string, employeeId: string) =>
    apiRequest("DELETE", restaurantEmployeePaths.delete(restaurantId, employeeId)),
  updatePermissions: (restaurantId: string, employeeId: string, data: unknown) =>
    apiRequest("PATCH", restaurantEmployeePaths.permissions(restaurantId, employeeId), data),
};
