import type { ActivityLog } from "@shared/schema";
import { resolveRoleHomePath } from "@/lib/portal-auth";

function parseNotificationMetadata(raw?: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isRestaurantRole(role: string): boolean {
  return role === "restaurant" || role === "restaurant_manager" || role === "restaurant_employee";
}

function isVendorStaffRole(role: string): boolean {
  return (
    role === "vendor_admin" ||
    role === "vendor" ||
    role === "manager" ||
    role === "sales_representative"
  );
}

function canUseVendorShipping(role: string): boolean {
  return role === "vendor_admin" || role === "vendor" || role === "manager";
}

const VENDOR_ORDER_APPROVAL_ACTIONS = new Set([
  "order_invoiced",
  "order_paid",
  "order_review_submitted",
  "order_review_resubmitted",
  "order_issue_pending_vendor",
  "order_review_forwarded_to_driver",
  "order_issue_resolved",
  "order_issue_resolved_driver",
]);

const VENDOR_ORDER_SHIPPING_ACTIONS = new Set([
  "order_assigned",
  "order_assigned_worker",
  "order_assigned_driver",
  "order_picking_saved",
  "order_picking_submitted",
  "order_picking_submitted_worker",
  "order_picking_approved",
  "order_substitution_proposed",
  "order_substitution_status_updated",
]);

const RESTAURANT_DISPUTE_ACTIONS = new Set([
  "order_review_rejected",
  "order_issue_reported",
]);

const RESTAURANT_REVIEW_ACTIONS = new Set([
  "order_delivered",
  "order_delivered_driver",
  "order_review_submitted",
  "order_review_resubmitted",
  "order_issue_resolved",
  "order_issue_pending_driver",
]);

const DRIVER_COMPLETED_ACTIONS = new Set([
  "order_delivered_driver",
  "order_issue_resolved_driver",
]);

type NotificationContext = {
  log: ActivityLog;
  role: string;
  meta: Record<string, unknown>;
  orderId: string | null;
  vendorId: string | null;
  restaurantId: string | null;
};

function buildContext(log: ActivityLog, role: string): NotificationContext {
  const meta = parseNotificationMetadata(log.metadata);
  const orderId =
    log.entityType === "order"
      ? log.entityId
      : String(meta.orderId ?? "").trim() || null;
  const vendorId = String(log.vendorId ?? meta.vendorId ?? "").trim() || null;
  const restaurantId =
    String(log.restaurantId ?? meta.restaurantId ?? meta.restaurantOrgId ?? "").trim() ||
    null;

  return { log, role, meta, orderId, vendorId, restaurantId };
}

function resolveSuperAdminHref(ctx: NotificationContext): string {
  const { log, orderId } = ctx;

  if (log.entityType === "order" && orderId) return `/admin/orders/${orderId}`;
  if (log.entityType === "vendor" && log.entityId) return `/admin/vendors/${log.entityId}`;
  if (log.entityType === "restaurant_org" && log.entityId) {
    return `/admin/restaurants/${log.entityId}`;
  }
  if (log.entityType === "relationship" && log.entityId) {
    return `/admin/relationships/${log.entityId}`;
  }
  if (log.entityType === "product" && ctx.vendorId) {
    return `/admin/vendors/${ctx.vendorId}`;
  }
  if (log.action === "csv_import_completed" && ctx.vendorId) {
    return `/admin/vendors/${ctx.vendorId}`;
  }
  if (log.action.endsWith("_profile_updated")) return "/super-admin/profile";
  if (
    log.action.includes("note_") ||
    log.action.includes("attachment_") ||
    log.action === "INSERT" ||
    log.action === "UPDATE" ||
    log.action === "DELETE"
  ) {
    return "/admin/activity-log";
  }

  return "/super-admin/dashboard";
}

function resolveRestaurantOrderHref(ctx: NotificationContext): string {
  const { log, orderId, vendorId } = ctx;
  if (!orderId) return "/restaurant/orders";

  if (vendorId) {
    if (RESTAURANT_DISPUTE_ACTIONS.has(log.action)) {
      return `/restaurant/vendor/${vendorId}/dispute/${orderId}`;
    }
    if (RESTAURANT_REVIEW_ACTIONS.has(log.action)) {
      return `/restaurant/vendor/${vendorId}/review/${orderId}`;
    }
    if (
      log.action === "order_submitted" ||
      log.action === "order_created" ||
      log.action === "order_draft_updated" ||
      log.action === "order_draft_cleared"
    ) {
      return `/restaurant/vendor/${vendorId}`;
    }
    if (log.action === "order_paid" || log.action === "order_invoiced") {
      return `/restaurant/vendor/${vendorId}`;
    }
    return `/restaurant/vendor/${vendorId}`;
  }

  return "/restaurant/orders";
}

function resolveRestaurantHref(ctx: NotificationContext): string {
  const { log, role } = ctx;

  if (log.entityType === "order") return resolveRestaurantOrderHref(ctx);
  if (log.entityType === "relationship") return "/restaurant/relationships";
  if (log.entityType === "restaurant_org") {
    return role === "restaurant" ? "/restaurant/settings" : "/restaurant/portal";
  }
  if (log.entityType === "restaurant_employee") return "/restaurant/employees";
  if (log.action.endsWith("_profile_updated")) return "/restaurant/profile";
  if (log.action.includes("employee")) return "/restaurant/employees";
  if (log.action === "csv_import_completed") return "/restaurant/portal";

  return "/restaurant/portal";
}

function resolveVendorOrderHref(ctx: NotificationContext): string {
  const { log, role, orderId } = ctx;
  if (!orderId) return "/vendor/orders";

  if (VENDOR_ORDER_APPROVAL_ACTIONS.has(log.action)) {
    return `/vendor/orders/${orderId}/approve`;
  }

  if (canUseVendorShipping(role) && VENDOR_ORDER_SHIPPING_ACTIONS.has(log.action)) {
    return `/vendor/shipping?orderId=${orderId}`;
  }

  if (log.action === "order_delivered" || log.action === "order_issue_reported") {
    return `/vendor/orders?section=delivered`;
  }
  if (log.action === "order_review_rejected") {
    return `/vendor/orders?section=disputed`;
  }
  if (log.action === "order_paid") {
    return `/vendor/orders?section=history`;
  }
  if (
    log.action === "order_submitted" ||
    log.action === "order_created" ||
    log.action === "order_draft_updated" ||
    log.action === "order_draft_cleared"
  ) {
    return `/vendor/orders?section=submitted`;
  }

  return `/vendor/orders/${orderId}`;
}

function resolveVendorStaffHref(ctx: NotificationContext): string {
  const { log, role, vendorId } = ctx;

  if (log.entityType === "order") return resolveVendorOrderHref(ctx);

  if (log.entityType === "relationship" && log.entityId) {
    return `/vendor/relationships/${log.entityId}`;
  }
  if (log.entityType === "relationship") return "/vendor/relationships";

  if (
    log.entityType === "product" ||
    log.action === "csv_import_completed" ||
    log.action === "product_reordered" ||
    log.action === "product_archived" ||
    (log.action === "vendor_updated" && log.entityName?.toLowerCase().includes("product"))
  ) {
    return "/vendor/products";
  }

  if (
    log.entityType === "vendor_employee" ||
    log.action.includes("employee") ||
    (log.action === "vendor_updated" && log.entityName?.toLowerCase().includes("employee"))
  ) {
    return role === "sales_representative" ? "/vendor/portal" : "/vendor/employees";
  }

  if (log.entityType === "vendor" && log.entityId) {
    if (role === "sales_representative") return "/vendor/portal";
    return "/vendor/settings";
  }

  if (log.action.endsWith("_profile_updated")) return "/vendor/profile";

  if (log.entityType === "order" || log.action.startsWith("order_")) {
    return resolveVendorOrderHref(ctx);
  }

  return "/vendor/portal";
}

function resolveWarehouseHref(ctx: NotificationContext): string {
  const { log, orderId } = ctx;

  if (log.entityType === "order" && orderId) return `/vendor/orders/${orderId}`;
  if (log.action.startsWith("order_") && orderId) return `/vendor/orders/${orderId}`;
  if (log.action === "csv_import_completed" || log.entityType === "product") {
    return "/vendor/products";
  }
  if (log.action.endsWith("_profile_updated")) return "/vendor/profile";

  return "/vendor/orders";
}

function resolveDriverHref(ctx: NotificationContext): string {
  const { log, orderId } = ctx;

  if (orderId) {
    const view = DRIVER_COMPLETED_ACTIONS.has(log.action) ? "completed" : "queue";
    return `/shipping-company/orders?view=${view}&orderId=${orderId}`;
  }

  if (log.action.endsWith("_profile_updated")) return "/shipping-company/profile";
  if (log.action === "csv_import_completed") return "/shipping-company/catalog";

  return "/shipping-company/orders";
}

export function resolveNotificationHref(
  log: ActivityLog,
  role: string | null,
): string {
  const normalizedRole = role ?? "";
  const ctx = buildContext(log, normalizedRole);

  if (normalizedRole === "super_admin") {
    return resolveSuperAdminHref(ctx);
  }

  if (isRestaurantRole(normalizedRole)) {
    return resolveRestaurantHref(ctx);
  }

  if (normalizedRole === "driver") {
    return resolveDriverHref(ctx);
  }

  if (normalizedRole === "warehouse_worker" || normalizedRole === "warehouse") {
    return resolveWarehouseHref(ctx);
  }

  if (isVendorStaffRole(normalizedRole)) {
    return resolveVendorStaffHref(ctx);
  }

  if (ctx.log.entityType === "order" && ctx.orderId && ctx.vendorId) {
    return `/vendor/orders/${ctx.orderId}`;
  }

  return resolveRoleHomePath(normalizedRole) || "/";
}
