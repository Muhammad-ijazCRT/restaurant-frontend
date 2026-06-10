import { useLocation } from "@/lib/wouter-compat";
import { relationshipKeys } from "@/api/shared/relationships";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { useQuery } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import type { VendorRestaurantRelationship } from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { RestaurantDashboardMetricCard } from "@/components/restaurant/dashboard-metric-card";
import {
  buildRestaurantDashboardStats,
  normalizeOrderEntries,
  type RestaurantDashboardStats,
} from "@/lib/restaurant-orders";
import {
  CircleCheck,
  ClipboardList,
  CreditCard,
  DollarSign,
  Inbox,
  Package,
  UtensilsCrossed,
} from "lucide-react";

function RestaurantOverviewDashboard({
  activeVendorCount,
  stats,
  onVendorsClick,
  onOrdersClick,
}: {
  activeVendorCount: number;
  stats: RestaurantDashboardStats;
  onVendorsClick: () => void;
  onOrdersClick: () => void;
}) {
  return (
    <div data-testid="restaurant-employee-dashboard">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A snapshot of your current order activity and payables.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Order Activity
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <RestaurantDashboardMetricCard
            title="Active Vendors"
            value={activeVendorCount}
            description="Linked vendors"
            icon={UtensilsCrossed}
            iconClassName="bg-orange-100 text-orange-500"
            onClick={onVendorsClick}
          />
          <RestaurantDashboardMetricCard
            title="Submitted Orders"
            value={stats.submittedOrderCount}
            description="Awaiting delivery"
            icon={Inbox}
            iconClassName="bg-blue-100 text-blue-500"
            onClick={onOrdersClick}
          />
          <RestaurantDashboardMetricCard
            title="Needs Review"
            value={stats.needsReviewCount}
            description="Delivered, awaiting review"
            icon={Package}
            iconClassName="bg-orange-100 text-orange-500"
            onClick={onOrdersClick}
          />
          <RestaurantDashboardMetricCard
            title="Waiting for Approval"
            value={stats.waitingForApprovalCount}
            description="Review submitted"
            icon={ClipboardList}
            iconClassName="bg-violet-100 text-violet-500"
            onClick={onOrdersClick}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Payables
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <RestaurantDashboardMetricCard
            title="Open Invoices"
            value={stats.openInvoiceCount}
            description="Approved, awaiting payment"
            icon={CreditCard}
            iconClassName="bg-teal-100 text-teal-500"
            onClick={onOrdersClick}
          />
          <RestaurantDashboardMetricCard
            title="Unpaid Total"
            value={formatCurrency(String(stats.unpaidTotal.toFixed(2)))}
            description="Outstanding balance"
            icon={DollarSign}
            iconClassName="bg-rose-100 text-rose-500"
            onClick={onOrdersClick}
          />
          <RestaurantDashboardMetricCard
            title="Finalized Invoice Spend"
            value={formatCurrency(String(stats.finalizedInvoiceSpend.toFixed(2)))}
            description="Total paid"
            icon={CircleCheck}
            iconClassName="bg-blue-100 text-blue-500"
            onClick={onOrdersClick}
          />
        </div>
      </section>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-28" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-20" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RestaurantPortal() {
  const { restaurantId } = useRestaurantAuth();
  const [, navigate] = useLocation();

  const { isLoading: relationshipsLoading, data: allRelationships = [] } = useQuery<
    VendorRestaurantRelationship[]
  >({
    queryKey: relationshipKeys.all(),
    enabled: !!restaurantId,
  });

  const { data: dashboardStats, isLoading: ordersLoading } = useQuery({
    queryKey: restaurantOrderKeys.list(restaurantId),
    enabled: !!restaurantId,
    select: (data) => buildRestaurantDashboardStats(normalizeOrderEntries(data)),
  });

  const linkedRelationships = allRelationships.filter(
    (relationship) =>
      relationship.restaurantOrgId === restaurantId && relationship.status !== "archived",
  );
  const activeVendorCount = linkedRelationships.filter(
    (relationship) => relationship.status === "active",
  ).length;

  if (!restaurantId) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Restaurant context unavailable. Try logging in again.
      </div>
    );
  }

  if (relationshipsLoading || ordersLoading || !dashboardStats) {
    return <OverviewSkeleton />;
  }

  return (
    <RestaurantOverviewDashboard
      activeVendorCount={activeVendorCount}
      stats={dashboardStats}
      onVendorsClick={() => navigate("/restaurant/relationships")}
      onOrdersClick={() => navigate("/restaurant/orders")}
    />
  );
}
