"use client";

import RestaurantVendorDetail from "@/views/restaurant-vendor-detail";
import PortalAuthGuard from "@/components/portal-auth-guard";
import RestaurantLayout from "@/components/restaurant-layout";
import { RestaurantPortalNavProvider } from "@/contexts/restaurant-portal-nav-context";

const ROLES = ["restaurant", "restaurant_manager", "restaurant_employee"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">
      <RestaurantPortalNavProvider>
        <RestaurantLayout>
          <RestaurantVendorDetail />
        </RestaurantLayout>
      </RestaurantPortalNavProvider>
    </PortalAuthGuard>
  );
}
