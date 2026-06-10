import { useParams, useLocation } from "@/lib/wouter-compat";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { vendorOrderPaths } from "@/api/vendor/orders";
import { vendorOrderApi } from "@/api/vendor/orders";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { apiUrl } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Package, UtensilsCrossed, CalendarDays, Hash, ClipboardList,
  ShoppingCart, Lock, Truck,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserData } from "@/lib/portal-auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedLineItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceAtTimeOfOrder: string;
  productName: string;
  sku: string | null;
}

interface VendorOrderDetailResponse {
  order: {
    id: string;
    restaurantOrgId: string;
    vendorId: string;
    status: string;
    createdAt: string;
    displayId?: number;
    warehouseWorkerId?: string | null;
    driverId?: string | null;
    pickingStatus?: string | null;
  };
  lineItems: EnrichedLineItem[];
  fulfillments: any[];
  restaurantName: string;
  vendorName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  submitted: {
    label: "Submitted",
    classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
  draft: {
    label: "Draft",
    classes: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  },
  delivered: {
    label: "Delivered",
    classes: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery<VendorOrderDetailResponse>({
    queryKey: vendorOrderKeys.detail(vendorId, orderId),
    enabled: !!vendorId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(vendorOrderPaths.detail(vendorId, orderId)));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  const [driverNote, setDriverNote] = useState("");
  const [pickingState, setPickingState] = useState<
    Record<string, { status: string; loadedQty: number; note: string }>
  >({});

  const deliverMutation = useMutation({
    mutationFn: async (note?: string) => {
      const res = await vendorOrderApi.deliver(vendorId, orderId, { note });
      return res.json() as Promise<{ restaurantOrgId: string; vendorId: string }>;
    },
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      if (updatedOrder?.restaurantOrgId) {
        queryClient.invalidateQueries({
          queryKey: restaurantOrderKeys.submittedList(updatedOrder.restaurantOrgId, vendorId),
        });
      }
      toast({ title: "Order marked as delivered", description: "The restaurant will now see this order for review." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approvePickingMutation = useMutation({
    mutationFn: async () => {
      const res = await vendorOrderApi.approvePicking(vendorId, orderId);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      toast({ title: "Picking approved", description: "Order is ready for delivery" });
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const pickingMutation = useMutation({
    mutationFn: async (submitForReview: boolean) => {
      const items = (data?.lineItems ?? []).map((li) => {
        const vals = pickingState[li.id] ?? {
          status: "loaded",
          loadedQty: li.quantity,
          note: "",
        };
        return {
          lineItemId: li.id,
          status: vals.status as "loaded" | "partial" | "no_stock",
          loadedQty: Number(vals.loadedQty),
          note: vals.note || "",
        };
      });
      const res = await vendorOrderApi.picking(vendorId, orderId, {
        items,
        submitForReview,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      toast({ title: "Picking updated successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const currentUser = getUserData();
  const currentRole = currentUser?.role;
  const currentUserId = currentUser?.id ? String(currentUser.id) : null;
  const order = data?.order;
  const lineItems = data?.lineItems ?? [];
  const fulfillments = data?.fulfillments ?? [];

  const isManager = currentRole === "vendor_admin" || currentRole === "manager";
  const needsReview = order?.pickingStatus === "review" && isManager;
  const isDriver = currentRole === "driver" || currentRole === "manager";
  const canDeliver =
    order?.status === "ready_for_delivery" &&
    isDriver &&
    (order.driverId === currentUserId || !order.driverId);
  const isWarehouseWorker = currentRole === "warehouse" || currentRole === "warehouse_worker";
  const isWarehouseManager = currentRole === "manager" || currentRole === "vendor_admin";
  const isAssignedWorker = !!currentUserId && order?.warehouseWorkerId === currentUserId;
  const canPick =
    needsReview ||
    (order?.status === "submitted" &&
      !!order?.warehouseWorkerId &&
      ((isWarehouseWorker && isAssignedWorker) || isWarehouseManager));

  useEffect(() => {
    if (!canPick || lineItems.length === 0) return;
    setPickingState((current) => {
      if (Object.keys(current).length > 0) return current;
      const initial: Record<string, { status: string; loadedQty: number; note: string }> = {};
      for (const li of lineItems) {
        const fulfillment = fulfillments.find((f: { orderLineItemId: string }) => f.orderLineItemId === li.id);
        initial[li.id] = {
          status: fulfillment?.fulfillmentStatus || "loaded",
          loadedQty: fulfillment?.loadedQuantity ?? li.quantity,
          note: fulfillment?.warehouseNote || "",
        };
      }
      return initial;
    });
  }, [canPick, lineItems, fulfillments, order?.id]);

  const ordersListPath = isWarehouseWorker ? "/vendor/orders" : "/vendor/portal";

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-4">You must be logged in as a vendor.</p>
          <Button onClick={() => navigate("/vendor/login")} data-testid="button-go-login">
            Go to Vendor Login
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 p-6 max-w-4xl mx-auto">
        <Skeleton className="h-5 w-32 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    const msg = (error as Error)?.message ?? "Order not found.";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-sm font-medium" data-testid="text-error-message">{msg}</p>
        <Button variant="outline" onClick={() => navigate("/vendor/portal")} data-testid="button-back-on-error">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Received Orders
        </Button>
      </div>
    );
  }

  const restaurantName = data.restaurantName;
  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.submitted;
  const itemCount = lineItems.length;
  const orderTotal = lineItems.reduce(
    (sum, li) => sum + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-muted/20" data-testid="page-vendor-order-detail">
      {/* Top nav */}
      <div className="border-b bg-card px-6 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
          onClick={() => navigate(ordersListPath)}
          data-testid="button-back-to-portal"
        >
          <ArrowLeft className="h-4 w-4" />
          {isWarehouseWorker ? "Orders" : "Received Orders"}
        </Button>
        <span className="text-muted-foreground text-sm">/</span>
        <span className="text-sm font-medium text-foreground" data-testid="text-breadcrumb-order-id">
          Order #{order.displayId ?? '—'}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">
                Order Detail
              </h1>
              <Badge
                variant="outline"
                className={`text-xs font-medium ${statusCfg.classes}`}
                data-testid="badge-order-status"
              >
                {statusCfg.label}
              </Badge>
            </div>
            {!canPick ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Read-only view
              </p>
            ) : (
              <p className="text-sm text-blue-700 flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" />
                Picking mode
              </p>
            )}
          </div>
          {canDeliver && (
            <div className="flex flex-col gap-2 items-end">
              <Input
                placeholder="Driver note (optional)..."
                value={driverNote}
                onChange={e => setDriverNote(e.target.value)}
                className="w-[250px] h-8 text-sm"
              />
              <Button
                onClick={() => deliverMutation.mutate(driverNote)}
                disabled={deliverMutation.isPending}
                className="shrink-0"
                data-testid="button-mark-delivered"
              >
                <Truck className="h-4 w-4 mr-1.5" />
              {deliverMutation.isPending ? "Marking..." : "Mark Delivered"}
              </Button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg bg-card px-4 py-3 space-y-1" data-testid="card-restaurant">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <UtensilsCrossed className="h-3 w-3" />
              Restaurant
            </div>
            <p className="text-sm font-semibold text-foreground" data-testid="text-restaurant-name">
              {restaurantName}
            </p>
          </div>
          <div className="border rounded-lg bg-card px-4 py-3 space-y-1" data-testid="card-order-date">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <CalendarDays className="h-3 w-3" />
              Order Date
            </div>
            <p className="text-sm font-semibold text-foreground" data-testid="text-order-date">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="border rounded-lg bg-card px-4 py-3 space-y-1" data-testid="card-item-count">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <ShoppingCart className="h-3 w-3" />
              Items
            </div>
            <p className="text-sm font-semibold text-foreground" data-testid="text-item-count">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="border rounded-lg bg-card px-4 py-3 space-y-1" data-testid="card-order-total">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <ClipboardList className="h-3 w-3" />
              Order Total
            </div>
            <p className="text-sm font-bold text-foreground" data-testid="text-order-total">
              {formatCurrency(String(orderTotal.toFixed(2)))}
            </p>
          </div>
        </div>

        {/* Order ID */}
        <div className="border rounded-lg bg-card px-4 py-3 flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">Order</span>
          <span className="text-sm font-semibold text-foreground ml-1" data-testid="text-full-order-id">
            #{order.displayId ?? '—'}
          </span>
        </div>

        {needsReview ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="mr-2 text-sm font-medium text-amber-800 dark:text-amber-200">
              Shortage review needed
            </span>
            <Button variant="outline" size="sm" onClick={() => pickingMutation.mutate(true)} disabled={pickingMutation.isPending}>
              Save Edits
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => approvePickingMutation.mutate()} disabled={approvePickingMutation.isPending}>
              Approve Picking
            </Button>
          </div>
        ) : null}

        {/* Line Items */}
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-line-items">
          <div className="px-5 py-3 border-b bg-muted/20 flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Product</TableHead>
                <TableHead className="font-medium">SKU</TableHead>
                <TableHead className="font-medium text-right">Qty</TableHead>
                <TableHead className="font-medium text-right">Unit Price</TableHead>
                <TableHead className="font-medium text-right">Line Total</TableHead>
                {canPick ? (
                  <>
                    <TableHead className="font-medium text-right">Picked Qty</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium">Note</TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((li) => {
                const pick = pickingState[li.id] ?? {
                  status: "loaded",
                  loadedQty: li.quantity,
                  note: "",
                };
                const pickedQty = canPick ? pick.loadedQty : li.quantity;
                const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * pickedQty;
                return (
                  <TableRow key={li.id} data-testid={`row-order-item-${li.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5 shrink-0">
                          <Package className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="font-medium text-sm" data-testid={`text-item-name-${li.id}`}>
                          {li.productName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono" data-testid={`text-item-sku-${li.id}`}>
                      {li.sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium" data-testid={`text-item-qty-${li.id}`}>
                      {li.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground" data-testid={`text-item-price-${li.id}`}>
                      {formatCurrency(li.unitPriceAtTimeOfOrder)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold" data-testid={`text-item-total-${li.id}`}>
                      {formatCurrency(String(lineTotal.toFixed(2)))}
                    </TableCell>
                    {canPick ? (
                      <>
                        <TableCell className="text-right">
                          <Input
                            className="ml-auto w-24 text-right"
                            type="number"
                            min={0}
                            value={pick.loadedQty}
                            onChange={(event) =>
                              setPickingState((current) => ({
                                ...current,
                                [li.id]: {
                                  ...pick,
                                  loadedQty: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={pick.status}
                            onValueChange={(value) =>
                              setPickingState((current) => ({
                                ...current,
                                [li.id]: {
                                  ...pick,
                                  status: value,
                                },
                              }))
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
                        <TableCell>
                          <Input
                            value={pick.note}
                            onChange={(event) =>
                              setPickingState((current) => ({
                                ...current,
                                [li.id]: {
                                  ...pick,
                                  note: event.target.value,
                                },
                              }))
                            }
                            placeholder="Note"
                          />
                        </TableCell>
                      </>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Footer total */}
          <div className="px-5 py-3 border-t bg-muted/10 flex justify-end items-center gap-6">
            {canPick && (
              <div className="flex gap-2 mr-auto">
                <Button variant="outline" size="sm" onClick={() => pickingMutation.mutate(false)} disabled={pickingMutation.isPending}>Save Progress</Button>
                <Button size="sm" onClick={() => pickingMutation.mutate(true)} disabled={pickingMutation.isPending}>Submit for Review</Button>
              </div>
            )}
            <span className="text-sm text-muted-foreground font-medium">Order Total</span>
            <span className="text-base font-bold text-foreground" data-testid="text-footer-total">
              {formatCurrency(String(orderTotal.toFixed(2)))}
            </span>
          </div>
        </div>

        {/* Footer nav */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => navigate(ordersListPath)}
            data-testid="button-back-bottom"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to {isWarehouseWorker ? "Orders" : "Received Orders"}
          </Button>
        </div>
      </div>
    </div>
  );
}
