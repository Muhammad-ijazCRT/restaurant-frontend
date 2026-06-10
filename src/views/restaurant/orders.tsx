import { useEffect, useMemo } from "react";
import { relationshipKeys } from "@/api/shared/relationships";
import { adminVendorKeys } from "@/api/admin/vendors";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import type { Order, Vendor, VendorRestaurantRelationship } from "@shared/schema";
import { formatPhone } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Mail,
  Phone,
  ReceiptText,
  UserCircle,
} from "lucide-react";
import { isInvoicedUnpaidOrder } from "@/lib/order-status-utils";
import { normalizeOrderEntries } from "@/lib/restaurant-orders";

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type VendorOrderSummary = {
  submitted: number;
  invoiced: number;
  needsReview: number;
};

function summarizeVendorOrders(orders: Order[]): VendorOrderSummary {
  return orders.reduce(
    (summary, order) => {
      if (order.status === "submitted") summary.submitted += 1;
      if (isInvoicedUnpaidOrder(order)) summary.invoiced += 1;
      if (order.status === "delivered" && !order.restaurantReviewSubmittedAt) {
        summary.needsReview += 1;
      }
      return summary;
    },
    { submitted: 0, invoiced: 0, needsReview: 0 },
  );
}

export default function RestaurantOrders() {
  const { restaurantId } = useRestaurantAuth();
  const [, navigate] = useLocation();

  const { data: relationships = [], isLoading: relationshipsLoading } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: relationshipKeys.all(),
    enabled: !!restaurantId,
  });
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: adminVendorKeys.list(false),
    enabled: !!restaurantId,
  });
  const { data: orderEntries = [], isLoading: ordersLoading } = useQuery({
    queryKey: restaurantOrderKeys.list(restaurantId),
    enabled: !!restaurantId,
    select: normalizeOrderEntries,
  });

  const activeRelationships = useMemo(
    () =>
      relationships.filter(
        (relationship) =>
          relationship.restaurantOrgId === restaurantId && relationship.status === "active",
      ),
    [relationships, restaurantId],
  );
  const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);

  const ordersByVendor = useMemo(() => {
    const grouped = new Map<string, Order[]>();
    for (const entry of orderEntries) {
      const vendorOrders = grouped.get(entry.order.vendorId) ?? [];
      vendorOrders.push(entry.order);
      grouped.set(entry.order.vendorId, vendorOrders);
    }
    return grouped;
  }, [orderEntries]);

  useEffect(() => {
    if (!restaurantId || relationshipsLoading || vendorsLoading) return;
    if (activeRelationships.length === 1) {
      navigate(`/restaurant/vendor/${activeRelationships[0].vendorId}`);
    }
  }, [restaurantId, activeRelationships, relationshipsLoading, vendorsLoading, navigate]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-muted-foreground">
        Restaurant context unavailable. Try logging in again.
      </div>
    );
  }

  const isLoading = relationshipsLoading || vendorsLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (activeRelationships.length === 1) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 text-center text-sm text-muted-foreground">
        Opening vendor orders...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a vendor to view submitted, invoiced, and order activity.
        </p>
      </div>

      {activeRelationships.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border bg-card px-4 py-10 text-muted-foreground">
          <Building2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No active vendors linked yet.</p>
        </div>
      ) : (
        activeRelationships.map((relationship) => {
          const vendor = vendorMap.get(relationship.vendorId);
          if (!vendor) return null;

          const summary = summarizeVendorOrders(ordersByVendor.get(vendor.id) ?? []);

          return (
            <div
              key={relationship.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/30 hover:bg-muted/10"
              data-testid={`card-restaurant-orders-vendor-${vendor.id}`}
              onClick={() => navigate(`/restaurant/vendor/${vendor.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/restaurant/vendor/${vendor.id}`);
                }
              }}
            >
              <div className="border-b px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{vendor.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                        <Badge variant="outline">Linked Vendor</Badge>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5">
                    <ReceiptText className="h-4 w-4" />
                    View Orders
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserCircle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Contact</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{vendor.contactName ?? "—"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Email</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{vendor.email}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Phone</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{formatPhone(vendor.phone)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Linked Since</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{formatDate(relationship.createdAt)}</p>
                </div>
              </div>

              <div className="border-t bg-muted/10 px-5 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Orders</span>
                  {summary.submitted > 0 ? (
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                      {summary.submitted === 1 ? "1 Submitted" : `${summary.submitted} Submitted`}
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-orange-50 px-4 py-2.5 dark:bg-orange-950/20">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-orange-700">Submitted</span>
                      <Badge className="bg-orange-200 text-orange-800 hover:bg-orange-200">{summary.submitted}</Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-orange-500" />
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-emerald-50 px-4 py-2.5 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Invoiced</span>
                      <Badge className="bg-emerald-200 text-emerald-800 hover:bg-emerald-200">{summary.invoiced}</Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
