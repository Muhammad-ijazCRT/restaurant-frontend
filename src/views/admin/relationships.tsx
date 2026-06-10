import { useState } from "react";
import { Link } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VendorRestaurantRelationship, Vendor, RestaurantOrg } from "@shared/schema";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { TypedDeleteDialog } from "@/components/shared/typed-delete-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, Link2, AlertCircle, RefreshCw, Building2, UtensilsCrossed,
  ArrowRight, ToggleLeft, ToggleRight, Search, Eye, Download,
} from "lucide-react";
import { exportToCsv, csvFilename } from "@/lib/csv";
import { Label } from "@/components/ui/label";

type StatusFilter = "all" | "active" | "inactive";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium capitalize ${variants[status] || variants.active}`}>
      {status}
    </Badge>
  );
}

function CreateRelationshipDialog({
  open,
  onOpenChange,
  vendors,
  restaurants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  restaurants: RestaurantOrg[];
}) {
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState("");
  const [restaurantOrgId, setRestaurantOrgId] = useState("");
  const [status, setStatus] = useState("active");

  const createMutation = useMutation({
    mutationFn: (data: { vendorId: string; restaurantOrgId: string; status: string }) =>
      apiRequest("POST", "/api/relationships", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Relationship created", description: "Partnership emails were sent to both the vendor and restaurant." });
      onOpenChange(false);
      setVendorId("");
      setRestaurantOrgId("");
      setStatus("active");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activeVendors = vendors.filter(v => v.status === "active");
  const activeRestaurants = restaurants.filter(r => r.status === "active");
  const selectedVendor = activeVendors.find((vendor) => vendor.id === vendorId);
  const selectedRestaurant = activeRestaurants.find((org) => org.id === restaurantOrgId);
  const vendorEmail = selectedVendor?.email?.trim() ?? "";
  const restaurantEmail = selectedRestaurant?.email?.trim() ?? "";
  const sameEmail =
    !!vendorEmail &&
    !!restaurantEmail &&
    vendorEmail.toLowerCase() === restaurantEmail.toLowerCase();

  const canSubmit = vendorId && restaurantOrgId && vendorEmail && restaurantEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-relationship-form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Create Relationship
          </DialogTitle>
          <DialogDescription>
            Link a vendor to a restaurant organization. This allows them to interact within the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Vendor
            </Label>
            {activeVendors.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">No active vendors available. Create a vendor first.</p>
            ) : (
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger data-testid="select-relationship-vendor">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {activeVendors.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-px w-8 bg-border" />
              <ArrowRight className="h-4 w-4" />
              <div className="h-px w-8 bg-border" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
              Restaurant Organization
            </Label>
            {activeRestaurants.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">No active restaurant organizations available. Create one first.</p>
            ) : (
              <Select value={restaurantOrgId} onValueChange={setRestaurantOrgId}>
                <SelectTrigger data-testid="select-relationship-restaurant">
                  <SelectValue placeholder="Select a restaurant organization" />
                </SelectTrigger>
                <SelectContent>
                  {activeRestaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-relationship-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedVendor && selectedRestaurant ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Notification emails</p>
              <p className="mt-2 text-muted-foreground">
                Vendor email will go to <span className="font-medium text-foreground">{vendorEmail || "—"}</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Restaurant email will go to <span className="font-medium text-foreground">{restaurantEmail || "—"}</span>
              </p>
              {sameEmail ? (
                <p className="mt-2 text-xs text-amber-700">
                  Both accounts use the same email address, so both notifications will arrive in one inbox. Use different emails if vendor and restaurant should receive them separately.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">Cancel</Button>
            <Button
              onClick={() => canSubmit && createMutation.mutate({ vendorId, restaurantOrgId, status })}
              disabled={!canSubmit || createMutation.isPending}
              data-testid="button-submit-relationship"
            >
              {createMutation.isPending ? "Creating..." : "Create Relationship"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminRelationships() {
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VendorRestaurantRelationship | undefined>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { toast } = useToast();

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/relationships/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Relationship updated", description: "The relationship status has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: relationships = [], isLoading, isError, error, refetch } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: restaurants = [] } = useQuery<RestaurantOrg[]>({
    queryKey: ["/api/restaurant-orgs"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/relationships/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Relationship removed", description: "The vendor-restaurant relationship has been removed." });
      setDeleteTarget(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const vendorMap = new Map(vendors.map(v => [v.id, v]));
  const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

  const filtered = relationships.filter(rel => {
    const vendorName = vendorMap.get(rel.vendorId)?.name?.toLowerCase() ?? "";
    const restaurantName = restaurantMap.get(rel.restaurantOrgId)?.name?.toLowerCase() ?? "";
    const q = search.toLowerCase();
    const matchesSearch = q === "" || vendorName.includes(q) || restaurantName.includes(q);
    const matchesStatus = statusFilter === "all" || rel.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isFiltered = search.trim() !== "" || statusFilter !== "all";

  function handleExport() {
    const tag = statusFilter !== "all" ? statusFilter : undefined;
    exportToCsv(
      csvFilename("relationships", tag),
      [
        { header: "vendor_name",      value: r => vendorMap.get(r.vendorId)?.name ?? "" },
        { header: "restaurant_name",  value: r => restaurantMap.get(r.restaurantOrgId)?.name ?? "" },
        { header: "status",           value: r => r.status },
        { header: "created_at",       value: r => new Date(r.createdAt).toISOString() },
      ],
      filtered,
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
          Vendor-Restaurant Relationships
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage which vendors are linked to which restaurant organizations. A relationship must exist for them to interact.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Vendor or restaurant name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-relationships"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[130px] shrink-0" data-testid="select-filter-status-relationships">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={filtered.length === 0}
            data-testid="button-export-relationships"
          >
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
          <Button onClick={() => setFormOpen(true)} data-testid="button-add-relationship">
            <Plus className="h-4 w-4 mr-2" />Add Relationship
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground" data-testid="text-relationship-count">
          {isFiltered
            ? `Showing ${filtered.length} of ${relationships.length} ${relationships.length === 1 ? "relationship" : "relationships"}`
            : `${relationships.length} ${relationships.length === 1 ? "relationship" : "relationships"}`
          }
        </p>
        {isFiltered && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            className="text-xs text-primary hover:underline"
            data-testid="button-clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="border rounded-lg bg-card overflow-hidden" data-testid="table-relationships">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="rounded-full bg-destructive/10 p-4 mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
            <h3 className="text-lg font-semibold mb-1">Failed to load relationships</h3>
            <p className="text-sm text-muted-foreground mb-6">{error?.message || "Something went wrong."}</p>
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-[180px]" /><Skeleton className="h-4 w-[30px]" /><Skeleton className="h-4 w-[180px]" /><Skeleton className="h-5 w-[60px] rounded-full" /><Skeleton className="h-8 w-[80px] ml-auto" /></div>
          ))}</div>
        ) : relationships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="empty-state-relationships">
            <div className="rounded-full bg-primary/10 p-4 mb-4"><Link2 className="h-8 w-8 text-primary" /></div>
            <h3 className="text-lg font-semibold mb-1">No relationships yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Link vendors to restaurant organizations so they can interact within the platform.
            </p>
            <Button onClick={() => setFormOpen(true)} data-testid="button-add-first-relationship"><Plus className="h-4 w-4 mr-2" />Create First Relationship</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-search-relationships">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No relationships match your filters</p>
            <p className="text-xs text-muted-foreground mb-4">Try adjusting your search or status filter.</p>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-primary hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Vendor</TableHead>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="font-medium">Restaurant Organization</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium">Created</TableHead>
                <TableHead className="text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rel => {
                const vendor = vendorMap.get(rel.vendorId);
                const restaurant = restaurantMap.get(rel.restaurantOrgId);
                return (
                  <TableRow key={rel.id} data-testid={`row-relationship-${rel.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
                          <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="font-medium" data-testid={`text-rel-vendor-${rel.id}`}>
                          {vendor?.name || "Unknown Vendor"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-orange-50 dark:bg-orange-950/40 p-1.5">
                          <UtensilsCrossed className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="font-medium" data-testid={`text-rel-restaurant-${rel.id}`}>
                          {restaurant?.name || "Unknown Organization"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={rel.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(rel.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/relationships/${rel.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            data-testid={`button-view-relationship-${rel.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatusMutation.mutate({
                            id: rel.id,
                            status: rel.status === "active" ? "inactive" : "active",
                          })}
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          data-testid={`button-toggle-relationship-${rel.id}`}
                        >
                          {rel.status === "active" ? (
                            <><ToggleRight className="h-3.5 w-3.5 mr-1" />Deactivate</>
                          ) : (
                            <><ToggleLeft className="h-3.5 w-3.5 mr-1" />Activate</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(rel)}
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          data-testid={`button-remove-relationship-${rel.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {formOpen && (
        <CreateRelationshipDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          vendors={vendors}
          restaurants={restaurants}
        />
      )}

      <TypedDeleteDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(undefined)}
        entityType="relationship"
        consequences={deleteTarget ? [
          `The link between "${vendorMap.get(deleteTarget.vendorId)?.name ?? "this vendor"}" and "${restaurantMap.get(deleteTarget.restaurantOrgId)?.name ?? "this organization"}" will be permanently removed.`,
          "The vendor and organization will no longer be able to interact within the platform.",
        ] : []}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
