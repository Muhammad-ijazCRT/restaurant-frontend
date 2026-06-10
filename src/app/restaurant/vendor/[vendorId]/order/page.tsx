"use client";

import RestaurantOrderComposer from "@/views/restaurant-order-composer";
import PortalAuthGuard from "@/components/portal-auth-guard";
import RestaurantLayout from "@/components/restaurant-layout";
import { RestaurantPortalNavProvider } from "@/contexts/restaurant-portal-nav-context";

const ROLES = ["restaurant", "restaurant_manager", "restaurant_employee"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">
      <RestaurantPortalNavProvider>
        <RestaurantLayout>
          <RestaurantOrderComposer />
        </RestaurantLayout>
      </RestaurantPortalNavProvider>
    </PortalAuthGuard>
  );
}
