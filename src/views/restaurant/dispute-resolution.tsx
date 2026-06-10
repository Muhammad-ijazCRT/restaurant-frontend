import { useState, useEffect } from "react";
import { restaurantReviewApi, restaurantReviewKeys, restaurantReviewPaths } from "@/api/restaurant/review";
import { restaurantOrderPaths } from "@/api/restaurant/orders";
import { adminDashboardKeys } from "@/api/admin/dashboard";
import { vendorKeys } from "@/api/vendor/vendors";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { useParams, useLocation } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { isDisputedOrder } from "@/lib/order-status-utils";
import {
  ArrowLeft, Package, CalendarDays, Building2, UtensilsCrossed,
  ClipboardCheck, Hash, ShieldAlert, RefreshCw,
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
  order: {
    id: string;
    displayId: number | null;
    restaurantOrgId: string;
    vendorId: string;
    status: string;
    createdAt: string;
    restaurantReviewSubmittedAt: string | null;
    vendorApprovedAt: string | null;
    vendorRejectedAt: string | null;
    vendorRejectionReason: string | null;
    paidAt: string | null;
  };
  lineItems: LineItemWithProduct[];
}

interface LineFulfillment {
  id: string;
  orderLineItemId: string;
  restaurantReceivedQty: number | null;
  restaurantNote: string | null;
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

export default function RestaurantDisputeResolution() {
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

  // ── Fetch existing fulfillments (prefill) ─────────────────────────────────

  const { data: existingFulfillments = [] } = useQuery<LineFulfillment[]>({
    queryKey: restaurantReviewKeys.review(restaurantId, orderId),
    enabled: !!restaurantId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(restaurantReviewPaths.review(restaurantId, orderId)));
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Redirect if invoice already exists — order belongs in Invoiced, not Disputed
  useEffect(() => {
    if (!data?.order) return;
    if (!isDisputedOrder(data.order)) {
      navigate(`/restaurant/vendor/${vendorId}`);
    }
  }, [data?.order, navigate, vendorId]);

  // Pre-populate draft from existing fulfillments
  useEffect(() => {
    if (existingFulfillments.length > 0) {
      const map: Record<string, ReviewDraftItem> = {};
      for (const f of existingFulfillments) {
        map[f.orderLineItemId] = {
          receivedQty: f.restaurantReceivedQty != null ? String(f.restaurantReceivedQty) : "",
          note: f.restaurantNote ?? "",
        };
      }
      setDraft(map);
    }
  }, [existingFulfillments]);

  // ── Resubmit mutation ─────────────────────────────────────────────────────

  const resubmitMutation = useMutation({
    mutationFn: async () => {
      const lineItems = data?.lineItems ?? [];
      const items = lineItems.map(li => ({
        lineItemId: li.id,
        receivedQty: draft[li.id]?.receivedQty !== "" && draft[li.id]?.receivedQty != null
          ? parseInt(draft[li.id].receivedQty, 10)
          : null,
        note: draft[li.id]?.note || null,
      }));
      const res = await restaurantReviewApi.resubmit(restaurantId, orderId, { items });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: restaurantReviewKeys.review(restaurantId, orderId),
      });
      queryClient.invalidateQueries({
        queryKey: restaurantOrderKeys.submittedList(restaurantId, vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: restaurantOrderKeys.detail(restaurantId, orderId),
      });
      queryClient.invalidateQueries({
        queryKey: vendorOrderKeys.list(vendorId),
      });
      queryClient.invalidateQueries({ queryKey: adminDashboardKeys.recentActivity() });
      toast({
        title: "Revised review submitted",
        description: "Your revised review has been saved and the invoice will update after driver resolution.",
      });
      navigate(`/restaurant/vendor/${vendorId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        <p className="text-destructive text-sm font-medium" data-testid="text-dispute-error">
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

  if (!isDisputedOrder(order)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const reviewTotal = lineItems.reduce((acc, li) => {
    const liDraft = draft[li.id] ?? { receivedQty: "", note: "" };
    const receivedQtyNum = liDraft.receivedQty !== "" ? parseInt(liDraft.receivedQty, 10) : null;
    return acc + parseFloat(li.unitPriceAtTimeOfOrder) * (receivedQtyNum ?? li.quantity);
  }, 0);

  const orderedTotal = lineItems.reduce(
    (acc, li) => acc + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0
  );

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
                <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-700">
                  Disputed
                </Badge>
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

        {/* ── Vendor Dispute Reason Banner ───────────────────────────── */}
        <div className="flex items-start gap-3 px-4 py-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" data-testid="banner-dispute-reason">
          <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {vendor?.name ?? "Vendor"} rejected your review
            </p>
            {order.vendorRejectionReason ? (
              <p className="text-sm text-red-700 dark:text-red-300" data-testid="text-dispute-reason">
                "{order.vendorRejectionReason}"
              </p>
            ) : (
              <p className="text-sm italic text-red-500 dark:text-red-400">No reason provided.</p>
            )}
            <p className="text-xs text-red-500 dark:text-red-500 mt-1">
              Review the quantities and notes below, make any corrections, and resubmit. Invoice will be created after driver resolution.
            </p>
          </div>
        </div>

        {/* ── Line Items Review Table ────────────────────────────────── */}
        <div className="bg-card border rounded-lg overflow-hidden" data-testid="card-review-table">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-foreground">Revise Your Review</h2>
            <span className="text-xs text-muted-foreground ml-1">
              {lineItems.length} item{lineItems.length !== 1 ? "s" : ""} — prefilled with your previous submission
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="font-semibold pl-5 w-[35%]">Product</TableHead>
                  <TableHead className="font-semibold text-right w-20">Ordered</TableHead>
                  <TableHead className="font-semibold text-right w-24">Unit Price</TableHead>
                  <TableHead className="font-semibold text-right w-32">Received Qty</TableHead>
                  <TableHead className="font-semibold text-right w-24">Line Total</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li, idx) => {
                  const liDraft = draft[li.id] ?? { receivedQty: "", note: "" };
                  const receivedQtyNum = liDraft.receivedQty !== "" ? parseInt(liDraft.receivedQty, 10) : null;
                  const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * (receivedQtyNum ?? li.quantity);
                  const hasDiscrepancy = receivedQtyNum != null && receivedQtyNum !== li.quantity;

                  return (
                    <TableRow
                      key={li.id}
                      className={`${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                      data-testid={`row-dispute-item-${li.id}`}
                    >
                      <TableCell className="pl-5 py-4">
                        <div className="flex items-start gap-2.5">
                          <div className="rounded-md bg-red-50 dark:bg-red-950/40 p-1.5 shrink-0 mt-0.5">
                            <Package className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground" data-testid={`text-dispute-product-${li.id}`}>
                              {li.product?.name ?? li.productId}
                            </p>
                            {li.product?.sku && (
                              <p className="text-xs text-muted-foreground mt-0.5">SKU: {li.product.sku}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm text-muted-foreground" data-testid={`text-dispute-ordered-qty-${li.id}`}>
                          {li.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <Input
                          type="number"
                          min={0}
                          className={`w-24 h-8 text-sm text-right ml-auto ${hasDiscrepancy ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                          placeholder="—"
                          value={liDraft.receivedQty}
                          onChange={e => setField(li.id, "receivedQty", e.target.value)}
                          data-testid={`input-dispute-received-qty-${li.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span
                          className={`text-sm font-semibold ${hasDiscrepancy ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}
                          data-testid={`text-dispute-line-total-${li.id}`}
                        >
                          {formatCurrency(String(lineTotal.toFixed(2)))}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <Input
                          type="text"
                          className="h-8 text-sm"
                          placeholder="Add note…"
                          maxLength={500}
                          value={liDraft.note}
                          onChange={e => setField(li.id, "note", e.target.value)}
                          data-testid={`input-dispute-note-${li.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t bg-red-50/20 dark:bg-red-950/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Ordered total:
                <span className="ml-1.5 font-medium text-foreground">
                  {formatCurrency(String(orderedTotal.toFixed(2)))}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Revised total:
                <span className="ml-1.5 font-semibold text-red-700 dark:text-red-300" data-testid="text-revised-total">
                  {formatCurrency(String(reviewTotal.toFixed(2)))}
                </span>
              </div>
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
              <Button
                size="sm"
                onClick={() => resubmitMutation.mutate()}
                disabled={resubmitMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                data-testid="button-resubmit-review"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {resubmitMutation.isPending ? "Resubmitting…" : "Resubmit for Vendor Approval"}
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
}
