import { useQuery } from "@tanstack/react-query";
import { adminDashboardKeys } from "@/api/admin/dashboard";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { adminRestaurantKeys } from "@/api/admin/restaurants";
import { adminVendorKeys } from "@/api/admin/vendors";
import { Link } from "@/lib/wouter-compat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, UtensilsCrossed, Link2, Package,
  AlertCircle, RefreshCw, ArrowRight, Archive, ToggleLeft,
  TrendingUp, Clock, AlertTriangle, CheckCircle2, CircleDollarSign,
} from "lucide-react";
import { formatRelativeTime, parsePortalDate } from "@/lib/format-relative-time";

type DashboardStats = {
  vendors: { total: number; active: number; archived: number };
  restaurantOrgs: { total: number; active: number; archived: number };
  relationships: { total: number; active: number; inactive: number };
};

type RecentVendor = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

type RecentRestaurantOrg = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

type RecentRelationship = {
  id: string;
  vendorName: string;
  restaurantName: string;
  status: string;
  createdAt: string;
};

type RecentProduct = {
  id: string;
  name: string;
  vendorName: string;
  vendorId: string;
  status: string;
  createdAt: string;
};

type RecentPaymentLog = {
  id: string;
  action: string;
  entityId: string;
  entityName: string;
  metadata: string | null;
  createdAt: string;
};

type RecentActivity = {
  vendors: RecentVendor[];
  restaurantOrgs: RecentRestaurantOrg[];
  relationships: RecentRelationship[];
  products: RecentProduct[];
  payments: RecentPaymentLog[];
};

type ActivityItem = {
  id: string;
  type: "vendor" | "restaurant" | "relationship" | "product" | "payment";
  primary: string;
  secondary?: string;
  date: Date;
  status: string;
  href?: string;
};

type CompletenessMap = Record<string, { complete: boolean; missing: string[] }>;

type AttentionItem = {
  id: string;
  type: "vendor" | "restaurant";
  name: string;
  missing: string[];
  href: string;
  createdAt: string;
};

function MetricCard({
  icon: Icon,
  iconColor,
  label,
  count,
  countLabel,
  href,
  testId,
}: {
  icon: typeof Building2;
  iconColor: string;
  label: string;
  count: number;
  countLabel: string;
  href: string;
  testId: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 sm:p-2 ${iconColor}`}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <span className="text-xs font-semibold text-foreground sm:text-sm">{label}</span>
        </div>
        <Link href={href}>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground sm:h-7 sm:text-xs">
            Manage <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
      <div className="rounded-md bg-muted/40 p-2 sm:p-3" data-testid={testId}>
        <p className="text-xl font-semibold text-foreground sm:text-2xl">{count}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{countLabel}</p>
      </div>
    </div>
  );
}

function MetricPair({
  icon: Icon,
  iconColor,
  label,
  activeCount,
  activeLabel,
  secondCount,
  secondLabel,
  href,
}: {
  icon: typeof Building2;
  iconColor: string;
  label: string;
  activeCount: number;
  activeLabel: string;
  secondCount: number;
  secondLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 sm:p-2 ${iconColor}`}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <span className="text-xs font-semibold text-foreground sm:text-sm">{label}</span>
        </div>
        <Link href={href}>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground sm:h-7 sm:text-xs">
            Manage <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="rounded-md bg-muted/40 p-2 sm:p-3" data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}-active`}>
          <p className="text-xl font-semibold text-foreground sm:text-2xl">{activeCount}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{activeLabel}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2 sm:p-3" data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}-inactive`}>
          <p className="text-xl font-semibold text-foreground sm:text-2xl">{secondCount}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">{secondLabel}</p>
        </div>
      </div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-5">
      <div className="mb-2 flex items-center gap-2 sm:mb-4">
        <Skeleton className="h-7 w-7 rounded-md sm:h-8 sm:w-8" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <Skeleton className="h-12 rounded-md sm:h-16" />
        <Skeleton className="h-12 rounded-md sm:h-16" />
      </div>
    </div>
  );
}

const typeConfig = {
  vendor: {
    icon: Building2,
    iconClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/40",
    label: "Vendor",
    labelClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
  restaurant: {
    icon: UtensilsCrossed,
    iconClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/40",
    label: "Restaurant Org",
    labelClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
  },
  relationship: {
    icon: Link2,
    iconClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-50 dark:bg-violet-950/40",
    label: "Relationship",
    labelClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  },
  product: {
    icon: Package,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
    label: "Product",
    labelClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  },
  payment: {
    icon: CircleDollarSign,
    iconClass: "text-teal-600 dark:text-teal-400",
    bgClass: "bg-teal-50 dark:bg-teal-950/40",
    label: "Payment",
    labelClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800",
  },
};

const statusVariants: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  archived: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  paid: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800",
};

