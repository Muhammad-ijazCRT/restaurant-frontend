import { authPaths } from "@/api/shared/auth";
import PortalForgotPasswordForm from "@/components/shared/portal-forgot-password-form";

export default function VendorForgotPassword() {
  return (
    <PortalForgotPasswordForm
      title="Forgot Password — Vendor"
      heading="🛒 Reset Password"
      subtitle="Enter your vendor account email and we will send you a reset link"
      emailPlaceholder="vendor@example.com"
      apiEndpoint={authPaths.vendorForgotPassword}
      loginHref="/vendor/login"
    />
  );
}
