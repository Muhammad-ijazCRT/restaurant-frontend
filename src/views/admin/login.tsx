import PortalLoginForm from "@/components/shared/portal-login-form";

export default function SuperAdminLogin() {
  return (
    <PortalLoginForm
      title="Super Admin Login"
      heading="👑 Super Admin Login"
      subtitle="Manage the entire system"
      emailPlaceholder="admin@example.com"
      apiEndpoint="/api/super-admin/login"
      expectedRoles={["super_admin"]}
      defaultDashboardPath="/super-admin/dashboard"
      registerHref="/super-admin/register"
      registerLabel="Register new admin"
      hideRegister
    />
  );
}
