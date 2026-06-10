import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vendor, InsertVendor } from "@shared/schema";
import { insertVendorSchema, formatPhone } from "@shared/schema";
import { z } from "zod";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pencil, Archive, Building2, Search, Users, Mail, Phone,
  UserCircle, AlertCircle, RefreshCw, Eye, RotateCcw, Trash2, Download, ListChecks,
  CheckCircle2, XCircle,
} from "lucide-react";
import { exportToCsv, csvFilename } from "@/lib/csv";
import { TypedDeleteDialog } from "@/components/shared/typed-delete-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/lib/wouter-compat";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

type ViewMode = "active" | "archived" | "all";
type SortOrder = "az" | "newest" | "oldest";

const vendorCreateSchema = insertVendorSchema.extend({
  loginPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type VendorFormValues = InsertVendor & { loginPassword?: string };

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    archived: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium capitalize ${variants[status] || variants.active}`} data-testid={`badge-status-${status}`}>
      {status}
    </Badge>
  );
}

type CompletenessMap = Record<string, { complete: boolean; missing: string[] }>;

function OnboardingBadge({ info }: { info?: { complete: boolean; missing: string[] } }) {
  if (!info) return null;
  if (info.complete) {
    return (
      <div className="flex items-center gap-1.5" data-testid="badge-onboarding-complete">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Complete</span>
      </div>
    );
  }
  return (
    <div data-testid="badge-onboarding-incomplete">
      <div className="flex items-center gap-1.5">
        <XCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Incomplete</span>
      </div>
      {info.missing.length > 0 && (
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
          {info.missing.join(" · ")}
        </p>
      )}
    </div>
  );
}

function VendorFormDialog({ open, onOpenChange, vendor }: { open: boolean; onOpenChange: (open: boolean) => void; vendor?: Vendor }) {
  const { toast } = useToast();
  const isEditing = !!vendor;

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(isEditing ? insertVendorSchema : vendorCreateSchema),
    defaultValues: {
      name: vendor?.name ?? "",
      contactName: vendor?.contactName ?? "",
      email: vendor?.email ?? "",
      phone: vendor?.phone ?? "",
      status: (vendor?.status as "active" | "inactive" | "archived") ?? "active",
      loginPassword: "",
    },
  });

  function handleServerError(error: Error) {
    const msg = error.message;
    try {
      const jsonStr = msg.substring(msg.indexOf("{"));
      const parsed = JSON.parse(jsonStr);
      const serverMsg = parsed.message || msg;
      if (serverMsg.toLowerCase().includes("phone")) {
        form.setError("phone", { message: serverMsg });
        return;
      }
    } catch {}
    toast({ title: "Error", description: msg, variant: "destructive" });
  }

  const createMutation = useMutation({
    mutationFn: (data: InsertVendor) => apiRequest("POST", "/api/vendors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Vendor created", description: "The vendor has been added and a welcome email with login details was sent." });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InsertVendor>) => apiRequest("PATCH", `/api/vendors/${vendor!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Vendor updated", description: "The vendor has been updated successfully." });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const onSubmit = (data: VendorFormValues) => {
    if (isEditing) {
      const { loginPassword, ...rest } = data;
      updateMutation.mutate(loginPassword ? data : rest);
      return;
    }
    createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-vendor-form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Vendor" : "Add New Vendor"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the vendor's information below." : "Fill in the details to create a new vendor."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />Company Name</FormLabel>
                <FormControl><Input placeholder="Acme Foods Inc." {...field} data-testid="input-vendor-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contactName" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5 text-muted-foreground" />Contact Name</FormLabel>
                <FormControl><Input placeholder="Jane Smith" {...field} data-testid="input-vendor-contact" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />Email</FormLabel>
                  <FormControl><Input type="email" placeholder="jane@acme.com" {...field} data-testid="input-vendor-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Phone</FormLabel>
                  <FormControl><Input type="tel" placeholder="(555) 123-4567" {...field} onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} value={formatPhone(field.value)} data-testid="input-vendor-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {!isEditing ? (
              <FormField control={form.control} name="loginPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Portal Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Minimum 8 characters" autoComplete="new-password" {...field} data-testid="input-vendor-password" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Sent to the vendor by email so they can sign in at /vendor/login.</p>
                  <FormMessage />
                </FormItem>
              )} />
            ) : null}
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-vendor-status"><SelectValue placeholder="Select a status" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-vendor">
                {isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Vendor")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminVendors() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<Vendor | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Vendor | undefined>();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("active");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { toast } = useToast();

  const { data: allVendors = [], isLoading, isError, error, refetch } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors?includeArchived=true"],
  });

  const { data: completeness = {} } = useQuery<CompletenessMap>({
    queryKey: ["/api/vendors/completeness"],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/vendors/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Vendor archived", description: "The vendor has been archived." });
      setArchiveTarget(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/vendors/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Vendor restored", description: "The vendor has been restored to active." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Vendor deleted", description: "The vendor has been permanently deleted." });
      setDeleteTarget(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => apiRequest("PATCH", `/api/vendors/${id}/archive`))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      toast({ title: "Vendors archived", description: `${ids.length} vendor${ids.length !== 1 ? "s" : ""} archived successfully.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => apiRequest("PATCH", `/api/vendors/${id}/restore`))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      toast({ title: "Vendors restored", description: `${ids.length} vendor${ids.length !== 1 ? "s" : ""} restored successfully.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => apiRequest("DELETE", `/api/vendors/${id}`))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast({ title: "Vendors deleted", description: `${ids.length} vendor${ids.length !== 1 ? "s" : ""} permanently deleted.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activeVendors = allVendors.filter(v => v.status !== "archived");
  const archivedVendors = allVendors.filter(v => v.status === "archived");

  const viewVendors = view === "active" ? activeVendors : view === "archived" ? archivedVendors : allVendors;

  const searchFiltered = viewVendors.filter(v => {
    const q = search.toLowerCase();
    const phoneDigits = search.replace(/\D/g, "");
    return (
      v.name.toLowerCase().includes(q) ||
      v.contactName.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      (phoneDigits.length > 0 && String(v.phone).includes(phoneDigits))
    );
  });

  const filtered = onboardingFilter === "all"
    ? searchFiltered
    : searchFiltered.filter(v => {
        const info = completeness[v.id];
        if (!info) return false;
        return onboardingFilter === "complete" ? info.complete : !info.complete;
      });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const allSelected = sorted.length > 0 && sorted.every(v => selectedIds.has(v.id));
  const someSelected = sorted.some(v => selectedIds.has(v.id)) && !allSelected;

  useEffect(() => { setSelectedIds(new Set()); }, [view]);

  function handleToggleRow(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function handleToggleAll(checked: boolean) {
    if (checked) setSelectedIds(new Set(sorted.map(v => v.id)));
    else setSelectedIds(new Set());
  }

  function handleBulkArchive() {
    if (selectedIds.size === 0) return;
    bulkArchiveMutation.mutate(Array.from(selectedIds));
  }

  function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    bulkRestoreMutation.mutate(Array.from(selectedIds));
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  }

  function handleExport() {
    exportToCsv(
      csvFilename("vendors", view),
      [
        { header: "name",         value: v => v.name },
        { header: "contact_name", value: v => v.contactName },
        { header: "email",        value: v => v.email },
        { header: "phone",        value: v => formatPhone(v.phone) },
        { header: "status",       value: v => v.status },
        { header: "created_at",   value: v => new Date(v.createdAt).toISOString() },
      ],
      sorted,
    );
  }

  const viewLabels: Record<ViewMode, string> = {
    active: `Active (${activeVendors.length})`,
    archived: `Archived (${archivedVendors.length})`,
    all: `All (${allVendors.length})`,
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">Vendors</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage vendors that supply your restaurant organizations.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted" data-testid="view-tabs-vendors">
          {(["active", "archived", "all"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${v}-vendors`}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto w-full sm:w-auto">
          <Select value={sort} onValueChange={v => setSort(v as SortOrder)}>
            <SelectTrigger className="w-[130px] shrink-0" data-testid="select-sort-vendors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="az">A–Z</SelectItem>
            </SelectContent>
          </Select>
          <Select value={onboardingFilter} onValueChange={v => setOnboardingFilter(v as "all" | "complete" | "incomplete")}>
            <SelectTrigger className="w-[150px] shrink-0" data-testid="select-onboarding-filter-vendors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Onboarding</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Name, contact, or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-[220px]" data-testid="input-search-vendors" />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={sorted.length === 0}
            data-testid="button-export-vendors"
          >
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
          <Link href="/admin/vendors/onboard">
            <Button data-testid="button-onboard-vendor">
              <ListChecks className="h-4 w-4 mr-2" />Onboard Vendor
            </Button>
          </Link>
        </div>
      </div>

      {(search.trim() !== "" || onboardingFilter !== "all") && !isLoading && (
        <p className="text-xs text-muted-foreground mb-3" data-testid="text-filtered-count-vendors">
          Showing {sorted.length} of {viewVendors.length} {viewVendors.length === 1 ? "vendor" : "vendors"}
        </p>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg mb-4" data-testid="bulk-action-bar">
          <span className="text-sm font-medium" data-testid="text-bulk-count">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            {view !== "archived" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkArchive}
                disabled={bulkArchiveMutation.isPending}
                data-testid="button-bulk-archive"
              >
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                {bulkArchiveMutation.isPending ? "Archiving..." : `Archive ${selectedIds.size}`}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkRestore}
                  disabled={bulkRestoreMutation.isPending}
                  data-testid="button-bulk-restore"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {bulkRestoreMutation.isPending ? "Restoring..." : `Restore ${selectedIds.size}`}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete {selectedIds.size}
                </Button>
              </>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground ml-2"
              data-testid="button-clear-selection"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card overflow-hidden" data-testid="table-vendors">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="error-state-vendors">
            <div className="rounded-full bg-destructive/10 p-4 mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
            <h3 className="text-lg font-semibold mb-1">Failed to load vendors</h3>
            <p className="text-sm text-muted-foreground mb-6">{error?.message || "Something went wrong."}</p>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-retry"><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-[180px]" /><Skeleton className="h-4 w-[140px]" /><Skeleton className="h-4 w-[160px]" /><Skeleton className="h-4 w-[110px]" /><Skeleton className="h-5 w-[60px] rounded-full" /><Skeleton className="h-8 w-[70px] ml-auto" /></div>
          ))}</div>
        ) : filtered.length === 0 && viewVendors.length === 0 && view === "active" && allVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="empty-state-vendors">
            <div className="rounded-full bg-primary/10 p-4 mb-4"><Building2 className="h-8 w-8 text-primary" /></div>
            <h3 className="text-lg font-semibold mb-1">No vendors yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Get started by onboarding your first vendor.</p>
            <Link href="/admin/vendors/onboard">
              <Button data-testid="button-onboard-first-vendor">
                <ListChecks className="h-4 w-4 mr-2" />Onboard Your First Vendor
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 && viewVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid={`empty-state-${view}`}>
            <div className="rounded-full bg-muted p-3 mb-3">
              {view === "archived" ? <Archive className="h-6 w-6 text-muted-foreground" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {view === "archived" ? "No archived vendors" : "No vendors in this view"}
            </p>
            <p className="text-xs text-muted-foreground">
              {view === "archived" ? "Archive a vendor from the Active tab to see it here." : "Try switching to a different tab."}
            </p>
          </div>
        ) : searchFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No vendors match "{search}"</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-onboarding-filter">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No {onboardingFilter} vendors</p>
            <p className="text-xs text-muted-foreground">Try selecting a different onboarding status filter.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pr-0">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={handleToggleAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead className="font-medium">Company</TableHead>
                <TableHead className="font-medium">Contact</TableHead>
                <TableHead className="font-medium">Email</TableHead>
                <TableHead className="font-medium">Phone</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium">Onboarding</TableHead>
                <TableHead className="text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(vendor => (
                <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`} className={vendor.status === "archived" ? "opacity-60" : ""}>
                  <TableCell className="w-10 pr-0">
                    <Checkbox
                      checked={selectedIds.has(vendor.id)}
                      onCheckedChange={(checked) => handleToggleRow(vendor.id, !!checked)}
                      data-testid={`checkbox-vendor-${vendor.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-vendor-name-${vendor.id}`}>
                    <Link href={`/admin/vendors/${vendor.id}`}>
                      <span className="text-primary hover:underline cursor-pointer" data-testid={`link-vendor-${vendor.id}`}>{vendor.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{vendor.contactName}</TableCell>
                  <TableCell className="text-muted-foreground">{vendor.email}</TableCell>
                  <TableCell className="text-muted-foreground">{formatPhone(vendor.phone)}</TableCell>
                  <TableCell><StatusBadge status={vendor.status} /></TableCell>
                  <TableCell data-testid={`cell-onboarding-${vendor.id}`}>
                    <OnboardingBadge info={completeness[vendor.id]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {vendor.status !== "archived" && (
                        <Link href={`/admin/vendors/${vendor.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground" data-testid={`button-view-vendor-${vendor.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />View
                          </Button>
                        </Link>
                      )}
                      {vendor.status !== "archived" && (
                        <Button variant="ghost" size="sm" onClick={() => { setEditingVendor(vendor); setFormOpen(true); }} className="h-8 px-2 text-muted-foreground hover:text-foreground" data-testid={`button-edit-vendor-${vendor.id}`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                      )}
                      {vendor.status !== "archived" ? (
                        <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(vendor)} className="h-8 px-2 text-muted-foreground hover:text-destructive" data-testid={`button-archive-vendor-${vendor.id}`}>
                          <Archive className="h-3.5 w-3.5 mr-1" />Archive
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreMutation.mutate(vendor.id)}
                            disabled={restoreMutation.isPending}
                            className="h-8 px-2 text-muted-foreground hover:text-emerald-600"
                            data-testid={`button-restore-vendor-${vendor.id}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(vendor)}
                            className="h-8 px-2 text-muted-foreground hover:text-destructive"
                            data-testid={`button-delete-vendor-${vendor.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {formOpen && (
        <VendorFormDialog open={formOpen} onOpenChange={open => { setFormOpen(open); if (!open) setEditingVendor(undefined); }} vendor={editingVendor} />
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={open => !open && setArchiveTarget(undefined)}>
        <AlertDialogContent data-testid="dialog-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-amber-600 shrink-0" />
              Archive Vendor
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">{archiveTarget?.name}</strong> will be moved to the Archived tab and will no longer appear in the active vendor list.
                </p>
                <p>Any linked vendor-restaurant relationships will be removed while this vendor is archived.</p>
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                  This is reversible — you can restore this vendor at any time from the Archived tab.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
              className="bg-amber-600 text-white hover:bg-amber-700"
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive Vendor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TypedDeleteDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(undefined)}
        entityType="vendor"
        consequences={[
          `"${deleteTarget?.name}" and all of its data will be permanently removed.`,
          "All vendor-restaurant relationships linked to this vendor will also be permanently deleted.",
          "Attachments, notes, and catalog data will be lost.",
        ]}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      <TypedDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={open => { if (!open) setBulkDeleteOpen(false); }}
        entityType="vendor"
        title={`Permanently Delete ${selectedIds.size} Vendor${selectedIds.size !== 1 ? "s" : ""}`}
        consequences={[
          `${selectedIds.size} vendor${selectedIds.size !== 1 ? "s" : ""} and all associated data will be permanently removed.`,
          "All associated products will be permanently deleted.",
          "All linked vendor-restaurant relationships will be permanently deleted.",
          "This action cannot be reversed.",
        ]}
        onConfirm={handleBulkDelete}
        isPending={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
