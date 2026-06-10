"use client";

import AdminOrderDetail from "@/views/admin-order-detail";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminOrderDetail />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
