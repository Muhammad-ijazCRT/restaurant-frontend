import { useMemo, useState } from "react";
import { vendorKeys, vendorPaths } from "@/api/vendor/vendors";
import { Link, useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Package,
  Truck,
  UserCheck,
  Warehouse,
  ArrowRight,
  Clock3,
  PackageCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { apiRequest } from "@/lib/queryClient";
import { formatRelativeTime } from "@/lib/format-relative-time";

type DashboardPeriod = "today" | "week" | "month";

type DashboardResponse = {
  period: DashboardPeriod;
  role: string;
  employee: { id: string; name: string; email: string };
  vendor: { id: string; name: string };
  stats: Record<string, number | Array<{ name: string; count: number }>>;
  recentAssignments?: Array<{
    orderId: string;
    displayId: string | number;
    assignerName: string;
    at: string;
    status?: string;
  }>;
  completedAssignments?: Array<{
    orderId: string;
    displayId: string | number;
    assignerName: string;
    at: string;
    status?: string;
  }>;
  recentOrders?: Array<{
    id: string;
    displayId: string | number;
    restaurantName: string;
    status: string;
    label: string;
    updatedAt: string;
  }>;
  details?: Record<
    string,
    Array<{
      id: string;
      displayId: string | number;
      restaurantName: string;
      status: string;
      label: string;
      updatedAt: string;
      assignerName?: string;
    }>
  >;
};

type StatCardConfig = {
  bucketId: string;
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Truck;
  tone?: "default" | "success" | "warning" | "info";
};

function isActiveAssignmentStatus(status: string): boolean {
  return !["invoiced", "delivered"].includes(status);
}

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Previous Week" },
  { id: "month", label: "This Month" },
];

