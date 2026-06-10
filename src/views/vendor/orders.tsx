import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useLocation, useSearch } from "@/lib/wouter-compat";
import { vendorOrderApi, vendorOrderKeys } from "@/api/vendor/orders";
import { profileKeys } from "@/api/shared/profile";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { useVendorPortalNav } from "@/contexts/vendor-portal-nav-context";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isDisputedOrder } from "@/lib/order-status-utils";
import { isWarehouseWorkerRole } from "@/lib/vendor-portal-labels";
import {
  isWarehouseActiveOrder,
  isWarehouseSubmittedOrder,
} from "@/lib/vendor-warehouse-orders";
import {
  getOriginalOrderTotal,
  getSubmittedOrderListTotal,
  getEffectiveOrderItemCount,
  getEffectiveLineQty,
  getVendorAdjustedQty,
  getVendorAdjustedTotal,
  getVendorNote,
  getWarehouseLoadedTotal,
  hasVendorAdjustment,
  hasWarehouseAdjustment,
  orderHasWarehouseLoadedData,
  formatSavedLoadedQtyForOrder,
  getWorkerNoteForOrder,
  getSavedLoadedQtyForOrder,
  getDriverDeliveryNote,
  getDriverResolutionNote,
  derivePickingStatus,
  normalizeLineFulfillment,
  getRestaurantReceivedQty,
  getRestaurantNote,
  getRestaurantReviewTotal,
  getRestaurantReviewItemCount,
  hasRestaurantReviewAdjustment,
} from "@/lib/vendor-order-fulfillment";
import { VENDOR_SECTION_IDS } from "@/lib/vendor-portal-sections";
import { WarehouseOrderCard } from "@/components/vendor/warehouse-order-picking-panel";
import type {
  Invoice,
  LineFulfillment,
  Order,
  OrderLineItem,
} from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  ExternalLink,
  Inbox,
  Package,
  Pencil,
  ShieldAlert,
  Truck,
} from "lucide-react";

type EnrichedLineItem = OrderLineItem & {
  productName: string;
  sku: string | null;
};

type VendorOrderEntry = {
  order: Order;
  lineItems: EnrichedLineItem[];
  restaurantName: string;
  fulfillments: LineFulfillment[];
  invoice: Invoice | null;
};

type PickItem = {
  status: "loaded" | "partial" | "no_stock";
  loadedQty: number | "";
  note: string;
};

type PickDraft = Record<string, Record<string, PickItem>>;

type OrderSectionId =
  | "submitted"
  | "picking-submitted"
  | "delivered"
  | "approval"
  | "disputed"
  | "invoiced"
  | "history";

function canWorkerPickOrder(order: Order, userId: string | null) {
  return isWarehouseActiveOrder(order, userId);
}

const ORDER_SECTION_IDS: OrderSectionId[] = [
  "submitted",
  "picking-submitted",
  "delivered",
  "approval",
  "disputed",
  "invoiced",
  "history",
];

function isOrderSectionId(value: string | null): value is OrderSectionId {
  return !!value && ORDER_SECTION_IDS.includes(value as OrderSectionId);
}

function createOpenSections(
  focusSection: OrderSectionId | null,
): Record<OrderSectionId, boolean> {
  if (!focusSection) {
    return {
      submitted: true,
      "picking-submitted": true,
      delivered: true,
      approval: true,
      disputed: true,
      invoiced: true,
      history: true,
    };
  }

  return {
    submitted: focusSection === "submitted",
    "picking-submitted": focusSection === "picking-submitted",
    delivered: focusSection === "delivered",
    approval: focusSection === "approval",
    disputed: focusSection === "disputed",
    invoiced: focusSection === "invoiced",
    history: focusSection === "history",
  };
}

type SectionTone = "blue" | "orange" | "violet" | "red" | "emerald" | "neutral";

const SECTION_TONES: Record<
  SectionTone,
  {
    border: string;
    header: string;
    text: string;
    badge: string;
    emptyIcon: string;
  }
> = {
  blue: {
    border: "border-blue-200",
    header: "bg-blue-50/40 border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    emptyIcon: "text-blue-300",
  },
  orange: {
    border: "border-orange-200",
    header: "bg-orange-50/40 border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    emptyIcon: "text-orange-300",
  },
  violet: {
    border: "border-violet-200",
    header: "bg-violet-50/40 border-violet-200",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    emptyIcon: "text-violet-300",
  },
  red: {
    border: "border-red-200",
    header: "bg-red-50/40 border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700 border-red-200",
    emptyIcon: "text-red-300",
  },
  emerald: {
    border: "border-emerald-200",
    header: "bg-emerald-50/40 border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    emptyIcon: "text-emerald-300",
  },
  neutral: {
    border: "border-border",
    header: "bg-card border-border",
    text: "text-foreground",
    badge: "bg-muted text-foreground border-border",
    emptyIcon: "text-muted-foreground",
  },
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Delivered: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  "Needs Approval": "bg-violet-100 text-violet-700 hover:bg-violet-100",
  Disputed: "bg-red-100 text-red-700 hover:bg-red-100",
  Invoiced: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Paid: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  "Picking Review": "bg-violet-100 text-violet-700 hover:bg-violet-100",
  "Ready for Delivery": "bg-orange-100 text-orange-700 hover:bg-orange-100",
};

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getOrderNumber(order: Order) {
  return `#${order.displayId ?? order.id.slice(0, 8)}`;
}

function getOrderStatus(entry: VendorOrderEntry): string {
  const { order } = entry;
  if (order.paidAt) return "Paid";
  if (order.status === "invoiced" || order.restaurantIssueStatus === "resolved_by_driver") {
    return "Invoiced";
  }
  if (isDisputedOrder(order)) return "Disputed";
  if (order.status === "pending_driver" || order.restaurantIssueStatus === "pending_driver") {
    return "Needs Driver Review";
  }
  if (order.restaurantIssueStatus === "pending_vendor") {
    return "Needs Vendor Review";
  }
  if (
    order.restaurantReviewSubmittedAt &&
    !order.vendorApprovedAt &&
    !order.vendorRejectedAt &&
    order.restaurantIssueStatus !== "pending_driver"
  ) {
    return "Needs Approval";
  }
  if (order.status === "delivered") return "Delivered";
  if (order.status === "picking_review" || order.pickingStatus === "review") {
    return "Picking Review";
  }
  if (order.status === "ready_for_delivery") return "Ready for Delivery";
  return "Submitted";
}

