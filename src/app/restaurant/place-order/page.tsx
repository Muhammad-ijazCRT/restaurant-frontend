"use client";

import RestaurantPlaceOrder from "@/views/restaurant/place-order";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import RestaurantLayout from "@/components/restaurant/layout";
import { RestaurantPortalNavProvider } from "@/contexts/restaurant-portal-nav-context";

const ROLES = ["restaurant", "restaurant_manager", "restaurant_employee"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">
      <RestaurantPortalNavProvider>
        <RestaurantLayout>
          <RestaurantPlaceOrder />
        </RestaurantLayout>
      </RestaurantPortalNavProvider>
    </PortalAuthGuard>
  );
}
