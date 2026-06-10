"use client";

import RestaurantOnboard from "@/views/admin/restaurant-onboard";
import AdminAuthGuard from "@/components/admin/auth-guard";
import AdminLayout from "@/components/admin/layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <RestaurantOnboard />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
