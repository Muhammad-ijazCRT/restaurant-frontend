"use client";

import AdminDashboard from "@/views/admin-dashboard";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
