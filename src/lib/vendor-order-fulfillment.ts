import type { LineFulfillment, Order, OrderLineItem } from "@shared/schema";

type LineWithPrice = Pick<OrderLineItem, "quantity" | "unitPriceAtTimeOfOrder"> & {
  id?: string;
};

type PickableOrder = Pick<Order, "pickingStatus"> | null | undefined;

export function isWarehousePickingSaved(order: PickableOrder): boolean {
  const status = order?.pickingStatus;
  return status === "in_progress" || status === "review" || status === "approved";
}

export function getVendorAdjustedQty(
  fulfillment: LineFulfillment | null | undefined,
  orderedQty: number,
): number {
  const normalized = normalizeLineFulfillment(fulfillment);
  if (normalized?.fulfilledQuantity != null) {
    return normalized.fulfilledQuantity;
  }
  return orderedQty;
}

export function normalizeLineFulfillment(
  fulfillment: LineFulfillment | null | undefined,
): LineFulfillment | null | undefined {
  if (!fulfillment) return fulfillment;
  const record = fulfillment as Record<string, unknown>;
  return {
    ...fulfillment,
    fulfilledQuantity:
      fulfillment.fulfilledQuantity ??
      (record.fulfilled_quantity as number | null | undefined) ??
      null,
    loadedQuantity:
      fulfillment.loadedQuantity ??
      (record.loaded_quantity as number | null | undefined) ??
      null,
    warehouseNote:
      fulfillment.warehouseNote ??
      (record.warehouse_note as string | null | undefined) ??
      null,
    issueReason:
      fulfillment.issueReason ??
      (record.issue_reason as string | null | undefined) ??
      null,
  };
}

export function getVendorNote(fulfillment: LineFulfillment | null | undefined): string {
  const normalized = normalizeLineFulfillment(fulfillment);
  return normalized?.warehouseNote?.trim() ?? "";
}

export function getSavedLoadedQty(
  fulfillment: LineFulfillment | null | undefined,
): number | null {
  const normalized = normalizeLineFulfillment(fulfillment);
  return normalized?.loadedQuantity ?? null;
}

export function getSavedLoadedQtyForOrder(
  fulfillment: LineFulfillment | null | undefined,
  order: PickableOrder,
): number | null {
  if (!isWarehousePickingSaved(order)) return null;
  return getSavedLoadedQty(fulfillment);
}

export function getWorkerLoadedQty(
  fulfillment: LineFulfillment | null | undefined,
  orderedQty: number,
): number {
  const saved = getSavedLoadedQty(fulfillment);
  if (saved != null) return saved;
  return getVendorAdjustedQty(fulfillment, orderedQty);
}

export function getEffectiveLoadedQty(
  fulfillment: LineFulfillment | null | undefined,
  orderedQty: number,
  draftQty?: number | "",
): number {
  if (draftQty !== "" && draftQty != null && Number.isFinite(Number(draftQty))) {
    return Number(draftQty);
  }
  const saved = getSavedLoadedQty(fulfillment);
  if (saved != null) return saved;
  return getVendorAdjustedQty(fulfillment, orderedQty);
}

export function formatSavedLoadedQty(
  fulfillment: LineFulfillment | null | undefined,
): string {
  const saved = getSavedLoadedQty(fulfillment);
  return saved == null ? "—" : String(saved);
}

export function formatSavedLoadedQtyForOrder(
  fulfillment: LineFulfillment | null | undefined,
  order: PickableOrder,
): string {
  const saved = getSavedLoadedQtyForOrder(fulfillment, order);
  return saved == null ? "—" : String(saved);
}

export function getWorkerNote(fulfillment: LineFulfillment | null | undefined): string {
  const normalized = normalizeLineFulfillment(fulfillment);
  return normalized?.issueReason?.trim() ?? "";
}

export function getWorkerNoteForOrder(
  fulfillment: LineFulfillment | null | undefined,
  order: PickableOrder,
): string {
  if (!isWarehousePickingSaved(order)) return "";
  return getWorkerNote(fulfillment);
}

export function getDriverDeliveryNote(
  order: Pick<Order, "driverNote"> | null | undefined,
): string {
  if (!order) return "";
  const record = order as Record<string, unknown>;
  const note =
    order.driverNote ??
    (record.driver_note as string | null | undefined) ??
    "";
  return typeof note === "string" ? note.trim() : "";
}

export function getDriverResolutionNote(
  order: Pick<Order, "driverResolutionNote"> | null | undefined,
): string {
  if (!order) return "";
  const record = order as Record<string, unknown>;
  const note =
    order.driverResolutionNote ??
    (record.driver_resolution_note as string | null | undefined) ??
    "";
  return typeof note === "string" ? note.trim() : "";
}

export function derivePickingStatus(
  referenceQty: number,
  loadedQty: number,
): "loaded" | "partial" | "no_stock" {
  if (loadedQty <= 0) return "no_stock";
  if (loadedQty < referenceQty) return "partial";
  return "loaded";
}

export function formatFulfillmentStatus(status: string | null | undefined): string {
  switch (status) {
    case "loaded":
      return "Loaded";
    case "partial":
      return "Partial";
    case "no_stock":
      return "No Stock";
    default:
      return status ?? "—";
  }
}

export function getOriginalOrderTotal(lineItems: LineWithPrice[]): number {
  return lineItems.reduce(
    (sum, lineItem) => sum + Number(lineItem.unitPriceAtTimeOfOrder) * lineItem.quantity,
    0,
  );
}

