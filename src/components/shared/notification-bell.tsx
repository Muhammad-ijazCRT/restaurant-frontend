import { useMemo } from "react";
import { profilePaths } from "@/api/shared/profile";
import { profileKeys } from "@/api/shared/profile";
import { useLocation } from "@/lib/wouter-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ActivityLog } from "@shared/schema";
import { getUserRole } from "@/lib/portal-auth";
import { formatRelativeTime, parsePortalDate } from "@/lib/format-relative-time";
import { apiRequest } from "@/lib/queryClient";
import { resolveNotificationHref } from "@/lib/notification-routes";

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Created record",
  UPDATE: "Updated record",
  DELETE: "Deleted record",
  vendor_created: "Vendor created",
  vendor_updated: "Vendor updated",
  vendor_archived: "Vendor archived",
  vendor_restored: "Vendor restored",
  vendor_deleted: "Vendor deleted",
  restaurant_created: "Restaurant created",
  restaurant_updated: "Restaurant updated",
  restaurant_archived: "Restaurant archived",
  restaurant_restored: "Restaurant restored",
  restaurant_deleted: "Restaurant deleted",
  relationship_created: "Relationship created",
  relationship_deactivated: "Relationship deactivated",
  relationship_reactivated: "Relationship reactivated",
  relationship_deleted: "Relationship deleted",
  order_created: "Order created",
  order_submitted: "Order placed",
  order_assigned: "Order assigned",
  order_assigned_worker: "Order assigned to you",
  order_assigned_driver: "Order assigned to you",
  order_unassigned_worker: "Order unassigned from you",
  order_unassigned_driver: "Order unassigned from you",
  order_picking_submitted_worker: "Picking submitted",
  order_issue_pending_driver: "Issue needs your review",
  order_issue_pending_vendor: "Restaurant review needs approval",
  order_review_forwarded_to_driver: "Review forwarded to driver",
  order_delivered_driver: "Order delivered",
  order_issue_resolved_driver: "Issue resolved",
  order_delivered: "Order delivered",
  super_admin_logged_in: "Admin signed in",
  restaurant_logged_in: "Restaurant signed in",
  vendor_logged_in: "Vendor signed in",
  employee_logged_in: "Employee signed in",
  super_admin_profile_updated: "Admin profile updated",
  restaurant_profile_updated: "Restaurant profile updated",
  vendor_profile_updated: "Vendor profile updated",
  employee_profile_updated: "Employee profile updated",
  profile_updated: "Profile updated",
  csv_import_completed: "CSV import completed",
  order_paid: "Order payment recorded",
  order_review_rejected: "Order review rejected",
  order_picking_saved: "Picking saved",
  order_picking_submitted: "Picking submitted",
  order_picking_approved: "Ready for delivery",
  order_substitution_proposed: "Substitution proposed",
  order_invoiced: "Order invoiced",
  order_issue_resolved: "Issue resolved",
  order_review_submitted: "Review submitted",
  order_review_resubmitted: "Review resubmitted",
  order_issue_reported: "Issue reported",
  order_draft_cleared: "Draft order cleared",
  order_draft_updated: "Draft order updated",
  order_substitution_status_updated: "Substitution status updated",
  order_deleted: "Order deleted",
  note_created: "Note added",
  note_deleted: "Note removed",
  attachment_created: "Attachment added",
  attachment_deleted: "Attachment removed",
  product_reordered: "Product order updated",
};

function notificationSubtitle(log: ActivityLog & { displayMessage?: string }): string {
  if (log.displayMessage) {
    return log.displayMessage;
  }

  const rawMeta = (log as { metadata?: string | null }).metadata;
  const role = getUserRole();

  if (rawMeta) {
    try {
      const meta = JSON.parse(rawMeta) as {
        restaurantName?: string;
        vendorName?: string;
        vendorSelfMessage?: string;
        selfMessage?: string;
        othersMessage?: string;
      };

      if (role === "vendor_admin" && meta.vendorSelfMessage) {
        return meta.vendorSelfMessage;
      }

      if (meta.othersMessage) {
        return meta.othersMessage;
      }

      const base = log.entityName ?? "Activity";
      const baseLower = base.toLowerCase();
      const vendorLower = meta.vendorName?.toLowerCase() ?? "";

      if (meta.restaurantName && meta.vendorName && !baseLower.startsWith(vendorLower)) {
        return `${meta.vendorName} · ${meta.restaurantName} — ${base}`;
      }
      if (meta.vendorName && !baseLower.startsWith(vendorLower)) {
        return `${meta.vendorName} — ${base}`;
      }
      if (meta.restaurantName) {
        return `${meta.restaurantName} — ${base}`;
      }
    } catch {
      // ignore invalid metadata
    }
  }

  return log.entityName ?? "Activity";
}