function getFulfillment(entry: VendorOrderEntry, lineItemId: string) {
  const fulfillment = entry.fulfillments.find(
    (item) => item.orderLineItemId === lineItemId,
  );
  return fulfillment ? normalizeLineFulfillment(fulfillment) : undefined;
}

function getApprovedQuantity(entry: VendorOrderEntry, lineItem: EnrichedLineItem) {
  const invoiceLines = Array.isArray(entry.invoice?.lineItems)
    ? entry.invoice!.lineItems
    : [];
  const invoiceLine = invoiceLines.find(
    (line) => line.orderLineItemId === lineItem.id,
  );
  if (invoiceLine) return invoiceLine.approvedQty;

  const fulfillment = getFulfillment(entry, lineItem.id);
  return fulfillment?.restaurantReceivedQty ?? lineItem.quantity;
}

function getLineDisplayQuantity(
  entry: VendorOrderEntry,
  lineItem: EnrichedLineItem,
  sectionId: OrderSectionId,
) {
  if (sectionId === "approval") {
    const fulfillment = getFulfillment(entry, lineItem.id);
    const expectedQty = getEffectiveLineQty(fulfillment, lineItem.quantity, entry.order);
    return getRestaurantReceivedQty(fulfillment, expectedQty);
  }
  if (usesFulfillmentSummaryMetrics(sectionId)) {
    return getEffectiveLineQty(getFulfillment(entry, lineItem.id), lineItem.quantity, entry.order);
  }
  return getApprovedQuantity(entry, lineItem);
}

function usesFulfillmentSummaryMetrics(sectionId: OrderSectionId): boolean {
  return (
    sectionId === "submitted" ||
    sectionId === "picking-submitted" ||
    sectionId === "delivered"
  );
}

function getSectionOrderItemCount(entry: VendorOrderEntry, sectionId: OrderSectionId): number {
  if (sectionId === "approval") {
    return getRestaurantReviewItemCount(entry.lineItems, entry.fulfillments, entry.order);
  }
  if (usesFulfillmentSummaryMetrics(sectionId)) {
    return getEffectiveOrderItemCount(entry.lineItems, entry.fulfillments, entry.order);
  }
  return entry.lineItems.reduce(
    (sum, lineItem) => sum + getApprovedQuantity(entry, lineItem),
    0,
  );
}

function getSectionOrderTotal(entry: VendorOrderEntry, sectionId: OrderSectionId) {
  if (sectionId === "approval") {
    return getRestaurantReviewTotal(entry.lineItems, entry.fulfillments, entry.order);
  }
  if (entry.invoice?.approvedTotal && !usesFulfillmentSummaryMetrics(sectionId)) {
    return Number(entry.invoice.approvedTotal);
  }
  if (usesFulfillmentSummaryMetrics(sectionId)) {
    return getSubmittedOrderListTotal(entry.lineItems, entry.fulfillments, entry.order);
  }
  return entry.lineItems.reduce(
    (sum, lineItem) =>
      sum + getApprovedQuantity(entry, lineItem) * getLinePrice(lineItem),
    0,
  );
}

function getLinePrice(lineItem: EnrichedLineItem) {
  return Number(lineItem.unitPriceAtTimeOfOrder);
}

function getOrderTotal(entry: VendorOrderEntry) {
  if (entry.invoice?.approvedTotal) {
    return Number(entry.invoice.approvedTotal);
  }

  return entry.lineItems.reduce(
    (sum, lineItem) =>
      sum + getApprovedQuantity(entry, lineItem) * getLinePrice(lineItem),
    0,
  );
}

function getVendorNotes(entry: VendorOrderEntry) {
  return entry.lineItems
    .map((lineItem) => {
      const fulfillment = getFulfillment(entry, lineItem.id);
      const note = getVendorNote(fulfillment);
      if (!note) return null;
      return `${lineItem.productName}: ${note}`;
    })
    .filter(Boolean) as string[];
}

function getRestaurantNotes(entry: VendorOrderEntry) {
  return entry.lineItems
    .map((lineItem) => {
      const fulfillment = getFulfillment(entry, lineItem.id);
      const note = getRestaurantNote(fulfillment);
      if (!note) return null;
      return `${lineItem.productName}: ${note}`;
    })
    .filter(Boolean) as string[];
}

