"use client";

import VendorDetail from "@/views/admin/vendor-detail";
import AdminAuthGuard from "@/components/admin/auth-guard";
import AdminLayout from "@/components/admin/layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <VendorDetail />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
