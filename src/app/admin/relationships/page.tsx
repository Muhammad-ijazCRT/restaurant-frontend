"use client";

import AdminRelationships from "@/views/admin-relationships";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminRelationships />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
