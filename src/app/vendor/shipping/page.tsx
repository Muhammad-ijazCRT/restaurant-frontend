"use client";

import ShippingOrders from "@/views/shipping-orders";
import PortalAuthGuard from "@/components/portal-auth-guard";
import VendorLayout from "@/components/vendor-layout";
import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";

const ROLES = ["vendor_admin"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <VendorPortalNavProvider>
        <VendorLayout>
          <ShippingOrders />
        </VendorLayout>
      </VendorPortalNavProvider>
    </PortalAuthGuard>
  );
}
