import type { Order, OrderLineItem } from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  derivePickingStatus,
  formatFulfillmentStatus,
  getOriginalOrderTotal,
  getVendorAdjustedQty,
  getVendorAdjustedTotal,
  getVendorNote,
  getWarehouseLoadedTotal,
  getSavedLoadedQtyForOrder,
  formatSavedLoadedQtyForOrder,
  getWorkerNoteForOrder,
  hasVendorAdjustment,
  hasWarehouseAdjustment,
  orderHasWarehouseLoadedData,
  normalizeLineFulfillment,
} from "@/lib/vendor-order-fulfillment";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Hash,
  Package,
  Pencil,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";

type EnrichedLineItem = OrderLineItem & {
  productName: string;
  sku: string | null;
};

type LineFulfillment = {
  orderLineItemId: string;
  fulfilledQuantity?: number | null;
  loadedQuantity?: number | null;
  warehouseNote?: string | null;
  fulfillmentStatus?: string | null;
  issueReason?: string | null;
};

export type PickItem = {
  status: "loaded" | "partial" | "no_stock";
  loadedQty: number | "";
  note: string;
};

type WarehouseOrderEntry = {
  order: Order;
  lineItems: EnrichedLineItem[];
  restaurantName: string;
  fulfillments: LineFulfillment[];
};

function formatShortDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLongDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getOrderNumber(order: Order) {
  return order.displayId != null ? `#${order.displayId}` : "—";
}

function getFulfillment(entry: WarehouseOrderEntry, lineItemId: string) {
  const fulfillment = entry.fulfillments.find((f) => f.orderLineItemId === lineItemId);
  return fulfillment ? normalizeLineFulfillment(fulfillment) : undefined;
}

interface WarehouseOrderCardProps {
  entry: WarehouseOrderEntry;
  isOpen: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  getPickForLine: (entry: WarehouseOrderEntry, lineItem: EnrichedLineItem) => PickItem;
  onUpdatePick: (orderId: string, lineItemId: string, patch: Partial<PickItem>) => void;
  onSavePicking: (orderId: string) => void;
  onSubmitPicking: (orderId: string) => void;
  pickingPending?: boolean;
  readOnly?: boolean;
}

