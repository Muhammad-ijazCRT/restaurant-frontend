import { useState, useEffect } from "react";
import { restaurantReviewApi, restaurantReviewKeys, restaurantReviewPaths } from "@/api/restaurant/review";
import { restaurantOrderPaths } from "@/api/restaurant/orders";
import { profileKeys } from "@/api/shared/profile";
import { vendorKeys } from "@/api/vendor/vendors";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { useParams, useLocation } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { formatCurrency } from "@shared/schema";
import type { LineFulfillment, Order } from "@shared/schema";
import {
  getEffectiveLineQty,
  getOriginalOrderTotal,
  getVendorAdjustedQty,
  getVendorAdjustedTotal,
  getVendorNote,
  normalizeLineFulfillment,
} from "@/lib/vendor-order-fulfillment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Package, CalendarDays, Building2, UtensilsCrossed,
  ClipboardCheck, Truck, CheckCircle2, Hash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItemWithProduct {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceAtTimeOfOrder: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    unitType: string;
    unitSize: string;
  } | null;
}

interface OrderDetailResponse {
  order: Pick<
    Order,
    | "id"
    | "displayId"
    | "restaurantOrgId"
    | "vendorId"
    | "status"
    | "createdAt"
    | "restaurantReviewSubmittedAt"
    | "restaurantIssueStatus"
    | "vendorApprovedAt"
    | "paidAt"
    | "pickingStatus"
  >;
  lineItems: LineItemWithProduct[];
}

interface ReviewFulfillment extends LineFulfillment {
  fulfilledQuantity?: number | null;
  loadedQuantity?: number | null;
  warehouseNote?: string | null;
}

interface Substitution {
  id: string;
  orderId: string;
  orderLineItemId: string;
  originalProductId: string;
  substituteProductId: string;
  proposedQty: number;
  note: string | null;
  status: "proposed" | "accepted" | "rejected";
}

interface ReviewDraftItem {
  receivedQty: string;
  note: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RestaurantOrderReview() {
  const { vendorId, orderId } = useParams<{ vendorId: string; orderId: string }>();
  const { restaurantId } = useRestaurantAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [draft, setDraft] = useState<Record<string, ReviewDraftItem>>({});

  if (!restaurantId) {
    navigate("/restaurant/login");
    return null;
  }

  // ── Fetch order detail ────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<OrderDetailResponse>({
    queryKey: restaurantOrderKeys.detail(restaurantId, orderId),
    enabled: !!restaurantId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(restaurantOrderPaths.detail(restaurantId, orderId)));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  // ── Fetch vendor name ─────────────────────────────────────────────────────

  const { data: vendor } = useQuery<{ id: string; name: string }>({
    queryKey: vendorKeys.detail(vendorId),
    enabled: !!vendorId,
    staleTime: Infinity,
  });

  // ── Fetch restaurant name ─────────────────────────────────────────────────

  const { data: restaurant } = useQuery<{ id: string; name: string }>({
    queryKey: restaurantOrgKeys.detail(restaurantId),
    enabled: !!restaurantId,
    staleTime: Infinity,
  });

  // ── Fetch existing fulfillments ───────────────────────────────────────────

