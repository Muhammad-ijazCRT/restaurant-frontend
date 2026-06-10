import { authPaths } from "@/api/shared/auth";
import PortalLoginForm from "@/components/shared/portal-login-form";
import { useVendorAuth } from "@/contexts/vendor-auth-context";

export default function VendorLogin() {
  const { login } = useVendorAuth();

  return (
    <PortalLoginForm
      title="Vendor Login"
      heading="🛒 Vendor Login"
      subtitle="Vendor admin, manager, warehouse, and driver team access"
      emailPlaceholder="vendor@example.com"
      apiEndpoint={authPaths.vendorLogin}
      expectedRoles={["vendor_admin", "manager", "warehouse_worker", "driver", "sales_representative"]}
      defaultDashboardPath="/vendor/portal"
      registerHref="/vendor/register"
      registerLabel="Register as a vendor"
      onLoginSuccess={(_role, entityId) => {
        if (entityId) login(entityId);
      }}
    />
  );
}
