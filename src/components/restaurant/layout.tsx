import { Link, useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import type { RestaurantOrg } from "@shared/schema";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ProfileMenu } from "@/components/shared/profile-menu";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import {
  canAccessRestaurantSettings,
  getRestaurantNavItems,
  getRestaurantPortalLabels,
  isRestaurantRouteAllowed,
} from "@/lib/restaurant-portal-labels";
import { countNeedsReviewOrders, normalizeOrderEntries } from "@/lib/restaurant-orders";

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { restaurantId, logout } = useRestaurantAuth();
  const user = getUserData();
  const role = getUserRole();
  const portalLabels = getRestaurantPortalLabels(role);
  const navItems = getRestaurantNavItems(role);
  const [location, navigate] = useLocation();
  const { data: restaurant } = useQuery<RestaurantOrg>({
    queryKey: restaurantOrgKeys.detail(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: ordersAttentionCount = 0 } = useQuery({
    queryKey: restaurantOrderKeys.list(restaurantId),
    enabled: !!restaurantId,
    select: (data) => countNeedsReviewOrders(normalizeOrderEntries(data)),
  });

  useEffect(() => {
    if (!role || isRestaurantRouteAllowed(role, location)) return;
    navigate("/restaurant/portal");
  }, [role, location, navigate]);

  const activeItem = navItems.find(
    (item) => location === item.href || location.startsWith(`${item.href}/`),
  ) ?? (location.startsWith("/restaurant/vendor/") ? navItems.find((item) => item.id === "place-order") : undefined);

  const pageTitle =
    location.startsWith("/restaurant/settings")
      ? "Settings"
      : location.startsWith("/restaurant/profile")
        ? "Profile"
        : activeItem?.label ?? "Dashboard";

  return (
    <div className="flex h-full overflow-hidden bg-background" data-testid="restaurant-layout">
      <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-12 items-center border-b border-sidebar-border px-6">
          <p className="text-base font-semibold text-sidebar-foreground">{portalLabels.sidebarTitle}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              location.startsWith(`${item.href}/`) ||
              (item.id === "place-order" && location.startsWith("/restaurant/vendor/"));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`mb-1 flex cursor-pointer items-center gap-3 rounded-md px-4 py-2.5 text-base transition-colors ${
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                  data-testid={`nav-restaurant-${item.id}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.id === "orders" && ordersAttentionCount > 0 ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                      {ordersAttentionCount}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-sidebar-border px-6 py-4">
          <p className="text-sm font-medium text-foreground">{restaurant?.name ?? "Loading..."}</p>
          <p className="text-xs text-muted-foreground">{portalLabels.footerRole}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-8">
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <UtensilsCrossed className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate text-muted-foreground">{restaurant?.name ?? "Restaurant"}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold text-foreground">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu
              user={user}
              roleLabel={portalLabels.roleLabel}
              onLogout={logout}
              profileHref="/restaurant/profile"
              settingsHref={
                canAccessRestaurantSettings(role) ? "/restaurant/settings" : undefined
              }
            />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-muted/40">{children}</main>
      </div>
    </div>
  );
}
