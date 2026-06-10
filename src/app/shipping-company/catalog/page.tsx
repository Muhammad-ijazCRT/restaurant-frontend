"use client";

import VendorProductCatalog from "@/views/vendor/product-catalog";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import ShippingLayout from "@/components/shipping/layout";

const ROLES = ["vendor_admin", "manager"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <ShippingLayout>
        <VendorProductCatalog />
      </ShippingLayout>
    </PortalAuthGuard>
  );
}
