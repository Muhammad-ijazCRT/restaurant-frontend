import { authPaths } from "@/api/shared/auth";
import PortalForgotPasswordForm from "@/components/shared/portal-forgot-password-form";

export default function RestaurantForgotPassword() {
  return (
    <PortalForgotPasswordForm
      title="Forgot Password — Restaurant"
      heading="🍽️ Reset Password"
      subtitle="Enter your restaurant account email and we will send you a reset link"
      emailPlaceholder="restaurant@example.com"
      apiEndpoint={authPaths.restaurantForgotPassword}
      loginHref="/restaurant/login"
    />
  );
}
