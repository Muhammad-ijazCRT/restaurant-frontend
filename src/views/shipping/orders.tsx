import { useEffect, useMemo, useRef, useState } from "react";
import { vendorOrderApi } from "@/api/vendor/orders";
import { profileKeys } from "@/api/shared/profile";
import { vendorEmployeeKeys } from "@/api/vendor/employees";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { vendorProductKeys } from "@/api/vendor/products";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "@/lib/wouter-compat";
import type { LineFulfillment, Order, OrderLineItem, Product, VendorEmployee } from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import {
  isDriverActiveDeliveryOrder,
  isDriverCompletedOrder,
  isDriverQueueOrder,
  isDriverWaitingForWarehouse,
  isWarehouseQueueOrder,
} from "@/lib/shipping-employee-orders";
import {
  formatFulfillmentStatus,
  getOriginalOrderTotal,
  getSavedLoadedQtyForOrder,
  formatSavedLoadedQtyForOrder,
  getWorkerNoteForOrder,
  getEffectiveLoadedQty,
  getVendorAdjustedQty,
  getVendorAdjustedTotal,
  getVendorNote,
  getWarehouseLoadedTotal,
  getDriverDeliveryNote,
  getDriverResolutionNote,
  hasVendorAdjustment,
  hasWarehouseAdjustment,
  orderHasWarehouseLoadedData,
  derivePickingStatus,
  getRestaurantReceivedQty,
  getRestaurantNote,
  getRestaurantReviewTotal,
  getRestaurantReviewItemCount,
  hasRestaurantReviewAdjustment,
  getEffectiveLineQty,
} from "@/lib/vendor-order-fulfillment";
import {
  canShowDriverAssignment,
  canShowWarehouseAssignment,
} from "@/lib/vendor-warehouse-orders";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Package, Pencil, Truck } from "lucide-react";

type EnrichedLineItem = OrderLineItem & { productName: string; sku: string | null };
type VendorOrderEntry = {
  order: Order;
  lineItems: EnrichedLineItem[];
  restaurantName: string;
  fulfillments: LineFulfillment[];
};

type PickDraft = Record<string, { status: "loaded" | "partial" | "no_stock"; loadedQty: number | ""; note: string }>;

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  picking_review: "Picking Review",
  ready_for_delivery: "Ready for Delivery",
  delivered: "Delivered",
  pending_driver: "Needs Driver Review",
  pending_vendor: "Needs Vendor Review",
  resolved_by_driver: "Resolved by Driver",
  invoiced: "Invoiced",
};

function isPickingReviewOrder(order: Order) {
  return order.pickingStatus === "review" || order.status === "picking_review";
}

function getFulfillment(entry: VendorOrderEntry, lineItemId: string) {
  return entry.fulfillments.find((item) => item.orderLineItemId === lineItemId);
}

function getRestaurantNotes(entry: VendorOrderEntry) {
  return entry.lineItems
    .map((lineItem) => {
      const note = getRestaurantNote(getFulfillment(entry, lineItem.id));
      if (!note) return null;
      return `${lineItem.productName}: ${note}`;
    })
    .filter(Boolean) as string[];
}

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase());
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim().toLowerCase())
      : [String(parsed).trim().toLowerCase()];
  } catch {
    return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  }
}

type DriverOrderView = "queue" | "completed";

function filterDriverOrders(
  orders: VendorOrderEntry[],
  userId: string | undefined,
  view: DriverOrderView,
) {
  const filtered = orders.filter(({ order }) => {
    if (view === "completed") {
      return isDriverCompletedOrder(order, userId);
    }
    return isDriverQueueOrder(order, userId);
  });

  if (view === "completed") {
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.order.vendorConfirmedAt ?? a.order.createdAt).getTime();
      const bTime = new Date(b.order.vendorConfirmedAt ?? b.order.createdAt).getTime();
      return bTime - aTime;
    });
  }

  return [...filtered].sort((a, b) => {
    const aPending = a.order.restaurantIssueStatus === "pending_driver" ? 0 : 1;
    const bPending = b.order.restaurantIssueStatus === "pending_driver" ? 0 : 1;
    return aPending - bPending;
  });
}

function filterVisibleOrders(
  orders: VendorOrderEntry[],
  role: string | null,
  userId: string | undefined,
  canManageAssignments: boolean,
  driverView: DriverOrderView = "queue",
) {
  if (canManageAssignments) return orders.filter(({ order }) => order.status !== "draft");
  if (role === "warehouse_worker") {
    return orders.filter(({ order }) => isWarehouseQueueOrder(order, userId));
  }
  if (role === "driver") {
    return filterDriverOrders(orders, userId, driverView);
  }
  return orders.filter(({ order }) => isDriverActiveDeliveryOrder(order, userId));
}

function canDriverTakeAction(order: Order) {
  return order.status === "ready_for_delivery" || order.restaurantIssueStatus === "pending_driver";
}

