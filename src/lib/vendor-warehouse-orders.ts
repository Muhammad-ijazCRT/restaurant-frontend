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
