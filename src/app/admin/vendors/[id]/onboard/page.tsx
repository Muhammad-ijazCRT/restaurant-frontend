"use client";

import VendorOnboard from "@/views/vendor-onboard";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <VendorOnboard />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
