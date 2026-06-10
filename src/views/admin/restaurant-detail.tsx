import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/wouter-compat";
import type { RestaurantOrg, VendorRestaurantRelationship, Vendor } from "@shared/schema";
import { formatPhone } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Building2, Mail, Phone, UserCircle, Link2, UtensilsCrossed, AlertCircle, Calendar, Package,
  CheckCircle2, XCircle, Plus, Eye, ToggleLeft, ToggleRight, Trash2,
} from "lucide-react";
import { AttachmentsSection } from "@/components/shared/attachments-section";
import { InternalNotesSection } from "@/components/shared/internal-notes-section";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    archived: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium capitalize ${variants[status] || variants.active}`}>
      {status}
    </Badge>
  );
}

function LinkVendorDialog({
  open,
  onOpenChange,
  restaurantOrgId,
  availableVendors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantOrgId: string;
  availableVendors: Vendor[];
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function handleClose(open: boolean) {
    if (!open) setSelectedIds(new Set());
    onOpenChange(open);
  }

  function handleToggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const linkMutation = useMutation({
    mutationFn: async (vendorIds: string[]) => {
      await Promise.all(
        vendorIds.map(vendorId =>
          apiRequest("POST", "/api/relationships", { vendorId, restaurantOrgId, status: "active" })
        )
      );
    },
    onSuccess: (_, vendorIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/completeness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs/completeness"] });
      toast({
        title: `${vendorIds.length} vendor${vendorIds.length !== 1 ? "s" : ""} linked`,
        description: "The linked vendors list has been updated.",
      });
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-link-vendor">
        <DialogHeader>
          <DialogTitle>Link Vendors</DialogTitle>
          <DialogDescription>
            Select one or more vendors to link to this restaurant. Already-linked and archived vendors are not shown.
          </DialogDescription>
        </DialogHeader>

        {availableVendors.length === 0 ? (
          <div className="py-8 text-center" data-testid="empty-state-no-available-vendors">
            <div className="rounded-full bg-muted p-3 mb-3 inline-flex">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">All vendors already linked</p>
            <p className="text-xs text-muted-foreground mt-1">
              Every active vendor is already linked to this restaurant organization.
            </p>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y divide-border/60" data-testid="list-available-vendors">
            {availableVendors.map(vendor => (
              <label
                key={vendor.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                data-testid={`option-vendor-${vendor.id}`}
              >
                <Checkbox
                  checked={selectedIds.has(vendor.id)}
                  onCheckedChange={() => handleToggle(vendor.id)}
                  data-testid={`checkbox-vendor-${vendor.id}`}
                />
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1 shrink-0">
                    <Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium truncate">{vendor.name}</span>
                  {vendor.status === "inactive" && (
                    <Badge variant="outline" className="text-xs ml-1 shrink-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                      Inactive
                    </Badge>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-link-vendor">
            Cancel
          </Button>
          <Button
            onClick={() => linkMutation.mutate(Array.from(selectedIds))}
            disabled={selectedIds.size === 0 || linkMutation.isPending || availableVendors.length === 0}
            data-testid="button-confirm-link-vendor"
          >
            {linkMutation.isPending
              ? "Linking..."
              : selectedIds.size === 0
              ? "Select vendors"
              : `Link ${selectedIds.size} Vendor${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RestaurantDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const [linkVendorOpen, setLinkVendorOpen] = useState(false);
  const [removingRelationship, setRemovingRelationship] = useState<VendorRestaurantRelationship | null>(null);

  const updateRelationshipMutation = useMutation({
    mutationFn: async ({ relId, status }: { relId: string; status: string }) => {
      await apiRequest("PATCH", `/api/relationships/${relId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/completeness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs/completeness"] });
      toast({ title: "Relationship updated", description: "Status changed successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relId: string) => {
      await apiRequest("DELETE", `/api/relationships/${relId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/completeness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs/completeness"] });
      toast({ title: "Relationship removed", description: "The link has been deleted." });
      setRemovingRelationship(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: org, isLoading: orgLoading, isError: orgError } = useQuery<RestaurantOrg>({
    queryKey: ["/api/restaurant-orgs", id],
  });

  const { data: allRelationships = [] } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const { data: allVendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const orgRelationships = allRelationships.filter(r => r.restaurantOrgId === id);
  const vendorMap = new Map(allVendors.map(v => [v.id, v]));

  const linkedVendorIds = new Set(orgRelationships.map(r => r.vendorId));
  const availableVendors = allVendors.filter(v => v.status !== "archived" && !linkedVendorIds.has(v.id));

  if (orgLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (orgError || !org) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/admin/restaurants">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Restaurants
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-destructive/10 p-4 mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
          <h3 className="text-lg font-semibold mb-1">Organization not found</h3>
          <p className="text-sm text-muted-foreground">This organization may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/admin/restaurants">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />Back to Restaurants
        </Button>
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-restaurant-detail-name">
              {org.name}
            </h1>
            <StatusBadge status={org.status} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Added {new Date(org.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <UserCircle className="h-4 w-4" />
              Contact
            </div>
            <p className="font-medium text-foreground" data-testid="text-restaurant-detail-contact">{org.contactName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="font-medium text-foreground" data-testid="text-restaurant-detail-email">{org.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              Phone
            </div>
            <p className="font-medium text-foreground" data-testid="text-restaurant-detail-phone">{formatPhone(org.phone)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Status */}
      {(() => {
        const hasVendors = orgRelationships.length > 0;
        const isComplete = hasVendors;
        const requirements = [
          { label: "Linked to at least one vendor", met: hasVendors },
        ];
        return (
          <div className="border rounded-lg bg-card p-5 mb-8" data-testid="section-onboarding-status">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Onboarding Status</h2>
              {isComplete ? (
                <div className="flex items-center gap-1.5" data-testid="badge-onboarding-complete">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Complete</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5" data-testid="badge-onboarding-incomplete">
                  <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Incomplete</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {requirements.map(req => (
                <div key={req.label} className="flex items-center gap-2 text-sm">
                  {req.met
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />}
                  <span className={req.met ? "text-foreground" : "text-muted-foreground"}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-linked-vendors">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Linked Vendors</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs" data-testid="text-relationship-count">
              {orgRelationships.length} linked
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setLinkVendorOpen(true)}
              data-testid="button-link-vendor"
            >
              <Plus className="h-3 w-3 mr-1" />Link Vendor
            </Button>
          </div>
        </div>

        {orgRelationships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-linked-vendors">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No linked vendors</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Link this restaurant to vendors to complete onboarding.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setLinkVendorOpen(true)}
              data-testid="button-link-vendor-empty"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />Link Vendor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Vendor</TableHead>
                <TableHead className="font-medium">Relationship Status</TableHead>
                <TableHead className="font-medium">Linked Since</TableHead>
                <TableHead className="font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgRelationships.map(rel => {
                const vendor = vendorMap.get(rel.vendorId);
                const isActive = rel.status === "active";
                return (
                  <TableRow key={rel.id} data-testid={`row-linked-vendor-${rel.id}`}>
                    <TableCell>
                      <Link href={`/admin/vendors/${rel.vendorId}`}>
                        <span className="font-medium text-primary hover:underline cursor-pointer flex items-center gap-2" data-testid={`link-vendor-${rel.vendorId}`}>
                          <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
                            <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          {vendor?.name || "Unknown Vendor"}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell><StatusBadge status={rel.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(rel.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/restaurants/${id}/catalog/${rel.vendorId}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid={`button-view-catalog-${rel.vendorId}`}>
                            <Package className="h-3.5 w-3.5 mr-1" />Catalog
                          </Button>
                        </Link>
                        <Link href={`/admin/relationships/${rel.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid={`button-view-relationship-${rel.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2 text-xs ${isActive ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}
                          onClick={() => updateRelationshipMutation.mutate({ relId: rel.id, status: isActive ? "inactive" : "active" })}
                          disabled={updateRelationshipMutation.isPending}
                          data-testid={`button-toggle-relationship-${rel.id}`}
                        >
                          {isActive ? <ToggleLeft className="h-3.5 w-3.5 mr-1" /> : <ToggleRight className="h-3.5 w-3.5 mr-1" />}
                          {isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setRemovingRelationship(rel)}
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

      <AttachmentsSection entityType="restaurant_org" entityId={id!} />

      <InternalNotesSection entityType="restaurant_org" entityId={id!} />

      <Dialog open={!!removingRelationship} onOpenChange={(open) => { if (!open) setRemovingRelationship(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-remove-relationship">
          <DialogHeader>
            <DialogTitle>Remove Relationship</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove the link between this restaurant and{" "}
            <span className="font-medium text-foreground">
              {removingRelationship ? vendorMap.get(removingRelationship.vendorId)?.name ?? "this vendor" : ""}
            </span>
            ? This cannot be undone, but you can re-link them later.
          </p>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setRemovingRelationship(null)} data-testid="button-cancel-remove-relationship">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removingRelationship && deleteRelationshipMutation.mutate(removingRelationship.id)}
              disabled={deleteRelationshipMutation.isPending}
              data-testid="button-confirm-remove-relationship"
            >
              {deleteRelationshipMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkVendorDialog
        open={linkVendorOpen}
        onOpenChange={setLinkVendorOpen}
        restaurantOrgId={id!}
        availableVendors={availableVendors}
      />
    </div>
  );
}
