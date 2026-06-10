import type { Order } from "@shared/schema";

type OrderInvoiceFields = Pick<Order, "status" | "vendorApprovedAt" | "paidAt">;

type OrderDisputeFields = OrderInvoiceFields &
  Pick<Order, "restaurantReviewSubmittedAt" | "vendorRejectedAt">;

export function isInvoicedUnpaidOrder(order: OrderInvoiceFields): boolean {
  if (order.paidAt) return false;
  return order.status === "invoiced" || !!order.vendorApprovedAt;
}

export function shouldAttachInvoice(order: OrderInvoiceFields): boolean {
  return order.status === "invoiced" || !!order.vendorApprovedAt || !!order.paidAt;
}

/** True when vendor rejected the review and the order is not yet invoiced or paid. */
export function isDisputedOrder(order: OrderDisputeFields): boolean {
  if (order.paidAt || isInvoicedUnpaidOrder(order)) return false;
  return (
    !!order.restaurantReviewSubmittedAt &&
    !!order.vendorRejectedAt &&
    !order.vendorApprovedAt
  );
}
