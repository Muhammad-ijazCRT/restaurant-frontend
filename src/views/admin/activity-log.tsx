import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2,
  UtensilsCrossed,
  Link2,
  FileUp,
  PlusCircle,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  PowerOff,
  Power,
  ClipboardList,
  Search,
  X,
} from "lucide-react";
import type { ActivityLog, ActivityAction } from "@shared/schema";

type ActionMeta = {
  label: string;
  icon: typeof PlusCircle;
  color: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

const ACTION_META: Record<string, ActionMeta> = {
  INSERT:                   { label: "Record created",                  icon: PlusCircle, color: "text-emerald-600 dark:text-emerald-400",  badgeVariant: "default" },
  UPDATE:                   { label: "Record updated",                  icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  DELETE:                   { label: "Record deleted",                  icon: Trash2,     color: "text-red-600 dark:text-red-400",            badgeVariant: "destructive" },
  vendor_created:           { label: "Vendor created",                  icon: PlusCircle, color: "text-emerald-600 dark:text-emerald-400",  badgeVariant: "default" },
  vendor_updated:           { label: "Vendor updated",                  icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  vendor_archived:          { label: "Vendor archived",                 icon: Archive,    color: "text-amber-600 dark:text-amber-400",        badgeVariant: "outline" },
  vendor_restored:          { label: "Vendor restored",                 icon: RotateCcw,  color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  vendor_deleted:           { label: "Vendor deleted",                  icon: Trash2,     color: "text-red-600 dark:text-red-400",            badgeVariant: "destructive" },
  restaurant_created:       { label: "Restaurant org created",          icon: PlusCircle, color: "text-emerald-600 dark:text-emerald-400",  badgeVariant: "default" },
  restaurant_updated:       { label: "Restaurant org updated",          icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  restaurant_archived:      { label: "Restaurant org archived",         icon: Archive,    color: "text-amber-600 dark:text-amber-400",        badgeVariant: "outline" },
  restaurant_restored:      { label: "Restaurant org restored",         icon: RotateCcw,  color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  restaurant_deleted:       { label: "Restaurant org deleted",          icon: Trash2,     color: "text-red-600 dark:text-red-400",            badgeVariant: "destructive" },
  relationship_created:     { label: "Relationship created",            icon: PlusCircle, color: "text-emerald-600 dark:text-emerald-400",  badgeVariant: "default" },
  relationship_deactivated: { label: "Relationship deactivated",        icon: PowerOff,   color: "text-amber-600 dark:text-amber-400",        badgeVariant: "outline" },
  relationship_reactivated: { label: "Relationship reactivated",        icon: Power,      color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  relationship_deleted:     { label: "Relationship deleted",            icon: Trash2,     color: "text-red-600 dark:text-red-400",            badgeVariant: "destructive" },
  csv_import_completed:     { label: "CSV import completed",            icon: FileUp,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  super_admin_logged_in:    { label: "Super Admin signed in",           icon: Power,      color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  restaurant_logged_in:     { label: "Restaurant signed in",            icon: Power,      color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  vendor_logged_in:         { label: "Vendor signed in",                icon: Power,      color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  employee_logged_in:       { label: "Employee signed in",            icon: Power,      color: "text-violet-600 dark:text-violet-400",      badgeVariant: "secondary" },
  super_admin_profile_updated: { label: "Super Admin profile updated", icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  restaurant_profile_updated:  { label: "Restaurant profile updated",  icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  vendor_profile_updated:      { label: "Vendor profile updated",      icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
  employee_profile_updated:    { label: "Employee profile updated",      icon: Pencil,     color: "text-blue-600 dark:text-blue-400",         badgeVariant: "secondary" },
};

const SEARCH_ALIASES: Record<string, string[]> = {
  restaurant: ["restaurant", "restaurant org", "restaurant_org"],
  vendor: ["vendor"],
  employee: ["employee", "vendor employee", "vendor_employee", "warehouse", "warehouse_worker", "worker"],
  manager: ["manager"],
  driver: ["driver"],
  admin: ["admin", "super admin", "super_admin"],
  relationship: ["relationship", "partnership", "link"],
  order: ["order"],
  login: ["logged in", "signed in", "login"],
};

const ENTITY_ICON: Record<string, typeof Building2> = {
  vendor:         Building2,
  restaurant_org: UtensilsCrossed,
  relationship:   Link2,
  vendor_employee: Building2,
  user:           ClipboardList,
};

function buildActivitySearchText(log: ActivityLog): string {
  const meta = ACTION_META[log.action];
  const parts = [
    log.action,
    log.entityType,
    log.entityName,
    meta?.label ?? "",
    log.metadata ?? "",
  ];

  if (log.metadata) {
    try {
      const parsed = JSON.parse(log.metadata) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" || typeof value === "number") {
          parts.push(String(value));
        }
      }
    } catch {
      // ignore invalid metadata JSON
    }
  }

  return parts.join(" ").toLowerCase().replace(/_/g, " ");
}

function wordMatchesHaystack(word: string, haystack: string): boolean {
  const normalizedWord = word.toLowerCase().replace(/_/g, " ");
  const aliases = SEARCH_ALIASES[normalizedWord];
  if (aliases) {
    return (
      haystack.includes(normalizedWord) ||
      aliases.some((alias) => haystack.includes(alias.toLowerCase().replace(/_/g, " ")))
    );
  }
  return haystack.includes(normalizedWord);
}

function matchesActivitySearch(log: ActivityLog, query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/_/g, " ");
  if (!normalized) return true;

  const haystack = buildActivitySearchText(log);
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.every((word) => wordMatchesHaystack(word, haystack));
}

function parseDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date(0);
  if (dateStr instanceof Date) return dateStr;
  return new Date(dateStr.endsWith("Z") ? dateStr.slice(0, -1) : dateStr);
}

function formatRelativeTime(date: string | Date): string {
  const d = parseDate(date);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return "Unknown";

  const now = new Date();
  let diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) diffMs = 0;

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} sec ago`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

function formatFullTimestamp(date: string | Date): string {
  return parseDate(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function parseCsvMeta(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  try {
    const m = JSON.parse(metadata) as { imported?: number; rejected?: number; total?: number };
    if (m.imported != null) {
      return `${m.imported} imported${m.rejected ? `, ${m.rejected} rejected` : ""} of ${m.total ?? m.imported}`;
    }
  } catch {}
  return null;
}

function LogRowSkeleton() {
  return (
    <div className="flex items-start gap-4 px-6 py-4 border-b border-border last:border-0">
      <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export default function AdminActivityLog() {
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs/all"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const filteredLogs = useMemo(
    () => (logs ?? []).filter((log) => matchesActivitySearch(log, search)),
    [logs, search],
  );

  const isFiltered = search.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-8 pb-8 pt-20" data-testid="page-activity-log">
      <div className="mb-5" data-testid="section-header">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground" data-testid="text-page-title">Activity Log</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          A system-wide record of all database actions across the platform.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="activity-log-search" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Search activity
          </label>
          {!isLoading ? (
            <p className="text-xs font-medium text-foreground tabular-nums" data-testid="text-activity-search-count">
              {isFiltered ? (
                <>
                  {filteredLogs.length} {filteredLogs.length === 1 ? "result" : "results"}
                  {logs?.length ? (
                    <span className="font-normal text-muted-foreground"> of {logs.length}</span>
                  ) : null}
                </>
              ) : (
                <span className="font-normal text-muted-foreground">
                  {logs?.length ?? 0} total {(logs?.length ?? 0) === 1 ? "entry" : "entries"}
                </span>
              )}
            </p>
          ) : null}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="activity-log-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search restaurant, vendor, employee, manager, driver, admin..."
            className="h-11 pl-9 pr-9 text-sm"
            data-testid="input-activity-log-search"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              data-testid="button-clear-activity-search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="border rounded-lg bg-card" data-testid="section-log">
        {isLoading ? (
          <div data-testid="list-log-skeleton">
            {Array.from({ length: 8 }).map((_, i) => <LogRowSkeleton key={i} />)}
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state-log">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Actions taken on vendors, restaurants, and relationships will appear here.
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state-log-search">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No matching activity found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Try searching for restaurant, vendor, employee, manager, driver, admin, or relationship.
            </p>
          </div>
        ) : (
          <ul data-testid="list-activity-log">
              {filteredLogs.map((log) => {
                const action = log.action as string;
                const meta = ACTION_META[action] || { label: action, icon: ClipboardList, color: "text-muted-foreground", badgeVariant: "outline" };
                const EntityIcon = ENTITY_ICON[log.entityType] ?? ClipboardList;
                const ActionIcon = meta.icon ?? Pencil;
                const csvDetail = action === "csv_import_completed" ? parseCsvMeta(log.metadata) : null;

                return (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-start gap-x-4 gap-y-2 px-6 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors sm:flex-nowrap"
                    data-testid={`log-row-${log.id}`}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <EntityIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background flex items-center justify-center ring-1 ring-border">
                        <ActionIcon className={`h-2.5 w-2.5 ${meta?.color ?? "text-muted-foreground"}`} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug" data-testid={`log-action-${log.id}`}>
                        {meta.label ?? log.action}
                      </p>
                      <p className="text-sm text-muted-foreground truncate mt-0.5" data-testid={`log-entity-${log.id}`}>
                        {log.entityName}
                        {csvDetail && (
                          <span className="ml-2 text-xs text-muted-foreground/70">({csvDetail})</span>
                        )}
                      </p>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
                      <Badge
                        variant={meta.badgeVariant ?? "secondary"}
                        className="text-xs capitalize"
                        data-testid={`log-badge-${log.id}`}
                      >
                        {log.entityType.replace(/_/g, " ")}
                      </Badge>

                      <time
                        className="text-xs text-muted-foreground whitespace-nowrap"
                        title={formatFullTimestamp(log.createdAt)}
                        dateTime={String(log.createdAt)}
                        data-testid={`log-time-${log.id}`}
                      >
                        {formatRelativeTime(log.createdAt)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
        )}
      </div>

    </div>
  );
}
