import { authPaths } from "@/api/shared/auth";
import PortalResetPasswordForm from "@/components/shared/portal-reset-password-form";

export default function RestaurantResetPassword() {
  return (
    <PortalResetPasswordForm
      title="Reset Password — Restaurant"
      heading="🍽️ Set New Password"
      subtitle="Choose a new password for your restaurant account"
      apiEndpoint={authPaths.restaurantResetPassword}
      loginHref="/restaurant/login"
      forgotPasswordHref="/restaurant/forgot-password"
    />
  );
}
