import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useLocation, useSearch } from "@/lib/wouter-compat";
import { vendorOrderApi, vendorOrderKeys } from "@/api/vendor/orders";
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
import { VENDOR_SECTION_IDS } from "@/lib/vendor-portal-sections";
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
  ShieldAlert,
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
  loadedQty: number;
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
  if (
    order.restaurantReviewSubmittedAt &&
    !order.vendorApprovedAt &&
    !order.vendorRejectedAt
  ) {
    return "Needs Approval";
  }
  if (order.status === "delivered") return "Delivered";
  return "Submitted";
}

function getFulfillment(entry: VendorOrderEntry, lineItemId: string) {
  return entry.fulfillments.find(
    (fulfillment) => fulfillment.orderLineItemId === lineItemId,
  );
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

function getOrderNotes(entry: VendorOrderEntry) {
  return entry.lineItems
    .map((lineItem) => {
      const fulfillment = getFulfillment(entry, lineItem.id);
      if (!fulfillment?.restaurantNote) return null;
      return `${lineItem.productName}: ${fulfillment.restaurantNote}`;
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
                  const notes = getOrderNotes(entry);
                  const orderCanPick = enablePicking && (canPickOrder?.(entry.order) ?? false);

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
                          {entry.lineItems.length}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(String(getOrderTotal(entry).toFixed(2)))}
                        </TableCell>
                        <TableCell className="text-right">
                          {!orderCanPick ? (
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
                          ) : null}
                        </TableCell>
                      </TableRow>

                      {isOrderOpen && (
                        <TableRow key={`${entry.order.id}-details`}>
                          <TableCell />
                          <TableCell colSpan={id === "history" ? 8 : 7}>
                            <div className="pb-5 pr-4">
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
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Loaded Qty</TableHead>
                                        <TableHead>Note</TableHead>
                                      </>
                                    ) : (
                                      <TableHead className="text-right">
                                        {id === "submitted" ? "Adj. Qty" : "Approved Qty"}
                                      </TableHead>
                                    )}
                                    <TableHead className="text-right">
                                      Unit Price
                                    </TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entry.lineItems.map((lineItem) => {
                                    const pick = getPickForLine?.(entry, lineItem);
                                    const approvedQty = getApprovedQuantity(
                                      entry,
                                      lineItem,
                                    );
                                    const displayQty = orderCanPick
                                      ? (pick?.loadedQty ?? lineItem.quantity)
                                      : approvedQty;
                                    const lineTotal = displayQty * getLinePrice(lineItem);

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
                                                value={pick.loadedQty}
                                                onChange={(event) =>
                                                  onUpdatePick?.(entry.order.id, lineItem.id, {
                                                    loadedQty: Number(event.target.value),
                                                  })
                                                }
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                value={pick.note}
                                                onChange={(event) =>
                                                  onUpdatePick?.(entry.order.id, lineItem.id, {
                                                    note: event.target.value,
                                                  })
                                                }
                                                placeholder="Note"
                                              />
                                            </TableCell>
                                          </>
                                        ) : (
                                          <TableCell
                                            className={`text-right ${
                                              approvedQty !== lineItem.quantity
                                                ? "text-orange-600"
                                                : ""
                                            }`}
                                          >
                                            {approvedQty}
                                            {approvedQty !== lineItem.quantity && " ↓"}
                                          </TableCell>
                                        )}
                                        <TableCell className="text-right text-muted-foreground">
                                          {formatCurrency(
                                            String(getLinePrice(lineItem).toFixed(2)),
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {formatCurrency(String(lineTotal.toFixed(2)))}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>

                              {orderCanPick ? (
                                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
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
                              ) : null}

                              <div className="mt-4 flex justify-end gap-12 border-t pt-4">
                                <span className="text-sm text-muted-foreground">
                                  Total
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatCurrency(
                                    String(getOrderTotal(entry).toFixed(2)),
                                  )}
                                </span>
                              </div>

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
      const items = lineItems.map((lineItem) => {
        const item = draft[lineItem.id] ?? getPickForLine(orderEntry!, lineItem);
        return {
          lineItemId: lineItem.id,
          status: item.status,
          loadedQty: Number.isFinite(Number(item.loadedQty))
            ? Number(item.loadedQty)
            : lineItem.quantity,
          note: item.note ?? "",
        };
      });
      await vendorOrderApi.picking(vendorId, orderId, {
        items,
        submitForReview,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      toast({
        title: variables.submitForReview ? "Picking submitted for review" : "Picking saved",
      });
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
    const draft = pickDraft[entry.order.id]?.[lineItem.id];
    if (draft) return draft;
    const fulfillment = getFulfillment(entry, lineItem.id);
    return {
      status: (fulfillment?.fulfillmentStatus as PickItem["status"]) ?? "loaded",
      loadedQty: fulfillment?.loadedQuantity ?? lineItem.quantity,
      note: fulfillment?.warehouseNote ?? "",
    };
  }

  function updatePick(orderId: string, lineItemId: string, patch: Partial<PickItem>) {
    setPickDraft((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {}),
        [lineItemId]: {
          status: "loaded",
          loadedQty: 0,
          note: "",
          ...(current[orderId]?.[lineItemId] ?? {}),
          ...patch,
        },
      },
    }));
  }

  const sections = useMemo(
    () => ({
      submitted: vendorOrders
        .filter(({ order }) => order.status === "submitted" && !isDisputedOrder(order))
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
          !!order.restaurantReviewSubmittedAt &&
          !isDisputedOrder(order) &&
          order.status !== "invoiced" &&
          order.status !== "paid" &&
          order.restaurantIssueStatus !== "pending_driver" &&
          order.restaurantIssueStatus !== "resolved_by_driver",
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
    <div className="px-7 py-7">
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
          <OrderSection
            id="picking-submitted"
            title="Submitted Orders"
            subtitle="Awaiting manager review"
            icon={ClipboardList}
            tone="violet"
            entries={sections["picking-submitted"]}
            isOpen={openSections["picking-submitted"]}
            onToggle={() => toggleSection("picking-submitted")}
            expandedOrderIds={expandedOrderIds}
            onToggleOrder={toggleOrder}
            onViewOrder={handleViewOrder}
            isLoading={isLoading}
            emptyText="No orders submitted for manager review."
          />
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
          subtitle="Restaurant review already handled"
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
