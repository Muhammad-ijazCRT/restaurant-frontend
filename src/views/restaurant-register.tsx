import PortalRegisterForm from "@/components/portal-register-form";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";

export default function RestaurantRegister() {
  const { login } = useRestaurantAuth();

  return (
    <PortalRegisterForm
      title="Restaurant Registration"
      heading="🍽️ Register Your Restaurant"
      subtitle="Create your restaurant account to place and manage orders"
      nameLabel="Restaurant Name"
      namePlaceholder="The Golden Fork"
      apiEndpoint="/api/restaurant/register"
      expectedRoles={["restaurant"]}
      defaultDashboardPath="/restaurant/portal"
      loginHref="/restaurant/login"
      loginLabel="Already have an account? Sign in"
      onRegisterSuccess={(_role, entityId) => {
        if (entityId) login(entityId);
      }}
    />
  );
}