function canWorkerTakeAction(order: Order) {
  return order.status === "submitted" && order.pickingStatus !== "approved";
}

export default function ShippingOrders() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const focusOrderId = searchParams.get("orderId");
  const driverView: DriverOrderView =
    searchParams.get("view") === "completed" ? "completed" : "queue";
  const [, navigate] = useLocation();
  const { vendorId } = useVendorAuth();
  const role = getUserRole();
  const user = getUserData();
  const userId = user?.id != null ? String(user.id) : undefined;
  const { toast } = useToast();
  const canManageAssignments = role === "vendor_admin" || role === "manager";
  const [pickDraft, setPickDraft] = useState<Record<string, PickDraft>>({});
  const [driverNotes, setDriverNotes] = useState<Record<string, string>>({});
  const [assignDraft, setAssignDraft] = useState<Record<string, { warehouseWorkerId: string; driverId: string }>>({});
  const [subDraft, setSubDraft] = useState<Record<string, { substituteProductId: string; proposedQty: number; note: string }>>({});
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(focusOrderId);
  const scrolledToOrderRef = useRef(false);

  const { data: orders = [], isLoading } = useQuery<VendorOrderEntry[]>({
    queryKey: vendorOrderKeys.list(vendorId),
    enabled: !!vendorId,
  });
  const { data: employees = [] } = useQuery<VendorEmployee[]>({
    queryKey: vendorEmployeeKeys.list(vendorId),
    enabled: !!vendorId && canManageAssignments,
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: vendorProductKeys.list(vendorId),
    enabled: !!vendorId && canManageAssignments,
  });

  const baseVisibleOrders = useMemo(
    () => filterVisibleOrders(orders, role, userId, canManageAssignments, driverView),
    [orders, role, userId, canManageAssignments, driverView],
  );

  const visibleOrders = useMemo(() => {
    if (!focusOrderId) return baseVisibleOrders;
    const focused = orders.find((entry) => entry.order.id === focusOrderId);
    if (!focused) return baseVisibleOrders;
    if (baseVisibleOrders.some((entry) => entry.order.id === focusOrderId)) return baseVisibleOrders;
    return [focused, ...baseVisibleOrders];
  }, [baseVisibleOrders, focusOrderId, orders]);

  const focusedHistoricalOrderIds = useMemo(() => {
    if (!focusOrderId) return new Set<string>();
    if (baseVisibleOrders.some((entry) => entry.order.id === focusOrderId)) return new Set<string>();
    return new Set([focusOrderId]);
  }, [baseVisibleOrders, focusOrderId]);

  useEffect(() => {
    scrolledToOrderRef.current = false;
    setHighlightedOrderId(focusOrderId);
  }, [focusOrderId]);

  useEffect(() => {
    if (!focusOrderId || isLoading || scrolledToOrderRef.current) return;
    const hasOrder = visibleOrders.some((entry) => entry.order.id === focusOrderId);
    if (!hasOrder) return;

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`shipping-order-${focusOrderId}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      scrolledToOrderRef.current = true;
    });

    const timer = window.setTimeout(() => setHighlightedOrderId(null), 4500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusOrderId, isLoading, visibleOrders]);

  const pickingMutation = useMutation({
    mutationFn: async ({ orderId, submitForReview }: { orderId: string; submitForReview: boolean }) => {
      const orderEntry = orders.find((entry) => entry.order.id === orderId);
      const lineItems = orderEntry?.lineItems ?? [];
      const draft = pickDraft[orderId] ?? {};
      const touchedItems = lineItems.filter((lineItem) => draft[lineItem.id]);
      if (touchedItems.length === 0) {
        throw new Error("Update loaded qty or add a worker note before saving.");
      }
      const items = lineItems.map((lineItem) => {
        const fulfillment = orderEntry?.fulfillments.find(
          (item) => item.orderLineItemId === lineItem.id,
        );
        const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
        const item = draft[lineItem.id] ?? getInitialPick(orderEntry!, lineItem);
        const loadedQty = item.loadedQty === "" ? vendorQty : Number(item.loadedQty);
        return {
          lineItemId: lineItem.id,
          status: derivePickingStatus(vendorQty, loadedQty),
          loadedQty: Number.isFinite(loadedQty) ? loadedQty : vendorQty,
          note: (item.note ?? "").trim() || null,
          warehouseTouched: Boolean(draft[lineItem.id]),
        };
      });
      await vendorOrderApi.picking(vendorId, orderId, { items, submitForReview });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({
        queryKey: vendorOrderKeys.detail(vendorId, variables.orderId),
      });
      toast({ title: "Picking saved" });
    },
    onError: (err: Error) => toast({ title: "Picking failed", description: err.message, variant: "destructive" }),
  });

  const releaseToDriverMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await vendorOrderApi.approvePicking(vendorId, orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({ title: "Released to driver", description: "Driver can now mark the order as delivered." });
    },
    onError: (err: Error) => toast({ title: "Release failed", description: err.message, variant: "destructive" }),
  });

  const deliverMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const note = (driverNotes[orderId] ?? "").trim();
      if (!note) {
        throw new Error("Add a delivery note before marking delivered.");
      }
      await vendorOrderApi.deliver(vendorId, orderId, { note });
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      setDriverNotes((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      toast({ title: "Order delivered", description: "The restaurant will now review this order." });
    },
    onError: (err: Error) => toast({ title: "Delivery failed", description: err.message, variant: "destructive" }),
  });

  const resolveIssueMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const note = (driverNotes[orderId] ?? "").trim();
      if (!note) {
        throw new Error("Add a resolution note before approving the invoice.");
      }
      await vendorOrderApi.resolveIssue(vendorId, orderId, { note });
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      setDriverNotes((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      toast({ title: "Issue resolved", description: "Invoice created after driver approval." });
    },
    onError: (err: Error) => toast({ title: "Resolution failed", description: err.message, variant: "destructive" }),
  });

  const forwardReviewMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await vendorOrderApi.forwardReviewToDriver(vendorId, orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: "Sent to driver",
        description: "Restaurant review changes were forwarded to the driver for approval.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Forward failed", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const orderEntry = orders.find((entry) => entry.order.id === orderId);
      const draft = assignDraft[orderId] ?? {
        warehouseWorkerId: orderEntry?.order.warehouseWorkerId ?? "",
        driverId: orderEntry?.order.driverId ?? "",
      };
      await vendorOrderApi.assign(vendorId, orderId, draft);
    },
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      const orderEntry = orders.find((entry) => entry.order.id === orderId);
      const wasAssigned = Boolean(orderEntry?.order.warehouseWorkerId || orderEntry?.order.driverId);
      toast({ title: wasAssigned ? "Assignment updated" : "Order assigned" });
    },
    onError: (err: Error) => toast({ title: "Assignment failed", description: err.message, variant: "destructive" }),
  });

  const substitutionMutation = useMutation({
    mutationFn: async ({ orderId, lineItemId }: { orderId: string; lineItemId: string }) => {
      const draft = subDraft[lineItemId];
      await vendorOrderApi.createSubstitution(vendorId, orderId, {
        lineItemId,
        substituteProductId: draft.substituteProductId,
        proposedQty: Number(draft.proposedQty),
        note: draft.note,
      });
    },
    onSuccess: () => toast({ title: "Substitution proposed" }),
    onError: (err: Error) => toast({ title: "Substitution failed", description: err.message, variant: "destructive" }),
  });

  function getInitialPick(entry: VendorOrderEntry, lineItem: EnrichedLineItem) {
    const draft = pickDraft[entry.order.id]?.[lineItem.id];
    if (draft) return draft;
    const fulfillment = entry.fulfillments.find((item) => item.orderLineItemId === lineItem.id);
    const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
    const savedQty = getSavedLoadedQtyForOrder(fulfillment, entry.order);
    return {
      status:
        (fulfillment?.fulfillmentStatus as "loaded" | "partial" | "no_stock") ??
        derivePickingStatus(vendorQty, savedQty ?? vendorQty),
      loadedQty: savedQty ?? "",
      note: getWorkerNoteForOrder(fulfillment, entry.order),
    };
  }

  function updatePick(orderId: string, lineItemId: string, patch: Partial<PickDraft[string]>) {
    setPickDraft((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {}),
        [lineItemId]: Object.assign(
          { status: "loaded" as const, loadedQty: 0, note: "" },
          current[orderId]?.[lineItemId] ?? {},
          patch,
        ),
      },
    }));
  }

  const warehouseWorkers = employees.filter((employee) =>
    normalizeRoles(employee.roles).some((roleName) => ["warehouse", "warehouse_worker"].includes(roleName))
  );
  const drivers = employees.filter((employee) =>
    normalizeRoles(employee.roles).includes("driver")
  );

  return (
    <div data-testid="page-shipping-orders">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">
          {role === "driver"
            ? driverView === "completed"
              ? "Completed Deliveries"
              : "Deliveries"
            : "Shipping Orders"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManageAssignments
            ? "Assign workers and drivers, then review picking for delivery."
            : role === "driver" && driverView === "completed"
              ? "Delivered orders assigned to you."
              : "Only orders assigned to you are shown here."}
        </p>
        {role === "driver" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={driverView === "queue" ? "default" : "outline"}
              onClick={() => navigate("/shipping-company/orders?view=queue")}
              data-testid="button-driver-view-queue"
            >
              Delivery Queue
            </Button>
            <Button
              size="sm"
              variant={driverView === "completed" ? "default" : "outline"}
              onClick={() => navigate("/shipping-company/orders?view=completed")}
              data-testid="button-driver-view-completed"
            >
              Completed Deliveries
            </Button>
          </div>
        ) : null}
      </div>

      {focusOrderId && !isLoading && !orders.some((entry) => entry.order.id === focusOrderId) ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The linked order could not be found. It may have been removed or you may not have access.
        </div>
      ) : null}

      <div className="space-y-4">
        {visibleOrders.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
            {role === "driver" && driverView === "completed"
              ? "No completed deliveries yet."
              : "No assigned orders right now."}
          </div>
        ) : visibleOrders.map((entry) => {
          const hasShortage = entry.fulfillments.some((item) => item.fulfillmentStatus === "partial" || item.fulfillmentStatus === "no_stock");
          const isFocused = highlightedOrderId === entry.order.id;
          const isCompletedView = role === "driver" && driverView === "completed";
          const isHistoricalFocus = isCompletedView || focusedHistoricalOrderIds.has(entry.order.id);
          const showPickingReviewLayout = canManageAssignments && isPickingReviewOrder(entry.order);
          const isDriverAssignedToOrder =
            role === "driver" &&
            (entry.order.driverId === userId || !entry.order.driverId);
          const showDriverReadyForDelivery =
            isDriverAssignedToOrder &&
            entry.order.status === "ready_for_delivery" &&
            entry.order.restaurantIssueStatus !== "pending_driver";
          const showDriverFulfillmentBreakdownLayout =
            isDriverAssignedToOrder &&
            (entry.order.status === "submitted" ||
              entry.order.status === "ready_for_delivery" ||
              entry.order.status === "delivered" ||
              entry.order.status === "invoiced" ||
              entry.order.restaurantIssueStatus === "pending_driver");
          const showVendorShippingDetailLayout =
            canManageAssignments && entry.order.status === "submitted";
          const showManagerFulfillmentBreakdownLayout =
            canManageAssignments &&
            (entry.order.status === "submitted" ||
              entry.order.status === "ready_for_delivery" ||
              entry.order.status === "delivered" ||
              entry.order.status === "invoiced" ||
              isPickingReviewOrder(entry.order));
          const showFulfillmentDetailLayout =
            showDriverFulfillmentBreakdownLayout || showManagerFulfillmentBreakdownLayout;
          const showWarehouseColumns = orderHasWarehouseLoadedData(
            entry.fulfillments,
            entry.order,
          );
          const showWarehouseAssignment = canManageAssignments && canShowWarehouseAssignment(entry.order);
          const showDriverAssignment = canManageAssignments && canShowDriverAssignment(entry.order);
          const showAssignmentSection = showWarehouseAssignment || showDriverAssignment;
          const origTotal = getOriginalOrderTotal(entry.lineItems);
          const vendorAdjustedTotal = getVendorAdjustedTotal(entry.lineItems, (lineItemId) =>
            getFulfillment(entry, lineItemId),
          );
          const warehouseLoadedTotal = getWarehouseLoadedTotal(entry.lineItems, (lineItemId) =>
            getSavedLoadedQtyForOrder(getFulfillment(entry, lineItemId), entry.order),
          );
          const showWarehouseLoadedTotal = orderHasWarehouseLoadedData(
            entry.fulfillments,
            entry.order,
          );
          const restaurantReviewTotal = getRestaurantReviewTotal(
            entry.lineItems,
            entry.fulfillments,
            entry.order,
          );
          const restaurantReviewItemCount = getRestaurantReviewItemCount(
            entry.lineItems,
            entry.fulfillments,
            entry.order,
          );
          const restaurantNotes = getRestaurantNotes(entry);
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
            entry.order.restaurantIssueStatus === "pending_vendor" ||
            entry.order.restaurantIssueStatus === "pending_driver" ||
            entry.order.restaurantIssueStatus === "resolved_by_driver" ||
            (showFulfillmentDetailLayout && hasRestaurantReviewData);
          const showForwardToDriverAction =
            canManageAssignments &&
            entry.order.restaurantIssueStatus === "pending_vendor" &&
            !isHistoricalFocus;
          const driverDeliveryNote = getDriverDeliveryNote(entry.order);
          const driverResolutionNote = getDriverResolutionNote(entry.order);
          const showDriverNoteColumn =
            showFulfillmentDetailLayout &&
            (entry.order.status === "delivered" ||
              entry.order.status === "invoiced" ||
              showRestaurantReviewDetail ||
              Boolean(driverDeliveryNote));
          return (
            <div
              key={entry.order.id}
              id={`shipping-order-${entry.order.id}`}
              className={`overflow-hidden rounded-lg border bg-card scroll-mt-24 transition-shadow duration-500 ${
                isFocused ? "border-primary ring-2 ring-primary/30 shadow-lg" : ""
              }`}
              data-testid={`card-shipping-order-${entry.order.id}`}
            >
              {isHistoricalFocus ? (
                <div className="border-b bg-primary/5 px-5 py-2 text-xs text-muted-foreground">
                  {isCompletedView
                    ? entry.order.vendorConfirmedAt
                      ? `Delivered on ${new Date(entry.order.vendorConfirmedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : "Completed delivery"
                    : "Opened from dashboard. This order is not in your active work queue, so actions are read-only."}
                </div>
              ) : role === "driver" &&
                entry.order.restaurantIssueStatus === "pending_driver" &&
                !isHistoricalFocus ? (
                <div className="border-b bg-violet-50 px-5 py-2 text-xs text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                  Restaurant review needs your approval — review received quantities below and approve
                  to create the invoice.
                </div>
              ) : role === "driver" && isDriverWaitingForWarehouse(entry.order, userId) ? (
                <div className="border-b bg-amber-50 px-5 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Assigned to you — waiting for warehouse picking to finish before delivery.
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Order #{entry.order.displayId ?? entry.order.id.slice(0, 8)}</h2>
                    {showPickingReviewLayout ? (
                      <Badge className="border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">
                        Picking Review
                      </Badge>
                    ) : entry.order.restaurantIssueStatus === "pending_driver" ? (
                      <Badge className="border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
                        Needs Driver Review
                      </Badge>
                    ) : showDriverReadyForDelivery ? (
                      <Badge className="border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">
                        Ready for Delivery
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline">{STATUS_LABELS[entry.order.status] ?? entry.order.status}</Badge>
                        {entry.order.pickingStatus && entry.order.pickingStatus !== "review" ? (
                          <Badge variant="secondary">Picking: {entry.order.pickingStatus}</Badge>
                        ) : null}
                      </>
                    )}
                    {entry.order.restaurantIssueStatus && (
                      <Badge variant="secondary">{STATUS_LABELS[entry.order.restaurantIssueStatus] ?? entry.order.restaurantIssueStatus}</Badge>
                    )}
                    {hasShortage && <Badge className="bg-amber-100 text-amber-700">Shortage</Badge>}
                  </div>
                  <p className={`mt-1 text-sm ${showFulfillmentDetailLayout ? "text-blue-700" : "text-muted-foreground"}`}>
                    {showPickingReviewLayout
                      ? "Warehouse picking review — review loaded quantities and worker notes below"
                      : showDriverReadyForDelivery
                        ? "Review vendor adjustments and warehouse notes before delivery"
                        : showDriverFulfillmentBreakdownLayout && entry.order.status === "submitted"
                          ? "Review original order and vendor adjustments — warehouse columns fill in after picking"
                          : showDriverFulfillmentBreakdownLayout &&
                              entry.order.restaurantIssueStatus === "pending_driver"
                            ? "Restaurant changed received quantities — review below, add your resolution note, and approve to create the invoice"
                            : showDriverFulfillmentBreakdownLayout && entry.order.status === "delivered"
                              ? "Delivered summary — original, vendor, warehouse, and your delivery note"
                              : showDriverFulfillmentBreakdownLayout && entry.order.status === "invoiced"
                                ? "Invoiced summary — original, vendor, warehouse, and your delivery note"
                                : showVendorShippingDetailLayout
                                ? "Review vendor adjustments below. Warehouse columns fill in after worker saves picking."
                              : showManagerFulfillmentBreakdownLayout &&
                                  entry.order.restaurantIssueStatus === "pending_vendor"
                                ? "Restaurant submitted quantity changes — review below and forward to the driver"
                                : showManagerFulfillmentBreakdownLayout &&
                                    entry.order.status === "ready_for_delivery"
                                  ? "Review original, vendor, and warehouse fulfillment before delivery"
                                  : showManagerFulfillmentBreakdownLayout &&
                                      entry.order.status === "delivered"
                                    ? "Fulfillment summary — original order, vendor adjustments, and warehouse loading"
                                    : showManagerFulfillmentBreakdownLayout &&
                                        entry.order.status === "invoiced"
                                      ? "Invoiced fulfillment summary — original, vendor, and warehouse details"
                                      : entry.restaurantName}
                  </p>
                  {showFulfillmentDetailLayout ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{entry.restaurantName}</p>
                  ) : null}
                </div>
                {showPickingReviewLayout ? (
                  <Button
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => releaseToDriverMutation.mutate(entry.order.id)}
                    disabled={releaseToDriverMutation.isPending}
                    data-testid={`button-release-to-driver-${entry.order.id}`}
                  >
                    <Truck className="mr-1.5 h-4 w-4" />
                    {releaseToDriverMutation.isPending ? "Releasing..." : "Release to Driver"}
                  </Button>
                ) : null}
              </div>

              {showAssignmentSection ? (
                <div className="border-b bg-muted/20 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fulfillment Assignment
                  </p>
                  <div
                    className={`grid gap-3 ${
                      showWarehouseAssignment && showDriverAssignment
                        ? "md:grid-cols-[1fr_1fr_auto]"
                        : "md:grid-cols-[1fr_auto]"
                    }`}
                  >
                    {showWarehouseAssignment ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
                        <Select
                          value={assignDraft[entry.order.id]?.warehouseWorkerId ?? entry.order.warehouseWorkerId ?? ""}
                          onValueChange={(value) => setAssignDraft((current) => ({
                            ...current,
                            [entry.order.id]: {
                              warehouseWorkerId: value,
                              driverId: current[entry.order.id]?.driverId ?? entry.order.driverId ?? "",
                            },
                          }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select warehouse worker" /></SelectTrigger>
                          <SelectContent>
                            {warehouseWorkers.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    {showDriverAssignment ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Driver</label>
                        <Select
                          value={assignDraft[entry.order.id]?.driverId ?? entry.order.driverId ?? ""}
                          onValueChange={(value) => setAssignDraft((current) => ({
                            ...current,
                            [entry.order.id]: {
                              warehouseWorkerId:
                                current[entry.order.id]?.warehouseWorkerId ?? entry.order.warehouseWorkerId ?? "",
                              driverId: value,
                            },
                          }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                          <SelectContent>
                            {drivers.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="flex items-end">
                      <Button
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        disabled={
                          (showWarehouseAssignment
                            && !(assignDraft[entry.order.id]?.warehouseWorkerId ?? entry.order.warehouseWorkerId))
                          || (showDriverAssignment
                            && !(assignDraft[entry.order.id]?.driverId ?? entry.order.driverId))
                          || assignMutation.isPending
                        }
                        onClick={() => assignMutation.mutate(entry.order.id)}
                      >
                        {entry.order.warehouseWorkerId || entry.order.driverId ? "Update Assignment" : "Assign"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showFulfillmentDetailLayout ? (
                <div
                  className={`grid grid-cols-1 gap-3 border-b px-5 py-4 ${
                    showRestaurantReviewDetail
                      ? "sm:grid-cols-2 lg:grid-cols-4"
                      : "sm:grid-cols-3"
                  }`}
                >
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
                  {showRestaurantReviewDetail ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
                      <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        Restaurant Review Total
                      </p>
                      <p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">
                        {formatCurrency(String(restaurantReviewTotal.toFixed(2)))}
                      </p>
                      <p className="mt-0.5 text-xs text-violet-600 dark:text-violet-400">
                        {restaurantReviewItemCount}{" "}
                        {restaurantReviewItemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Table>
                <TableHeader>
                <TableRow>
                    {showFulfillmentDetailLayout ? (
                      <>
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
                        {showDriverNoteColumn ? <TableHead>Delivery Note</TableHead> : null}
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
                      <>
                        <TableHead>Product</TableHead>
                        <TableHead>Ordered</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Loaded Qty</TableHead>
                        <TableHead>Note</TableHead>
                        {canManageAssignments && <TableHead>Substitute</TableHead>}
                        <TableHead className="text-right">Line Total</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lineItems.map((lineItem) => {
                    if (showFulfillmentDetailLayout) {
                      const fulfillment = getFulfillment(entry, lineItem.id);
                      const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
                      const vendorNote = getVendorNote(fulfillment);
                      const unitPrice = Number(lineItem.unitPriceAtTimeOfOrder);
                      const origLineTotal = lineItem.quantity * unitPrice;
                      const vendorLineTotal = vendorQty * unitPrice;
                      const savedLoadedQty = getSavedLoadedQtyForOrder(fulfillment, entry.order);
                      const loadedLineTotal =
                        savedLoadedQty == null ? null : savedLoadedQty * unitPrice;
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
                          <TableCell className={`text-right text-sm font-semibold ${adjusted ? "text-primary" : ""}`}>
                            {vendorQty}
                            {adjusted ? qtyMarker : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-primary">
                            {formatCurrency(String(vendorLineTotal.toFixed(2)))}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                            {vendorNote || "—"}
                          </TableCell>
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
                          {showDriverNoteColumn ? (
                            <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                              {driverDeliveryNote || "—"}
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
                                  className={`text-right text-sm font-semibold ${
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
                                  className={`text-right text-sm font-semibold ${
                                    reviewAdjusted
                                      ? "text-violet-700 dark:text-violet-300"
                                      : ""
                                  }`}
                                >
                                  {formatCurrency(String(reviewLineTotal.toFixed(2)))}
                                </TableCell>
                                <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                                  {restaurantNote || "—"}
                                </TableCell>
                              </>
                            );
                          })() : null}
                        </TableRow>
                      );
                    }

                    const pick = getInitialPick(entry, lineItem);
                    const editable = role === "warehouse_worker";
                    const shortage = pick.status === "partial" || pick.status === "no_stock";
                    const fulfillment = getFulfillment(entry, lineItem.id);
                    const vendorQty = getVendorAdjustedQty(fulfillment, lineItem.quantity);
                    const savedLoadedQty = getSavedLoadedQtyForOrder(fulfillment, entry.order);
                    const effectiveQty = getEffectiveLoadedQty(
                      fulfillment,
                      lineItem.quantity,
                      pick.loadedQty,
                    );
                    const unitPrice = Number(lineItem.unitPriceAtTimeOfOrder);
                    const lineTotal =
                      editable || savedLoadedQty != null
                        ? effectiveQty * unitPrice
                        : vendorQty * unitPrice;
                    const adjusted =
                      hasWarehouseAdjustment(fulfillment, vendorQty, entry.order)
                      || hasVendorAdjustment(fulfillment, lineItem.quantity);
                    return (
                      <TableRow key={lineItem.id}>
                        <TableCell>
                          <p className="font-medium">{lineItem.productName}</p>
                          <p className="text-xs text-muted-foreground">{lineItem.sku ?? "-"}</p>
                        </TableCell>
                        <TableCell>{lineItem.quantity}</TableCell>
                        <TableCell>
                          {editable ? (
                            <Select value={pick.status} onValueChange={(value) => updatePick(entry.order.id, lineItem.id, { status: value as PickDraft[string]["status"] })}>
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="loaded">Loaded</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="no_stock">No Stock</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{pick.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Input
                              className="w-24"
                              type="number"
                              min={0}
                              value={pick.loadedQty === "" ? "" : pick.loadedQty}
                              placeholder="Qty"
                              autoComplete="off"
                              onChange={(e) => {
                                const raw = e.target.value;
                                const loadedQty = raw === "" ? "" : Number(raw);
                                updatePick(entry.order.id, lineItem.id, {
                                  loadedQty,
                                  status: derivePickingStatus(
                                    vendorQty,
                                    loadedQty === "" ? 0 : loadedQty,
                                  ),
                                });
                              }}
                            />
                          ) : (
                            formatSavedLoadedQtyForOrder(fulfillment, entry.order)
                          )}
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Input
                              value={pick.note ?? ""}
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              name={`worker-note-${entry.order.id}-${lineItem.id}`}
                              onChange={(e) =>
                                updatePick(entry.order.id, lineItem.id, { note: e.target.value })
                              }
                              placeholder="Worker note..."
                            />
                          ) : (
                            getWorkerNoteForOrder(fulfillment, entry.order) || "—"
                          )}
                        </TableCell>
                        {canManageAssignments && (
                          <TableCell>
                            {shortage ? (
                              <div className="flex flex-col gap-2">
                                <Select
                                  value={subDraft[lineItem.id]?.substituteProductId ?? ""}
                                  onValueChange={(value) => setSubDraft((current) => ({
                                    ...current,
                                    [lineItem.id]: {
                                      substituteProductId: value,
                                      proposedQty: subDraft[lineItem.id]?.proposedQty ?? lineItem.quantity,
                                      note: subDraft[lineItem.id]?.note ?? "",
                                    },
                                  }))}
                                >
                                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select substitute" /></SelectTrigger>
                                  <SelectContent>
                                    {products.map((product) => (
                                      <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={1}
                                  className="w-24"
                                  value={subDraft[lineItem.id]?.proposedQty ?? lineItem.quantity}
                                  onChange={(e) => setSubDraft((current) => ({
                                    ...current,
                                    [lineItem.id]: {
                                      substituteProductId: subDraft[lineItem.id]?.substituteProductId ?? "",
                                      proposedQty: Number(e.target.value),
                                      note: subDraft[lineItem.id]?.note ?? "",
                                    },
                                  }))}
                                />
                                <Input
                                  value={subDraft[lineItem.id]?.note ?? ""}
                                  onChange={(e) => setSubDraft((current) => ({
                                    ...current,
                                    [lineItem.id]: {
                                      substituteProductId: subDraft[lineItem.id]?.substituteProductId ?? "",
                                      proposedQty: subDraft[lineItem.id]?.proposedQty ?? lineItem.quantity,
                                      note: e.target.value,
                                    },
                                  }))}
                                  placeholder="Sub note"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!subDraft[lineItem.id]?.substituteProductId}
                                  onClick={() => substitutionMutation.mutate({ orderId: entry.order.id, lineItemId: lineItem.id })}
                                >
                                  Propose
                                </Button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <span className={`font-medium ${adjusted ? "text-primary" : ""}`}>
                            {formatCurrency(String(lineTotal.toFixed(2)))}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(lineItem.unitPriceAtTimeOfOrder)} × {effectiveQty}
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {restaurantNotes.length > 0 ? (
                <div className="border-t border-violet-200 bg-violet-50/50 px-5 py-4 dark:border-violet-800 dark:bg-violet-950/20">
                  <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    Restaurant Notes
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-foreground">
                    {restaurantNotes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {driverResolutionNote ? (
                <div className="border-t border-sky-200 bg-sky-50/50 px-5 py-4 dark:border-sky-800 dark:bg-sky-950/20">
                  <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
                    Driver Resolution Note
                  </p>
                  <p className="mt-2 text-sm text-foreground">{driverResolutionNote}</p>
                </div>
              ) : null}

              {!showFulfillmentDetailLayout && canManageAssignments ? (
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
                </div>
              ) : null}

              {showForwardToDriverAction ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-200 bg-violet-50/50 px-5 py-3 dark:border-violet-800 dark:bg-violet-950/20">
                  <span className="text-sm text-violet-700 dark:text-violet-300">
                    Restaurant received{" "}
                    <span className="font-semibold">
                      {restaurantReviewItemCount}{" "}
                      {restaurantReviewItemCount === 1 ? "item" : "items"}
                    </span>{" "}
                    for{" "}
                    <span className="font-semibold">
                      {formatCurrency(String(restaurantReviewTotal.toFixed(2)))}
                    </span>
                    . Forward to the driver for final approval and invoicing.
                  </span>
                  <Button
                    size="sm"
                    className="bg-violet-600 text-white hover:bg-violet-700"
                    onClick={() => forwardReviewMutation.mutate(entry.order.id)}
                    disabled={forwardReviewMutation.isPending}
                    data-testid={`button-forward-to-driver-${entry.order.id}`}
                  >
                    <Truck className="mr-1.5 h-4 w-4" />
                    {forwardReviewMutation.isPending ? "Sending…" : "Send to Driver"}
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4">
                {role === "warehouse_worker" && canWorkerTakeAction(entry.order) && !isHistoricalFocus && (
                  <>
                    <Button variant="outline" onClick={() => pickingMutation.mutate({ orderId: entry.order.id, submitForReview: false })}>Save Picking</Button>
                    <Button onClick={() => pickingMutation.mutate({ orderId: entry.order.id, submitForReview: true })}>Send to Picking Review</Button>
                  </>
                )}
                {role === "driver" && canDriverTakeAction(entry.order) && !isHistoricalFocus && (
                  <div className="flex w-full flex-wrap items-center justify-end gap-2">
                    {entry.order.restaurantIssueStatus === "pending_driver" ? (
                      <div className="flex w-full flex-col gap-3">
                        <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-300">
                          Restaurant received{" "}
                          <span className="font-semibold">
                            {restaurantReviewItemCount}{" "}
                            {restaurantReviewItemCount === 1 ? "item" : "items"}
                          </span>{" "}
                          for{" "}
                          <span className="font-semibold">
                            {formatCurrency(String(restaurantReviewTotal.toFixed(2)))}
                          </span>
                          . Approve to create the invoice at this amount.
                        </div>
                        <div className="flex w-full flex-wrap items-end justify-end gap-2">
                          <div className="w-full flex-1 space-y-1.5">
                            <label
                              htmlFor={`driver-resolution-note-${entry.order.id}`}
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Driver Resolution Note <span className="text-destructive">*</span>
                            </label>
                            <Textarea
                              id={`driver-resolution-note-${entry.order.id}`}
                              className="min-h-20"
                              placeholder="Explain your approval — e.g. accepted restaurant count, damaged item confirmed..."
                              value={driverNotes[entry.order.id] ?? ""}
                              onChange={(event) =>
                                setDriverNotes((current) => ({
                                  ...current,
                                  [entry.order.id]: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <Button
                            className="bg-violet-600 text-white hover:bg-violet-700 sm:shrink-0"
                            onClick={() => resolveIssueMutation.mutate(entry.order.id)}
                            disabled={
                              resolveIssueMutation.isPending ||
                              !(driverNotes[entry.order.id] ?? "").trim()
                            }
                            data-testid={`button-approve-review-${entry.order.id}`}
                          >
                            {resolveIssueMutation.isPending
                              ? "Approving…"
                              : "Approve & Create Invoice"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                        <div className="w-full flex-1 space-y-1.5">
                          <label
                            htmlFor={`driver-note-${entry.order.id}`}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Delivery Note <span className="text-destructive">*</span>
                          </label>
                          <Textarea
                            id={`driver-note-${entry.order.id}`}
                            className="min-h-20"
                            placeholder="Describe the delivery — e.g. handed to manager, left at back door..."
                            value={driverNotes[entry.order.id] ?? ""}
                            onChange={(event) =>
                              setDriverNotes((current) => ({
                                ...current,
                                [entry.order.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <Button
                          className="bg-blue-600 text-white hover:bg-blue-700 sm:shrink-0"
                          onClick={() => deliverMutation.mutate(entry.order.id)}
                          disabled={
                            deliverMutation.isPending ||
                            !(driverNotes[entry.order.id] ?? "").trim()
                          }
                        >
                          <Truck className="mr-1.5 h-4 w-4" />
                          {deliverMutation.isPending ? "Marking..." : "Mark Delivered"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
