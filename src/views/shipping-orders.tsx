import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "@/lib/wouter-compat";
import type { LineFulfillment, Order, OrderLineItem, Product, VendorEmployee } from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type EnrichedLineItem = OrderLineItem & { productName: string; sku: string | null };
type VendorOrderEntry = {
  order: Order;
  lineItems: EnrichedLineItem[];
  restaurantName: string;
  fulfillments: LineFulfillment[];
};

type PickDraft = Record<string, { status: "loaded" | "partial" | "no_stock"; loadedQty: number; note: string }>;

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  ready_for_delivery: "Ready for Delivery",
  delivered: "Delivered",
  pending_driver: "Needs Driver Review",
  resolved_by_driver: "Resolved by Driver",
  invoiced: "Invoiced",
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

type DriverOrderView = "queue" | "completed";

function filterDriverOrders(
  orders: VendorOrderEntry[],
  userId: string | undefined,
  view: DriverOrderView,
) {
  const filtered = orders.filter(({ order }) => {
    if (order.driverId !== userId) return false;
    if (view === "completed") {
      return ["delivered", "invoiced"].includes(order.status);
    }
    return (
      order.status === "ready_for_delivery" ||
      order.restaurantIssueStatus === "pending_driver"
    );
  });

  if (view === "completed") {
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.order.vendorConfirmedAt ?? a.order.createdAt).getTime();
      const bTime = new Date(b.order.vendorConfirmedAt ?? b.order.createdAt).getTime();
      return bTime - aTime;
    });
  }

  return filtered;
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
    return orders.filter(({ order }) =>
      order.warehouseWorkerId === userId &&
      ["submitted"].includes(order.status) &&
      order.pickingStatus !== "approved",
    );
  }
  if (role === "driver") {
    return filterDriverOrders(orders, userId, driverView);
  }
  return orders.filter(({ order }) =>
    order.driverId === userId &&
    (order.status === "ready_for_delivery" || order.restaurantIssueStatus === "pending_driver"),
  );
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
  const { toast } = useToast();
  const canManageAssignments = role === "vendor_admin" || role === "manager";
  const [pickDraft, setPickDraft] = useState<Record<string, PickDraft>>({});
  const [driverNotes, setDriverNotes] = useState<Record<string, string>>({});
  const [assignDraft, setAssignDraft] = useState<Record<string, { warehouseWorkerId: string; driverId: string }>>({});
  const [subDraft, setSubDraft] = useState<Record<string, { substituteProductId: string; proposedQty: number; note: string }>>({});
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(focusOrderId);
  const scrolledToOrderRef = useRef(false);

  const { data: orders = [], isLoading } = useQuery<VendorOrderEntry[]>({
    queryKey: ["/api/vendors", vendorId, "orders"],
    enabled: !!vendorId,
  });
  const { data: employees = [] } = useQuery<VendorEmployee[]>({
    queryKey: ["/api/vendors", vendorId, "employees"],
    enabled: !!vendorId && canManageAssignments,
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/vendors", vendorId, "products"],
    enabled: !!vendorId && canManageAssignments,
  });

  const baseVisibleOrders = useMemo(
    () => filterVisibleOrders(orders, role, user?.id, canManageAssignments, driverView),
    [orders, role, user?.id, canManageAssignments, driverView],
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
      const items = lineItems.map((lineItem) => {
        const item = draft[lineItem.id] ?? getInitialPick(orderEntry!, lineItem);
        return {
          lineItemId: lineItem.id,
          status: item.status,
          loadedQty: Number.isFinite(Number(item.loadedQty)) ? Number(item.loadedQty) : lineItem.quantity,
          note: item.note ?? "",
        };
      });
      await apiRequest("PATCH", `/api/vendors/${vendorId}/orders/${orderId}/picking`, { items, submitForReview });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "orders"] });
      toast({ title: "Picking saved" });
    },
    onError: (err: Error) => toast({ title: "Picking failed", description: err.message, variant: "destructive" }),
  });

  const approvePickingMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/vendors/${vendorId}/orders/${orderId}/approve-picking`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "orders"] });
      toast({ title: "Order ready for delivery" });
    },
    onError: (err: Error) => toast({ title: "Approval failed", description: err.message, variant: "destructive" }),
  });

  const deliverMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/vendors/${vendorId}/orders/${orderId}/deliver`, { note: driverNotes[orderId] ?? "" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "orders"] });
      toast({ title: "Order delivered" });
    },
    onError: (err: Error) => toast({ title: "Delivery failed", description: err.message, variant: "destructive" }),
  });

  const resolveIssueMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("PATCH", `/api/vendors/${vendorId}/orders/${orderId}/resolve-issue`, {
        note: driverNotes[orderId] ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "orders"] });
      toast({ title: "Issue resolved", description: "Invoice created after driver approval." });
    },
    onError: (err: Error) => toast({ title: "Resolution failed", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const draft = assignDraft[orderId];
      await apiRequest("PATCH", `/api/vendors/${vendorId}/orders/${orderId}/assign`, draft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Order assigned" });
    },
    onError: (err: Error) => toast({ title: "Assignment failed", description: err.message, variant: "destructive" }),
  });

  const substitutionMutation = useMutation({
    mutationFn: async ({ orderId, lineItemId }: { orderId: string; lineItemId: string }) => {
      const draft = subDraft[lineItemId];
      await apiRequest("POST", `/api/vendors/${vendorId}/orders/${orderId}/substitutions`, {
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
    return {
      status: (fulfillment?.fulfillmentStatus as "loaded" | "partial" | "no_stock") ?? "loaded",
      loadedQty: fulfillment?.loadedQuantity ?? lineItem.quantity,
      note: fulfillment?.warehouseNote ?? "",
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
    <div className="mx-auto max-w-6xl px-6 py-8" data-testid="page-shipping-orders">
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
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Order #{entry.order.displayId ?? entry.order.id.slice(0, 8)}</h2>
                    <Badge variant="outline">{STATUS_LABELS[entry.order.status] ?? entry.order.status}</Badge>
                    {entry.order.pickingStatus && <Badge variant="secondary">Picking: {entry.order.pickingStatus}</Badge>}
                    {entry.order.restaurantIssueStatus && (
                      <Badge variant="secondary">{STATUS_LABELS[entry.order.restaurantIssueStatus] ?? entry.order.restaurantIssueStatus}</Badge>
                    )}
                    {hasShortage && <Badge className="bg-amber-100 text-amber-700">Shortage</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{entry.restaurantName}</p>
                </div>
                {canManageAssignments && entry.order.pickingStatus === "review" && (
                  <Button onClick={() => approvePickingMutation.mutate(entry.order.id)}>Approve for Delivery</Button>
                )}
              </div>

              {canManageAssignments && entry.order.status === "submitted" && !entry.order.warehouseWorkerId && (
                <div className="grid gap-3 border-b bg-muted/20 px-5 py-4 md:grid-cols-[1fr_1fr_auto]">
                  <Select
                    value={assignDraft[entry.order.id]?.warehouseWorkerId ?? ""}
                    onValueChange={(value) => setAssignDraft((current) => ({
                      ...current,
                      [entry.order.id]: { ...(current[entry.order.id] ?? { driverId: "" }), warehouseWorkerId: value },
                    }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select warehouse worker" /></SelectTrigger>
                    <SelectContent>
                      {warehouseWorkers.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={assignDraft[entry.order.id]?.driverId ?? ""}
                    onValueChange={(value) => setAssignDraft((current) => ({
                      ...current,
                      [entry.order.id]: { ...(current[entry.order.id] ?? { warehouseWorkerId: "" }), driverId: value },
                    }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                    <SelectContent>
                      {drivers.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!assignDraft[entry.order.id]?.warehouseWorkerId || !assignDraft[entry.order.id]?.driverId || assignMutation.isPending}
                    onClick={() => assignMutation.mutate(entry.order.id)}
                  >
                    Assign
                  </Button>
                </div>
              )}

              <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Loaded Qty</TableHead>
                    <TableHead>Note</TableHead>
                    {canManageAssignments && <TableHead>Substitute</TableHead>}
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lineItems.map((lineItem) => {
                    const pick = getInitialPick(entry, lineItem);
                    const editable = role === "warehouse_worker";
                    const shortage = pick.status === "partial" || pick.status === "no_stock";
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
                            <Input className="w-24" type="number" min={0} value={pick.loadedQty} onChange={(e) => updatePick(entry.order.id, lineItem.id, { loadedQty: Number(e.target.value) })} />
                          ) : pick.loadedQty}
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Input value={pick.note} onChange={(e) => updatePick(entry.order.id, lineItem.id, { note: e.target.value })} placeholder="Note" />
                          ) : pick.note || "-"}
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
                        <TableCell className="text-right">{formatCurrency(lineItem.unitPriceAtTimeOfOrder)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4">
                {role === "warehouse_worker" && canWorkerTakeAction(entry.order) && !isHistoricalFocus && (
                  <>
                    <Button variant="outline" onClick={() => pickingMutation.mutate({ orderId: entry.order.id, submitForReview: false })}>Save Picking</Button>
                    <Button onClick={() => pickingMutation.mutate({ orderId: entry.order.id, submitForReview: true })}>Send to Picking Review</Button>
                  </>
                )}
                {role === "driver" && canDriverTakeAction(entry.order) && !isHistoricalFocus && (
                  <div className="flex w-full items-end gap-2">
                    <Textarea
                      className="min-h-20"
                      placeholder={entry.order.restaurantIssueStatus === "pending_driver" ? "Driver resolution note" : "Delivery note"}
                      value={driverNotes[entry.order.id] ?? ""}
                      onChange={(event) => setDriverNotes((current) => ({ ...current, [entry.order.id]: event.target.value }))}
                    />
                    {entry.order.restaurantIssueStatus === "pending_driver" ? (
                      <Button onClick={() => resolveIssueMutation.mutate(entry.order.id)} disabled={resolveIssueMutation.isPending}>
                        Approve Issue / Create Invoice
                      </Button>
                    ) : (
                      <Button onClick={() => deliverMutation.mutate(entry.order.id)}>Mark Delivered</Button>
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
