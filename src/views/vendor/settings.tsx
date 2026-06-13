import { CutoffSettingsPanel } from "@/components/vendor/cutoff-settings-panel";
import { ChangePasswordSection } from "@/components/shared/change-password-section";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { getUserRole } from "@/lib/portal-auth";

export default function VendorSettings() {
  const { vendorId } = useVendorAuth();
  const role = getUserRole();
  const showCutoffSettings = role === "vendor_admin" || role === "vendor" || role === "manager";

  if (showCutoffSettings && !vendorId) return null;

  return (
    <div data-testid="page-vendor-settings" className="mx-auto w-full max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your account and vendor preferences.
        </p>
      </div>

      <ChangePasswordSection />

      {showCutoffSettings && vendorId ? (
        <CutoffSettingsPanel
          vendorId={vendorId}
          title="Cutoff Settings"
          description="Control when orders lock and what reminder message vendors see."
        />
      ) : null}
    </div>
  );
}