function OrderSection({
  id,
  title,
  subtitle,
  icon: Icon,
  tone,
  entries,
  isOpen,
  onToggle,
  expandedOrderIds,
  onToggleOrder,
  onViewOrder,
  isLoading,
  emptyText,
  viewOnly = false,
  enablePicking = false,
  pickDraft,
  onUpdatePick,
  getPickForLine,
  onSavePicking,
  onSubmitPicking,
  pickingPending = false,
  canPickOrder,
  onForwardToDriver,
  forwardPending = false,
}: {
  id: OrderSectionId;
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  tone: SectionTone;
  entries: VendorOrderEntry[];
  isOpen: boolean;
  onToggle: () => void;
  expandedOrderIds: Record<string, boolean>;
  onToggleOrder: (orderId: string) => void;
  onViewOrder: (entry: VendorOrderEntry, sectionId: OrderSectionId) => void;
  isLoading: boolean;
  emptyText: string;
  viewOnly?: boolean;
  enablePicking?: boolean;
  pickDraft?: PickDraft;
  onUpdatePick?: (orderId: string, lineItemId: string, patch: Partial<PickItem>) => void;
  getPickForLine?: (entry: VendorOrderEntry, lineItem: EnrichedLineItem) => PickItem;
  onSavePicking?: (orderId: string) => void;
  onSubmitPicking?: (orderId: string) => void;
  pickingPending?: boolean;
  canPickOrder?: (order: Order) => boolean;
  onForwardToDriver?: (orderId: string) => void;
  forwardPending?: boolean;
}) {
  const styles = SECTION_TONES[tone];

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card shadow-sm ${styles.border}`}
      data-testid={`section-vendor-orders-${id}`}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-3 border-b px-6 py-4 text-left ${styles.header}`}
        onClick={onToggle}
        data-testid={`button-toggle-orders-${id}`}
      >
        {isOpen ? (
          <ChevronDown className={`h-4 w-4 ${styles.text}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${styles.text}`} />
        )}
        <Icon className={`h-4 w-4 ${styles.text}`} />
        <span className={`text-base font-semibold ${styles.text}`}>{title}</span>
        <Badge variant="outline" className={`h-7 px-3 text-sm ${styles.badge}`}>
          {isLoading ? "..." : entries.length}
        </Badge>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
        {viewOnly ? (
          <span className="ml-auto text-xs font-medium text-muted-foreground">View Only</span>
        ) : enablePicking ? (
          <span className="ml-auto text-xs font-medium text-blue-700">Picking</span>
        ) : null}
      </button>

      {isOpen && (
        <div>
          {isLoading ? (
            <div className="px-6 py-6">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Icon className={`h-10 w-10 opacity-35 ${styles.emptyIcon}`} />
              <p className="text-sm">{emptyText}</p>
            </div>
          ) : enablePicking ? (
            <div className="space-y-4 p-5">
              {entries.map((entry) => (
                <WarehouseOrderCard
                  key={entry.order.id}
                  entry={entry}
                  isOpen={expandedOrderIds[entry.order.id] ?? false}
                  onToggle={() => onToggleOrder(entry.order.id)}
                  onOpenDetail={() => onViewOrder(entry, id)}
                  getPickForLine={(orderEntry, lineItem) => getPickForLine!(orderEntry, lineItem)}
                  onUpdatePick={(orderId, lineItemId, patch) => onUpdatePick?.(orderId, lineItemId, patch)}
                  onSavePicking={(orderId) => onSavePicking?.(orderId)}
                  onSubmitPicking={(orderId) => onSubmitPicking?.(orderId)}
                  pickingPending={pickingPending}
                />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12" />
                  <TableHead className="font-medium">Restaurant</TableHead>
                  <TableHead className="font-medium">Order ID</TableHead>
                  <TableHead className="font-medium">
                    {id === "history" ? "Ordered" : "Date"}
                  </TableHead>
                  {id === "history" && (
                    <TableHead className="font-medium">Paid</TableHead>
                  )}
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="text-right font-medium">Items</TableHead>
                  <TableHead className="text-right font-medium">Total</TableHead>
                  <TableHead className="w-28 text-right font-medium" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const status = getOrderStatus(entry);
                  const isOrderOpen = expandedOrderIds[entry.order.id] ?? true;
                  const notes = getVendorNotes(entry);
                  const restaurantNotes = getRestaurantNotes(entry);
                  const origTotal = getOriginalOrderTotal(entry.lineItems);
                  const vendorAdjustedTotal = getVendorAdjustedTotal(
                    entry.lineItems,
                    (lineItemId) => getFulfillment(entry, lineItemId),
                  );
                  const restaurantReviewTotal = getRestaurantReviewTotal(
                    entry.lineItems,
                    entry.fulfillments,
                    entry.order,
                  );
                  const orderCanPick = enablePicking && (canPickOrder?.(entry.order) ?? false);
                  const showVendorAdjustment = id === "submitted" && !orderCanPick;
                  const showSubmittedVendorDetail =
                    showVendorAdjustment && !orderCanPick;
                  const showSubmittedWarehouseDetail =
                    showSubmittedVendorDetail &&
                    orderHasWarehouseLoadedData(entry.fulfillments, entry.order);
                  const warehouseLoadedTotal = getWarehouseLoadedTotal(
                    entry.lineItems,
                    (lineItemId) =>
                      getSavedLoadedQtyForOrder(getFulfillment(entry, lineItemId), entry.order),
                  );
                  const showWarehouseLoadedTotal = orderHasWarehouseLoadedData(
                    entry.fulfillments,
                    entry.order,
                  );
                  const savedDriverNote = getDriverDeliveryNote(entry.order);
                  const driverResolutionNote = getDriverResolutionNote(entry.order);
                  const showApprovalReviewDetail = id === "approval";
                  const showDeliveredFulfillmentDetail =
                    entry.order.status === "delivered" || entry.order.status === "invoiced";
                  const showFulfillmentBreakdown =
                    showSubmittedVendorDetail ||
                    showDeliveredFulfillmentDetail ||
                    showApprovalReviewDetail;
                  const hasRestaurantReviewData =
                    restaurantNotes.length > 0 ||
                    Boolean(entry.order.restaurantReviewSubmittedAt) ||
                    Boolean(entry.order.restaurantIssueStatus) ||
                    entry.lineItems.some((lineItem) => {
                      const fulfillment = getFulfillment(entry, lineItem.id);
                      return (
                        fulfillment?.restaurantReceivedQty != null ||
                        Boolean(getRestaurantNote(fulfillment))
                      );
                    });
                  const showRestaurantReviewDetail =
                    showApprovalReviewDetail ||
                    (showFulfillmentBreakdown && hasRestaurantReviewData);
                  const showWarehouseBreakdown =
                    (showSubmittedVendorDetail && showSubmittedWarehouseDetail) ||
                    ((showDeliveredFulfillmentDetail || showApprovalReviewDetail) &&
                      showWarehouseLoadedTotal);
                  const showDriverNoteColumn =
                    showFulfillmentBreakdown &&
                    (entry.order.status === "delivered" ||
                      entry.order.status === "invoiced" ||
                      showRestaurantReviewDetail ||
                      Boolean(savedDriverNote));

                  return (
                    <Fragment key={entry.order.id}>
                      <TableRow
                        className="hover:bg-muted/20"
                        data-testid={`row-vendor-order-${entry.order.id}`}
                      >
                        <TableCell>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
                            onClick={() => onToggleOrder(entry.order.id)}
                            aria-label="Toggle order details"
                          >
                            {isOrderOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.restaurantName}
                        </TableCell>
                        <TableCell>{getOrderNumber(entry.order)}</TableCell>
                        <TableCell>{formatDate(entry.order.createdAt)}</TableCell>
                        {id === "history" && (
                          <TableCell>{formatDate(entry.order.paidAt)}</TableCell>
                        )}
                        <TableCell>
                          <Badge className={ORDER_STATUS_STYLES[status]}>
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {getSectionOrderItemCount(entry, id)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(String(getSectionOrderTotal(entry, id).toFixed(2)))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {orderCanPick ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => onViewOrder(entry, id)}
                                data-testid={`button-open-order-${entry.order.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => onViewOrder(entry, id)}
                                data-testid={`button-view-order-${entry.order.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                                View
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {isOrderOpen && (
                        <TableRow key={`${entry.order.id}-details`}>
                          <TableCell />
                          <TableCell colSpan={id === "history" ? 8 : 7}>
                            <div className="pb-5 pr-4">
                              {showFulfillmentBreakdown ? (
                                <div
                                  className={`mb-4 grid grid-cols-1 gap-3 ${
                                    showRestaurantReviewDetail
                                      ? "sm:grid-cols-2 lg:grid-cols-4"
                                      : "sm:grid-cols-3"
                                  }`}
                                >
                                  <div className="rounded-lg border bg-card px-4 py-3">
                                    <p className="text-xs font-medium text-muted-foreground">Orig. Order Total</p>
                                    <p className="mt-1 text-lg font-bold">
                                      {formatCurrency(String(origTotal.toFixed(2)))}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
                                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                                      <Pencil className="h-3.5 w-3.5" />
                                      Vendor Adjusted Total
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-primary">
                                      {formatCurrency(String(vendorAdjustedTotal.toFixed(2)))}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                      Warehouse Loaded Total
                                    </p>
                                    <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                      {showWarehouseBreakdown && showWarehouseLoadedTotal
                                        ? formatCurrency(String(warehouseLoadedTotal.toFixed(2)))
                                        : "—"}
                                    </p>
                                  </div>
                                  {showRestaurantReviewDetail ? (
                                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
                                      <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                                        Restaurant Review Total
                                      </p>
                                      <p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">
                                        {formatCurrency(String(restaurantReviewTotal.toFixed(2)))}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">
                                      Ordered Qty
                                    </TableHead>
                                    {orderCanPick ? (
                                      <>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Orig. Total</TableHead>
                                        <TableHead className="text-right">Vendor Qty</TableHead>
                                        <TableHead className="text-right">Vendor Total</TableHead>
                                        <TableHead>Vendor Note</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Loaded Qty</TableHead>
                                        <TableHead>Worker Note</TableHead>
                                      </>
                                    ) : showFulfillmentBreakdown ? (
                                      <>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Orig. Total</TableHead>
                                        <TableHead className="text-right">Vendor Qty</TableHead>
                                        <TableHead className="text-right">Vendor Total</TableHead>
                                        <TableHead>Vendor Note</TableHead>
                                        {showWarehouseBreakdown ? (
                                          <>
                                            <TableHead className="text-right">Loaded Qty</TableHead>
                                            <TableHead className="text-right">Loaded Total</TableHead>
                                            <TableHead>Worker Note</TableHead>
                                          </>
                                        ) : null}
                                        {showDriverNoteColumn ? (
                                          <TableHead>Delivery Note</TableHead>
                                        ) : null}
                                        {showRestaurantReviewDetail ? (
                                          <>
                                            <TableHead className="text-right text-violet-700 dark:text-violet-300">
                                              Received Qty
                                            </TableHead>
                                            <TableHead className="text-right text-violet-700 dark:text-violet-300">
                                              Review Total
                                            </TableHead>
                                            <TableHead className="text-violet-700 dark:text-violet-300">
                                              Restaurant Note
                                            </TableHead>
                                          </>
                                        ) : null}
                                      </>
                                    ) : (
                                      <TableHead className="text-right">
                                        {id === "submitted" ? "Adj. Qty" : "Approved Qty"}
                                      </TableHead>
                                    )}
                                    {!orderCanPick && !showFulfillmentBreakdown ? (
                                      <>
                                        <TableHead className="text-right">
                                          Unit Price
                                        </TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                      </>
                                    ) : null}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entry.lineItems.map((lineItem) => {
                                    const pick = getPickForLine?.(entry, lineItem);
                                    const fulfillment = getFulfillment(entry, lineItem.id);
                                    const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
                                    const vendorNote = getVendorNote(fulfillment);
                                    const displayQty = orderCanPick
                                      ? (pick?.loadedQty === "" || pick?.loadedQty == null
                                          ? getSavedLoadedQtyForOrder(fulfillment, entry.order)
                                          : Number(pick.loadedQty))
                                      : getLineDisplayQuantity(entry, lineItem, id);
                                    const unitPrice = getLinePrice(lineItem);
                                    const origLineTotal = lineItem.quantity * unitPrice;
                                    const vendorLineTotal = vendorQty * unitPrice;
                                    const savedLoadedQty = getSavedLoadedQtyForOrder(
                                      fulfillment,
                                      entry.order,
                                    );
                                    const loadedLineTotal =
                                      savedLoadedQty == null ? null : savedLoadedQty * unitPrice;
                                    const lineTotal =
                                      (displayQty ?? lineItem.quantity) * unitPrice;
                                    const adjusted = hasVendorAdjustment(fulfillment, lineItem.quantity);
                                    const warehouseAdjusted = hasWarehouseAdjustment(
                                      fulfillment,
                                      vendorQty,
                                      entry.order,
                                    );

                                    return (
                                      <TableRow key={lineItem.id}>
                                        <TableCell className="font-medium">
                                          {lineItem.productName}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {lineItem.sku ?? "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {lineItem.quantity}
                                        </TableCell>
                                        {orderCanPick && pick ? (
                                          <>
                                            <TableCell className="text-right text-muted-foreground">
                                              {formatCurrency(String(unitPrice.toFixed(2)))}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              {formatCurrency(String(origLineTotal.toFixed(2)))}
                                            </TableCell>
                                            <TableCell
                                              className={`text-right font-semibold ${
                                                adjusted ? "text-primary" : ""
                                              }`}
                                            >
                                              {vendorQty}
                                              {adjusted ? " ↓" : ""}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-primary">
                                              {formatCurrency(String(vendorLineTotal.toFixed(2)))}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate text-muted-foreground">
                                              {vendorNote || "—"}
                                            </TableCell>
                                            <TableCell>
                                              <Select
                                                value={pick.status}
                                                onValueChange={(value) =>
                                                  onUpdatePick?.(entry.order.id, lineItem.id, {
                                                    status: value as PickItem["status"],
                                                  })
                                                }
                                              >
                                                <SelectTrigger className="w-[140px]">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="loaded">Loaded</SelectItem>
                                                  <SelectItem value="partial">Partial</SelectItem>
                                                  <SelectItem value="no_stock">No Stock</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Input
                                                className="ml-auto w-24 text-right"
                                                type="number"
                                                min={0}
                                                value={pick.loadedQty === "" ? "" : pick.loadedQty}
                                                placeholder="Qty"
                                                autoComplete="off"
                                                onChange={(event) => {
                                                  const raw = event.target.value;
                                                  const loadedQty = raw === "" ? "" : Number(raw);
                                                  onUpdatePick?.(entry.order.id, lineItem.id, {
                                                    loadedQty,
                                                    status: derivePickingStatus(
                                                      vendorQty,
                                                      loadedQty === "" ? 0 : loadedQty,
                                                    ),
                                                  });
                                                }}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={pick.note ?? ""}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                spellCheck={false}
                                                name={`worker-note-${entry.order.id}-${lineItem.id}`}
                                                onChange={(event) =>
                                                  onUpdatePick?.(entry.order.id, lineItem.id, {
                                                    note: event.target.value,
                                                  })
                                                }
                                                placeholder="Worker note..."
                                              />
                                            </TableCell>
                                          </>
                                        ) : showFulfillmentBreakdown ? (
                                          <>
                                            <TableCell className="text-right text-muted-foreground">
                                              {formatCurrency(String(unitPrice.toFixed(2)))}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              {formatCurrency(String(origLineTotal.toFixed(2)))}
                                            </TableCell>
                                            <TableCell
                                              className={`text-right font-semibold ${
                                                adjusted ? "text-primary" : ""
                                              }`}
                                            >
                                              {vendorQty}
                                              {adjusted
                                                ? vendorQty > lineItem.quantity
                                                  ? " ↑"
                                                  : vendorQty < lineItem.quantity
                                                    ? " ↓"
                                                    : ""
                                                : ""}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-primary">
                                              {formatCurrency(String(vendorLineTotal.toFixed(2)))}
                                            </TableCell>
                                            <TableCell className="max-w-[180px] truncate text-muted-foreground">
                                              {vendorNote || "—"}
                                            </TableCell>
                                            {showWarehouseBreakdown ? (
                                              <>
                                                <TableCell className="text-right font-semibold">
                                                  {formatSavedLoadedQtyForOrder(fulfillment, entry.order)}
                                                </TableCell>
                                                <TableCell
                                                  className={`text-right font-semibold ${
                                                    warehouseAdjusted ? "text-emerald-700" : ""
                                                  }`}
                                                >
                                                  {loadedLineTotal == null
                                                    ? "—"
                                                    : formatCurrency(String(loadedLineTotal.toFixed(2)))}
                                                </TableCell>
                                                <TableCell className="max-w-[180px] truncate text-muted-foreground">
                                                  {getWorkerNoteForOrder(fulfillment, entry.order) || "—"}
                                                </TableCell>
                                              </>
                                            ) : null}
                                            {showDriverNoteColumn ? (
                                              <TableCell className="max-w-[180px] truncate text-muted-foreground">
                                                {savedDriverNote || "—"}
                                              </TableCell>
                                            ) : null}
                                            {showRestaurantReviewDetail ? (() => {
                                              const expectedQty = getEffectiveLineQty(
                                                fulfillment,
                                                lineItem.quantity,
                                                entry.order,
                                              );
                                              const receivedQty = getRestaurantReceivedQty(
                                                fulfillment,
                                                expectedQty,
                                              );
                                              const reviewLineTotal = receivedQty * unitPrice;
                                              const restaurantNote = getRestaurantNote(fulfillment);
                                              const reviewAdjusted = hasRestaurantReviewAdjustment(
                                                fulfillment,
                                                lineItem.quantity,
                                                entry.order,
                                              );
                                              return (
                                                <>
                                                  <TableCell
                                                    className={`text-right font-semibold ${
                                                      reviewAdjusted
                                                        ? "text-violet-700 dark:text-violet-300"
                                                        : ""
                                                    }`}
                                                  >
                                                    {receivedQty}
                                                    {reviewAdjusted ? (
                                                      <span className="block text-xs font-normal text-violet-500">
                                                        (expected {expectedQty})
                                                      </span>
                                                    ) : null}
                                                  </TableCell>
                                                  <TableCell
                                                    className={`text-right font-semibold ${
                                                      reviewAdjusted
                                                        ? "text-violet-700 dark:text-violet-300"
                                                        : ""
                                                    }`}
                                                  >
                                                    {formatCurrency(String(reviewLineTotal.toFixed(2)))}
                                                  </TableCell>
                                                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                                                    {restaurantNote || "—"}
                                                  </TableCell>
                                                </>
                                              );
                                            })() : null}
                                          </>
                                        ) : (
                                          <>
                                            <TableCell
                                              className={`text-right font-semibold ${
                                                showVendorAdjustment && adjusted
                                                  ? "text-primary"
                                                  : displayQty !== lineItem.quantity
                                                    ? "text-orange-600"
                                                    : ""
                                              }`}
                                            >
                                              {displayQty}
                                              {(showVendorAdjustment && adjusted) ||
                                              displayQty !== lineItem.quantity
                                                ? " ↓"
                                                : ""}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                              {formatCurrency(
                                                String(getLinePrice(lineItem).toFixed(2)),
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              {formatCurrency(String(lineTotal.toFixed(2)))}
                                            </TableCell>
                                          </>
                                        )}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>

                              {orderCanPick ? (
                                <div className="mt-4 space-y-3 border-t pt-4">
                                  <div className="flex flex-wrap items-center justify-end gap-6 text-sm">
                                    <span className="text-muted-foreground">
                                      Orig. Order Total{" "}
                                      <span className="font-semibold text-foreground">
                                        {formatCurrency(String(origTotal.toFixed(2)))}
                                      </span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-primary">
                                      Vendor Adjusted Total{" "}
                                      <span className="font-semibold">
                                        {formatCurrency(String(vendorAdjustedTotal.toFixed(2)))}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={pickingPending}
                                      onClick={() => onSavePicking?.(entry.order.id)}
                                    >
                                      Save Picking
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={pickingPending}
                                      onClick={() => onSubmitPicking?.(entry.order.id)}
                                    >
                                      Send to Picking Review
                                    </Button>
                                  </div>
                                </div>
                              ) : null}

                              {showApprovalReviewDetail &&
                              entry.order.restaurantIssueStatus === "pending_vendor" ? (
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                                  <p className="text-sm text-violet-700 dark:text-violet-300">
                                    Restaurant changed received quantities. Forward to the driver for
                                    final approval and invoicing.
                                  </p>
                                  <Button
                                    size="sm"
                                    className="bg-violet-600 text-white hover:bg-violet-700"
                                    disabled={forwardPending}
                                    onClick={() => onForwardToDriver?.(entry.order.id)}
                                    data-testid={`button-forward-to-driver-${entry.order.id}`}
                                  >
                                    <Truck className="mr-1.5 h-4 w-4" />
                                    {forwardPending ? "Sending…" : "Send to Driver"}
                                  </Button>
                                </div>
                              ) : null}

                              {!showFulfillmentBreakdown ? (
                              <div className="mt-4 flex justify-end gap-12 border-t pt-4">
                                <span className="text-sm text-muted-foreground">
                                  Total
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatCurrency(
                                    String(getSectionOrderTotal(entry, id).toFixed(2)),
                                  )}
                                </span>
                              </div>
                              ) : null}

                              {notes.length > 0 && (
                                <div className="mt-5">
                                  <p className="text-sm font-semibold text-orange-600">
                                    Vendor Notes
                                  </p>
                                  <div className="mt-1 space-y-1 text-sm">
                                    {notes.map((note) => (
                                      <p key={note}>{note}</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {restaurantNotes.length > 0 && (
                                <div className="mt-5">
                                  <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                                    Restaurant Notes
                                  </p>
                                  <div className="mt-1 space-y-1 text-sm">
                                    {restaurantNotes.map((note) => (
                                      <p key={note}>{note}</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {driverResolutionNote ? (
                                <div className="mt-5 rounded-md border border-sky-200 bg-sky-50/50 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/20">
                                  <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
                                    Driver Resolution Note
                                  </p>
                                  <p className="mt-1 text-sm text-foreground">{driverResolutionNote}</p>
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

export default function VendorOrders() {
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();
  const role = getUserRole();
  const user = getUserData();
  const userId = user?.id != null ? String(user.id) : null;
  const { toast } = useToast();
  const isWarehouseWorker = isWarehouseWorkerRole(role);
  const [pickDraft, setPickDraft] = useState<PickDraft>({});
  const searchString = useSearch();
  const focusSectionParam = new URLSearchParams(searchString).get("section");
  const focusSection = isOrderSectionId(focusSectionParam)
    ? focusSectionParam
    : null;
  const portalNav = useVendorPortalNav();
  const [openSections, setOpenSections] = useState<Record<OrderSectionId, boolean>>(
    () => createOpenSections(focusSection),
  );
  const [expandedOrderIds, setExpandedOrderIds] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!vendorId) navigate("/vendor/login");
  }, [vendorId, navigate]);

  useEffect(() => {
    portalNav?.setActiveSection(VENDOR_SECTION_IDS.orders);
  }, [portalNav]);

  useEffect(() => {
    setOpenSections(createOpenSections(focusSection));
  }, [focusSection]);

  const { data: vendorOrders = [], isLoading } = useQuery<VendorOrderEntry[]>({
    queryKey: vendorOrderKeys.list(vendorId!),
    enabled: !!vendorId,
    refetchOnWindowFocus: true,
  });

  const fulfillmentFingerprint = useMemo(
    () =>
      vendorOrders
        .map((entry) =>
          entry.fulfillments
            .map(
              (fulfillment) =>
                `${fulfillment.orderLineItemId}:${fulfillment.fulfilledQuantity ?? ""}:${fulfillment.warehouseNote ?? ""}:${fulfillment.loadedQuantity ?? ""}:${fulfillment.issueReason ?? ""}:${fulfillment.restaurantReceivedQty ?? ""}:${fulfillment.restaurantNote ?? ""}`,
            )
            .join("|"),
        )
        .join(";"),
    [vendorOrders],
  );

  useEffect(() => {
    setPickDraft({});
  }, [fulfillmentFingerprint]);

  const forwardReviewMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await vendorOrderApi.forwardReviewToDriver(vendorId!, orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: "Sent to driver",
        description: "Restaurant review changes were forwarded to the driver for approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Forward failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pickingMutation = useMutation({
    mutationFn: async ({
      orderId,
      submitForReview,
    }: {
      orderId: string;
      submitForReview: boolean;
    }) => {
      const orderEntry = vendorOrders.find((entry) => entry.order.id === orderId);
      const lineItems = orderEntry?.lineItems ?? [];
      const draft = pickDraft[orderId] ?? {};
      const touchedItems = lineItems.filter((lineItem) => draft[lineItem.id]);
      if (touchedItems.length === 0) {
        throw new Error("Update loaded qty or add a worker note before saving.");
      }
      const items = lineItems.map((lineItem) => {
        const item = draft[lineItem.id] ?? getPickForLine(orderEntry!, lineItem);
        const vendorQty = getVendorAdjustedQty(
          getFulfillment(orderEntry!, lineItem.id),
          lineItem.quantity,
        );
        const loadedQty = item.loadedQty === "" ? vendorQty : Number(item.loadedQty);
        return {
          lineItemId: lineItem.id,
          status: derivePickingStatus(vendorQty, loadedQty),
          loadedQty: Number.isFinite(loadedQty) ? loadedQty : vendorQty,
          note: (item.note ?? "").trim() || null,
          warehouseTouched: Boolean(draft[lineItem.id]),
        };
      });
      await vendorOrderApi.picking(vendorId, orderId, {
        items,
        submitForReview,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({
        queryKey: vendorOrderKeys.detail(vendorId, variables.orderId),
      });
      setPickDraft((current) => {
        const next = { ...current };
        delete next[variables.orderId];
        return next;
      });
      toast({
        title: variables.submitForReview ? "Picking submitted for review" : "Picking saved",
        description: variables.submitForReview
          ? "Vendor will review and release the order to the driver."
          : undefined,
      });
      if (variables.submitForReview) {
        navigate("/vendor/orders?section=picking-submitted");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Picking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function getPickForLine(entry: VendorOrderEntry, lineItem: EnrichedLineItem): PickItem {
    const fulfillment = getFulfillment(entry, lineItem.id);
    const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
    const savedQty = getSavedLoadedQtyForOrder(fulfillment, entry.order);
    const serverNote = getWorkerNoteForOrder(fulfillment, entry.order);
    const draft = pickDraft[entry.order.id]?.[lineItem.id];
    if (!draft) {
      return {
        status:
          (fulfillment?.fulfillmentStatus as PickItem["status"]) ??
          derivePickingStatus(vendorQty, savedQty ?? vendorQty),
        loadedQty: savedQty ?? "",
        note: serverNote,
      };
    }
    return {
      status:
        draft.status ??
        (fulfillment?.fulfillmentStatus as PickItem["status"]) ??
        derivePickingStatus(vendorQty, savedQty ?? vendorQty),
      loadedQty:
        draft.loadedQty === "" ? (savedQty ?? "") : draft.loadedQty,
      note: draft.note ?? serverNote,
    };
  }

  function updatePick(orderId: string, lineItemId: string, patch: Partial<PickItem>) {
    setPickDraft((current) => {
      const existing = current[orderId]?.[lineItemId];
      if (existing) {
        return {
          ...current,
          [orderId]: {
            ...(current[orderId] ?? {}),
            [lineItemId]: { ...existing, ...patch },
          },
        };
      }

      const orderEntry = vendorOrders.find((entry) => entry.order.id === orderId);
      const lineItem = orderEntry?.lineItems.find((item) => item.id === lineItemId);
      const baseline =
        orderEntry && lineItem
          ? getPickForLine(orderEntry, lineItem)
          : { status: "loaded" as const, loadedQty: 0, note: "" };

      return {
        ...current,
        [orderId]: {
          ...(current[orderId] ?? {}),
          [lineItemId]: { ...baseline, ...patch },
        },
      };
    });
  }

  const sections = useMemo(
    () => ({
      submitted: vendorOrders
        .filter(({ order }) =>
          (order.status === "submitted" || order.status === "picking_review") &&
          !isDisputedOrder(order),
        )
        .filter(({ order }) =>
          isWarehouseWorker && userId
            ? canWorkerPickOrder(order, userId)
            : true,
        ),
      "picking-submitted": vendorOrders.filter(({ order }) =>
        isWarehouseWorker && userId
          ? isWarehouseSubmittedOrder(order, userId)
          : false,
      ),
      delivered: vendorOrders.filter(
        ({ order }) =>
          order.status === "delivered" &&
          !order.restaurantReviewSubmittedAt &&
          !isDisputedOrder(order),
      ),
      approval: vendorOrders.filter(
        ({ order }) =>
          order.restaurantIssueStatus === "pending_vendor" &&
          !isDisputedOrder(order) &&
          order.status !== "invoiced" &&
          order.status !== "paid",
      ),
      disputed: vendorOrders.filter(({ order }) => isDisputedOrder(order)),
      invoiced: vendorOrders.filter(
        ({ order }) => (order.status === "invoiced" || order.restaurantIssueStatus === "resolved_by_driver") && !order.paidAt,
      ),
      history: vendorOrders
        .filter(({ order }) => !!order.paidAt)
        .sort(
          (a, b) =>
            new Date(b.order.paidAt!).getTime() -
            new Date(a.order.paidAt!).getTime(),
        ),
    }),
    [vendorOrders, isWarehouseWorker, userId],
  );

  useEffect(() => {
    if (!isWarehouseWorker || isLoading || sections.submitted.length === 0) return;
    setExpandedOrderIds((current) => {
      if (Object.keys(current).length > 0) return current;
      return { [sections.submitted[0].order.id]: true };
    });
  }, [isWarehouseWorker, isLoading, sections.submitted]);

  useEffect(() => {
    if (!focusSection || isLoading) return;

    const section = document.querySelector(
      `[data-testid="section-vendor-orders-${focusSection}"]`,
    );
    if (!section) return;

    requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusSection, isLoading, vendorOrders.length]);

  if (!vendorId) return null;

  function toggleSection(sectionId: OrderSectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  function toggleOrder(orderId: string) {
    setExpandedOrderIds((current) => ({
      ...current,
      [orderId]: !(current[orderId] ?? true),
    }));
  }

  function handleViewOrder(entry: VendorOrderEntry, sectionId: OrderSectionId) {
    if (sectionId === "invoiced" || entry.order.status === "invoiced") {
      navigate(`/vendor/orders/${entry.order.id}/approve`);
      return;
    }
    navigate(`/vendor/orders/${entry.order.id}`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Orders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isWarehouseWorker
            ? "Pick assigned orders and submit them for manager review."
            : "Track submitted, delivered, approved, invoiced, and paid orders."}
        </p>
      </div>

      <div className="space-y-5">
        <OrderSection
          id="submitted"
          title={isWarehouseWorker ? "Active Orders" : "Submitted Orders"}
          subtitle={isWarehouseWorker ? "Assigned and in progress" : "Awaiting delivery"}
          icon={isWarehouseWorker ? Package : Inbox}
          tone="blue"
          entries={sections.submitted}
          isOpen={openSections.submitted}
          onToggle={() => toggleSection("submitted")}
          expandedOrderIds={expandedOrderIds}
          onToggleOrder={toggleOrder}
          onViewOrder={handleViewOrder}
          isLoading={isLoading}
          emptyText={
            isWarehouseWorker
              ? "No orders assigned to you for picking."
              : "No submitted orders awaiting delivery"
          }
          enablePicking={isWarehouseWorker}
          pickDraft={pickDraft}
          onUpdatePick={updatePick}
          getPickForLine={getPickForLine}
          onSavePicking={(orderId) =>
            pickingMutation.mutate({ orderId, submitForReview: false })
          }
          onSubmitPicking={(orderId) =>
            pickingMutation.mutate({ orderId, submitForReview: true })
          }
          pickingPending={pickingMutation.isPending}
          canPickOrder={(order) => canWorkerPickOrder(order, userId)}
        />
        {isWarehouseWorker ? (
          <div
            className="overflow-hidden rounded-lg border border-violet-200 bg-card shadow-sm"
            data-testid="section-vendor-orders-picking-submitted"
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-violet-200 bg-violet-50/40 px-6 py-4 text-left"
              onClick={() => toggleSection("picking-submitted")}
            >
              {openSections["picking-submitted"] ? (
                <ChevronDown className="h-4 w-4 text-violet-700" />
              ) : (
                <ChevronRight className="h-4 w-4 text-violet-700" />
              )}
              <ClipboardList className="h-4 w-4 text-violet-700" />
              <span className="text-base font-semibold text-violet-700">Submitted Orders</span>
              <Badge variant="outline" className="h-7 border-violet-200 bg-violet-100 px-3 text-sm text-violet-700">
                {isLoading ? "..." : sections["picking-submitted"].length}
              </Badge>
              <span className="text-sm text-muted-foreground">Awaiting vendor review</span>
            </button>
            {openSections["picking-submitted"] && (
              <div className="space-y-4 p-5">
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : sections["picking-submitted"].length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No orders submitted for manager review.
                  </p>
                ) : (
                  sections["picking-submitted"].map((entry) => (
                    <WarehouseOrderCard
                      key={entry.order.id}
                      entry={entry}
                      isOpen={expandedOrderIds[entry.order.id] ?? true}
                      onToggle={() => toggleOrder(entry.order.id)}
                      onOpenDetail={() => handleViewOrder(entry, "picking-submitted")}
                      getPickForLine={getPickForLine}
                      onUpdatePick={updatePick}
                      onSavePicking={() => undefined}
                      onSubmitPicking={() => undefined}
                      readOnly
                    />
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}
        {!isWarehouseWorker ? (
        <>
        <OrderSection
          id="delivered"
          title="Delivered"
          subtitle="Awaiting restaurant review"
          icon={Package}
          tone="orange"
          entries={sections.delivered}
          isOpen={openSections.delivered}
          onToggle={() => toggleSection("delivered")}
          expandedOrderIds={expandedOrderIds}
          onToggleOrder={toggleOrder}
          onViewOrder={handleViewOrder}
          isLoading={isLoading}
          emptyText="No delivered orders awaiting restaurant review"
        />
        <OrderSection
          id="approval"
          title="Invoiced / Review"
          subtitle="Restaurant review with quantity changes — forward to driver"
          icon={CheckCircle2}
          tone="violet"
          entries={sections.approval}
          isOpen={openSections.approval}
          onToggle={() => toggleSection("approval")}
          expandedOrderIds={expandedOrderIds}
          onToggleOrder={toggleOrder}
          onViewOrder={handleViewOrder}
          isLoading={isLoading}
          emptyText="No orders in this state"
          onForwardToDriver={(orderId) => forwardReviewMutation.mutate(orderId)}
          forwardPending={forwardReviewMutation.isPending}
        />
        <OrderSection
          id="disputed"
          title="Disputed Orders"
          subtitle="Review rejected by you"
          icon={ShieldAlert}
          tone="red"
          entries={sections.disputed}
          isOpen={openSections.disputed}
          onToggle={() => toggleSection("disputed")}
          expandedOrderIds={expandedOrderIds}
          onToggleOrder={toggleOrder}
          onViewOrder={handleViewOrder}
          isLoading={isLoading}
          emptyText="No disputed orders"
        />
        <OrderSection
          id="invoiced"
          title="Invoiced"
          subtitle="Awaiting payment from restaurant"
          icon={CreditCard}
          tone="emerald"
          entries={sections.invoiced}
          isOpen={openSections.invoiced}
          onToggle={() => toggleSection("invoiced")}
          expandedOrderIds={expandedOrderIds}
          onToggleOrder={toggleOrder}
          onViewOrder={handleViewOrder}
          isLoading={isLoading}
          emptyText="No invoiced orders"
        />
        <OrderSection
          id="history"
          title="Order History"
          subtitle="Paid orders"
          icon={Clock}
          tone="neutral"
          entries={sections.history}
          isOpen={openSections.history}
          onToggle={() => toggleSection("history")}
          expandedOrderIds={expandedOrderIds}
          onToggleOrder={toggleOrder}
          onViewOrder={handleViewOrder}
          isLoading={isLoading}
          emptyText="No paid orders yet"
        />
        </>
        ) : null}
      </div>
    </div>
  );
}
