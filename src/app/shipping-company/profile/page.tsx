"use client";

import ProfilePage from "@/views/shared/profile-page";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import ShippingLayout from "@/components/shipping/layout";

const ROLES = ["vendor_admin", "manager", "driver"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <ShippingLayout>
        <ProfilePage />
      </ShippingLayout>
    </PortalAuthGuard>
  );
}
