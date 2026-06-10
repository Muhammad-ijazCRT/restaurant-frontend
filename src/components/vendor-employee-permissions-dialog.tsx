import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import type { VendorEmployee } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type PermissionGroup = {
  id: string;
  label: string;
  permissions: Array<{ key: string; label: string }>;
};

type PermissionsResponse = {
  employeeId: string;
  employeeName: string;
  roles: string[];
  primaryRoleLabel: string;
  permissionGroups: PermissionGroup[];
  roleDefaults: string[];
  extraPermissions: string[];
};

export default function VendorEmployeePermissionsDialog({
  open,
  onOpenChange,
  vendorId,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  employee: VendorEmployee | null;
}) {
  const { toast } = useToast();
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const { data, isLoading, isError } = useQuery<PermissionsResponse>({
    queryKey: ["/api/vendors", vendorId, "employees", employee?.id, "permissions"],
    enabled: open && !!employee?.id,
  });

  useEffect(() => {
    if (!data) return;
    setSelectedExtras(data.extraPermissions);
  }, [data]);

  const roleDefaultSet = useMemo(
    () => new Set(data?.roleDefaults ?? []),
    [data?.roleDefaults],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(
        "PATCH",
        `/api/vendors/${vendorId}/employees/${employee!.id}/permissions`,
        { extraPermissions: selectedExtras },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "employees"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/vendors", vendorId, "employees", employee?.id, "permissions"],
      });
      toast({ title: "Permissions saved" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  function toggleExtraPermission(permissionKey: string, checked: boolean) {
    setSelectedExtras((current) => {
      if (checked) return current.includes(permissionKey) ? current : [...current, permissionKey];
      return current.filter((permission) => permission !== permissionKey);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col" data-testid="dialog-employee-permissions">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-600" />
            Manage Permissions — {employee?.name ?? "Employee"}
          </DialogTitle>
          <DialogDescription>
            Grant extra permissions beyond this employee&apos;s role defaults. Role defaults are always
            included and cannot be removed here.
          </DialogDescription>
          {data?.primaryRoleLabel ? (
            <Badge variant="secondary" className="w-fit">
              {data.primaryRoleLabel}
            </Badge>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Could not load permissions.</p>
          ) : (
            <div className="space-y-6">
              {data.permissionGroups.map((group) => (
                <section key={group.id}>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h3>
                  <div className="space-y-2.5">
                    {group.permissions.map((permission) => {
                      const fromRole = roleDefaultSet.has(permission.key);
                      const isExtra = !fromRole && selectedExtras.includes(permission.key);
                      const checked = fromRole || isExtra;

                      return (
                        <label
                          key={permission.key}
                          className="flex items-start gap-3 rounded-md border border-border/70 px-3 py-2.5"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={fromRole}
                            onCheckedChange={(value) =>
                              toggleExtraPermission(permission.key, value === true)
                            }
                            data-testid={`checkbox-permission-${permission.key}`}
                          />
                          <span className="text-sm leading-5">
                            {permission.label}
                            {fromRole ? (
                              <span className="ml-2 text-xs text-muted-foreground">(from role)</span>
                            ) : isExtra ? (
                              <span className="ml-2 text-xs font-medium text-violet-600">(extra)</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!employee || saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
            data-testid="button-save-employee-permissions"
          >
            {saveMutation.isPending ? "Saving..." : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