const ROLE_COPY: Record<string, { title: string; body: string }> = {
  vendor_admin: {
    title: "Vendor Operations Dashboard",
    body: "Track assignments, deliveries, and team performance in real time.",
  },
  manager: {
    title: "Manager Dashboard",
    body: "Monitor shipping flow, assignments, and open issues for your vendor.",
  },
  warehouse_worker: {
    title: "Warehouse Dashboard",
    body: "See your assignments, picking progress, and fulfillment workload.",
  },
  driver: {
    title: "Driver Dashboard",
    body: "Track deliveries, issues, and completed routes for your assigned orders.",
  },
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
}: StatCardConfig & { onClick?: () => void }) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 bg-emerald-500/10"
      : tone === "warning"
        ? "text-amber-600 bg-amber-500/10"
        : tone === "info"
          ? "text-blue-600 bg-blue-500/10"
          : "text-primary bg-primary/10";

  return (
    <Card
      className={cn(
        "rounded-xl border-border/70 shadow-sm transition-colors",
        onClick && "cursor-pointer hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
            {onClick ? <p className="mt-2 text-[11px] font-medium text-primary/80">Click to view details</p> : null}
          </div>
          <div className={`rounded-xl p-2.5 ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BucketDetailDialog({
  open,
  onOpenChange,
  title,
  items,
  onOrderClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: NonNullable<DashboardResponse["details"]>[string];
  onOrderClick: (orderId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-hidden sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {items.length === 0
              ? "No orders in this category for the selected period."
              : `${items.length} order${items.length === 1 ? "" : "s"} in this view`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing to show yet. Try another time period or check Open Orders.
            </p>
          ) : (
            items.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onOrderClick(order.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`dashboard-order-link-${order.id}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Order #{order.displayId}
                    <span className="ml-2 font-normal text-muted-foreground">· {order.restaurantName}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground capitalize">{order.label}</p>
                  {order.assignerName ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">Assigned by {order.assignerName}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] font-medium text-primary/80">Open in orders</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className="capitalize">
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(order.updatedAt)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end border-t border-border/60 pt-4">
          <Link href="/shipping-company/orders">
            <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
              Open Orders
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentPanel({
  assignedBy,
  recentAssignments,
  emptyMessage = "No assignments in this period yet.",
  showStatus = false,
}: {
  assignedBy: Array<{ name: string; count: number }>;
  recentAssignments?: Array<{
    orderId: string;
    displayId: string | number;
    assignerName: string;
    at: string;
    status?: string;
  }>;
  emptyMessage?: string;
  showStatus?: boolean;
}) {
  const hasAssigners = assignedBy.length > 0;
  const hasRecent = (recentAssignments?.length ?? 0) > 0;

  if (!hasAssigners && !hasRecent) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {hasAssigners ? (
        <div className="space-y-2">
          {assignedBy.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{item.name}</span>
              </div>
              <Badge variant="secondary" className="tabular-nums">{item.count}</Badge>
            </div>
          ))}
        </div>
      ) : null}

      {hasRecent ? (
        <div className={hasAssigners ? "space-y-2 border-t border-border/60 pt-3" : "space-y-2"}>
          {recentAssignments!.map((item, index) => (
            <div key={`${item.orderId}-${index}`} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Order #{item.displayId}</p>
                {showStatus && item.status ? (
                  <Badge variant="outline" className="shrink-0 capitalize text-[10px]">
                    {item.status.replace(/_/g, " ")}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Assigned by {item.assignerName} · {formatRelativeTime(item.at)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ShippingDashboard() {
  const [, navigate] = useLocation();
  const role = getUserRole() ?? "driver";
  const user = getUserData();
  const { vendorId } = useVendorAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const [detailBucket, setDetailBucket] = useState<{ id: string; label: string } | null>(null);
  const copy = ROLE_COPY[role] ?? ROLE_COPY.driver;
  const canSeeCatalog = role === "vendor_admin" || role === "manager";

  const { data, isLoading, isError } = useQuery<DashboardResponse>({
    queryKey: vendorKeys.employeeDashboard(vendorId, period),
    enabled: !!vendorId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        vendorPaths.employeeDashboardWithPeriod(vendorId, period),
      );
      return res.json();
    },
  });

  const stats = data?.stats ?? {};
  const isEmployeeRole = role === "warehouse_worker" || role === "driver";
  const assignedBy = Array.isArray(stats.assignedBy) ? stats.assignedBy : [];
  const completedAssignedBy = Array.isArray(stats.assignedCompletedBy) ? stats.assignedCompletedBy : [];
  const recentAssignments = data?.recentAssignments ?? [];
  const completedAssignments = data?.completedAssignments ?? [];
  const assignerByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of recentAssignments) {
      map.set(item.orderId, item.assignerName);
    }
    for (const item of data?.details?.assigned ?? []) {
      if (item.assignerName) map.set(item.id, item.assignerName);
    }
    return map;
  }, [recentAssignments, data?.details?.assigned]);
  const completedAssignerByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of completedAssignments) {
      map.set(item.orderId, item.assignerName);
    }
    for (const item of data?.details?.assignedCompleted ?? []) {
      if (item.assignerName) map.set(item.id, item.assignerName);
    }
    return map;
  }, [completedAssignments, data?.details?.assignedCompleted]);

  const workerCards = useMemo((): StatCardConfig[] => {
    if (role !== "warehouse_worker") return [];
    return [
      { bucketId: "assigned", label: "Assigned", value: Number(stats.assigned ?? 0), hint: "In selected period", icon: ClipboardList, tone: "info" },
      { bucketId: "newTasks", label: "New", value: Number(stats.newTasks ?? 0), hint: "Not started yet", icon: Package, tone: "warning" },
      { bucketId: "inProgress", label: "In Progress", value: Number(stats.inProgress ?? 0), hint: "Picking underway", icon: Warehouse, tone: "default" },
      { bucketId: "submittedForReview", label: "Submitted", value: Number(stats.submittedForReview ?? 0), hint: "Waiting approval", icon: Clock3, tone: "info" },
      { bucketId: "readyForDelivery", label: "Ready", value: Number(stats.readyForDelivery ?? 0), hint: "Approved for driver", icon: Truck, tone: "success" },
      { bucketId: "completed", label: "Completed", value: Number(stats.completed ?? 0), hint: "Picking finished", icon: CheckCircle2, tone: "success" },
    ];
  }, [role, stats]);

  const driverCards = useMemo((): StatCardConfig[] => {
    if (role !== "driver") return [];
    return [
      {
        bucketId: "activeAssignments",
        label: "Delivery Queue",
        value: Number(stats.activeAssignments ?? stats.assigned ?? 0),
        hint: "orders assigned to you",
        icon: Truck,
        tone: "warning",
      },
      {
        bucketId: "delivered",
        label: "Completed Deliveries",
        value: Number(stats.delivered ?? 0),
        hint: "delivered orders",
        icon: CheckCircle2,
        tone: "success",
      },
    ];
  }, [role, stats]);

  const teamCards = useMemo((): StatCardConfig[] => {
    if (role !== "manager" && role !== "vendor_admin") return [];
    return [
      { bucketId: "ordersInPeriod", label: "Orders", value: Number(stats.ordersInPeriod ?? 0), hint: "In selected period", icon: ClipboardList, tone: "info" },
      { bucketId: "submitted", label: "Submitted", value: Number(stats.submitted ?? 0), hint: "Awaiting assign", icon: Package, tone: "warning" },
      { bucketId: "assignmentsInPeriod", label: "Assignments", value: Number(stats.assignmentsInPeriod ?? 0), hint: "Team assignments", icon: UserCheck, tone: "default" },
      { bucketId: "readyForDelivery", label: "Ready", value: Number(stats.readyForDelivery ?? 0), hint: "Ready for driver", icon: Truck, tone: "info" },
      { bucketId: "delivered", label: "Delivered", value: Number(stats.delivered ?? 0), hint: "Completed deliveries", icon: CheckCircle2, tone: "success" },
      { bucketId: "issuePending", label: "Issues", value: Number(stats.issuePending ?? 0), hint: `${Number(stats.issueResolved ?? 0)} resolved`, icon: AlertTriangle, tone: "warning" },
    ];
  }, [role, stats]);

  const statCards = role === "warehouse_worker" ? workerCards : role === "driver" ? driverCards : teamCards;
  const isDriver = role === "driver";
  const detailItems = detailBucket ? (data?.details?.[detailBucket.id] ?? []) : [];

  function openOrderFromDashboard(orderId: string) {
    setDetailBucket(null);
    navigate(`/shipping-company/orders?orderId=${encodeURIComponent(orderId)}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8" data-testid="page-shipping-dashboard">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {!isDriver ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
              {data?.vendor?.name ?? user?.vendor_name ?? "Shipping Console"}
            </p>
          ) : null}
          <h1 className={`${isDriver ? "" : "mt-1 "}text-3xl font-bold tracking-tight text-foreground`}>
            {isDriver ? "Dashboard" : copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isDriver ? "Delivery overview for today" : copy.body}
          </p>
        </div>

        {!isDriver ? (
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={period === option.id ? "default" : "outline"}
                onClick={() => setPeriod(option.id)}
                data-testid={`button-period-${option.id}`}
              >
                {option.label}
              </Button>
            ))}
            <Link href="/shipping-company/orders">
              <Button size="sm" variant="secondary">
                Open Orders
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="rounded-xl border-destructive/30">
          <CardContent className="p-6 text-sm text-destructive">
            Could not load dashboard stats. Please refresh or sign in again.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={`grid gap-4 ${isDriver ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
            {statCards.map((card) => (
              <StatCard
                key={card.bucketId}
                {...card}
                onClick={
                  isDriver
                    ? () =>
                        navigate(
                          card.bucketId === "delivered"
                            ? "/shipping-company/orders?view=completed"
                            : "/shipping-company/orders?view=queue",
                        )
                    : () => setDetailBucket({ id: card.bucketId, label: card.label })
                }
              />
            ))}
          </div>

          {!isDriver ? (
          <BucketDetailDialog
            open={!!detailBucket}
            onOpenChange={(open) => {
              if (!open) setDetailBucket(null);
            }}
            title={detailBucket?.label ?? "Details"}
            items={detailItems}
            onOrderClick={openOrderFromDashboard}
          />
          ) : null}

          {!isDriver ? (
          <div className={cn("mt-6 grid gap-4", isEmployeeRole ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {isEmployeeRole ? "Who Assigned You" : "Who Assigned Orders"}
                </CardTitle>
                {isEmployeeRole ? (
                  <p className="text-xs text-muted-foreground">Active orders still in progress</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <AssignmentPanel
                  assignedBy={assignedBy}
                  recentAssignments={recentAssignments}
                  emptyMessage={
                    isEmployeeRole
                      ? "No active assignments in this period."
                      : "No assignments in this period yet."
                  }
                />
              </CardContent>
            </Card>

            {isEmployeeRole ? (
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Assignment History</CardTitle>
                  <p className="text-xs text-muted-foreground">Completed orders assigned in this period</p>
                </CardHeader>
                <CardContent>
                  <AssignmentPanel
                    assignedBy={completedAssignedBy}
                    recentAssignments={completedAssignments}
                    emptyMessage="No completed assignments in this period."
                    showStatus
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card className={cn("rounded-xl", isEmployeeRole ? "lg:col-span-2" : "lg:col-span-2")}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.recentOrders ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent orders for this view.</p>
                ) : (
                  (data?.recentOrders ?? []).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Order #{order.displayId}
                          <span className="ml-2 font-normal text-muted-foreground">· {order.restaurantName}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground capitalize">{order.label}</p>
                        {isActiveAssignmentStatus(order.status) && assignerByOrderId.get(order.id) ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Assigned by {assignerByOrderId.get(order.id)}
                          </p>
                        ) : null}
                        {!isActiveAssignmentStatus(order.status) && completedAssignerByOrderId.get(order.id) ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Was assigned by {completedAssignerByOrderId.get(order.id)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className="capitalize">{order.status.replace(/_/g, " ")}</Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(order.updatedAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
          ) : null}
        </>
      )}

      {canSeeCatalog ? (
        <div className="mt-6">
          <Link href="/shipping-company/catalog">
            <Button variant="outline" size="sm">
              <Package className="mr-2 h-4 w-4" />
              View Product Catalog
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
