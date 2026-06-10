import type { Order } from "@shared/schema";

function normalizeId(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isWarehouseOrderAssignedToUser(
  order: Order,
  userId: string | null | undefined,
): boolean {
  return !!userId && normalizeId(order.warehouseWorkerId) === normalizeId(userId);
}

/** Orders assigned to the worker that still need picking action. */
export function isWarehouseActiveOrder(
  order: Order,
  userId: string | null | undefined,
): boolean {
  return (
    isWarehouseOrderAssignedToUser(order, userId) &&
    order.status === "submitted" &&
    order.pickingStatus !== "approved" &&
    order.pickingStatus !== "review"
  );
}

/** Orders the worker submitted for manager review. */
export function isWarehouseSubmittedOrder(
  order: Order,
  userId: string | null | undefined,
): boolean {
  return (
    isWarehouseOrderAssignedToUser(order, userId) &&
    (order.pickingStatus === "review" || order.status === "picking_review")
  );
}

/** Warehouse has finished picking (submitted for review or beyond). */
export function isWarehousePickingComplete(order: Order): boolean {
  return (
    order.pickingStatus === "review" ||
    order.pickingStatus === "approved" ||
    order.status === "picking_review" ||
    order.status === "ready_for_delivery" ||
    order.status === "delivered" ||
    order.status === "invoiced"
  );
}

/** Show warehouse worker dropdown while picking is still in progress. */
export function canShowWarehouseAssignment(order: Order): boolean {
  if (order.status === "delivered" || order.status === "invoiced") return false;
  return order.status === "submitted" && !isWarehousePickingComplete(order);
}

/** Show driver dropdown until the order is delivered. */
export function canShowDriverAssignment(order: Order): boolean {
  if (order.status === "delivered" || order.status === "invoiced") return false;
  return ["submitted", "picking_review", "ready_for_delivery"].includes(order.status);
}

export function canShowFulfillmentAssignment(order: Order): boolean {
  return canShowWarehouseAssignment(order) || canShowDriverAssignment(order);
}