function parseDate(dateStr: string | null | undefined): Date {
  return parsePortalDate(dateStr) ?? new Date(0);
}

function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  const relative = formatRelativeTime(date);
  return relative || "Unknown";
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const cfg = typeConfig[item.type];
  const Icon = cfg.icon;
  const content = (
    <div
      className="flex items-center gap-3 py-3 px-1 hover:bg-muted/30 rounded-md transition-colors group"
      data-testid={`activity-row-${item.id}`}
    >
      <div className={`rounded-md p-1.5 shrink-0 ${cfg.bgClass}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.iconClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.primary}</p>
        {item.secondary && (
          <p className="text-xs text-muted-foreground truncate">{item.secondary}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={`text-xs font-medium capitalize hidden sm:inline-flex ${statusVariants[item.status] || statusVariants.active}`}>
          {item.status}
        </Badge>
        <Badge variant="outline" className={`text-xs font-medium hidden md:inline-flex ${cfg.labelClass}`}>
          {cfg.label}
        </Badge>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeDate(item.date)}</span>
        {item.href && (
          <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        )}
      </div>
    </div>
  );

  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

function buildActivityFeed(activity: RecentActivity): ActivityItem[] {
  const items: ActivityItem[] = [
    ...activity.vendors.map(v => ({
      id: `vendor-${v.id}`,
      type: "vendor" as const,
      primary: v.name,
      secondary: "Vendor onboarded",
      date: parseDate(v.createdAt),
      status: v.status,
      href: `/admin/vendors/${v.id}`,
    })),
    ...activity.restaurantOrgs.map(r => ({
      id: `restaurant-${r.id}`,
      type: "restaurant" as const,
      primary: r.name,
      secondary: "Restaurant organization onboarded",
      date: parseDate(r.createdAt),
      status: r.status,
      href: `/admin/restaurants/${r.id}`,
    })),
    ...activity.relationships.map(r => ({
      id: `rel-${r.id}`,
      type: "relationship" as const,
      primary: `${r.vendorName} → ${r.restaurantName}`,
      secondary: "Relationship created",
      date: parseDate(r.createdAt),
      status: r.status,
      href: `/admin/relationships/${r.id}`,
    })),
    ...activity.products.map(p => ({
      id: `product-${p.id}`,
      type: "product" as const,
      primary: p.name,
      secondary: `Added to ${p.vendorName}`,
      date: parseDate(p.createdAt),
      status: p.status,
      href: `/admin/vendors/${p.vendorId}`,
    })),
    ...(activity.payments ?? []).map(p => {
      let meta: { restaurantName?: string; vendorName?: string; amount?: string; displayOrderId?: number | string } = {};
      try { meta = p.metadata ? JSON.parse(p.metadata) : {}; } catch { /* ignore */ }
      const amount = meta.amount ? `$${Number(meta.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
      const orderRef = meta.displayOrderId ? ` for Order #${meta.displayOrderId}` : "";
      return {
        id: `payment-${p.id}`,
        type: "payment" as const,
        primary: `${meta.restaurantName ?? "Restaurant"} paid ${meta.vendorName ?? "Vendor"}${orderRef} → ${amount}`,
        date: parseDate(p.createdAt),
        status: "paid",
      };
    }),
  ];
  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 12);
}

