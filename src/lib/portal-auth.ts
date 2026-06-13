export type UserRole =
  | "super_admin"
  | "restaurant"
  | "restaurant_manager"
  | "restaurant_employee"
  | "vendor_admin"
  | "manager"
  | "warehouse_worker"
  | "driver"
  | "sales_representative";

export interface AuthUser {
  id: number | string;
  email?: string;
  name?: string;
  role?: string;
  vendor_id?: number | string;
  [key: string]: unknown;
}

export interface LoginResponse {
  status: string;
  message?: string;
  token?: string;
  user?: AuthUser;
  redirect?: string;
  errors?: Record<string, string[] | string> | string[] | string;
}

const AUTH_TOKEN_KEY = "auth_token";
const USER_ROLE_KEY = "user_role";
const USER_DATA_KEY = "user_data";
const FLASH_STORAGE_KEY = "app.flash.message";
const SESSION_PASSWORD_KEY = "portal.session.password";

import { apiUrl } from "@/api/client";
import { authPaths } from "@/api/shared/auth";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAuthToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getUserRole(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(USER_ROLE_KEY);
}

export function getUserData(): AuthUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeSessionPassword(password: string): void {
  if (typeof sessionStorage === "undefined") return;
  if (password) sessionStorage.setItem(SESSION_PASSWORD_KEY, password);
}

export function getSessionPassword(): string {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(SESSION_PASSWORD_KEY) ?? "";
}

export function clearSessionPassword(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SESSION_PASSWORD_KEY);
}

export function setAuthSession(
  token: string,
  role: string,
  user: AuthUser,
  password?: string,
): void {
  if (!canUseStorage()) return;
  const resolvedRole = resolveEffectiveRole(role, user);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(USER_ROLE_KEY, resolvedRole);
  localStorage.setItem(USER_DATA_KEY, JSON.stringify({ ...user, role: resolvedRole }));
  if (password) storeSessionPassword(password);
}

const SWITCHABLE_VENDOR_ROLES = new Set([
  "manager",
  "sales_representative",
  "warehouse_worker",
  "driver",
]);

const PORTAL_ROLE_LABELS: Record<string, string> = {
  manager: "Manager Portal",
  sales_representative: "Sales Representative Portal",
  warehouse_worker: "Warehouse Portal",
  driver: "Driver Portal",
};

export function normalizePortalEmployeeRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  return normalized === "warehouse" ? "warehouse_worker" : normalized;
}

export function getUserAssignedRoles(user: AuthUser | null): string[] {
  if (!user || !Array.isArray(user.roles)) return [];
  const canonical = user.roles
    .map((item) => normalizePortalEmployeeRole(String(item)))
    .filter((role) => SWITCHABLE_VENDOR_ROLES.has(role));
  return [...new Set(canonical)];
}

export function getAlternatePortalRoles(currentRole: string | null): Array<{
  role: string;
  label: string;
  homePath: string;
}> {
  const user = getUserData();
  const activeRole = normalizePortalEmployeeRole(currentRole ?? getUserRole() ?? "");
  return getUserAssignedRoles(user)
    .filter((role) => role !== activeRole)
    .map((role) => ({
      role,
      label: PORTAL_ROLE_LABELS[role] ?? role,
      homePath: resolveRoleHomePath(role),
    }));
}

export async function switchPortalRole(role: string): Promise<string> {
  const token = getAuthToken();
  const user = getUserData();
  if (!token || !user) {
    throw new Error("You must be logged in to switch roles.");
  }

  const response = await fetch(apiUrl(authPaths.switchRole), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });

  const data = (await response.json()) as LoginResponse & {
    user?: AuthUser;
    redirect?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? "Failed to switch role");
  }

  const nextUser = data.user ?? user;
  const nextRole = String(nextUser.role ?? role);
  const nextToken = data.token ?? token;
  setAuthSession(nextToken, nextRole, { ...user, ...nextUser, role: nextRole });
  return resolvePostLoginPath(nextRole, data.redirect, resolveRoleHomePath(nextRole));
}

export function resolveEffectiveRole(role: string, user: AuthUser): string {
  const roles = Array.isArray(user.roles)
    ? user.roles.map((item) => String(item).trim().toLowerCase())
    : [];

  if (role === "manager" && roles.length > 0 && !roles.includes("manager")) {
    if (roles.includes("driver")) return "driver";
    if (roles.includes("warehouse") || roles.includes("warehouse_worker")) return "warehouse_worker";
  }

  return role === "warehouse" ? "warehouse_worker" : role;
}

export function clearAuthSession(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  clearSessionPassword();
}

