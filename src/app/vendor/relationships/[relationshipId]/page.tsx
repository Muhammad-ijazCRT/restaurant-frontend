"use client";

import VendorRelationshipDetail from "@/views/vendor-relationship-detail";
import PortalAuthGuard from "@/components/portal-auth-guard";
import VendorLayout from "@/components/vendor-layout";
import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";

const ROLES = ["vendor_admin", "manager", "sales_representative", "warehouse_worker"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <VendorPortalNavProvider>
        <VendorLayout>
          <VendorRelationshipDetail />
        </VendorLayout>
      </VendorPortalNavProvider>
    </PortalAuthGuard>
  );
}
