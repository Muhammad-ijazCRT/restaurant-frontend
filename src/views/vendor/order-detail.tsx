import { useParams, useLocation } from "@/lib/wouter-compat";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { vendorOrderPaths } from "@/api/vendor/orders";
import { vendorOrderApi } from "@/api/vendor/orders";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { profileKeys } from "@/api/shared/profile";
import { vendorEmployeeKeys } from "@/api/vendor/employees";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { formatCurrency } from "@shared/schema";
import type { VendorEmployee } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Package, UtensilsCrossed, CalendarDays, Hash, ClipboardList,
  ShoppingCart, Lock, Truck, Pencil,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  derivePickingStatus,
  formatFulfillmentStatus,
  getOriginalOrderTotal,
  getVendorAdjustedQty,
  getVendorAdjustedTotal,
  getVendorNote,
  getWarehouseLoadedTotal,
  getEffectiveOrderItemCount,
  getSubmittedOrderListTotal,
  getSavedLoadedQtyForOrder,
  formatSavedLoadedQtyForOrder,
  getWorkerNoteForOrder,
  getDriverDeliveryNote,
  getDriverResolutionNote,
  hasVendorAdjustment,
  hasWarehouseAdjustment,
  orderHasWarehouseLoadedData,
  getRestaurantReceivedQty,
  getRestaurantNote,
  getRestaurantReviewTotal,
  getRestaurantReviewItemCount,
  hasRestaurantReviewAdjustment,
  getEffectiveLineQty,
} from "@/lib/vendor-order-fulfillment";
import {
  isWarehouseOrderAssignedToUser,
  isWarehouseSubmittedOrder,
  canShowDriverAssignment,
  canShowFulfillmentAssignment,
  canShowWarehouseAssignment,
} from "@/lib/vendor-warehouse-orders";

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
    driverNote?: string | null;
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
  ready_for_delivery: {
    label: "Ready for Delivery",
    classes: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  },
  draft: {
    label: "Draft",
    classes: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  },
  delivered: {
    label: "Delivered",
    classes: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",
  },
  picking_review: {
    label: "Picking Review",
    classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
};

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


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useQuery<VendorOrderDetailResponse>({
    queryKey: vendorOrderKeys.detail(vendorId, orderId),
    enabled: !!vendorId && !!orderId,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const res = await apiRequest("GET", vendorOrderPaths.detail(vendorId, orderId));
      return res.json() as Promise<VendorOrderDetailResponse>;
    },
  });

  const [assignDraft, setAssignDraft] = useState({ warehouseWorkerId: "", driverId: "" });
  const [driverNoteDraft, setDriverNoteDraft] = useState("");
  const [pickingState, setPickingState] = useState<
    Record<string, { status: string; loadedQty: number | ""; note: string }>
  >({});

  const { data: employees = [] } = useQuery<VendorEmployee[]>({
    queryKey: vendorEmployeeKeys.list(vendorId),
    enabled: !!vendorId,
  });

  const warehouseWorkers = employees.filter((employee) =>
    normalizeRoles(employee.roles).some((roleName) => ["warehouse", "warehouse_worker"].includes(roleName)),
  );
  const drivers = employees.filter((employee) =>
    normalizeRoles(employee.roles).some((roleName) => roleName === "driver"),
  );

  const releaseToDriverMutation = useMutation({
    mutationFn: async () => {
      await vendorOrderApi.approvePicking(vendorId, orderId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: "Released to driver",
        description: "Order is ready for driver delivery.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Release failed", description: err.message, variant: "destructive" });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      const note = driverNoteDraft.trim();
      if (!note) {
        throw new Error("Add a delivery note before marking delivered.");
      }
      const res = await vendorOrderApi.deliver(vendorId, orderId, { note });
      return res.json() as Promise<{ restaurantOrgId: string; vendorId: string }>;
    },
    onSuccess: (updatedOrder) => {
      setDriverNoteDraft("");
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      if (updatedOrder?.restaurantOrgId) {
        queryClient.invalidateQueries({
          queryKey: restaurantOrderKeys.submittedList(updatedOrder.restaurantOrgId, vendorId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: "Order marked as delivered",
        description: "The restaurant will now review this order.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const forwardReviewMutation = useMutation({
    mutationFn: async () => {
      await vendorOrderApi.forwardReviewToDriver(vendorId, orderId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: "Sent to driver",
        description: "Restaurant review changes were forwarded to the driver for approval.",
      });
      navigate("/vendor/orders?section=approval");
    },
    onError: (err: Error) => {
      toast({ title: "Forward failed", description: err.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      await vendorOrderApi.assign(vendorId, orderId!, {
        warehouseWorkerId: assignDraft.warehouseWorkerId,
        driverId: assignDraft.driverId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: data?.order?.warehouseWorkerId || data?.order?.driverId
          ? "Assignment updated"
          : "Order assigned",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
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
        const fulfillment = data?.fulfillments?.find(
          (f: { orderLineItemId: string }) => f.orderLineItemId === li.id,
        );
        const vendorQty = getVendorAdjustedQty(fulfillment, li.quantity);
        const isWorkerSave = !canManageFulfillment && canWarehousePick;
        const loadedQty =
          vals.loadedQty === "" ? vendorQty : Number(vals.loadedQty);
        return {
          lineItemId: li.id,
          status: vals.status as "loaded" | "partial" | "no_stock",
          loadedQty: Number.isFinite(loadedQty) ? loadedQty : vendorQty,
          note: (vals.note ?? "").trim(),
          warehouseTouched:
            isWorkerSave &&
            (vals.loadedQty !== "" || Boolean((vals.note ?? "").trim())),
        };
      });
      const res = await vendorOrderApi.picking(vendorId, orderId, {
        items,
        submitForReview,
        vendorAdjust: canManageFulfillment,
      });
      return res.json() as Promise<{
        order: VendorOrderDetailResponse["order"];
        fulfillments: VendorOrderDetailResponse["fulfillments"];
      }>;
    },
    onSuccess: async (response, submitForReview) => {
      if (response?.fulfillments) {
        queryClient.setQueryData<VendorOrderDetailResponse>(
          vendorOrderKeys.detail(vendorId, orderId),
          (current) =>
            current
              ? {
                  ...current,
                  order: response.order ?? current.order,
                  fulfillments: response.fulfillments,
                }
              : current,
        );
      }
      await queryClient.invalidateQueries({ queryKey: vendorOrderKeys.detail(vendorId, orderId) });
      await queryClient.refetchQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      const role = getUserRole();
      const isWorker = role === "warehouse" || role === "warehouse_worker";
      if (submitForReview && isWorker) {
        toast({
          title: "Picking submitted for review",
          description: "Vendor will review your loaded quantities and release the order to the driver.",
        });
        navigate("/vendor/orders?section=picking-submitted");
        return;
      }
      toast({
        title: isWorker ? "Picking saved" : submitForReview ? "Picking submitted" : "Adjustments saved",
      });
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

  const isManager = currentRole === "vendor_admin" || currentRole === "vendor" || currentRole === "manager";
  const isPickingReview =
    order?.pickingStatus === "review" || order?.status === "picking_review";
  const isAssignedWorker = !!order && isWarehouseOrderAssignedToUser(order, currentUserId);
  const isWarehouseWorker = currentRole === "warehouse" || currentRole === "warehouse_worker";
  const canManageFulfillment = isManager && order?.status === "submitted" && !isPickingReview;
  const showWarehouseAssignment =
    isManager && !isWarehouseWorker && !!order && canShowWarehouseAssignment(order);
  const showDriverAssignment =
    isManager && !isWarehouseWorker && !!order && canShowDriverAssignment(order);
  const showFulfillmentAssignment = showWarehouseAssignment || showDriverAssignment;
  const isDriverRole = currentRole === "driver";
  const canDriverDeliver =
    order?.status === "ready_for_delivery" &&
    isDriverRole &&
    (order.driverId === currentUserId || !order.driverId);
  const canWarehousePick =
    isWarehouseWorker &&
    isAssignedWorker &&
    order?.status === "submitted" &&
    !isPickingReview;
  const useWarehousePickLayout = canWarehousePick;
  const useWarehouseReadonlyLayout =
    isWarehouseWorker && isAssignedWorker && isWarehouseSubmittedOrder(order!, currentUserId);
  const useManagerPickingReviewLayout = isManager && isPickingReview;
  const useManagerReadonlyFulfillmentLayout =
    isManager && !isWarehouseWorker && !!order &&
    (order.status === "ready_for_delivery" || order.status === "delivered");
  const useDriverDeliveryLayout =
    isDriverRole &&
    !!order &&
    order.status === "ready_for_delivery" &&
    (order.driverId === currentUserId || !order.driverId);
  const useAdjustOrderLayout = canManageFulfillment;
  const useFulfillmentSummaryLayout =
    useAdjustOrderLayout ||
    useWarehousePickLayout ||
    useWarehouseReadonlyLayout ||
    useManagerPickingReviewLayout ||
    useManagerReadonlyFulfillmentLayout ||
    useDriverDeliveryLayout;
  const showTotalsOverview =
    useFulfillmentSummaryLayout ||
    (isManager && !isWarehouseWorker && !!order && canShowFulfillmentAssignment(order));
  const workerEditable = useWarehousePickLayout;
  const canAdjustOrder = useAdjustOrderLayout || canWarehousePick;
  const showReleaseToDriverAction = useManagerPickingReviewLayout && isManager;
  const showDriverDeliverAction = canDriverDeliver;
  const showSubmittedWarehouseSummary =
    isManager &&
    !isWarehouseWorker &&
    !!order &&
    order.status === "submitted" &&
    !isPickingReview &&
    orderHasWarehouseLoadedData(fulfillments, order);
  const showPendingVendorReview =
    isManager && order?.restaurantIssueStatus === "pending_vendor";
  const showForwardToDriverAction = showPendingVendorReview && isManager;
  const savedDriverNote = getDriverDeliveryNote(order);
  const showDriverNoteColumn =
    useFulfillmentSummaryLayout &&
    !useAdjustOrderLayout &&
    (order?.status === "delivered" ||
      order?.status === "invoiced" ||
      showPendingVendorReview ||
      Boolean(savedDriverNote));
  const showWarehouseLoadedColumns =
    (useFulfillmentSummaryLayout && !useAdjustOrderLayout) || showSubmittedWarehouseSummary;

  useEffect(() => {
    if (!order) return;
    setAssignDraft({
      warehouseWorkerId: order.warehouseWorkerId ?? "",
      driverId: order.driverId ?? "",
    });
  }, [order?.id, order?.warehouseWorkerId, order?.driverId]);

  const fulfillmentFingerprint = useMemo(
    () =>
      fulfillments
        .map(
          (f) =>
            `${f.orderLineItemId}:${f.fulfilledQuantity ?? ""}:${f.warehouseNote ?? ""}:${f.loadedQuantity ?? ""}:${f.issueReason ?? ""}:${f.fulfillmentStatus ?? ""}:${f.restaurantReceivedQty ?? ""}:${f.restaurantNote ?? ""}`,
        )
        .join("|"),
    [fulfillments],
  );

  useEffect(() => {
    if (!canAdjustOrder || lineItems.length === 0) return;
    const initial: Record<string, { status: string; loadedQty: number | ""; note: string }> = {};
    for (const li of lineItems) {
      const fulfillment = fulfillments.find((f: { orderLineItemId: string }) => f.orderLineItemId === li.id);
      if (canManageFulfillment) {
        initial[li.id] = {
          status: fulfillment?.fulfillmentStatus || "loaded",
          loadedQty: getVendorAdjustedQty(fulfillment, li.quantity),
          note: getVendorNote(fulfillment),
        };
      } else {
        initial[li.id] = {
          status: (fulfillment?.fulfillmentStatus as string) || "loaded",
          loadedQty: getSavedLoadedQtyForOrder(fulfillment, order) ?? "",
          note: getWorkerNoteForOrder(fulfillment, order),
        };
      }
    }
    setPickingState(initial);
  }, [canAdjustOrder, canManageFulfillment, lineItems, fulfillmentFingerprint, order?.id]);

  const ordersListPath = isWarehouseWorker ? "/vendor/orders" : "/vendor/portal";

  if (!vendorId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
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
      <div className="p-6">
        <Skeleton className="h-5 w-32 mb-6" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    const msg = (error as Error)?.message ?? "Order not found.";
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
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
  const restaurantReviewTotal = getRestaurantReviewTotal(lineItems, fulfillments, order);
  const restaurantReviewItemCount = getRestaurantReviewItemCount(lineItems, fulfillments, order);
  const itemCount = showPendingVendorReview
    ? restaurantReviewItemCount
    : getEffectiveOrderItemCount(lineItems, fulfillments, order);
  const orderTotal = getOriginalOrderTotal(lineItems);
  const summaryOrderTotal = showPendingVendorReview
    ? restaurantReviewTotal
    : getSubmittedOrderListTotal(lineItems, fulfillments, order);
  const vendorAdjustedTotal = useAdjustOrderLayout
    ? lineItems.reduce((sum, li) => {
        const pick = pickingState[li.id] ?? {
          status: "loaded",
          loadedQty: li.quantity,
          note: "",
        };
        const qty = typeof pick.loadedQty === "number" ? pick.loadedQty : li.quantity;
        return sum + parseFloat(li.unitPriceAtTimeOfOrder) * qty;
      }, 0)
    : getVendorAdjustedTotal(lineItems, (lineItemId) =>
        fulfillments.find((f: { orderLineItemId: string }) => f.orderLineItemId === lineItemId),
      );
  const warehouseLoadedTotal = showWarehouseLoadedColumns
    ? getWarehouseLoadedTotal(lineItems, (lineItemId) => {
        const fulfillment = fulfillments.find(
          (f: { orderLineItemId: string }) => f.orderLineItemId === lineItemId,
        );
        if (workerEditable) {
          const pick = pickingState[lineItemId];
          if (pick?.loadedQty === "") return getSavedLoadedQtyForOrder(fulfillment, order);
          if (pick?.loadedQty != null && pick.loadedQty !== "") return Number(pick.loadedQty);
        }
        return getSavedLoadedQtyForOrder(fulfillment, order);
      })
    : orderTotal;
  const showWarehouseLoadedTotalCard =
    showWarehouseLoadedColumns && orderHasWarehouseLoadedData(fulfillments, order);
  const restaurantNotes = lineItems
    .map((lineItem) => {
      const note = getRestaurantNote(
        fulfillments.find((f: { orderLineItemId: string }) => f.orderLineItemId === lineItem.id),
      );
      if (!note) return null;
      return `${lineItem.productName}: ${note}`;
    })
    .filter(Boolean) as string[];
  const driverResolutionNote = getDriverResolutionNote(order);
  const hasRestaurantReviewData =
    restaurantNotes.length > 0 ||
    Boolean(order.restaurantReviewSubmittedAt) ||
    Boolean(order.restaurantIssueStatus) ||
    lineItems.some((lineItem) => {
      const fulfillment = fulfillments.find(
        (f: { orderLineItemId: string }) => f.orderLineItemId === lineItem.id,
      );
      return (
        fulfillment?.restaurantReceivedQty != null ||
        Boolean(getRestaurantNote(fulfillment))
      );
    });
  const showRestaurantReviewDetail =
    showPendingVendorReview ||
    (useManagerReadonlyFulfillmentLayout && hasRestaurantReviewData);

  return (
    <div data-testid="page-vendor-order-detail">
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

      <div className="space-y-6">

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
            {!useFulfillmentSummaryLayout ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Read-only view
              </p>
            ) : useManagerPickingReviewLayout ? (
              <p className="text-sm text-blue-700">
                Warehouse picking review — release to driver after reviewing loaded quantities
              </p>
            ) : useManagerReadonlyFulfillmentLayout && order?.status === "ready_for_delivery" ? (
              <p className="text-sm text-blue-700">
                Released to driver — awaiting delivery
              </p>
            ) : useManagerReadonlyFulfillmentLayout && showPendingVendorReview ? (
              <p className="text-sm text-violet-700 dark:text-violet-300">
                Restaurant submitted quantity changes — review below and forward to the driver
              </p>
            ) : useManagerReadonlyFulfillmentLayout && order?.status === "delivered" ? (
              <p className="text-sm text-muted-foreground">
                Delivered — restaurant will review this order
              </p>
            ) : useWarehouseReadonlyLayout ? (
              <p className="text-sm text-blue-700">
                Picking submitted — awaiting vendor review
              </p>
            ) : useDriverDeliveryLayout ? (
              <p className="text-sm text-blue-700">
                Review delivery details below, then mark as delivered when drop-off is complete
              </p>
            ) : (showTotalsOverview && (useAdjustOrderLayout || order?.status === "submitted")) ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Adjustable — order is awaiting delivery
              </p>
            ) : null}
          </div>
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
              {formatCurrency(String((showTotalsOverview ? summaryOrderTotal : orderTotal).toFixed(2)))}
            </p>
          </div>
        </div>

        {showFulfillmentAssignment ? (
          <div className="rounded-lg border bg-card overflow-hidden" data-testid="section-fulfillment-assignment">
            <div className="border-b bg-muted/20 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fulfillment Assignment
              </p>
            </div>
            <div
              className={`grid gap-4 px-5 py-4 ${
                showWarehouseAssignment && showDriverAssignment ? "md:grid-cols-2" : "md:grid-cols-1"
              }`}
            >
              {showWarehouseAssignment ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Warehouse</label>
                  <Select
                    value={assignDraft.warehouseWorkerId}
                    onValueChange={(value) => setAssignDraft((current) => ({ ...current, warehouseWorkerId: value }))}
                  >
                    <SelectTrigger data-testid="select-warehouse-worker">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
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
                    value={assignDraft.driverId}
                    onValueChange={(value) => setAssignDraft((current) => ({ ...current, driverId: value }))}
                  >
                    <SelectTrigger data-testid="select-driver">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-4 border-t bg-muted/10 px-5 py-3">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={
                  (showWarehouseAssignment && !assignDraft.warehouseWorkerId) ||
                  (showDriverAssignment && !assignDraft.driverId) ||
                  assignMutation.isPending
                }
                onClick={() => assignMutation.mutate()}
                data-testid="button-save-assignment"
              >
                {order.warehouseWorkerId || order.driverId ? "Update Assignment" : "Assign"}
              </Button>
            </div>
          </div>
        ) : null}

        {showTotalsOverview ? (
          <div
            className={`grid grid-cols-1 gap-3 ${
              showRestaurantReviewDetail
                ? "sm:grid-cols-2 lg:grid-cols-4"
                : showWarehouseLoadedColumns
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2"
            }`}
            data-testid="section-order-totals"
          >
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Orig. Order Total</p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {formatCurrency(String(orderTotal.toFixed(2)))}
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
            {showWarehouseLoadedTotalCard ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Warehouse Loaded Total</p>
                <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(String(warehouseLoadedTotal.toFixed(2)))}
                </p>
              </div>
            ) : showWarehouseLoadedColumns ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Warehouse Loaded Total</p>
                <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">—</p>
              </div>
            ) : null}
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

        {/* Order ID */}
        <div className="border rounded-lg bg-card px-4 py-3 flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">Order</span>
          <span className="text-sm font-semibold text-foreground ml-1" data-testid="text-full-order-id">
            #{order.displayId ?? '—'}
          </span>
        </div>

        {showForwardToDriverAction ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/50 px-5 py-3 dark:border-violet-800 dark:bg-violet-950/20">
            <span className="text-sm text-violet-700 dark:text-violet-300">
              Restaurant changed received quantities. Forward to the driver for final approval and
              invoicing.
            </span>
            <Button
              size="sm"
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => forwardReviewMutation.mutate()}
              disabled={forwardReviewMutation.isPending}
              data-testid="button-forward-to-driver"
            >
              <Truck className="mr-1.5 h-4 w-4" />
              {forwardReviewMutation.isPending ? "Sending…" : "Send to Driver"}
            </Button>
          </div>
        ) : null}

        {showReleaseToDriverAction ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-5 py-3">
            <span className="text-sm text-blue-700">
              Warehouse submitted picking — review loaded quantities and worker notes below
            </span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={() => releaseToDriverMutation.mutate()}
                disabled={releaseToDriverMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-release-to-driver"
              >
                <Truck className="h-4 w-4 mr-1.5" />
                {releaseToDriverMutation.isPending ? "Releasing..." : "Release to Driver"}
              </Button>
            </div>
          </div>
        ) : null}

        {showDriverDeliverAction ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-5 py-3">
            <span className="text-sm text-blue-700">
              Review vendor adjustments and warehouse notes, add a delivery note, then mark delivered
            </span>
            <div className="space-y-1.5">
              <label htmlFor="driver-delivery-note" className="text-xs font-medium text-muted-foreground">
                Delivery Note <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="driver-delivery-note"
                className="min-h-20"
                placeholder="Describe the delivery — e.g. handed to manager, left at back door..."
                value={driverNoteDraft}
                onChange={(event) => setDriverNoteDraft(event.target.value)}
                data-testid="input-driver-delivery-note"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                onClick={() => deliverMutation.mutate()}
                disabled={deliverMutation.isPending || !driverNoteDraft.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-mark-delivered"
              >
                <Truck className="h-4 w-4 mr-1.5" />
                {deliverMutation.isPending ? "Marking..." : "Mark Delivered"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Line Items / Adjust Order */}
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-line-items">
          <div className="px-5 py-3 border-b bg-muted/20">
            <div className="flex items-start gap-2">
              {(useFulfillmentSummaryLayout) ? <Pencil className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <Package className="mt-0.5 h-4 w-4 text-muted-foreground" />}
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {useFulfillmentSummaryLayout ? "Adjust Order" : "Line Items"}
                </h2>
                {useAdjustOrderLayout ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {showSubmittedWarehouseSummary
                      ? "Adjust vendor qty and notes, then review warehouse loaded quantities below."
                      : "Original ordered quantities are preserved. Adjust vendor qty and add notes before delivery."}
                  </p>
                ) : useFulfillmentSummaryLayout ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vendor adjustments and warehouse loaded quantities are shown below.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Product</TableHead>
                <TableHead className="font-medium">SKU</TableHead>
                {useAdjustOrderLayout ? (
                  <>
                    <TableHead className="font-medium text-right">Ordered Qty</TableHead>
                    <TableHead className="font-medium text-right">Unit Price</TableHead>
                    <TableHead className="font-medium text-right">Orig. Total</TableHead>
                    <TableHead className="font-medium text-right">Vendor Qty</TableHead>
                    <TableHead className="font-medium text-right">Vendor Total</TableHead>
                    <TableHead className="font-medium">Vendor Note</TableHead>
                    {showSubmittedWarehouseSummary ? (
                      <>
                        <TableHead className="font-medium text-right">Loaded Qty</TableHead>
                        <TableHead className="font-medium text-right">Loaded Total</TableHead>
                        <TableHead className="font-medium">Worker Note</TableHead>
                      </>
                    ) : null}
                  </>
                ) : useFulfillmentSummaryLayout && !useAdjustOrderLayout ? (
                  <>
                    <TableHead className="font-medium text-right">Ordered Qty</TableHead>
                    <TableHead className="font-medium text-right">Unit Price</TableHead>
                    <TableHead className="font-medium text-right">Orig. Total</TableHead>
                    <TableHead className="font-medium text-right">Vendor Qty</TableHead>
                    <TableHead className="font-medium text-right">Vendor Total</TableHead>
                    <TableHead className="font-medium">Vendor Note</TableHead>
                    <TableHead className="font-medium text-right">Loaded Qty</TableHead>
                    <TableHead className="font-medium text-right">Loaded Total</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium">Worker Note</TableHead>
                    {showDriverNoteColumn ? (
                      <TableHead className="font-medium">Delivery Note</TableHead>
                    ) : null}
                    {showRestaurantReviewDetail ? (
                      <>
                        <TableHead className="font-medium text-right text-violet-700 dark:text-violet-300">
                          Received Qty
                        </TableHead>
                        <TableHead className="font-medium text-right text-violet-700 dark:text-violet-300">
                          Review Total
                        </TableHead>
                        <TableHead className="font-medium text-violet-700 dark:text-violet-300">
                          Restaurant Note
                        </TableHead>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <TableHead className="font-medium text-right">Qty</TableHead>
                    <TableHead className="font-medium text-right">Unit Price</TableHead>
                    <TableHead className="font-medium text-right">Line Total</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((li) => {
                const fulfillment = fulfillments.find(
                  (f: { orderLineItemId: string }) => f.orderLineItemId === li.id,
                );
                const pick = pickingState[li.id] ?? {
                  status: "loaded",
                  loadedQty: li.quantity,
                  note: "",
                };
                const vendorQty = getVendorAdjustedQty(fulfillment, li.quantity);
                const vendorNote = getVendorNote(fulfillment);
                const vendorPickQty =
                  typeof pick.loadedQty === "number" ? pick.loadedQty : vendorQty;
                const pickedQty = canAdjustOrder ? vendorPickQty : li.quantity;
                const origTotal = parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity;
                const vendorTotal = parseFloat(li.unitPriceAtTimeOfOrder) * vendorQty;
                const savedLoadedQty = getSavedLoadedQtyForOrder(fulfillment, order);
                const savedLoadedTotal =
                  savedLoadedQty == null
                    ? null
                    : parseFloat(li.unitPriceAtTimeOfOrder) * savedLoadedQty;
                const draftLoadedQty =
                  workerEditable && pick.loadedQty !== "" ? Number(pick.loadedQty) : null;
                const draftLoadedTotal =
                  draftLoadedQty == null
                    ? null
                    : parseFloat(li.unitPriceAtTimeOfOrder) * draftLoadedQty;
                const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * pickedQty;
                const adjusted = hasVendorAdjustment(fulfillment, li.quantity);
                const warehouseAdjusted = hasWarehouseAdjustment(fulfillment, vendorQty, order);
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
                    {useAdjustOrderLayout ? (
                      <>
                        <TableCell className="text-sm text-right font-medium">{li.quantity}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground">
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {formatCurrency(String(origTotal.toFixed(2)))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="ml-auto w-24 text-right"
                            type="number"
                            min={0}
                            value={pick.loadedQty}
                            onChange={(event) => {
                              const loadedQty = Number(event.target.value);
                              setPickingState((current) => ({
                                ...current,
                                [li.id]: {
                                  ...pick,
                                  loadedQty,
                                  status: derivePickingStatus(li.quantity, loadedQty),
                                },
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold">
                          {formatCurrency(String(lineTotal.toFixed(2)))}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={pick.note}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            name={`vendor-note-${order?.id}-${li.id}`}
                            onChange={(event) =>
                              setPickingState((current) => ({
                                ...current,
                                [li.id]: { ...pick, note: event.target.value },
                              }))
                            }
                            placeholder="Optional note..."
                          />
                        </TableCell>
                        {showSubmittedWarehouseSummary ? (
                          <>
                            <TableCell className="text-sm text-right font-semibold">
                              {formatSavedLoadedQtyForOrder(fulfillment, order)}
                            </TableCell>
                            <TableCell
                              className={`text-sm text-right font-semibold ${warehouseAdjusted ? "text-emerald-700" : ""}`}
                            >
                              {savedLoadedTotal == null
                                ? "—"
                                : formatCurrency(String(savedLoadedTotal.toFixed(2)))}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {getWorkerNoteForOrder(fulfillment, order) || "—"}
                            </TableCell>
                          </>
                        ) : null}
                      </>
                    ) : useFulfillmentSummaryLayout && !useAdjustOrderLayout ? (
                      <>
                        <TableCell className="text-sm text-right font-medium">{li.quantity}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground">
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {formatCurrency(String(origTotal.toFixed(2)))}
                        </TableCell>
                        <TableCell
                          className={`text-sm text-right font-semibold ${adjusted ? "text-primary" : ""}`}
                        >
                          {vendorQty}
                          {adjusted
                            ? vendorQty > li.quantity
                              ? " ↑"
                              : vendorQty < li.quantity
                                ? " ↓"
                                : ""
                            : ""}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold text-primary">
                          {formatCurrency(String(vendorTotal.toFixed(2)))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {vendorNote || "—"}
                        </TableCell>
                        {workerEditable ? (
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
                                  const loadedQty = raw === "" ? "" : Number(raw);
                                  setPickingState((current) => ({
                                    ...current,
                                    [li.id]: {
                                      ...pick,
                                      loadedQty,
                                      status: derivePickingStatus(
                                        vendorQty,
                                        loadedQty === "" ? 0 : loadedQty,
                                      ),
                                    },
                                  }));
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold text-emerald-700">
                              {draftLoadedTotal == null
                                ? "—"
                                : formatCurrency(String(draftLoadedTotal.toFixed(2)))}
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
                                value={pick.note ?? ""}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                name={`worker-note-${order?.id}-${li.id}`}
                                onChange={(event) =>
                                  setPickingState((current) => ({
                                    ...current,
                                    [li.id]: {
                                      ...pick,
                                      note: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Worker note..."
                              />
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right text-sm font-semibold text-foreground">
                              {formatSavedLoadedQtyForOrder(fulfillment, order)}
                            </TableCell>
                            <TableCell
                              className={`text-right text-sm font-semibold ${warehouseAdjusted ? "text-emerald-700" : ""}`}
                            >
                              {savedLoadedTotal == null
                                ? "—"
                                : formatCurrency(String(savedLoadedTotal.toFixed(2)))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatFulfillmentStatus(fulfillment?.fulfillmentStatus)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {getWorkerNoteForOrder(fulfillment, order) || "—"}
                            </TableCell>
                            {showDriverNoteColumn ? (
                              <TableCell className="text-sm text-muted-foreground">
                                {savedDriverNote || "—"}
                              </TableCell>
                            ) : null}
                            {showRestaurantReviewDetail ? (() => {
                              const expectedQty = getEffectiveLineQty(
                                fulfillment,
                                li.quantity,
                                order,
                              );
                              const receivedQty = getRestaurantReceivedQty(
                                fulfillment,
                                expectedQty,
                              );
                              const reviewLineTotal =
                                parseFloat(li.unitPriceAtTimeOfOrder) * receivedQty;
                              const restaurantNote = getRestaurantNote(fulfillment);
                              const reviewAdjusted = hasRestaurantReviewAdjustment(
                                fulfillment,
                                li.quantity,
                                order,
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
                                  <TableCell className="text-sm text-muted-foreground">
                                    {restaurantNote || "—"}
                                  </TableCell>
                                </>
                              );
                            })() : null}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <TableCell className="text-sm text-right font-medium" data-testid={`text-item-qty-${li.id}`}>
                          {li.quantity}
                        </TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground" data-testid={`text-item-price-${li.id}`}>
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold" data-testid={`text-item-total-${li.id}`}>
                          {formatCurrency(String(lineTotal.toFixed(2)))}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Footer actions */}
          {(showTotalsOverview && (useAdjustOrderLayout || workerEditable)) || !showTotalsOverview ? (
          <div className="px-5 py-3 border-t bg-muted/10 flex flex-wrap justify-end items-center gap-6">
            {showTotalsOverview ? (
              <>
                {useAdjustOrderLayout ? (
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => pickingMutation.mutate(false)}
                    disabled={pickingMutation.isPending}
                    data-testid="button-save-adjustments"
                  >
                    Save Adjustments
                  </Button>
                ) : workerEditable ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => pickingMutation.mutate(false)}
                      disabled={pickingMutation.isPending}
                      data-testid="button-save-picking"
                    >
                      Save Picking
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => pickingMutation.mutate(true)}
                      disabled={pickingMutation.isPending}
                      data-testid="button-submit-for-review"
                    >
                      Send to Picking Review
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground font-medium">Order Total</span>
                <span className="text-base font-bold text-foreground" data-testid="text-footer-total">
                  {formatCurrency(String(orderTotal.toFixed(2)))}
                </span>
              </>
            )}
          </div>
          ) : null}
        </div>

        {restaurantNotes.length > 0 ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-5 py-4 dark:border-violet-800 dark:bg-violet-950/20">
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
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 px-5 py-4 dark:border-sky-800 dark:bg-sky-950/20">
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
              Driver Resolution Note
            </p>
            <p className="mt-2 text-sm text-foreground">{driverResolutionNote}</p>
          </div>
        ) : null}

        {/* Footer nav */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => navigate(ordersListPath)}
            data-testid="button-back-bottom"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Received Orders
          </Button>
        </div>
      </div>
    </div>
  );
}
