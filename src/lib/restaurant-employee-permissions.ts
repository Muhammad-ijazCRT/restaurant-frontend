export type RestaurantEmployeeRole = "manager" | "employee";

export const ROLE_OPTIONS = [
  { value: "manager" as const, label: "Manager" },
  { value: "employee" as const, label: "Employee" },
];

export function normalizeEmployeeRoles(roles: unknown): RestaurantEmployeeRole[] {
  const valid = new Set(ROLE_OPTIONS.map((option) => option.value));
  let raw: unknown[] = [];

  if (Array.isArray(roles)) {
    raw = roles;
  } else if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles);
      raw = Array.isArray(parsed) ? parsed : roles.split(",");
    } catch {
      raw = roles.split(",");
    }
  }

  return raw
    .map((role) => String(role).trim().toLowerCase())
    .filter((role): role is RestaurantEmployeeRole => valid.has(role as RestaurantEmployeeRole));
}

export function roleLabel(role: RestaurantEmployeeRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}
