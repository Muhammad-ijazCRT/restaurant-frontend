import type { Order } from "@shared/schema";
import { isInvoicedUnpaidOrder } from "@/lib/order-status-utils";

export type RestaurantOrderEntry = {
  order: Order;
  itemCount: number;
  total: string;
};

export function normalizeOrderEntries(raw: unknown): RestaurantOrderEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      if ("order" in entry && entry.order && typeof entry.order === "object") {
        const enriched = entry as RestaurantOrderEntry;
        return {
          order: enriched.order,
          itemCount: enriched.itemCount ?? 0,
          total: enriched.total ?? "0.00",
        };
      }

      const order = entry as Order;
      if (order.id && order.status) {
        return { order, itemCount: 0, total: "0.00" };
      }

      return null;
    })
    .filter((entry): entry is RestaurantOrderEntry => entry != null);
}

export function countNeedsReviewOrders(entries: RestaurantOrderEntry[]): number {
  return entries.filter(
    (entry) =>
      entry.order.status === "delivered" && !entry.order.restaurantReviewSubmittedAt,
  ).length;
}

export function countSubmittedOrders(entries: RestaurantOrderEntry[]): number {
  return entries.filter((entry) => entry.order.status === "submitted").length;
}

export function countWaitingForApprovalOrders(entries: RestaurantOrderEntry[]): number {
  return entries.filter(
    (entry) =>
      entry.order.status === "delivered" &&
      !!entry.order.restaurantReviewSubmittedAt &&
      !entry.order.vendorApprovedAt &&
      !entry.order.vendorRejectedAt,
  ).length;
}

export function countOpenInvoices(entries: RestaurantOrderEntry[]): number {
  return entries.filter((entry) => isInvoicedUnpaidOrder(entry.order)).length;
}

export function sumUnpaidTotal(entries: RestaurantOrderEntry[]): number {
  return entries
    .filter((entry) => isInvoicedUnpaidOrder(entry.order))
    .reduce((sum, entry) => sum + Number(entry.total), 0);
}

export function sumFinalizedInvoiceSpend(entries: RestaurantOrderEntry[]): number {
  return entries
    .filter((entry) => !!entry.order.paidAt)
    .reduce((sum, entry) => sum + Number(entry.total), 0);
}

export type RestaurantDashboardStats = {
  submittedOrderCount: number;
  needsReviewCount: number;
  waitingForApprovalCount: number;
  openInvoiceCount: number;
  unpaidTotal: number;
  finalizedInvoiceSpend: number;
};

export function buildRestaurantDashboardStats(
  entries: RestaurantOrderEntry[],
): RestaurantDashboardStats {
  return {
    submittedOrderCount: countSubmittedOrders(entries),
    needsReviewCount: countNeedsReviewOrders(entries),
    waitingForApprovalCount: countWaitingForApprovalOrders(entries),
    openInvoiceCount: countOpenInvoices(entries),
    unpaidTotal: sumUnpaidTotal(entries),
    finalizedInvoiceSpend: sumFinalizedInvoiceSpend(entries),
  };
}
