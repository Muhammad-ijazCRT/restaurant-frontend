import PortalRegisterForm from "@/components/shared/portal-register-form";
import { useVendorAuth } from "@/contexts/vendor-auth-context";

export default function VendorRegister() {
  const { login } = useVendorAuth();

  return (
    <PortalRegisterForm
      title="Vendor Registration"
      heading="🛒 Vendor Registration"
      subtitle="Create your vendor account to manage orders and catalog"
      nameLabel="Company Name"
      namePlaceholder="Acme Foods Inc."
      apiEndpoint="/api/vendor/register"
      expectedRoles={["vendor_admin", "manager", "warehouse_worker", "driver"]}
      defaultDashboardPath="/vendor/portal"
      loginHref="/vendor/login"
      loginLabel="Already have an account? Sign in"
      onRegisterSuccess={(_role, entityId) => {
        if (entityId) login(entityId);
      }}
    />
  );
}
