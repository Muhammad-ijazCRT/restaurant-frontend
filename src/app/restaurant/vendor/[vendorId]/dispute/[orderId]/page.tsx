"use client";

import RestaurantDisputeResolution from "@/views/restaurant/dispute-resolution";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import RestaurantLayout from "@/components/restaurant/layout";
import { RestaurantPortalNavProvider } from "@/contexts/restaurant-portal-nav-context";

const ROLES = ["restaurant", "restaurant_manager", "restaurant_employee"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">
      <RestaurantPortalNavProvider>
        <RestaurantLayout>
          <RestaurantDisputeResolution />
        </RestaurantLayout>
      </RestaurantPortalNavProvider>
    </PortalAuthGuard>
  );
}
