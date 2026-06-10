"use client";

import AdminActivityLog from "@/views/admin-activity-log";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminActivityLog />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
