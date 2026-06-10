import { useQuery } from "@tanstack/react-query";
import { adminDashboardKeys } from "@/api/admin/dashboard";
import { Link, useParams } from "@/lib/wouter-compat";
import { formatCurrency } from "@shared/schema";
import type { Vendor, RestaurantOrg, VendorRestaurantRelationship, Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Building2, UtensilsCrossed, Link2, ShoppingCart,
  Truck, ClipboardCheck, CheckCircle2, CreditCard, ShieldAlert,
  Clock, AlertCircle, ExternalLink, Package, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedLineItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceAtTimeOfOrder: string;
  productName: string;
  productSku: string | null;
}

interface LineFulfillment {
  id: string;
  orderLineItemId: string;
  restaurantReceivedQty: number | null;
  restaurantNote: string | null;
}

interface AdminOrderDetail {
  order: {
    id: string;
    displayId: number | null;
    status: string;
    restaurantOrgId: string;
    vendorId: string;
    createdAt: string;
    vendorConfirmedAt: string | null;
    restaurantReviewSubmittedAt: string | null;
    vendorApprovedAt: string | null;
    vendorRejectedAt: string | null;
    vendorRejectionReason: string | null;
    paidAt: string | null;
  };
  vendor: Vendor | null;
  restaurant: RestaurantOrg | null;
  relationship: VendorRestaurantRelationship | null;
  lineItems: EnrichedLineItem[];
  fulfillments: LineFulfillment[];
  invoice: Invoice | null;
  orderedTotal: number;
  reviewedTotal: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function deriveLifecycleStatus(order: AdminOrderDetail["order"]): { label: string; color: string } {
  if (order.paidAt) return { label: "Paid", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" };
  if (order.vendorApprovedAt) return { label: "Invoiced", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
  if (order.vendorRejectedAt && !order.vendorApprovedAt) return { label: "Disputed", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
  if (order.restaurantReviewSubmittedAt && !order.vendorApprovedAt) return { label: "Needs Approval", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
  if (order.status === "delivered") return { label: "Awaiting Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {count !== undefined && (
        <Badge className="text-xs bg-muted text-muted-foreground ml-auto">{count}</Badge>
      )}
    </div>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div className={`grid gap-3 px-5 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide`}
      style={{ gridTemplateColumns: `1fr repeat(${cols.length - 1}, auto)` }}
    >
      {cols.map(c => <span key={c} className="last:text-right">{c}</span>)}
    </div>
  );
}

function TotalRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 border-t ${highlight ? "bg-muted/20" : ""}`}>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-green-700 dark:text-green-300" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

interface TimelineEvent {
  label: string;
  date: string | null;
  icon: React.ElementType;
  color: string;
  active: boolean;
  testId: string;
}

function LifecycleTimeline({ events }: { events: TimelineEvent[] }) {
  const active = events.filter(e => e.active);
  return (
    <div className="relative flex flex-col gap-0" data-testid="section-lifecycle-timeline">
      {active.map((event, idx) => {
        const Icon = event.icon;
        const isLast = idx === active.length - 1;
        return (
          <div key={event.testId} className="flex items-start gap-3" data-testid={event.testId}>
            <div className="flex flex-col items-center">
              <div className={`rounded-full p-1.5 ${event.color} shrink-0 z-10`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px h-8 bg-border mt-1" />}
            </div>
            <div className="pb-6">
              <p className="text-sm font-medium text-foreground">{event.label}</p>
              {event.date && (
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(event.date)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();

  const { data, isLoading, isError } = useQuery<AdminOrderDetail>({
    queryKey: adminDashboardKeys.adminOrder(orderId),
    enabled: !!orderId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/admin/relationships">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Order not found</h3>
          <p className="text-sm text-muted-foreground">This order may have been removed or the ID is invalid.</p>
        </div>
      </div>
    );
  }

  const { order, vendor, restaurant, relationship, lineItems, fulfillments, invoice, orderedTotal, reviewedTotal } = data;
  const { label: statusLabel, color: statusColor } = deriveLifecycleStatus(order);

  const fulfillmentMap = new Map(fulfillments.map(f => [f.orderLineItemId, f]));
  const hasReview = !!order.restaurantReviewSubmittedAt;
  const hasInvoice = !!invoice;
  const hasDispute = !!order.vendorRejectedAt;
  const isPaid = !!order.paidAt;

  const bestTotal = hasInvoice && invoice.approvedTotal
    ? formatCurrency(invoice.approvedTotal)
    : hasReview
    ? formatCurrency(String(reviewedTotal.toFixed(2)))
    : formatCurrency(String(orderedTotal.toFixed(2)));

  const backHref = relationship ? `/admin/relationships/${relationship.id}` : "/admin/relationships";

  // ── Timeline events ─────────────────────────────────────────────────────────
  const timelineEvents: TimelineEvent[] = [
    {
      label: "Order Submitted",
      date: order.createdAt,
      icon: ShoppingCart,
      color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
      active: true,
      testId: "timeline-submitted",
    },
    {
      label: "Order Delivered",
      date: order.vendorConfirmedAt,
      icon: Truck,
      color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
      active: order.status === "delivered" || hasReview || hasDispute || hasInvoice || isPaid,
      testId: "timeline-delivered",
    },
    {
      label: "Restaurant Review Submitted",
      date: order.restaurantReviewSubmittedAt,
      icon: ClipboardCheck,
      color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
      active: hasReview,
      testId: "timeline-review-submitted",
    },
    {
      label: "Disputed by Vendor",
      date: order.vendorRejectedAt,
      icon: ShieldAlert,
      color: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
      active: hasDispute,
      testId: "timeline-disputed",
    },
    {
      label: "Vendor Approved",
      date: order.vendorApprovedAt,
      icon: CheckCircle2,
      color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
      active: !!order.vendorApprovedAt,
      testId: "timeline-approved",
    },
    {
      label: "Invoice Created",
      date: invoice?.createdAt ?? null,
      icon: FileText,
      color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
      active: hasInvoice,
      testId: "timeline-invoiced",
    },
    {
      label: "Payment Received",
      date: order.paidAt,
      icon: CreditCard,
      color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
      active: isPaid,
      testId: "timeline-paid",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Back button */}
      <Link href={backHref}>
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          data-testid="link-back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {relationship ? "Back to Relationship" : "Back to Relationships"}
        </Button>
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-order-heading">
              Order #{order.displayId ?? "—"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-order-parties">
            <span className="font-medium">{vendor?.name ?? "—"}</span>
            <span className="mx-1.5 text-muted-foreground/40">→</span>
            <span className="font-medium">{restaurant?.name ?? "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`${statusColor} border-0 text-xs font-medium`} data-testid="badge-lifecycle-status">
            {statusLabel}
          </Badge>
          {relationship && (
            <Link href={`/admin/relationships/${relationship.id}`}>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-muted-foreground" data-testid="link-relationship">
                <Link2 className="h-3 w-3 mr-1" />Relationship
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Metadata bar ────────────────────────────────────────────────────── */}
      <div className="border rounded-lg p-4 bg-card mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="section-metadata">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Order Date</p>
          <p className="text-sm font-medium text-foreground" data-testid="text-order-date">{fmtDate(order.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Review Submitted</p>
          <p className="text-sm font-medium text-foreground" data-testid="text-review-date">
            {order.restaurantReviewSubmittedAt ? fmtDate(order.restaurantReviewSubmittedAt) : <span className="text-muted-foreground">—</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Vendor Approved</p>
          <p className="text-sm font-medium text-foreground" data-testid="text-approved-date">
            {order.vendorApprovedAt ? fmtDate(order.vendorApprovedAt) : <span className="text-muted-foreground">—</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Paid</p>
          <p className={`text-sm font-medium ${isPaid ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`} data-testid="text-paid-date">
            {order.paidAt ? fmtDate(order.paidAt) : "—"}
          </p>
        </div>
      </div>

      {/* ── Two-column layout: timeline left, sections right ────────────────── */}
      <div className="flex gap-8">
        {/* Timeline */}
        <div className="hidden sm:block w-48 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Lifecycle</p>
          <LifecycleTimeline events={timelineEvents} />
        </div>

        {/* Main sections */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* ── Original Order ──────────────────────────────────────────────── */}
          <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-original-order">
            <SectionHeading icon={ShoppingCart} title="Original Order" count={lineItems.length} />
            <div>
              {lineItems.map(li => (
                <div
                  key={li.id}
                  className="grid gap-3 px-5 py-3 border-b last:border-0 items-center text-sm"
                  style={{ gridTemplateColumns: "1fr auto auto auto" }}
                  data-testid={`row-original-item-${li.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate" data-testid={`text-product-name-${li.id}`}>{li.productName}</p>
                    {li.productSku && (
                      <p className="text-xs text-muted-foreground">{li.productSku}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs text-right whitespace-nowrap" data-testid={`text-ordered-qty-${li.id}`}>
                    ×{li.quantity}
                  </span>
                  <span className="text-muted-foreground text-xs text-right whitespace-nowrap" data-testid={`text-unit-price-${li.id}`}>
                    {formatCurrency(li.unitPriceAtTimeOfOrder)}
                  </span>
                  <span className="font-medium text-foreground text-right whitespace-nowrap" data-testid={`text-line-total-${li.id}`}>
                    {formatCurrency(String((parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity).toFixed(2)))}
                  </span>
                </div>
              ))}
            </div>
            <TotalRow label="Ordered Total" value={formatCurrency(String(orderedTotal.toFixed(2)))} />
          </div>

          {/* ── Restaurant Review ───────────────────────────────────────────── */}
          {hasReview && (
            <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-restaurant-review">
              <SectionHeading icon={ClipboardCheck} title="Restaurant Review" />
              <div>
                {lineItems.map(li => {
                  const f = fulfillmentMap.get(li.id);
                  const receivedQty = f?.restaurantReceivedQty ?? li.quantity;
                  const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * receivedQty;
                  const hasDiscrepancy = f && f.restaurantReceivedQty !== null && f.restaurantReceivedQty !== li.quantity;
                  return (
                    <div
                      key={li.id}
                      className="px-5 py-3 border-b last:border-0 text-sm"
                      data-testid={`row-review-item-${li.id}`}
                    >
                      <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "1fr auto auto auto" }}>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{li.productName}</p>
                          {f?.restaurantNote && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic" data-testid={`text-review-note-${li.id}`}>
                              "{f.restaurantNote}"
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs text-right whitespace-nowrap ${hasDiscrepancy ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}`}
                          data-testid={`text-received-qty-${li.id}`}
                        >
                          ×{receivedQty}
                          {hasDiscrepancy && <span className="text-muted-foreground font-normal ml-1">(ordered {li.quantity})</span>}
                        </span>
                        <span className="text-xs text-muted-foreground text-right whitespace-nowrap">
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </span>
                        <span className="font-medium text-foreground text-right whitespace-nowrap" data-testid={`text-review-line-total-${li.id}`}>
                          {formatCurrency(String(lineTotal.toFixed(2)))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <TotalRow label="Reviewed Total" value={formatCurrency(String(reviewedTotal.toFixed(2)))} />
            </div>
          )}

          {/* ── Dispute History ─────────────────────────────────────────────── */}
          {hasDispute && (
            <div className="border border-red-200 dark:border-red-800 rounded-lg bg-card overflow-hidden" data-testid="section-dispute-history">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Dispute History</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Disputed by</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground" data-testid="text-disputed-by">
                      {vendor?.name ?? "Vendor"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Disputed on</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-disputed-at">
                    {fmtDateTime(order.vendorRejectedAt!)}
                  </p>
                </div>
                {order.vendorRejectionReason && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Rejection reason</p>
                    <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
                      <p className="text-sm text-red-700 dark:text-red-300 italic" data-testid="text-rejection-reason">
                        "{order.vendorRejectionReason}"
                      </p>
                    </div>
                  </div>
                )}
                {order.vendorApprovedAt && (
                  <div className="mt-2 pt-3 border-t border-dashed border-muted">
                    <p className="text-xs text-muted-foreground mb-1">Dispute resolved — Vendor approved</p>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" data-testid="text-dispute-resolved-at">
                      {fmtDateTime(order.vendorApprovedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Approved Invoice ────────────────────────────────────────────── */}
          {hasInvoice && invoice && (
            <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-approved-invoice">
              <SectionHeading icon={CheckCircle2} title="Approved Invoice" />
              <div>
                {(invoice.lineItems as Array<{
                  productId: string; productName: string; sku: string | null;
                  orderLineItemId: string; unitPrice: string; approvedQty: number;
                  lineTotal: string; restaurantNote: string | null;
                }>).map((snap, idx) => (
                  <div
                    key={snap.orderLineItemId ?? idx}
                    className="grid gap-3 px-5 py-3 border-b last:border-0 items-center text-sm"
                    style={{ gridTemplateColumns: "1fr auto auto auto" }}
                    data-testid={`row-invoice-item-${snap.orderLineItemId ?? idx}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate" data-testid={`text-invoice-product-${idx}`}>{snap.productName}</p>
                      {snap.sku && <p className="text-xs text-muted-foreground">{snap.sku}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground text-right whitespace-nowrap" data-testid={`text-invoice-qty-${idx}`}>
                      ×{snap.approvedQty}
                    </span>
                    <span className="text-xs text-muted-foreground text-right whitespace-nowrap" data-testid={`text-invoice-unit-price-${idx}`}>
                      {formatCurrency(snap.unitPrice)}
                    </span>
                    <span className="font-medium text-foreground text-right whitespace-nowrap" data-testid={`text-invoice-line-total-${idx}`}>
                      {formatCurrency(snap.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
              <TotalRow
                label="Approved Invoice Total"
                value={formatCurrency(invoice.approvedTotal ?? "0")}
                highlight
              />
            </div>
          )}

          {/* ── Payment Record ──────────────────────────────────────────────── */}
          {isPaid && (
            <div className="border border-green-200 dark:border-green-800 rounded-lg bg-card overflow-hidden" data-testid="section-payment-record">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">Payment Record</h3>
              </div>
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Paid by</p>
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground" data-testid="text-paid-by">
                      {restaurant?.name ?? "Restaurant"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Paid on</p>
                  <p className="text-sm font-medium text-foreground" data-testid="text-payment-date">
                    {fmtDateTime(order.paidAt!)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Amount paid</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300" data-testid="text-paid-amount">
                    {hasInvoice && invoice.approvedTotal
                      ? formatCurrency(invoice.approvedTotal)
                      : formatCurrency(String(reviewedTotal.toFixed(2)))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Parties ─────────────────────────────────────────────────────── */}
          <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-parties">
            <SectionHeading icon={Link2} title="Order Parties" />
            <div className="px-5 py-4 grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</p>
                </div>
                <p className="text-sm font-semibold text-foreground" data-testid="text-vendor-name">{vendor?.name ?? "—"}</p>
                {vendor && (
                  <Link href={`/admin/vendors/${vendor.id}`}>
                    <Button variant="ghost" size="sm" className="h-6 px-0 text-xs text-muted-foreground hover:text-foreground mt-1" data-testid="link-vendor">
                      <ExternalLink className="h-3 w-3 mr-1" />View vendor
                    </Button>
                  </Link>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-orange-500" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Restaurant</p>
                </div>
                <p className="text-sm font-semibold text-foreground" data-testid="text-restaurant-name">{restaurant?.name ?? "—"}</p>
                {restaurant && (
                  <Link href={`/admin/restaurants/${restaurant.id}`}>
                    <Button variant="ghost" size="sm" className="h-6 px-0 text-xs text-muted-foreground hover:text-foreground mt-1" data-testid="link-restaurant">
                      <ExternalLink className="h-3 w-3 mr-1" />View restaurant
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
