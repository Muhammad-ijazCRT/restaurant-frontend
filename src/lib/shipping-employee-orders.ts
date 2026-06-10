import type { Order } from "@shared/schema";
import {
  isWarehouseActiveOrder,
  isWarehouseOrderAssignedToUser,
  isWarehouseSubmittedOrder,
} from "@/lib/vendor-warehouse-orders";

function normalizeId(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isOrderAssignedToDriver(
  order: Order,
  userId: string | null | undefined,
): boolean {
  return !!userId && normalizeId(order.driverId) === normalizeId(userId);
}

/** Driver orders still in progress (assigned, ready, or issue review). */
export function isDriverQueueOrder(
  order: Order,
  userId: string | null | undefined,
): boolean {
  if (!isOrderAssignedToDriver(order, userId)) return false;
  if (order.restaurantIssueStatus === "pending_driver") return true;
  if (["delivered", "invoiced"].includes(order.status)) return false;
  return true;
}

/** Driver orders where delivery action is available now. */
export function isDriverActiveDeliveryOrder(
  order: Order,
  userId: string | null | undefined,
): boolean {
  if (!isOrderAssignedToDriver(order, userId)) return false;
  return (
    order.status === "ready_for_delivery" ||
    order.restaurantIssueStatus === "pending_driver"
  );
}

export function isDriverCompletedOrder(
  order: Order,
  userId: string | null | undefined,
): boolean {
  if (!isOrderAssignedToDriver(order, userId)) return false;
  if (order.restaurantIssueStatus === "pending_driver") return false;
  return ["delivered", "invoiced"].includes(order.status);
}

export function isDriverWaitingForWarehouse(
  order: Order,
  userId: string | null | undefined,
): boolean {
  return (
    isDriverQueueOrder(order, userId) &&
    !isDriverActiveDeliveryOrder(order, userId)
  );
}

export function isWarehouseQueueOrder(
  order: Order,
  userId: string | null | undefined,
): boolean {
  return (
    isWarehouseActiveOrder(order, userId) || isWarehouseSubmittedOrder(order, userId)
  );
}

export { isWarehouseOrderAssignedToUser };
