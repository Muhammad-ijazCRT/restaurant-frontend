"use client";

import ShippingOrders from "@/views/shipping-orders";
import PortalAuthGuard from "@/components/portal-auth-guard";
import ShippingLayout from "@/components/shipping-layout";

const ROLES = ["vendor_admin", "manager", "driver"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <ShippingLayout>
        <ShippingOrders />
      </ShippingLayout>
    </PortalAuthGuard>
  );
}
