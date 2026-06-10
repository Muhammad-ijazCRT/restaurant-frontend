import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RestaurantOrg, InsertRestaurantOrg } from "@shared/schema";
import { insertRestaurantOrgSchema, formatPhone } from "@shared/schema";
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
  ListChecks, Pencil, Archive, UtensilsCrossed, Search, Mail, Phone,
  UserCircle, AlertCircle, RefreshCw, Eye, RotateCcw, Trash2, Download,
  CheckCircle2, XCircle,
} from "lucide-react";
import { exportToCsv, csvFilename } from "@/lib/csv";
import { TypedDeleteDialog } from "@/components/typed-delete-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/lib/wouter-compat";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

type ViewMode = "active" | "archived" | "all";
type SortOrder = "az" | "newest" | "oldest";

const restaurantCreateSchema = insertRestaurantOrgSchema.extend({
  loginPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type RestaurantFormValues = InsertRestaurantOrg & { loginPassword?: string };

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

function RestaurantFormDialog({ open, onOpenChange, org }: { open: boolean; onOpenChange: (open: boolean) => void; org?: RestaurantOrg }) {
  const { toast } = useToast();
  const isEditing = !!org;

  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(isEditing ? insertRestaurantOrgSchema : restaurantCreateSchema),
    defaultValues: {
      name: org?.name ?? "",
      contactName: org?.contactName ?? "",
      email: org?.email ?? "",
      phone: org?.phone ?? "",
      status: (org?.status as "active" | "inactive" | "archived") ?? "active",
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
    mutationFn: (data: InsertRestaurantOrg) => apiRequest("POST", "/api/restaurant-orgs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Restaurant created", description: "The restaurant was added and a welcome email with login details was sent." });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InsertRestaurantOrg>) => apiRequest("PATCH", `/api/restaurant-orgs/${org!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Restaurant updated", description: "The restaurant organization has been updated." });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const onSubmit = (data: RestaurantFormValues) => {
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
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-restaurant-form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Restaurant Organization" : "Add Restaurant Organization"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the organization's information below." : "Fill in the details to create a new restaurant organization."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />Organization Name</FormLabel>
                <FormControl><Input placeholder="Downtown Dining Group" {...field} data-testid="input-restaurant-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="contactName" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5 text-muted-foreground" />Contact Name</FormLabel>
                <FormControl><Input placeholder="Alex Rivera" {...field} data-testid="input-restaurant-contact" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />Email</FormLabel>
                  <FormControl><Input type="email" placeholder="alex@dining.com" {...field} data-testid="input-restaurant-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Phone</FormLabel>
                  <FormControl><Input type="tel" placeholder="(555) 234-5678" {...field} onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))} value={formatPhone(field.value)} data-testid="input-restaurant-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {!isEditing ? (
              <FormField control={form.control} name="loginPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Portal Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Minimum 8 characters" autoComplete="new-password" {...field} data-testid="input-restaurant-password" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Sent to the restaurant by email so they can sign in at /restaurant/login.</p>
                  <FormMessage />
                </FormItem>
              )} />
            ) : null}
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-restaurant-status"><SelectValue placeholder="Select a status" /></SelectTrigger>
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
              <Button type="submit" disabled={isPending} data-testid="button-submit-restaurant">
                {isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Organization")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminRestaurants() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<RestaurantOrg | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<RestaurantOrg | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RestaurantOrg | undefined>();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("active");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { toast } = useToast();

  const { data: allOrgs = [], isLoading, isError, error, refetch } = useQuery<RestaurantOrg[]>({
    queryKey: ["/api/restaurant-orgs?includeArchived=true"],
  });

  const { data: completeness = {} } = useQuery<CompletenessMap>({
    queryKey: ["/api/restaurant-orgs/completeness"],
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/restaurant-orgs/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Organization archived", description: "The organization has been archived." });
      setArchiveTarget(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/restaurant-orgs/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Organization restored", description: "The organization has been restored to active." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/restaurant-orgs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Organization deleted", description: "The organization has been permanently deleted." });
      setDeleteTarget(undefined);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => apiRequest("PATCH", `/api/restaurant-orgs/${id}/archive`))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      toast({ title: "Organizations archived", description: `${ids.length} organization${ids.length !== 1 ? "s" : ""} archived successfully.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => apiRequest("PATCH", `/api/restaurant-orgs/${id}/restore`))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      toast({ title: "Organizations restored", description: `${ids.length} organization${ids.length !== 1 ? "s" : ""} restored successfully.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => apiRequest("DELETE", `/api/restaurant-orgs/${id}`))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast({ title: "Organizations deleted", description: `${ids.length} organization${ids.length !== 1 ? "s" : ""} permanently deleted.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const activeOrgs = allOrgs.filter(o => o.status !== "archived");
  const archivedOrgs = allOrgs.filter(o => o.status === "archived");

  const viewOrgs = view === "active" ? activeOrgs : view === "archived" ? archivedOrgs : allOrgs;

  const searchFiltered = viewOrgs.filter(o => {
    const q = search.toLowerCase();
    const phoneDigits = search.replace(/\D/g, "");
    return (
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.contactName.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      (phoneDigits.length > 0 && String(o.phone).includes(phoneDigits))
    );
  });

  const filtered = onboardingFilter === "all"
    ? searchFiltered
    : searchFiltered.filter(o => {
        const info = completeness[o.id];
        if (!info) return false;
        return onboardingFilter === "complete" ? info.complete : !info.complete;
      });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const allSelected = sorted.length > 0 && sorted.every(o => selectedIds.has(o.id));
  const someSelected = sorted.some(o => selectedIds.has(o.id)) && !allSelected;

  useEffect(() => { setSelectedIds(new Set()); }, [view]);

  function handleToggleRow(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function handleToggleAll(checked: boolean) {
    if (checked) setSelectedIds(new Set(sorted.map(o => o.id)));
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
      csvFilename("restaurant-orgs", view),
      [
        { header: "name",         value: o => o.name },
        { header: "contact_name", value: o => o.contactName },
        { header: "email",        value: o => o.email },
        { header: "phone",        value: o => formatPhone(o.phone) },
        { header: "status",       value: o => o.status },
        { header: "created_at",   value: o => new Date(o.createdAt).toISOString() },
      ],
      sorted,
    );
  }

  const viewLabels: Record<ViewMode, string> = {
    active: `Active (${activeOrgs.length})`,
    archived: `Archived (${archivedOrgs.length})`,
    all: `All (${allOrgs.length})`,
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">Restaurant Organizations</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage restaurant organizations that purchase from vendors.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted" data-testid="view-tabs-restaurants">
          {(["active", "archived", "all"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${v}-restaurants`}
            >
              {viewLabels[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto w-full sm:w-auto">
          <Select value={sort} onValueChange={v => setSort(v as SortOrder)}>
            <SelectTrigger className="w-[130px] shrink-0" data-testid="select-sort-restaurants">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="az">A–Z</SelectItem>
            </SelectContent>
          </Select>
          <Select value={onboardingFilter} onValueChange={v => setOnboardingFilter(v as "all" | "complete" | "incomplete")}>
            <SelectTrigger className="w-[150px] shrink-0" data-testid="select-onboarding-filter-restaurants">
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
            <Input placeholder="Name, contact, or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-[220px]" data-testid="input-search-restaurants" />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={sorted.length === 0}
            data-testid="button-export-restaurants"
          >
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
          <Link href="/admin/restaurants/onboard">
            <Button data-testid="button-onboard-restaurant">
              <ListChecks className="h-4 w-4 mr-2" />Onboard Restaurant
            </Button>
          </Link>
        </div>
      </div>

      {(search.trim() !== "" || onboardingFilter !== "all") && !isLoading && (
        <p className="text-xs text-muted-foreground mb-3" data-testid="text-filtered-count-restaurants">
          Showing {sorted.length} of {viewOrgs.length} {viewOrgs.length === 1 ? "organization" : "organizations"}
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

      <div className="border rounded-lg bg-card overflow-hidden" data-testid="table-restaurants">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="rounded-full bg-destructive/10 p-4 mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
            <h3 className="text-lg font-semibold mb-1">Failed to load organizations</h3>
            <p className="text-sm text-muted-foreground mb-6">{error?.message || "Something went wrong."}</p>
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4"><Skeleton className="h-4 w-[180px]" /><Skeleton className="h-4 w-[140px]" /><Skeleton className="h-4 w-[160px]" /><Skeleton className="h-4 w-[110px]" /><Skeleton className="h-5 w-[60px] rounded-full" /><Skeleton className="h-8 w-[70px] ml-auto" /></div>
          ))}</div>
        ) : filtered.length === 0 && viewOrgs.length === 0 && view === "active" && allOrgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="empty-state-restaurants">
            <div className="rounded-full bg-primary/10 p-4 mb-4"><UtensilsCrossed className="h-8 w-8 text-primary" /></div>
            <h3 className="text-lg font-semibold mb-1">No restaurant organizations yet</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Get started by onboarding your first restaurant organization.</p>
            <Link href="/admin/restaurants/onboard">
              <Button data-testid="button-onboard-first-restaurant">
                <ListChecks className="h-4 w-4 mr-2" />Onboard Your First Restaurant
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 && viewOrgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid={`empty-state-${view}`}>
            <div className="rounded-full bg-muted p-3 mb-3">
              {view === "archived" ? <Archive className="h-6 w-6 text-muted-foreground" /> : <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />}
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {view === "archived" ? "No archived organizations" : "No organizations in this view"}
            </p>
            <p className="text-xs text-muted-foreground">
              {view === "archived" ? "Archive an organization from the Active tab to see it here." : "Try switching to a different tab."}
            </p>
          </div>
        ) : searchFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No organizations match "{search}"</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-onboarding-filter">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No {onboardingFilter} organizations</p>
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
                <TableHead className="font-medium">Organization</TableHead>
                <TableHead className="font-medium">Contact</TableHead>
                <TableHead className="font-medium">Email</TableHead>
                <TableHead className="font-medium">Phone</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium">Onboarding</TableHead>
                <TableHead className="text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(org => (
                <TableRow key={org.id} data-testid={`row-restaurant-${org.id}`} className={org.status === "archived" ? "opacity-60" : ""}>
                  <TableCell className="w-10 pr-0">
                    <Checkbox
                      checked={selectedIds.has(org.id)}
                      onCheckedChange={(checked) => handleToggleRow(org.id, !!checked)}
                      data-testid={`checkbox-restaurant-${org.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-restaurant-name-${org.id}`}>
                    <Link href={`/admin/restaurants/${org.id}`}>
                      <span className="text-primary hover:underline cursor-pointer" data-testid={`link-restaurant-${org.id}`}>{org.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{org.contactName}</TableCell>
                  <TableCell className="text-muted-foreground">{org.email}</TableCell>
                  <TableCell className="text-muted-foreground">{formatPhone(org.phone)}</TableCell>
                  <TableCell><StatusBadge status={org.status} /></TableCell>
                  <TableCell data-testid={`cell-onboarding-${org.id}`}>
                    <OnboardingBadge info={completeness[org.id]} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {org.status !== "archived" && (
                        <Link href={`/admin/restaurants/${org.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground" data-testid={`button-view-restaurant-${org.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />View
                          </Button>
                        </Link>
                      )}
                      {org.status !== "archived" && (
                        <Button variant="ghost" size="sm" onClick={() => { setEditingOrg(org); setFormOpen(true); }} className="h-8 px-2 text-muted-foreground hover:text-foreground" data-testid={`button-edit-restaurant-${org.id}`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                      )}
                      {org.status !== "archived" ? (
                        <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(org)} className="h-8 px-2 text-muted-foreground hover:text-destructive" data-testid={`button-archive-restaurant-${org.id}`}>
                          <Archive className="h-3.5 w-3.5 mr-1" />Archive
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreMutation.mutate(org.id)}
                            disabled={restoreMutation.isPending}
                            className="h-8 px-2 text-muted-foreground hover:text-emerald-600"
                            data-testid={`button-restore-restaurant-${org.id}`}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(org)}
                            className="h-8 px-2 text-muted-foreground hover:text-destructive"
                            data-testid={`button-delete-restaurant-${org.id}`}
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
        <RestaurantFormDialog open={formOpen} onOpenChange={open => { setFormOpen(open); if (!open) setEditingOrg(undefined); }} org={editingOrg} />
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={open => !open && setArchiveTarget(undefined)}>
        <AlertDialogContent data-testid="dialog-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-amber-600 shrink-0" />
              Archive Organization
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">{archiveTarget?.name}</strong> will be moved to the Archived tab and will no longer appear in the active organization list.
                </p>
                <p>Any linked vendor-restaurant relationships will be removed while this organization is archived.</p>
                <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                  This is reversible — you can restore this organization at any time from the Archived tab.
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
              {archiveMutation.isPending ? "Archiving..." : "Archive Organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TypedDeleteDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(undefined)}
        entityType="restaurant organization"
        consequences={[
          `"${deleteTarget?.name}" and all of its data will be permanently removed.`,
          "All vendor-restaurant relationships linked to this organization will also be permanently deleted.",
          "Attachments, notes, and all associated data will be lost.",
        ]}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      <TypedDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={open => { if (!open) setBulkDeleteOpen(false); }}
        entityType="restaurant organization"
        title={`Permanently Delete ${selectedIds.size} Organization${selectedIds.size !== 1 ? "s" : ""}`}
        consequences={[
          `${selectedIds.size} organization${selectedIds.size !== 1 ? "s" : ""} and all associated data will be permanently removed.`,
          "All linked vendor-restaurant relationships will be permanently deleted.",
          "Attachments, notes, and all associated data will be lost.",
          "This action cannot be reversed.",
        ]}
        onConfirm={handleBulkDelete}
        isPending={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
