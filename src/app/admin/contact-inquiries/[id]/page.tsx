"use client";

import AdminAuthGuard from "@/components/admin/auth-guard";
import AdminLayout from "@/components/admin/layout";
import AdminContactInquiry from "@/views/admin/contact-inquiry";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <AdminContactInquiry />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
