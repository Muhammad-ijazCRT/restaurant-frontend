"use client";

import SettingsPage from "@/views/shared/settings-page";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import ShippingLayout from "@/components/shipping/layout";

const ROLES = ["vendor_admin", "manager"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <ShippingLayout>
        <SettingsPage />
      </ShippingLayout>
    </PortalAuthGuard>
  );
}
