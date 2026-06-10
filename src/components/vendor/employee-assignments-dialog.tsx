import { useEffect, useState } from "react";
import { vendorEmployeeApi, vendorEmployeeKeys } from "@/api/vendor/employees";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
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

type AssignmentRelationship = {
  id: string;
  restaurantOrgId: string;
  restaurantName: string;
  status: string;
  assigned: boolean;
};

type AssignmentsResponse = {
  employeeId: string;
  employeeName: string;
  primaryRoleLabel: string;
  relationshipAssignments: string[];
  relationships: AssignmentRelationship[];
};

export default function VendorEmployeeAssignmentsDialog({
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const employeeId = employee?.id ?? "";

  const { data, isLoading, isError } = useQuery<AssignmentsResponse>({
    queryKey: vendorEmployeeKeys.assignments(vendorId, employeeId),
    enabled: open && !!employee?.id,
  });

  useEffect(() => {
    if (!data) return;
    setSelectedIds(data.relationshipAssignments);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error("No employee selected");
      await vendorEmployeeApi.updateAssignments(vendorId, employee.id, { relationshipIds: selectedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorEmployeeKeys.list(vendorId) });
      if (employee?.id) {
        queryClient.invalidateQueries({
          queryKey: vendorEmployeeKeys.assignments(vendorId, employee.id),
        });
      }
      toast({ title: "Assignments saved" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  function toggleRelationship(relationshipId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return current.includes(relationshipId) ? current : [...current, relationshipId];
      return current.filter((id) => id !== relationshipId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col" data-testid="dialog-employee-assignments">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-600" />
            Manage Assignments — {employee?.name ?? "Employee"}
          </DialogTitle>
          <DialogDescription>
            Assign restaurant relationships this employee can access.
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
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">Could not load assignments.</p>
          ) : data.relationships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active restaurant relationships yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.relationships.map((relationship) => (
                <label
                  key={relationship.id}
                  className="flex items-center gap-3 rounded-md border border-border/70 px-3 py-2.5"
                >
                  <Checkbox
                    checked={selectedIds.includes(relationship.id)}
                    onCheckedChange={(value) =>
                      toggleRelationship(relationship.id, value === true)
                    }
                    data-testid={`checkbox-assignment-${relationship.id}`}
                  />
                  <span className="text-sm font-medium">{relationship.restaurantName}</span>
                </label>
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
            data-testid="button-save-employee-assignments"
          >
            {saveMutation.isPending ? "Saving..." : "Save Assignments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
