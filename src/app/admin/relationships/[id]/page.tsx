"use client";

import RelationshipDetail from "@/views/admin/relationship-detail";
import AdminAuthGuard from "@/components/admin/auth-guard";
import AdminLayout from "@/components/admin/layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <RelationshipDetail />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