export function WarehouseOrderCard({
  entry,
  isOpen,
  onToggle,
  onOpenDetail,
  getPickForLine,
  onUpdatePick,
  onSavePicking,
  onSubmitPicking,
  pickingPending = false,
  readOnly = false,
}: WarehouseOrderCardProps) {
  const { order, lineItems, restaurantName } = entry;
  const origTotal = getOriginalOrderTotal(lineItems);
  const vendorAdjustedTotal = getVendorAdjustedTotal(lineItems, (lineItemId) =>
    getFulfillment(entry, lineItemId),
  );
  const warehouseLoadedTotal = readOnly
    ? getWarehouseLoadedTotal(lineItems, (lineItemId) =>
        getSavedLoadedQtyForOrder(getFulfillment(entry, lineItemId), entry.order),
      )
    : getWarehouseLoadedTotal(lineItems, (lineItemId) => {
        const lineItem = lineItems.find((item) => item.id === lineItemId);
        if (!lineItem) return null;
        const pick = getPickForLine(entry, lineItem);
        if (pick.loadedQty === "") {
          return getSavedLoadedQtyForOrder(getFulfillment(entry, lineItemId), entry.order);
        }
        return Number(pick.loadedQty);
      });
  const showWarehouseLoadedTotal = orderHasWarehouseLoadedData(
    entry.fulfillments,
    entry.order,
  );
  return (
    <div
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
      data-testid={`card-warehouse-order-${order.id}`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
          onClick={onToggle}
          aria-label="Toggle order details"
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{restaurantName}</span>
            <span className="text-sm text-muted-foreground">{getOrderNumber(order)}</span>
            <Badge className={readOnly ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100"}>
              {readOnly ? "Picking Review" : "Submitted"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatShortDate(order.createdAt)} · {lineItems.length}{" "}
            {lineItems.length === 1 ? "item" : "items"} · Warehouse total{" "}
            {formatCurrency(String(warehouseLoadedTotal.toFixed(2)))}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onOpenDetail}>
          <ExternalLink className="h-4 w-4" />
          Open Detail
        </Button>
      </div>

      {isOpen ? (
        <div className="space-y-5 p-5">
          <p className={`text-sm ${readOnly ? "text-violet-700" : "text-muted-foreground"}`}>
            {readOnly
              ? "Picking submitted — awaiting vendor review"
              : "Adjustable — order is awaiting delivery"}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UtensilsCrossed className="h-3 w-3" />
                Restaurant
              </div>
              <p className="text-sm font-semibold">{restaurantName}</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                Order Date
              </div>
              <p className="text-sm font-semibold">{formatLongDate(order.createdAt)}</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShoppingCart className="h-3 w-3" />
                Items
              </div>
              <p className="text-sm font-semibold">
                {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ClipboardList className="h-3 w-3" />
                Order Total
              </div>
              <p className="text-sm font-bold">{formatCurrency(String(origTotal.toFixed(2)))}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Orig. Order Total</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(String(origTotal.toFixed(2)))}</p>
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
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Warehouse Loaded Total</p>
              <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {showWarehouseLoadedTotal
                  ? formatCurrency(String(warehouseLoadedTotal.toFixed(2)))
                  : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Order</span>
            <span className="text-sm font-semibold">{getOrderNumber(order)}</span>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b bg-muted/20 px-5 py-3">
              <div className="flex items-start gap-2">
                <Pencil className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <h3 className="text-sm font-semibold">Adjust Order</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Review vendor adjustments below, then record loaded quantities and notes for picking.
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Ordered Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Orig. Total</TableHead>
                    <TableHead className="text-right">Vendor Qty</TableHead>
                    <TableHead className="text-right">Vendor Total</TableHead>
                    <TableHead>Vendor Note</TableHead>
                    <TableHead className="text-right">Loaded Qty</TableHead>
                    <TableHead className="text-right">Loaded Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Worker Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((lineItem) => {
                    const fulfillment = getFulfillment(entry, lineItem.id);
                    const pick = getPickForLine(entry, lineItem);
                    const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
                    const vendorNote = getVendorNote(fulfillment);
                    const unitPrice = Number(lineItem.unitPriceAtTimeOfOrder);
                    const origLineTotal = lineItem.quantity * unitPrice;
                    const vendorLineTotal = vendorQty * unitPrice;
                    const loadedQty = readOnly
                      ? getSavedLoadedQtyForOrder(fulfillment, entry.order)
                      : pick.loadedQty === ""
                        ? null
                        : Number(pick.loadedQty);
                    const loadedLineTotal =
                      loadedQty == null ? null : loadedQty * unitPrice;
                    const adjusted = hasVendorAdjustment(fulfillment, lineItem.quantity);
                    const warehouseAdjusted = hasWarehouseAdjustment(
                      fulfillment,
                      vendorQty,
                      entry.order,
                    );
                    const qtyMarker =
                      vendorQty > lineItem.quantity ? " ↑" : vendorQty < lineItem.quantity ? " ↓" : "";

                    return (
                      <TableRow key={lineItem.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-blue-50 p-1.5 dark:bg-blue-950/40">
                              <Package className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm font-medium">{lineItem.productName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {lineItem.sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{lineItem.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(lineItem.unitPriceAtTimeOfOrder)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(String(origLineTotal.toFixed(2)))}
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-semibold ${adjusted ? "text-primary" : ""}`}
                        >
                          {vendorQty}
                          {adjusted ? qtyMarker : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-primary">
                          {formatCurrency(String(vendorLineTotal.toFixed(2)))}
                        </TableCell>
                        <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                          <span className="line-clamp-3" title={vendorNote || undefined}>
                            {vendorNote || "—"}
                          </span>
                        </TableCell>
                        {readOnly ? (
                          <>
                            <TableCell className="text-right text-sm font-semibold">
                              {formatSavedLoadedQtyForOrder(fulfillment, entry.order)}
                            </TableCell>
                            <TableCell
                              className={`text-right text-sm font-semibold ${warehouseAdjusted ? "text-emerald-700" : ""}`}
                            >
                              {loadedLineTotal == null
                                ? "—"
                                : formatCurrency(String(loadedLineTotal.toFixed(2)))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatFulfillmentStatus(fulfillment?.fulfillmentStatus)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {getWorkerNoteForOrder(fulfillment, entry.order) || "—"}
                            </TableCell>
                          </>
                        ) : (
                          <>
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
                                  const nextLoadedQty = raw === "" ? "" : Number(raw);
                                  onUpdatePick(order.id, lineItem.id, {
                                    loadedQty: nextLoadedQty,
                                    status: derivePickingStatus(
                                      vendorQty,
                                      nextLoadedQty === "" ? 0 : nextLoadedQty,
                                    ),
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold text-emerald-700">
                              {loadedLineTotal == null
                                ? "—"
                                : formatCurrency(String(loadedLineTotal.toFixed(2)))}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={pick.status}
                                onValueChange={(value) =>
                                  onUpdatePick(order.id, lineItem.id, {
                                    status: value as PickItem["status"],
                                  })
                                }
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="loaded">Loaded</SelectItem>
                                  <SelectItem value="partial">Partial</SelectItem>
                                  <SelectItem value="no_stock">No Stock</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={pick.note ?? ""}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                name={`worker-note-${order.id}-${lineItem.id}`}
                                onChange={(event) =>
                                  onUpdatePick(order.id, lineItem.id, { note: event.target.value })
                                }
                                placeholder="Worker note..."
                              />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-4 border-t bg-muted/10 px-5 py-3">
              <span className="text-sm text-muted-foreground">
                Orig. Order Total{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(String(origTotal.toFixed(2)))}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm text-primary">
                <Pencil className="h-3.5 w-3.5" />
                Vendor Adjusted Total{" "}
                <span className="font-bold">{formatCurrency(String(vendorAdjustedTotal.toFixed(2)))}</span>
              </span>
              <span className="text-sm font-medium text-emerald-700">
                Warehouse Loaded Total{" "}
                <span className="font-bold">
                  {showWarehouseLoadedTotal
                    ? formatCurrency(String(warehouseLoadedTotal.toFixed(2)))
                    : "—"}
                </span>
              </span>
              {!readOnly ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pickingPending}
                    onClick={() => onSavePicking(order.id)}
                  >
                    Save Picking
                  </Button>
                  <Button size="sm" disabled={pickingPending} onClick={() => onSubmitPicking(order.id)}>
                    Send to Picking Review
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
