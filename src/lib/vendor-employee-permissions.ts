export type VendorEmployeeRole =
  | "manager"
  | "sales_representative"
  | "driver"
  | "warehouse";

export const ROLE_OPTIONS = [
  { value: "manager" as const, label: "Manager" },
  { value: "sales_representative" as const, label: "Sales Representative" },
  { value: "driver" as const, label: "Driver" },
  { value: "warehouse" as const, label: "Warehouse" },
];

export function roleLabel(role: string) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}

export function normalizeEmployeeRoles(value: unknown): VendorEmployeeRole[] {
  const validRoles = new Set(ROLE_OPTIONS.map((role) => role.value));
  let rawRoles: unknown[] = [];

  if (Array.isArray(value)) {
    rawRoles = value;
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      rawRoles = Array.isArray(parsed) ? parsed : value.split(",");
    } catch {
      rawRoles = value.split(",");
    }
  }

  return rawRoles
    .map((role) => String(role).trim().toLowerCase())
    .filter((role): role is VendorEmployeeRole => validRoles.has(role as VendorEmployeeRole));
}

export function employeeCanManageAssignments(roles: unknown): boolean {
  const normalized = normalizeEmployeeRoles(roles);
  return normalized.includes("manager") || normalized.includes("sales_representative");
}