export function NotificationBell() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const role = getUserRole();
  const { data, isLoading } = useQuery<{
    notifications: (ActivityLog & { displayMessage?: string; displayTitle?: string })[];
    total: number;
    unreadCount?: number;
    clearedAt?: string | null;
  }>({
    queryKey: profileKeys.notifications(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnMount: "always",
    retry: false,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", profilePaths.notificationClear);
      return res.json() as Promise<{ clearedAt: string; unreadCount: number }>;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(profileKeys.notifications(), (prev: typeof data) => {
        if (!prev) return prev;
        return {
          ...prev,
          unreadCount: result.unreadCount ?? 0,
          clearedAt: result.clearedAt ?? new Date().toISOString(),
        };
      });
    },
  });

  const notifications = data?.notifications ?? [];
  const total = data?.total ?? 0;
  const unreadCount = data?.unreadCount ?? total;
  const displayCount = unreadCount > 999 ? "999+" : String(unreadCount);
  const items = useMemo(() => {
    return notifications
      .map((log) => {
        const rawDate = (log as any).createdAt ?? (log as any).created_at;
        const parsed = parsePortalDate(rawDate);

        return {
          id: log.id,
          title: log.displayTitle ?? ACTION_LABELS[log.action] ?? log.action ?? "Notification",
          subtitle: notificationSubtitle(log),
          relativeTime: formatRelativeTime(rawDate),
          timestamp: parsed?.getTime() ?? 0,
          href: resolveNotificationHref(log, role),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [notifications, role]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-11 w-11 overflow-visible rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <Badge
              className="pointer-events-none absolute right-0 top-0 z-10 min-h-5 min-w-5 shrink-0 rounded-full border-2 border-background px-1.5 py-0 text-[10px] font-semibold leading-none tabular-nums"
              variant="destructive"
            >
              {displayCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] overflow-hidden rounded-2xl border border-border bg-popover p-0 shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-muted/30 p-4">
          <div>
            <DropdownMenuLabel className="text-sm font-semibold">Notifications</DropdownMenuLabel>
            <p className="text-xs text-muted-foreground">Recent portal activity and counts.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 ? (
              <Badge variant="secondary" className="rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums">
                {displayCount}
              </Badge>
            ) : null}
            {total > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={clearMutation.isPending || unreadCount === 0}
                onClick={() => clearMutation.mutate()}
              >
                {clearMutation.isPending ? "Clearing..." : "Clear"}
              </Button>
            ) : null}
          </div>
        </div>
        <ScrollArea className="h-[420px] p-2">
          {isLoading ? (
            <div className="space-y-2 px-2 pb-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl bg-muted/50 p-4" />
              ))}
            </div>
          ) : !items.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <ClipboardList className="h-6 w-6" />
              <span>No recent notifications</span>
            </div>
          ) : (
            <div className="space-y-2 px-1 pb-2">
              {items.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className="cursor-pointer rounded-2xl border border-muted/20 bg-background px-4 py-3 shadow-sm transition hover:border-primary/30 hover:bg-muted/10 focus:bg-muted/10"
                  onSelect={() => navigate(item.href)}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.subtitle}</p>
                    </div>
                    {item.relativeTime ? (
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {item.relativeTime}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-muted/20 px-4 py-3 text-xs text-muted-foreground">
          {total === 0
            ? "No notifications available"
            : unreadCount > 0
              ? `Showing ${notifications.length} notification${notifications.length === 1 ? "" : "s"} · ${unreadCount} unread`
              : `Showing ${notifications.length} notification${notifications.length === 1 ? "" : "s"} · all read`}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
