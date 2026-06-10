"use client";

import RestaurantCatalog from "@/views/restaurant-catalog";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <RestaurantCatalog />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
