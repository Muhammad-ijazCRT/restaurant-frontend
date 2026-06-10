"use client";

import SettingsPage from "@/views/settings-page";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <SettingsPage />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
