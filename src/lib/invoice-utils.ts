import type {
  Invoice,
  InvoiceLineItemSnapshot,
  LineFulfillment,
  OrderLineItem,
  Product,
} from "@shared/schema";

export function normalizeInvoiceLineItems(value: unknown): InvoiceLineItemSnapshot[] {
  if (Array.isArray(value)) return value as InvoiceLineItemSnapshot[];
  if (typeof value === "string") {
    try {
      return normalizeInvoiceLineItems(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (value && typeof value === "object") {
    const values = Object.values(value as Record<string, unknown>);
    if (values.length > 0 && values.every((entry) => entry && typeof entry === "object")) {
      return values as InvoiceLineItemSnapshot[];
    }
  }
  return [];
}

function buildSnapshotFromLineItems(
  lineItems: OrderLineItem[],
  fulfillments: LineFulfillment[] = [],
  productMap?: Map<string, Pick<Product, "name" | "sku">>,
): InvoiceLineItemSnapshot[] {
  const fulfillmentMap = new Map(fulfillments.map((f) => [f.orderLineItemId, f]));
  return lineItems.map((li) => {
    const fulfillment = fulfillmentMap.get(li.id);
    const approvedQty = fulfillment?.restaurantReceivedQty ?? li.quantity;
    const unitPrice = li.unitPriceAtTimeOfOrder;
    const product = productMap?.get(li.productId);
    return {
      orderLineItemId: li.id,
      productId: li.productId,
      productName: product?.name ?? li.productId,
      sku: product?.sku ?? null,
      approvedQty,
      unitPrice,
      lineTotal: (parseFloat(unitPrice) * approvedQty).toFixed(2),
      restaurantNote: fulfillment?.restaurantNote ?? null,
    };
  });
}

export function resolveInvoicedOrderDisplay(options: {
  invoice?: Invoice | null;
  lineItems?: OrderLineItem[];
  fulfillments?: LineFulfillment[];
  productMap?: Map<string, Pick<Product, "name" | "sku">>;
}): { snapshotLines: InvoiceLineItemSnapshot[]; orderTotal: number } {
  const lineItems = options.lineItems ?? [];
  const snapshotLines = normalizeInvoiceLineItems(options.invoice?.lineItems);

  if (snapshotLines.length > 0) {
    const orderTotal = options.invoice?.approvedTotal
      ? parseFloat(options.invoice.approvedTotal)
      : snapshotLines.reduce((sum, line) => sum + parseFloat(line.lineTotal), 0);
    return { snapshotLines, orderTotal };
  }

  if (options.invoice?.approvedTotal) {
    const fallbackLines = lineItems.length > 0
      ? buildSnapshotFromLineItems(lineItems, options.fulfillments, options.productMap)
      : [];
    return {
      snapshotLines: fallbackLines,
      orderTotal: parseFloat(options.invoice.approvedTotal),
    };
  }

  if (lineItems.length > 0) {
    const fallbackLines = buildSnapshotFromLineItems(lineItems, options.fulfillments, options.productMap);
    return {
      snapshotLines: fallbackLines,
      orderTotal: fallbackLines.reduce((sum, line) => sum + parseFloat(line.lineTotal), 0),
    };
  }

  return { snapshotLines: [], orderTotal: 0 };
}