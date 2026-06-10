"use client";

import SettingsPage from "@/views/settings-page";
import PortalAuthGuard from "@/components/portal-auth-guard";
import RestaurantLayout from "@/components/restaurant-layout";
import { RestaurantPortalNavProvider } from "@/contexts/restaurant-portal-nav-context";

const ROLES = ["restaurant", "restaurant_manager", "restaurant_employee"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">
      <RestaurantPortalNavProvider>
        <RestaurantLayout>
          <SettingsPage />
        </RestaurantLayout>
      </RestaurantPortalNavProvider>
    </PortalAuthGuard>
  );
}
