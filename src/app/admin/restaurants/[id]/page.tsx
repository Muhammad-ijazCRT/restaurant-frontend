"use client";

import RestaurantDetail from "@/views/admin/restaurant-detail";
import AdminAuthGuard from "@/components/admin/auth-guard";
import AdminLayout from "@/components/admin/layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <RestaurantDetail />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
