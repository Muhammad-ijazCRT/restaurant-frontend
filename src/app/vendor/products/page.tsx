"use client";

import VendorProductCatalog from "@/views/vendor-product-catalog";
import PortalAuthGuard from "@/components/portal-auth-guard";
import VendorLayout from "@/components/vendor-layout";
import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";

const ROLES = ["vendor_admin", "manager", "sales_representative", "warehouse_worker"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <VendorPortalNavProvider>
        <VendorLayout>
          <VendorProductCatalog />
        </VendorLayout>
      </VendorPortalNavProvider>
    </PortalAuthGuard>
  );
}
