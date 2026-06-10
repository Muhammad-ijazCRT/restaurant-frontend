"use client";

import VendorSettings from "@/views/vendor/settings";
import PortalAuthGuard from "@/components/shared/portal-auth-guard";
import VendorLayout from "@/components/vendor/layout";
import { VendorPortalNavProvider } from "@/contexts/vendor-portal-nav-context";

const ROLES = ["vendor_admin", "manager"];

export default function Page() {
  return (
    <PortalAuthGuard expectedRoles={ROLES} loginPath="/vendor/login">
      <VendorPortalNavProvider>
        <VendorLayout>
          <VendorSettings />
        </VendorLayout>
      </VendorPortalNavProvider>
    </PortalAuthGuard>
  );
}
