"use client";

import ProfilePage from "@/views/shared/profile-page";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import RestaurantLayout from "@/components/restaurant/layout";

const ROLES = ["restaurant", "restaurant_manager", "restaurant_employee"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/restaurant/login">
      <RestaurantLayout>
          <ProfilePage />
        </RestaurantLayout>
    </PortalAuthGuard>
  );
}