export function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function getDashboardPathForRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "restaurant":
      return "/restaurant/dashboard";
    case "vendor_admin":
    case "vendor":
      return "/vendor/dashboard";
    case "sales_representative":
    case "manager":
    case "warehouse_worker":
      return "/vendor/portal";
    case "driver":
      return "/shipping-company/dashboard";
    default:
      return "/";
  }
}

export function normalizeLoginRedirect(redirect: string | null | undefined): string | null {
  if (!redirect) return null;
  const trimmed = redirect.trim();
  if (!trimmed) return null;
  if (trimmed === "/admin/dashboard" || trimmed.startsWith("/admin/dashboard/")) {
    return "/super-admin/dashboard";
  }
  return trimmed;
}

export function isVendorPortalRedirect(path: string): boolean {
  return (
    path === "/vendor/dashboard" ||
    path === "/vendor/portal" ||
    path.startsWith("/vendor/dashboard/")
  );
}

export function resolveRoleHomePath(role: string | null | undefined): string {
  if (!role) return "/";
  switch (role) {
    case "vendor_admin":
    case "vendor":
      return "/vendor/portal";
    case "sales_representative":
    case "manager":
    case "warehouse_worker":
    case "warehouse":
      return "/vendor/portal";
    case "driver":
      return "/shipping-company/dashboard";
    case "super_admin":
      return "/super-admin/dashboard";
    case "restaurant":
    case "restaurant_manager":
    case "restaurant_employee":
      return "/restaurant/portal";
    default:
      return getReactDashboardPath(role) || "/";
  }
}

export function resolvePostLoginPath(
  role: string | null,
  redirect: string | null | undefined,
  defaultDashboardPath: string,
): string {
  const normalizedRedirect = normalizeLoginRedirect(redirect);
  const roleHome = resolveRoleHomePath(role);

  if (normalizedRedirect) {
    if (isVendorPortalRedirect(normalizedRedirect) && roleHome !== "/vendor/portal") {
      return roleHome;
    }
    return normalizedRedirect;
  }

  if (roleHome && roleHome !== "/") return roleHome;
  return defaultDashboardPath;
}

export function getReactDashboardPath(role: string): string {
  switch (role) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "restaurant":
    case "restaurant_manager":
    case "restaurant_employee":
      return "/restaurant/portal";
    case "vendor_admin":
    case "vendor":
      return "/vendor/portal";
    case "sales_representative":
    case "manager":
    case "warehouse_worker":
      return "/vendor/portal";
    case "driver":
      return "/shipping-company/dashboard";
    default:
      return "/";
  }
}

export function resolvePortalEntityId(user: AuthUser, role: string): string | null {
  const id = user.restaurant_id ?? user.vendor_id ?? user.id;
  if (id == null) return null;
  return String(id);
}

export function normalizeFlashMessage(message: unknown): string {
  if (Array.isArray(message)) {
    return message.map(normalizeFlashMessage).filter(Boolean).join("\n");
  }
  if (message && typeof message === "object") {
    return Object.values(message as Record<string, unknown>)
      .flat()
      .map(normalizeFlashMessage)
      .filter(Boolean)
      .join("\n");
  }
  return String(message ?? "").trim();
}

export function storePendingFlash(
  message: string,
  type: "success" | "error" | "warning" | "info" = "info",
  options: { title?: string; duration?: number } = {},
): void {
  const text = normalizeFlashMessage(message);
  if (!text || typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    FLASH_STORAGE_KEY,
    JSON.stringify({ message: text, type, options }),
  );
}

export interface PendingFlash {
  message: string;
  type: "success" | "error" | "warning" | "info";
  options?: { title?: string; duration?: number };
}

export function consumePendingFlash(): PendingFlash | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(FLASH_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(FLASH_STORAGE_KEY);
  try {
    return JSON.parse(raw) as PendingFlash;
  } catch {
    return null;
  }
}

export function isAuthenticatedForRoles(expectedRoles: string[]): boolean {
  const token = getAuthToken();
  const role = getUserRole();
  return Boolean(token && role && expectedRoles.includes(role));
}

export async function loginWithApi(
  endpoint: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; data: LoginResponse; status: number }> {
  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json()) as LoginResponse;
  return { ok: response.ok, data, status: response.status };
}

export interface RegisterPayload {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  password: string;
}

export async function registerWithApi(
  endpoint: string,
  payload: RegisterPayload,
): Promise<{ ok: boolean; data: LoginResponse; status: number }> {
  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as LoginResponse;
  return { ok: response.ok, data, status: response.status };
}
