import { CutoffSettingsPanel } from "@/components/cutoff-settings-panel";
import { useVendorAuth } from "@/contexts/vendor-auth-context";

export default function VendorSettings() {
  const { vendorId } = useVendorAuth();

  if (!vendorId) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8" data-testid="page-vendor-settings">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage cutoff time and reminder settings for this vendor.
        </p>
      </div>
      <CutoffSettingsPanel
        vendorId={vendorId}
        title="Cutoff Settings"
        description="Control when orders lock and what reminder message vendors see."
      />
    </div>
  );
}
