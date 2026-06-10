import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "@/lib/wouter-compat";
import type { VendorRestaurantRelationship, Vendor, RestaurantOrg, Invoice } from "@shared/schema";
import { formatPhone, formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Building2, UtensilsCrossed, Link2, Calendar, Mail, Phone,
  UserCircle, AlertCircle, RefreshCw, ToggleLeft, ToggleRight,
  ShoppingCart, ShieldAlert, ExternalLink,
  CheckCircle2, CreditCard, Clock, Truck, ClipboardCheck,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InternalNotesSection } from "@/components/internal-notes-section";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedLineItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceAtTimeOfOrder: string;
  productName: string;
}

interface LineFulfillment {
  id: string;
  orderLineItemId: string;
  restaurantReceivedQty: number | null;
  restaurantNote: string | null;
}

interface RelationshipOrder {
  order: {
    id: string;
    displayId: number | null;
    status: string;
    restaurantOrgId: string;
    vendorId: string;
    createdAt: string;
    restaurantReviewSubmittedAt: string | null;
    vendorApprovedAt: string | null;
    vendorRejectedAt: string | null;
    vendorRejectionReason: string | null;
    paidAt: string | null;
  };
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

function deriveOrderStatus(order: RelationshipOrder["order"]): {
  label: string;
  color: string;
  icon: React.ElementType;
} {
  if (order.paidAt) return { label: "Paid", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: CreditCard };
  if (order.vendorApprovedAt) return { label: "Invoiced", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 };
  if (order.vendorRejectedAt && !order.vendorApprovedAt) return { label: "Disputed", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: ShieldAlert };
  if (order.restaurantReviewSubmittedAt && !order.vendorApprovedAt) return { label: "Needs Approval", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", icon: ClipboardCheck };
  if (order.status === "delivered") return { label: "Awaiting Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Truck };
  return { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Clock };
}

function displayTotal(entry: RelationshipOrder): string {
  if (entry.invoice?.approvedTotal) return formatCurrency(entry.invoice.approvedTotal);
  if (entry.order.vendorApprovedAt || entry.order.paidAt) return formatCurrency(String(entry.reviewedTotal.toFixed(2)));
  return formatCurrency(String(entry.orderedTotal.toFixed(2)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    archived: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium capitalize ${variants[status] || variants.active}`}>
      {status}
    </Badge>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelationshipDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const {
    data: relationship,
    isLoading: relLoading,
    isError: relError,
    refetch,
  } = useQuery<VendorRestaurantRelationship>({
    queryKey: ["/api/relationships", id],
  });

  const {
    data: vendor,
    isLoading: vendorLoading,
  } = useQuery<Vendor>({
    queryKey: ["/api/vendors", relationship?.vendorId],
    enabled: !!relationship?.vendorId,
  });

  const {
    data: restaurant,
    isLoading: restaurantLoading,
  } = useQuery<RestaurantOrg>({
    queryKey: ["/api/restaurant-orgs", relationship?.restaurantOrgId],
    enabled: !!relationship?.restaurantOrgId,
  });

  const {
    data: relationshipOrders = [],
    isLoading: ordersLoading,
  } = useQuery<RelationshipOrder[]>({
    queryKey: ["/api/admin/relationships", id, "orders"],
    enabled: !!id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const toggleMutation = useMutation({
    mutationFn: ({ status }: { status: string }) =>
      apiRequest("PATCH", `/api/relationships/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Status updated", description: "The relationship status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = relLoading || vendorLoading || restaurantLoading;

  const [ordersOpen, setOrdersOpen] = useState(true);
  const [disputesOpen, setDisputesOpen] = useState(true);

  // Derived slices
  const disputedOrders = relationshipOrders.filter(e =>
    !!e.order.vendorRejectedAt && !e.order.vendorApprovedAt
  );
  const paidOrders = relationshipOrders.filter(e => !!e.order.paidAt);
  const totalPaidAmount = paidOrders.reduce((sum, e) => {
    const t = e.invoice?.approvedTotal ? parseFloat(e.invoice.approvedTotal) : e.reviewedTotal;
    return sum + t;
  }, 0);

  if (relError) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/admin/relationships">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Relationships
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Relationship not found</h3>
          <p className="text-sm text-muted-foreground mb-6">This relationship may have been removed.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/admin/relationships">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="link-back-relationships">
          <ArrowLeft className="h-4 w-4 mr-1" />Back to Relationships
        </Button>
      </Link>

      {isLoading ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : relationship ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
                  Relationship Overview
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {vendor?.name || "—"} <span className="mx-1 text-muted-foreground/40">→</span> {restaurant?.name || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={relationship.status} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleMutation.mutate({
                  status: relationship.status === "active" ? "inactive" : "active",
                })}
                disabled={toggleMutation.isPending}
                data-testid="button-toggle-status"
              >
                {relationship.status === "active" ? (
                  <><ToggleRight className="h-3.5 w-3.5 mr-1.5" />Deactivate</>
                ) : (
                  <><ToggleLeft className="h-3.5 w-3.5 mr-1.5" />Activate</>
                )}
              </Button>
            </div>
          </div>

          {/* ── Relationship meta ──────────────────────────────────── */}
          <div className="border rounded-lg p-4 bg-card mb-6" data-testid="section-relationship-meta">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Relationship Details</p>
            <div className="flex flex-wrap gap-6">
              <InfoRow
                icon={Calendar}
                label="Created"
                value={new Date(relationship.createdAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })}
              />
              <div className="flex items-start gap-2.5 text-sm">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Relationship ID</p>
                  <p className="font-mono text-xs text-muted-foreground">{relationship.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Vendor + Restaurant cards ──────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="border rounded-lg p-5 bg-card" data-testid="section-vendor-summary">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor</p>
                </div>
                {vendor && (
                  <Link href={`/admin/vendors/${vendor.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground text-xs" data-testid="link-vendor-detail">
                      <ExternalLink className="h-3 w-3 mr-1" />View
                    </Button>
                  </Link>
                )}
              </div>
              {vendor ? (
                <div className="space-y-3">
                  <p className="text-base font-semibold text-foreground" data-testid="text-vendor-name">{vendor.name}</p>
                  <div className="space-y-2">
                    <InfoRow icon={UserCircle} label="Contact" value={vendor.contactName} />
                    <InfoRow icon={Mail} label="Email" value={vendor.email} />
                    <InfoRow icon={Phone} label="Phone" value={formatPhone(vendor.phone)} />
                  </div>
                  <div className="pt-1">
                    <StatusBadge status={vendor.status} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Vendor details unavailable</p>
              )}
            </div>

            <div className="border rounded-lg p-5 bg-card" data-testid="section-restaurant-summary">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/40 p-1.5">
                    <UtensilsCrossed className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Restaurant Organization</p>
                </div>
                {restaurant && (
                  <Link href={`/admin/restaurants/${restaurant.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground text-xs" data-testid="link-restaurant-detail">
                      <ExternalLink className="h-3 w-3 mr-1" />View
                    </Button>
                  </Link>
                )}
              </div>
              {restaurant ? (
                <div className="space-y-3">
                  <p className="text-base font-semibold text-foreground" data-testid="text-restaurant-name">{restaurant.name}</p>
                  <div className="space-y-2">
                    <InfoRow icon={UserCircle} label="Contact" value={restaurant.contactName} />
                    <InfoRow icon={Mail} label="Email" value={restaurant.email} />
                    <InfoRow icon={Phone} label="Phone" value={formatPhone(restaurant.phone)} />
                  </div>
                  <div className="pt-1">
                    <StatusBadge status={restaurant.status} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Restaurant details unavailable</p>
              )}
            </div>
          </div>

          {/* ── Activity ───────────────────────────────────────────── */}
          <div className="space-y-4" data-testid="section-activity">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Activity</h2>

            {/* Summary stats */}
            {!ordersLoading && relationshipOrders.length > 0 && (
              <div className="grid grid-cols-3 gap-3" data-testid="section-activity-stats">
                <div className="border rounded-lg p-3 bg-card text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-total-orders">{relationshipOrders.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Orders</p>
                </div>
                <div className="border rounded-lg p-3 bg-card text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="stat-total-paid">{paidOrders.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Paid Orders</p>
                </div>
                <div className="border rounded-lg p-3 bg-card text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 text-sm font-semibold" data-testid="stat-revenue">
                    {formatCurrency(String(totalPaidAmount.toFixed(2)))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Paid Revenue</p>
                </div>
              </div>
            )}

            {/* Orders section */}
            <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-orders">
              <div
                className="flex items-center gap-2 px-5 py-3 border-b cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setOrdersOpen(!ordersOpen)}
                data-testid="button-toggle-orders-section"
              >
                {ordersOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Orders</h3>
                {!ordersLoading && (
                  <Badge className="text-xs bg-muted text-muted-foreground ml-1" data-testid="badge-order-count">
                    {relationshipOrders.length}
                  </Badge>
                )}
              </div>

              {ordersOpen && (ordersLoading ? (
                <div className="p-5 space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : relationshipOrders.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-10 px-4 text-center"
                  data-testid="empty-state-orders"
                >
                  <div className="rounded-full bg-muted/60 p-3 mb-3">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No order activity yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Orders placed within this vendor-restaurant relationship will appear here.</p>
                </div>
              ) : (
                <div data-testid="list-orders">
                  {/* Table header */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span className="w-16">Order #</span>
                    <span>Status</span>
                    <span className="text-right w-28">Order Date</span>
                    <span className="text-right w-24">Paid Date</span>
                    <span className="text-right w-24">Amount</span>
                  </div>
                  {relationshipOrders.map((entry) => {
                    const { label, color, icon: StatusIcon } = deriveOrderStatus(entry.order);
                    return (
                      <Link key={entry.order.id} href={`/admin/orders/${entry.order.id}`}>
                        <div
                          className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-5 py-3 border-b last:border-0 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                          data-testid={`row-order-${entry.order.id}`}
                        >
                          <span className="w-16 text-sm font-semibold text-foreground" data-testid={`text-order-display-id-${entry.order.id}`}>
                            #{entry.order.displayId ?? "—"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-xs ${color} border-0`} data-testid={`badge-order-status-${entry.order.id}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {label}
                            </Badge>
                            {entry.lineItems.length > 0 && (
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                · {entry.lineItems.length} item{entry.lineItems.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground text-right w-28" data-testid={`text-order-date-${entry.order.id}`}>
                            {fmtDate(entry.order.createdAt)}
                          </span>
                          <span className="text-xs text-right w-24" data-testid={`text-paid-date-${entry.order.id}`}>
                            {entry.order.paidAt ? (
                              <span className="text-green-600 dark:text-green-400 font-medium">{fmtDate(entry.order.paidAt)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </span>
                          <span className="text-sm font-semibold text-foreground text-right w-24" data-testid={`text-order-amount-${entry.order.id}`}>
                            {displayTotal(entry)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Disputes section */}
            <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-disputes">
              <div
                className="flex items-center gap-2 px-5 py-3 border-b cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setDisputesOpen(!disputesOpen)}
                data-testid="button-toggle-disputes-section"
              >
                {disputesOpen
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Disputes</h3>
                {!ordersLoading && disputedOrders.length > 0 && (
                  <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ml-1" data-testid="badge-dispute-count">
                    {disputedOrders.length}
                  </Badge>
                )}
              </div>

              {disputesOpen && (ordersLoading ? (
                <div className="p-5 space-y-3">
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : disputedOrders.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-10 px-4 text-center"
                  data-testid="empty-state-disputes"
                >
                  <div className="rounded-full bg-muted/60 p-3 mb-3">
                    <ShieldAlert className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No disputes</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Disputed orders tied to this relationship will appear here for admin review.</p>
                </div>
              ) : (
                <div data-testid="list-disputes">
                  {disputedOrders.map((entry) => (
                    <div
                      key={entry.order.id}
                      className="px-5 py-4 border-b last:border-0"
                      data-testid={`row-dispute-${entry.order.id}`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            <span className="text-sm font-semibold text-foreground" data-testid={`text-dispute-order-id-${entry.order.id}`}>
                              Order #{entry.order.displayId ?? "—"}
                            </span>
                            <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0">
                              Disputed
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground" data-testid={`text-dispute-date-${entry.order.id}`}>
                            Order placed {fmtDate(entry.order.createdAt)}
                            {entry.order.vendorRejectedAt && (
                              <> · Disputed {fmtDate(entry.order.vendorRejectedAt)}</>
                            )}
                          </p>
                          {entry.order.vendorRejectionReason && (
                            <div className="mt-1.5 flex items-start gap-1.5">
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium shrink-0">Rejection reason:</span>
                              <span className="text-xs text-red-700 dark:text-red-300" data-testid={`text-dispute-reason-${entry.order.id}`}>
                                "{entry.order.vendorRejectionReason}"
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground" data-testid={`text-dispute-amount-${entry.order.id}`}>
                              {displayTotal(entry)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {entry.lineItems.length} item{entry.lineItems.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Link href={`/admin/orders/${entry.order.id}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" data-testid={`link-view-dispute-${entry.order.id}`}>
                              <ExternalLink className="h-3 w-3 mr-1" />View Order
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

          </div>

          <InternalNotesSection entityType="relationship" entityId={id!} />
        </>
      ) : null}
    </div>
  );
}
