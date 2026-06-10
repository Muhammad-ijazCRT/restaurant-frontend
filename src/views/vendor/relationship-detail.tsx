import { useEffect, type ComponentType, type ReactNode } from "react";
import { Link, useLocation, useParams } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { useVendorPortalNav } from "@/contexts/vendor-portal-nav-context";
import { VENDOR_SECTION_IDS } from "@/lib/vendor-portal-sections";
import type {
  Invoice,
  LineFulfillment,
  Order,
  OrderLineItem,
  RestaurantOrg,
  VendorRestaurantRelationship,
} from "@shared/schema";
import { formatCurrency, formatPhone } from "@shared/schema";
import { isInvoicedUnpaidOrder } from "@/lib/order-status-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  DollarSign,
  Mail,
  Phone,
  UserCircle,
  UtensilsCrossed,
} from "lucide-react";

type EnrichedLineItem = OrderLineItem & {
  productName: string;
  sku: string | null;
};

type VendorOrderEntry = {
  order: Order;
  lineItems: EnrichedLineItem[];
  restaurantName: string;
  fulfillments: LineFulfillment[];
  invoice: Invoice | null;
};

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getOrderTotal(entry: VendorOrderEntry): number {
  if (entry.invoice?.approvedTotal) {
    return parseFloat(entry.invoice.approvedTotal);
  }

  return entry.lineItems.reduce(
    (sum, item) =>
      sum + Number(item.quantity) * Number(item.unitPriceAtTimeOfOrder),
    0,
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function EmptyPanel({
  icon: Icon,
  message,
}: {
  icon: ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function OrderPanel({
  title,
  count,
  subtitle,
  accent,
  children,
}: {
  title: string;
  count: number;
  subtitle?: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card ${
        accent ? "border-emerald-200" : "border-border"
      }`}
    >
      <div
        className={`flex items-center gap-3 border-b px-6 py-4 ${
          accent
            ? "border-emerald-200 bg-emerald-50/30 text-emerald-700"
            : "border-border text-foreground"
        }`}
      >
        <CreditCard className="h-4 w-4" />
        <h2 className="font-semibold">{title}</h2>
        <Badge variant="secondary" className="h-7 px-3 text-sm">
          {count}
        </Badge>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

export default function VendorRelationshipDetail() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();
  const portalNav = useVendorPortalNav();

  useEffect(() => {
    if (!vendorId) navigate("/vendor/login");
  }, [vendorId, navigate]);

  useEffect(() => {
    portalNav?.setActiveSection(VENDOR_SECTION_IDS.restaurants);
  }, [portalNav]);

  const {
    data: relationship,
    isLoading: relationshipLoading,
  } = useQuery<VendorRestaurantRelationship>({
    queryKey: ["/api/relationships", relationshipId],
    enabled: !!relationshipId,
  });

  const canLoadRelationshipData =
    !!vendorId && !!relationship && relationship.vendorId === vendorId;

  const {
    data: restaurant,
    isLoading: restaurantLoading,
  } = useQuery<RestaurantOrg>({
    queryKey: ["/api/restaurant-orgs", relationship?.restaurantOrgId],
    enabled: canLoadRelationshipData,
  });

  const { data: vendorOrders = [], isLoading: ordersLoading } = useQuery<
    VendorOrderEntry[]
  >({
    queryKey: ["/api/vendors", vendorId!, "orders"],
    enabled: canLoadRelationshipData,
  });

  if (!vendorId) return null;

  const isLoading = relationshipLoading || restaurantLoading || ordersLoading;
  const relationshipOrders = relationship
    ? vendorOrders.filter(
        (entry) => entry.order.restaurantOrgId === relationship.restaurantOrgId,
      )
    : [];
  const invoicedOrders = relationshipOrders.filter((entry) =>
    isInvoicedUnpaidOrder(entry.order),
  );
  const paidOrders = relationshipOrders.filter((entry) => !!entry.order.paidAt);
  const paidRevenue = paidOrders.reduce(
    (sum, entry) => sum + getOrderTotal(entry),
    0,
  );

  if (!relationshipLoading && relationship && relationship.vendorId !== vendorId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Relationship not found.
      </div>
    );
  }

  return (
    <div className="px-7 py-7">
      <div className="mb-7 flex items-center gap-4 text-sm">
        <Link href="/vendor/relationships">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Relationships
          </button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-foreground">
          {restaurant?.name ?? "Restaurant"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-40 rounded-lg" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
          <Skeleton className="h-52 rounded-lg" />
        </div>
      ) : !relationship || !restaurant ? (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Relationship not found.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-4 px-6 py-5">
              <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {restaurant.name}
                </h1>
                <div className="mt-2 flex items-center gap-3">
                  <StatusBadge status={relationship.status} />
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    Linked {formatDate(relationship.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-border px-6 py-4 md:grid-cols-3">
              <div className="flex items-center gap-2 text-sm">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Contact:</span>
                <span className="font-medium text-foreground">
                  {restaurant.contactName}
                </span>
              </div>
              <a
                href={`mailto:${restaurant.email}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                {restaurant.email}
              </a>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {formatPhone(restaurant.phone)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="flex items-start gap-4 p-6">
                <div className="rounded-md bg-muted p-2">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Paid Orders
                  </p>
                  <p className="mt-1 text-3xl font-bold">{paidOrders.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start gap-4 p-6">
                <div className="rounded-md bg-muted p-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Paid Revenue
                  </p>
                  <p className="mt-1 text-3xl font-bold">
                    {formatCurrency(String(paidRevenue.toFixed(2)))}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <OrderPanel
            title="Invoiced Orders"
            count={invoicedOrders.length}
            subtitle="Awaiting payment"
            accent
          >
            {invoicedOrders.length === 0 ? (
              <EmptyPanel icon={CreditCard} message="No invoiced orders" />
            ) : (
              <div className="divide-y">
                {invoicedOrders.map((entry) => (
                  <div
                    key={entry.order.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <p className="font-medium">
                        Order #{entry.order.displayId ?? entry.order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Approved {formatDate(entry.order.vendorApprovedAt!)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatCurrency(String(getOrderTotal(entry).toFixed(2)))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </OrderPanel>

          <OrderPanel title="Paid Orders" count={paidOrders.length}>
            {paidOrders.length === 0 ? (
              <EmptyPanel icon={CheckCircle2} message="No paid orders yet" />
            ) : (
              <div className="divide-y">
                {paidOrders.map((entry) => (
                  <div
                    key={entry.order.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <p className="font-medium">
                        Order #{entry.order.displayId ?? entry.order.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Paid {formatDate(entry.order.paidAt!)}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatCurrency(String(getOrderTotal(entry).toFixed(2)))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </OrderPanel>
        </div>
      )}
    </div>
  );
}
