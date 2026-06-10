"use client";

import ProfilePage from "@/views/profile-page";
import AdminAuthGuard from "@/components/admin-auth-guard";
import AdminLayout from "@/components/admin-layout";

export default function Page() {
  return (
    <AdminAuthGuard>
      <AdminLayout>
        <ProfilePage />
      </AdminLayout>
    </AdminAuthGuard>
  );
}
