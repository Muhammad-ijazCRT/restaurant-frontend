"use client";

import AdminVendors from "@/views/admin-vendors";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminVendors />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
