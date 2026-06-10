"use client";

import VendorOrderDetail from "@/views/vendor/order-detail";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import VendorLayout from "@/components/vendor/layout";
import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";

const ROLES = ["vendor_admin", "manager", "sales_representative", "warehouse_worker"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <VendorPortalNavProvider>
        <VendorLayout>
          <VendorOrderDetail />
        </VendorLayout>
      </VendorPortalNavProvider>
    </PortalAuthGuard>
  );
}