  const { data: existingFulfillments = [] } = useQuery<ReviewFulfillment[]>({
    queryKey: restaurantReviewKeys.review(restaurantId, orderId),
    enabled: !!restaurantId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(restaurantReviewPaths.review(restaurantId, orderId)));
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: substitutions = [] } = useQuery<Substitution[]>({
    queryKey: restaurantReviewKeys.substitutions(restaurantId, orderId),
    enabled: !!restaurantId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(restaurantReviewPaths.substitutions(restaurantId, orderId)));
      if (!res.ok) return [];
      return res.json();
    },
  });

  const substitutionMutation = useMutation({
    mutationFn: async (payload: { substitutionId: string; status: "accepted" | "rejected" }) => {
      const res = await restaurantReviewApi.updateSubstitution(
        restaurantId,
        orderId,
        payload.substitutionId,
        { status: payload.status },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: restaurantReviewKeys.substitutions(restaurantId, orderId),
      });
      queryClient.invalidateQueries({
        queryKey: restaurantReviewKeys.review(restaurantId, orderId),
      });
      toast({
        title: "Substitution updated",
        description: "Your substitution decision has been saved.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Pre-populate draft from existing fulfillments or default to vendor/warehouse qty
  useEffect(() => {
    const lineItems = data?.lineItems ?? [];
    if (lineItems.length === 0) return;

    const fulfillmentByLine = new Map(
      existingFulfillments.map((f) => [f.orderLineItemId, normalizeLineFulfillment(f)!]),
    );
    const map: Record<string, ReviewDraftItem> = {};

    for (const li of lineItems) {
      const fulfillment = fulfillmentByLine.get(li.id);
      const expectedQty = getEffectiveLineQty(fulfillment, li.quantity, data?.order ?? undefined);
      const savedReceived = fulfillment?.restaurantReceivedQty;
      map[li.id] = {
        receivedQty:
          savedReceived != null
            ? String(savedReceived)
            : String(expectedQty),
        note: fulfillment?.restaurantNote ?? "",
      };
    }
    setDraft(map);
  }, [existingFulfillments, data?.lineItems, data?.order]);

  // ── Submit review mutation ────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      const lineItems = data?.lineItems ?? [];
      const items = lineItems.map(li => ({
        lineItemId: li.id,
        receivedQty: draft[li.id]?.receivedQty !== "" && draft[li.id]?.receivedQty != null
          ? parseInt(draft[li.id].receivedQty, 10)
          : null,
        note: draft[li.id]?.note || null,
      }));
      const res = await restaurantReviewApi.submit(restaurantId, orderId, { items });
      return res.json() as Promise<{
        order: OrderDetailResponse["order"];
        pendingVendorReview?: boolean;
        invoiced?: boolean;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: restaurantReviewKeys.review(restaurantId, orderId),
      });
      queryClient.invalidateQueries({
        queryKey: restaurantOrderKeys.submittedList(restaurantId, vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: restaurantOrderKeys.detail(restaurantId, orderId),
      });
      queryClient.invalidateQueries({ queryKey: restaurantOrderKeys.submittedAll(restaurantId) });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      queryClient.invalidateQueries({ queryKey: restaurantOrgKeys.vendor(restaurantId, vendorId) });
      queryClient.invalidateQueries({
        queryKey: restaurantOrderKeys.submittedList(restaurantId, vendorId),
      });
      void queryClient.refetchQueries({ queryKey: restaurantOrderKeys.submittedList(restaurantId, vendorId) });
      void queryClient.refetchQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      toast({
        title: result.pendingVendorReview ? "Review sent to vendor" : "Review submitted",
        description: result.pendingVendorReview
          ? "Quantity changes were sent to the vendor for review before invoicing."
          : "Order has been invoiced successfully.",
      });
      navigate(`/restaurant/vendor/${vendorId}`);
    },
    onError: (err: Error) => {
      if (err.message.includes("already been approved")) {
        void queryClient.refetchQueries({ queryKey: restaurantOrderKeys.submittedList(restaurantId, vendorId) });
        void queryClient.refetchQueries({ queryKey: vendorOrderKeys.list(vendorId) });
        toast({ title: "Review saved", description: "This order was successfully reviewed." });
        navigate(`/restaurant/vendor/${vendorId}`, { replace: true });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  function setField(lineItemId: string, field: keyof ReviewDraftItem, value: string) {
    setDraft(prev => ({
      ...prev,
      [lineItemId]: { ...prev[lineItemId] ?? { receivedQty: "", note: "" }, [field]: value },
    }));
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-sm font-medium" data-testid="text-review-error">
          Order not found or you do not have access.
        </p>
        <Button variant="outline" onClick={() => navigate(`/restaurant/vendor/${vendorId}`)} data-testid="button-back-on-error">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Vendor
        </Button>
      </div>
    );
  }

  const { order, lineItems } = data;
  const isReadOnly = !!order.restaurantReviewSubmittedAt;
  const fulfillmentMap = new Map(
    existingFulfillments.map((f) => [f.orderLineItemId, normalizeLineFulfillment(f)!]),
  );

  const orderedTotal = getOriginalOrderTotal(lineItems);
  const vendorTotal = getVendorAdjustedTotal(lineItems, (lineItemId) =>
    fulfillmentMap.get(lineItemId),
  );

  const orderTotal = lineItems.reduce((acc, li) => {
    const liDraft = draft[li.id] ?? { receivedQty: "", note: "" };
    const expectedQty = getEffectiveLineQty(fulfillmentMap.get(li.id), li.quantity, order);
    const receivedQtyNum =
      liDraft.receivedQty !== "" ? parseInt(liDraft.receivedQty, 10) : expectedQty;
    return acc + parseFloat(li.unitPriceAtTimeOfOrder) * receivedQtyNum;
  }, 0);

  return (
    <div className="space-y-6 pb-16">
        {/* ── Order Info Card ───────────────────────────────────────────── */}
        <div className="bg-card border rounded-lg p-5 space-y-4" data-testid="card-order-info">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-xl font-bold text-foreground" data-testid="text-order-display-id">
                  Order #{order.displayId ?? "—"}
                </span>
                {isReadOnly ? (
                  <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                    {order.status === "invoiced" || order.vendorApprovedAt ? "Invoiced" : "Review Submitted"}
                  </Badge>
                ) : (
                  <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    Needs Review
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-order-vendor-name">
                  {vendor?.name ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-emerald-500/10 p-1.5 shrink-0">
                <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Restaurant</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-order-restaurant-name">
                  {restaurant?.name ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-muted p-1.5 shrink-0">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order Date</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-order-date">
                  {formatDate(order.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Invoiced Banner (read-only) ────────────────────── */}
        {isReadOnly && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800" data-testid="banner-review-submitted">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {order.restaurantIssueStatus === "pending_vendor"
                ? "Review submitted — waiting for vendor to review quantity changes."
                : order.restaurantIssueStatus === "pending_driver"
                  ? "Review submitted — waiting for driver approval."
                  : order.status === "invoiced" || order.vendorApprovedAt
                    ? "Review submitted — invoice created."
                    : "Review already submitted."}
            </p>
          </div>
        )}

        {/* ── Line Items Review Table ────────────────────────────────── */}
        {substitutions.length > 0 && (
          <div className="bg-card border rounded-lg overflow-hidden" data-testid="card-substitutions">
            <div className="px-5 py-3 border-b flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-foreground">Substitutions</h2>
              <span className="text-xs text-muted-foreground ml-1">
                {substitutions.length} item{substitutions.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-5 space-y-3">
              {substitutions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between gap-3 rounded-md border px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Replacement proposal</p>
                    <p className="text-xs text-muted-foreground">
                      Qty {sub.proposedQty}{sub.note ? ` - ${sub.note}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="font-medium text-foreground">{sub.status}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {sub.status === "proposed" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => substitutionMutation.mutate({ substitutionId: sub.id, status: "accepted" })}
                          disabled={substitutionMutation.isPending}
                          data-testid={`button-accept-substitution-${sub.id}`}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => substitutionMutation.mutate({ substitutionId: sub.id, status: "rejected" })}
                          disabled={substitutionMutation.isPending}
                          data-testid={`button-reject-substitution-${sub.id}`}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline">{sub.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card border rounded-lg overflow-hidden" data-testid="card-review-table">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-foreground">
              {isReadOnly ? "Submitted Review" : "Review Received Items"}
            </h2>
            <span className="text-xs text-muted-foreground ml-1">
              {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="font-semibold pl-5 w-[28%]">Product</TableHead>
                  <TableHead className="font-semibold text-right w-20">Ordered Qty</TableHead>
                  <TableHead className="font-semibold text-right w-20">Vendor Qty</TableHead>
                  <TableHead className="font-semibold min-w-[120px]">Vendor Note</TableHead>
                  <TableHead className="font-semibold text-right w-24">Unit Price</TableHead>
                  <TableHead className="font-semibold text-right w-24">Vendor Total</TableHead>
                  <TableHead className="font-semibold text-right w-28">Received Qty</TableHead>
                  <TableHead className="font-semibold text-right w-24">Line Total</TableHead>
                  <TableHead className="font-semibold min-w-[160px]">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li, idx) => {
                  const fulfillment = fulfillmentMap.get(li.id);
                  const vendorQty = getVendorAdjustedQty(fulfillment, li.quantity);
                  const expectedQty = getEffectiveLineQty(fulfillment, li.quantity, order);
                  const vendorNote = getVendorNote(fulfillment);
                  const liDraft = draft[li.id] ?? { receivedQty: String(expectedQty), note: "" };
                  const receivedQtyNum =
                    liDraft.receivedQty !== "" ? parseInt(liDraft.receivedQty, 10) : expectedQty;
                  const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * receivedQtyNum;
                  const vendorLineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * vendorQty;
                  const hasDiscrepancy = receivedQtyNum !== expectedQty;

                  return (
                    <TableRow
                      key={li.id}
                      className={`${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                      data-testid={`row-review-item-${li.id}`}
                    >
                      <TableCell className="pl-5 py-4">
                        <div className="flex items-start gap-2.5">
                          <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 p-1.5 shrink-0 mt-0.5">
                            <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground" data-testid={`text-review-product-${li.id}`}>
                              {li.product?.name ?? li.productId}
                            </p>
                            {li.product?.sku && (
                              <p className="text-xs text-muted-foreground mt-0.5">SKU: {li.product.sku}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm text-muted-foreground" data-testid={`text-review-ordered-qty-${li.id}`}>
                          {li.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm font-medium text-foreground" data-testid={`text-review-vendor-qty-${li.id}`}>
                          {vendorQty}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm text-muted-foreground" data-testid={`text-review-vendor-note-${li.id}`}>
                          {vendorNote || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm font-medium text-foreground" data-testid={`text-review-vendor-total-${li.id}`}>
                          {formatCurrency(String(vendorLineTotal.toFixed(2)))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        {isReadOnly ? (
                          <span
                            className={`text-sm font-medium ${hasDiscrepancy ? "text-red-600 dark:text-red-400" : ""}`}
                            data-testid={`text-received-qty-${li.id}`}
                          >
                            {liDraft.receivedQty !== "" ? liDraft.receivedQty : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            className="w-24 h-8 text-sm text-right ml-auto"
                            placeholder="—"
                            value={liDraft.receivedQty}
                            onChange={e => setField(li.id, "receivedQty", e.target.value)}
                            data-testid={`input-received-qty-${li.id}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span
                          className={`text-sm font-semibold ${hasDiscrepancy ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
                          data-testid={`text-review-line-total-${li.id}`}
                        >
                          {formatCurrency(String(lineTotal.toFixed(2)))}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {isReadOnly ? (
                          <span className="text-sm text-muted-foreground" data-testid={`text-review-note-${li.id}`}>
                            {liDraft.note || <span className="italic">—</span>}
                          </span>
                        ) : (
                          <Input
                            type="text"
                            className="h-8 text-sm"
                            placeholder="Add note…"
                            maxLength={500}
                            value={liDraft.note}
                            onChange={e => setField(li.id, "note", e.target.value)}
                            data-testid={`input-review-note-${li.id}`}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t bg-muted/20 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Ordered total:
                <span className="ml-1.5 font-medium text-foreground">
                  {formatCurrency(String(orderedTotal.toFixed(2)))}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Vendor total:
                <span className="ml-1.5 font-medium text-foreground">
                  {formatCurrency(String(vendorTotal.toFixed(2)))}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Review total:
                <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-400" data-testid="text-review-total">
                  {formatCurrency(String(orderTotal.toFixed(2)))}
                </span>
              </div>
              {isReadOnly && (
                <div className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span data-testid="text-review-submitted-label">Review submitted</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/restaurant/vendor/${vendorId}`)}
                data-testid="button-back-footer"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
              </Button>
              {!isReadOnly && (
                <Button
                  size="sm"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="button-submit-review"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  {submitMutation.isPending ? "Submitting…" : "Submit Review"}
                </Button>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
