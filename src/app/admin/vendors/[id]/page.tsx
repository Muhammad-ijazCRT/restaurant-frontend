"use client";

import VendorDetail from "@/views/vendor-detail";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <VendorDetail />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