export function getVendorAdjustedTotal(
  lineItems: LineWithPrice[],
  getFulfillment: (lineItemId: string) => LineFulfillment | null | undefined,
): number {
  return lineItems.reduce((sum, lineItem) => {
    const fulfillment = lineItem.id ? getFulfillment(lineItem.id) : undefined;
    const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
    return sum + Number(lineItem.unitPriceAtTimeOfOrder) * vendorQty;
  }, 0);
}

export function getWarehouseLoadedTotal(
  lineItems: LineWithPrice[],
  getLoadedQty: (lineItemId: string, orderedQty: number) => number | null,
): number {
  return lineItems.reduce((sum, lineItem) => {
    const qty = lineItem.id ? getLoadedQty(lineItem.id, lineItem.quantity) : null;
    if (qty == null) return sum;
    return sum + Number(lineItem.unitPriceAtTimeOfOrder) * qty;
  }, 0);
}

export function hasWarehouseLoadedData(
  fulfillment: LineFulfillment | null | undefined,
  order?: PickableOrder,
): boolean {
  if (order && !isWarehousePickingSaved(order)) return false;
  return getSavedLoadedQty(fulfillment) != null;
}

export function orderHasWarehouseLoadedData(
  fulfillments: LineFulfillment[],
  order?: PickableOrder,
): boolean {
  if (order && !isWarehousePickingSaved(order)) return false;
  return fulfillments.some((fulfillment) => getSavedLoadedQty(fulfillment) != null);
}

export function getSubmittedOrderListTotal(
  lineItems: LineWithPrice[],
  fulfillments: LineFulfillment[],
  order?: PickableOrder,
): number {
  if (orderHasWarehouseLoadedData(fulfillments, order)) {
    return getWarehouseLoadedTotal(lineItems, (lineItemId) => {
      const fulfillment = fulfillments.find((item) => item.orderLineItemId === lineItemId);
      return getSavedLoadedQtyForOrder(fulfillment, order);
    });
  }
  return getVendorAdjustedTotal(lineItems, (lineItemId) =>
    fulfillments.find((item) => item.orderLineItemId === lineItemId),
  );
}

export function getEffectiveLineQty(
  fulfillment: LineFulfillment | null | undefined,
  orderedQty: number,
  order?: PickableOrder,
): number {
  const warehouseQty = getSavedLoadedQtyForOrder(fulfillment, order);
  if (warehouseQty != null) return warehouseQty;
  return getVendorAdjustedQty(fulfillment, orderedQty);
}

export function getEffectiveOrderItemCount(
  lineItems: (LineWithPrice & { id?: string })[],
  fulfillments: LineFulfillment[],
  order?: PickableOrder,
): number {
  return lineItems.reduce((sum, lineItem) => {
    const fulfillment = lineItem.id
      ? fulfillments.find((item) => item.orderLineItemId === lineItem.id)
      : undefined;
    return sum + getEffectiveLineQty(fulfillment, lineItem.quantity, order);
  }, 0);
}

export function hasVendorAdjustment(
  fulfillment: LineFulfillment | null | undefined,
  orderedQty: number,
): boolean {
  return getVendorAdjustedQty(fulfillment, orderedQty) !== orderedQty;
}

export function hasWarehouseAdjustment(
  fulfillment: LineFulfillment | null | undefined,
  vendorQty: number,
  order?: PickableOrder,
): boolean {
  const saved = getSavedLoadedQtyForOrder(fulfillment, order ?? null);
  if (saved == null) return false;
  return saved !== vendorQty;
}

export function hasWarehousePickingData(
  fulfillment: LineFulfillment | null | undefined,
): boolean {
  return hasWarehouseLoadedData(fulfillment);
}

export function orderHasWarehousePickingData(
  fulfillments: LineFulfillment[],
  order?: PickableOrder,
): boolean {
  return orderHasWarehouseLoadedData(fulfillments, order);
}

export function getRestaurantReceivedQty(
  fulfillment: LineFulfillment | null | undefined,
  expectedQty: number,
): number {
  return fulfillment?.restaurantReceivedQty ?? expectedQty;
}

export function getRestaurantNote(fulfillment: LineFulfillment | null | undefined): string {
  return fulfillment?.restaurantNote?.trim() ?? "";
}

export function hasRestaurantReviewAdjustment(
  fulfillment: LineFulfillment | null | undefined,
  orderedQty: number,
  order?: PickableOrder,
): boolean {
  const expectedQty = getEffectiveLineQty(fulfillment, orderedQty, order);
  const receivedQty = getRestaurantReceivedQty(fulfillment, expectedQty);
  return receivedQty !== expectedQty;
}

export function getRestaurantReviewTotal(
  lineItems: (LineWithPrice & { id?: string })[],
  fulfillments: LineFulfillment[],
  order?: PickableOrder,
): number {
  return lineItems.reduce((sum, lineItem) => {
    const fulfillment = lineItem.id
      ? fulfillments.find((item) => item.orderLineItemId === lineItem.id)
      : undefined;
    const expectedQty = getEffectiveLineQty(fulfillment, lineItem.quantity, order);
    const receivedQty = getRestaurantReceivedQty(fulfillment, expectedQty);
    return sum + Number(lineItem.unitPriceAtTimeOfOrder) * receivedQty;
  }, 0);
}

export function getRestaurantReviewItemCount(
  lineItems: (LineWithPrice & { id?: string })[],
  fulfillments: LineFulfillment[],
  order?: PickableOrder,
): number {
  return lineItems.reduce((sum, lineItem) => {
    const fulfillment = lineItem.id
      ? fulfillments.find((item) => item.orderLineItemId === lineItem.id)
      : undefined;
    const expectedQty = getEffectiveLineQty(fulfillment, lineItem.quantity, order);
    return sum + getRestaurantReceivedQty(fulfillment, expectedQty);
  }, 0);
}
