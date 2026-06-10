"use client";

import VendorOrderApproval from "@/views/vendor/order-approval";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import VendorLayout from "@/components/vendor/layout";
import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";

const ROLES = ["vendor_admin", "manager", "sales_representative", "warehouse_worker"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <VendorPortalNavProvider>
        <VendorLayout>
          <VendorOrderApproval />
        </VendorLayout>
      </VendorPortalNavProvider>
    </PortalAuthGuard>
  );
}
