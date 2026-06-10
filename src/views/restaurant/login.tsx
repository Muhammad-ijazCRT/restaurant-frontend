import { authPaths } from "@/api/shared/auth";
import PortalLoginForm from "@/components/shared/portal-login-form";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";

export default function RestaurantLogin() {
  const { login } = useRestaurantAuth();

  return (
    <PortalLoginForm
      title="Restaurant Login"
      heading="🍽️ Restaurant Login"
      subtitle="Restaurant managers and employees — sign in here to access your portal"
      emailPlaceholder="restaurant@example.com"
      apiEndpoint={authPaths.restaurantLogin}
      expectedRoles={["restaurant", "restaurant_manager", "restaurant_employee"]}
      defaultDashboardPath="/restaurant/portal"
      registerHref="/restaurant/register"
      registerLabel="Register your restaurant"
      onLoginSuccess={(_role, entityId) => {
        if (entityId) login(entityId);
      }}
    />
  );
}
