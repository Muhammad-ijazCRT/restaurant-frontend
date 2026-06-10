"use client";

import AdminRestaurants from "@/views/admin-restaurants";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminRestaurants />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