export default function AdminDashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: adminDashboardKeys.stats(),
  });

  const {
    data: activity,
    isLoading: activityLoading,
  } = useQuery<RecentActivity>({
    queryKey: adminDashboardKeys.recentActivity(),
  });

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<RecentVendor[]>({
    queryKey: adminVendorKeys.list(false),
  });
  const { data: vendorCompleteness = {}, isLoading: vendorCompletenessLoading } = useQuery<CompletenessMap>({
    queryKey: adminVendorKeys.completeness(),
  });
  const { data: orgs = [], isLoading: orgsLoading } = useQuery<RecentRestaurantOrg[]>({
    queryKey: restaurantOrgKeys.list(),
  });
  const { data: orgCompleteness = {}, isLoading: orgCompletenessLoading } = useQuery<CompletenessMap>({
    queryKey: adminRestaurantKeys.completeness(),
  });

  const attentionLoading = vendorsLoading || vendorCompletenessLoading || orgsLoading || orgCompletenessLoading;

  const attentionItems: AttentionItem[] = [
    ...vendors
      .filter(v => v.status !== "archived" && vendorCompleteness[v.id] && !vendorCompleteness[v.id].complete)
      .map(v => ({
        id: `vendor-${v.id}`,
        type: "vendor" as const,
        name: v.name,
        missing: vendorCompleteness[v.id].missing,
        href: `/admin/vendors/${v.id}`,
        createdAt: v.createdAt,
      })),
    ...orgs
      .filter(o => o.status !== "archived" && orgCompleteness[o.id] && !orgCompleteness[o.id].complete)
      .map(o => ({
        id: `restaurant-${o.id}`,
        type: "restaurant" as const,
        name: o.name,
        missing: orgCompleteness[o.id].missing,
        href: `/admin/restaurants/${o.id}`,
        createdAt: o.createdAt,
      })),
  ].sort((a, b) => parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime());

  const feed = activity ? buildActivityFeed(activity) : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational overview of the controlled commerce ecosystem.
        </p>
      </div>

      {statsError ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-lg bg-card mb-8">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Failed to load stats</h3>
          <p className="text-sm text-muted-foreground mb-6">Something went wrong loading the dashboard.</p>
          <Button variant="outline" onClick={() => refetchStats()} data-testid="button-retry">
            <RefreshCw className="h-4 w-4 mr-2" />Retry
          </Button>
        </div>
      ) : (
        <section className="mb-8" data-testid="section-metrics">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Metrics</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {statsLoading ? (
              <>
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </>
            ) : stats ? (
              <>
                <MetricCard
                  icon={Building2}
                  iconColor="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                  label="Vendors"
                  count={stats.vendors.active}
                  countLabel="Active"
                  href="/admin/vendors"
                  testId="metric-vendors-active"
                />
                <MetricCard
                  icon={UtensilsCrossed}
                  iconColor="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
                  label="Restaurant Orgs"
                  count={stats.restaurantOrgs.active}
                  countLabel="Active"
                  href="/admin/restaurants"
                  testId="metric-restaurant-orgs-active"
                />
                <MetricPair
                  icon={Link2}
                  iconColor="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
                  label="Relationships"
                  activeCount={stats.relationships.active}
                  activeLabel="Active"
                  secondCount={stats.relationships.inactive}
                  secondLabel="Inactive"
                  href="/admin/relationships"
                />
              </>
            ) : null}
          </div>
        </section>
      )}

      <section className="mb-8" data-testid="section-attention-needed">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Attention Needed</h2>
          {!attentionLoading && attentionItems.length > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs font-semibold h-5 min-w-5 px-1.5" data-testid="count-attention-items">
              {attentionItems.length}
            </span>
          )}
        </div>
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="list-attention-items">
          {attentionLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4" data-testid="empty-state-attention">
              <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-3 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">All onboarding complete</p>
              <p className="text-xs text-muted-foreground">
                No vendors or restaurants have incomplete onboarding.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {attentionItems.map(item => {
                const isVendor = item.type === "vendor";
                const Icon = isVendor ? Building2 : UtensilsCrossed;
                const iconBg = isVendor
                  ? "bg-blue-50 dark:bg-blue-950/40"
                  : "bg-orange-50 dark:bg-orange-950/40";
                const iconColor = isVendor
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-orange-600 dark:text-orange-400";
                const labelClass = isVendor
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
                  : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800";
                return (
                  <Link key={item.id} href={item.href}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer"
                      data-testid={`attention-item-${item.id}`}
                    >
                      <div className={`rounded-md p-1.5 shrink-0 ${iconBg}`}>
                        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.missing.join(" · ")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs font-medium hidden sm:inline-flex ${labelClass}`}>
                          {isVendor ? "Vendor" : "Restaurant"}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        {!attentionLoading && attentionItems.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Showing {attentionItems.length} incomplete onboarding {attentionItems.length === 1 ? "item" : "items"}, sorted by creation date (newest first).
          </p>
        )}
      </section>

      <section data-testid="section-recent-activity">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Recent Activity</h2>
        </div>
        <div className="border rounded-lg bg-card px-4 py-2" data-testid="list-recent-activity">
          {activityLoading ? (
            <div className="space-y-1 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="empty-state-activity">
              <div className="rounded-full bg-muted/60 p-3 mb-3">
                <Clock className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No activity yet</p>
              <p className="text-xs text-muted-foreground">
                Records will appear here as vendors, restaurants, and relationships are created.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {feed.map(item => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 px-1">
          Showing up to 12 most recent records across all entity types, sorted by creation date.
        </p>
      </section>
    </div>
  );
}
