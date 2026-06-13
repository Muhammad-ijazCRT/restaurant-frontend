import { authPaths } from "@/api/shared/auth";
import PortalResetPasswordForm from "@/components/shared/portal-reset-password-form";

export default function VendorResetPassword() {
  return (
    <PortalResetPasswordForm
      title="Reset Password — Vendor"
      heading="🛒 Set New Password"
      subtitle="Choose a new password for your vendor account"
      apiEndpoint={authPaths.vendorResetPassword}
      loginHref="/vendor/login"
      forgotPasswordHref="/vendor/forgot-password"
    />
  );
}
