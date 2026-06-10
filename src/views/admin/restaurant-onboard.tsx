import { useState, useEffect, useMemo } from "react";
import { useParams, useSearch, useLocation, Link } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  insertRestaurantOrgSchema, formatPhone,
  type InsertRestaurantOrg, type RestaurantOrg, type Vendor,
  type VendorRestaurantRelationship, type AttachmentMeta, type InternalNote,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  UtensilsCrossed, UserCircle, Mail, Phone, Building2,
  ArrowLeft, ArrowRight, Check, CheckCircle2, Link2, Eye, EyeOff,
} from "lucide-react";
import { AttachmentsSection } from "@/components/shared/attachments-section";
import { InternalNotesSection } from "@/components/shared/internal-notes-section";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Restaurant Info" },
  { id: 2, label: "Attachments" },
  { id: 3, label: "Internal Notes" },
  { id: 4, label: "Link Vendors" },
  { id: 5, label: "Review & Finish" },
] as const;

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  const offsetPercent = 100 / (STEPS.length * 2);
  return (
    <nav className="relative flex items-start justify-between w-full" aria-label="Onboarding progress" data-testid="onboard-stepper">
      {/* Background Line */}
      <div
        className="absolute top-3.5 h-0.5 bg-border -translate-y-1/2 z-0"
        style={{ left: `${offsetPercent}%`, right: `${offsetPercent}%` }}
      />
      {/* Progress Line */}
      <div
        className="absolute top-3.5 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
        style={{
          left: `${offsetPercent}%`,
          width: `${(current / (STEPS.length - 1)) * (100 - 2 * offsetPercent)}%`
        }}
      />
      {STEPS.map((step, i) => (
        <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 bg-card transition-colors ${
              i < current
                ? "bg-primary border-primary text-primary-foreground"
                : i === current
                ? "border-primary text-primary"
                : "border-muted-foreground/25 text-muted-foreground/40"
            }`}
            data-testid={`step-indicator-${step.id}`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : step.id}
          </div>
          <span
            className={`text-[10px] sm:text-xs font-medium mt-2 text-center max-w-[120px] leading-tight ${
              i === current
                ? "text-foreground font-semibold"
                : i < current
                ? "text-primary"
                : "text-muted-foreground/50"
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </nav>
  );
}

// ─── Shared StepNav ───────────────────────────────────────────────────────────

function StepNav({
  onPrev,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  nextPending = false,
  canSkip = false,
}: {
  onPrev?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextPending?: boolean;
  canSkip?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-5 border-t">
      {onPrev ? (
        <Button variant="outline" onClick={onPrev} data-testid="button-step-prev">
          <ArrowLeft className="h-4 w-4 mr-1.5" />Previous
        </Button>
      ) : (
        <div />
      )}
      <div className="ml-auto flex items-center gap-2">
        {canSkip && (
          <Button
            variant="ghost"
            onClick={onNext}
            className="text-muted-foreground"
            data-testid="button-step-skip"
            disabled={nextPending}
          >
            Skip for now
          </Button>
        )}
        <Button onClick={onNext} disabled={nextDisabled || nextPending} data-testid="button-step-next">
          {nextPending ? "Saving..." : nextLabel}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 1: Restaurant Info ──────────────────────────────────────────────────

function StepRestaurantInfo({
  restaurantId,
  onCreated,
  onUpdated,
}: {
  restaurantId?: string;
  onCreated: (id: string) => void;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!restaurantId;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: existingOrg } = useQuery<RestaurantOrg>({
    queryKey: ["/api/restaurant-orgs", restaurantId],
    enabled: isEditing,
  });

  const onboardSchema = z.object({
    name: z.string().min(1, "Name is required"),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().trim().min(1, "Email is required").email("Please enter a valid email address"),
    phone: z.string().length(10, "Phone must be exactly 10 digits"),
    status: z.enum(["active", "inactive", "archived"]).default("active"),
    password: isEditing
      ? z.string().optional()
      : z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: isEditing
      ? z.string().optional()
      : z.string().min(1, "Please confirm your password"),
  }).refine((data) => {
    if (isEditing && !data.password) return true;
    return data.password === data.confirmPassword;
  }, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

  const form = useForm<z.infer<typeof onboardSchema>>({
    resolver: zodResolver(onboardSchema),
    defaultValues: {
      name: "",
      contactName: "",
      email: "",
      phone: "",
      status: "active",
      password: "",
      confirmPassword: "",
    },
    values: existingOrg
      ? {
          name: existingOrg.name,
          contactName: existingOrg.contactName,
          email: existingOrg.email,
          phone: existingOrg.phone,
          status: existingOrg.status as "active" | "inactive" | "archived",
          password: "",
          confirmPassword: "",
        }
      : undefined,
  });

  function handleError(error: Error) {
    const msg = error.message;
    try {
      const parsed = JSON.parse(msg.substring(msg.indexOf("{")));
      if ((parsed.message || "").toLowerCase().includes("phone")) {
        form.setError("phone", { message: parsed.message });
        return;
      }
    } catch {}
    toast({ title: "Error", description: msg, variant: "destructive" });
  }

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof onboardSchema>) => {
      const payload = {
        name: data.name,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        status: data.status,
        loginPassword: data.password || undefined,
      };
      const res = await apiRequest("POST", "/api/restaurant-orgs", payload);
      return res.json() as Promise<RestaurantOrg>;
    },
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      onCreated(org.id);
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof onboardSchema>) => {
      const payload: any = {
        name: data.name,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        status: data.status,
      };
      if (data.password) {
        payload.loginPassword = data.password;
      }
      return apiRequest("PATCH", `/api/restaurant-orgs/${restaurantId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs", restaurantId] });
      toast({ title: "Restaurant updated" });
      onUpdated?.();
    },
    onError: handleError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && !existingOrg) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">
          {isEditing ? "Edit Restaurant Information" : "Restaurant Information"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditing
            ? "Update the restaurant's basic details, then continue."
            : "Enter the basic details for this restaurant organization. All fields are required."}
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(d =>
            isEditing ? updateMutation.mutate(d) : createMutation.mutate(d)
          )}
          className="space-y-5"
        >
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />Organization Name
              </FormLabel>
              <FormControl>
                <Input placeholder="Bagel Nook Freehold" {...field} data-testid="input-restaurant-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="contactName" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />Contact Name
              </FormLabel>
              <FormControl>
                <Input placeholder="Emma Shekhter" {...field} data-testid="input-restaurant-contact" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="emma@bagelnook.com"
                    {...field}
                    onKeyDown={e => { if (e.key === " ") e.preventDefault(); }}
                    onChange={e => field.onChange(e.target.value.replace(/\s/g, ""))}
                    onBlur={() => { field.onChange(field.value.trim()); field.onBlur(); }}
                    data-testid="input-restaurant-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />Phone
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    {...field}
                    onChange={e => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    value={formatPhone(field.value)}
                    data-testid="input-restaurant-phone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <div className="relative flex items-center">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="absolute right-3 focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <div className="relative flex items-center">
                  <FormControl>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="absolute right-3 focus:outline-none"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-restaurant-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending} data-testid="button-step1-submit">
              {isPending
                ? (isEditing ? "Saving..." : "Creating...")
                : (isEditing ? "Save & Continue" : "Create Restaurant & Continue")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ─── Step 2: Attachments ──────────────────────────────────────────────────────

function StepAttachments({
  restaurantId,
  onNext,
  onPrev,
}: {
  restaurantId: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">Attachments</h2>
          <Badge variant="outline" className="text-xs text-muted-foreground">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload contracts, licenses, or any relevant files. You can also manage attachments later from the restaurant profile.
        </p>
      </div>
      <AttachmentsSection entityType="restaurant_org" entityId={restaurantId} />
      <StepNav onPrev={onPrev} onNext={onNext} canSkip />
    </div>
  );
}

// ─── Step 3: Internal Notes ───────────────────────────────────────────────────

function StepNotes({
  restaurantId,
  onNext,
  onPrev,
}: {
  restaurantId: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">Internal Notes</h2>
          <Badge variant="outline" className="text-xs text-muted-foreground">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Record onboarding notes, agreements, or internal context. You can also add notes later from the restaurant profile.
        </p>
      </div>
      <InternalNotesSection entityType="restaurant_org" entityId={restaurantId} />
      <StepNav onPrev={onPrev} onNext={onNext} canSkip />
    </div>
  );
}

// ─── Step 4: Link Vendors ─────────────────────────────────────────────────────

function StepLinkVendors({
  restaurantId,
  onNext,
  onPrev,
}: {
  restaurantId: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const { data: allVendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: allRelationships = [], isLoading: relsLoading } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const activeVendors = useMemo(
    () => allVendors.filter(v => v.status !== "archived"),
    [allVendors]
  );

  const linkedVendorIds = useMemo(
    () =>
      new Set(
        allRelationships
          .filter(r => r.restaurantOrgId === restaurantId)
          .map(r => r.vendorId)
      ),
    [allRelationships, restaurantId]
  );

  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && !relsLoading) {
      setSelectedVendors(new Set(linkedVendorIds));
      setInitialized(true);
    }
  }, [linkedVendorIds, initialized, relsLoading]);

  function toggleVendor(vendorId: string) {
    if (linkedVendorIds.has(vendorId)) return;
    setSelectedVendors(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  }

  const newLinkCount = useMemo(
    () => [...selectedVendors].filter(id => !linkedVendorIds.has(id)).length,
    [selectedVendors, linkedVendorIds]
  );

  async function handleContinue() {
    const toCreate = [...selectedVendors].filter(vendorId => !linkedVendorIds.has(vendorId));

    if (toCreate.length === 0) {
      onNext();
      return;
    }

    setIsPending(true);
    try {
      await Promise.all(
        toCreate.map(vendorId =>
          apiRequest("POST", "/api/relationships", {
            vendorId,
            restaurantOrgId: restaurantId,
            status: "active",
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      toast({
        title: `${toCreate.length} vendor${toCreate.length !== 1 ? "s" : ""} linked`,
      });
      onNext();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error linking vendors", description: message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  const isLoading = vendorsLoading || relsLoading;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">Link Vendors</h2>
          <Badge variant="secondary" className="text-xs" data-testid="text-linked-count">
            {selectedVendors.size} selected
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Select which vendors this restaurant will order from. Already-linked vendors are shown locked.
          Use the Relationships page to remove existing links.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : activeVendors.length === 0 ? (
        <div className="border rounded-lg p-8 flex flex-col items-center text-center" data-testid="empty-state-vendors">
          <Building2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">No vendors available</p>
          <p className="text-xs text-muted-foreground">
            Onboard vendors first, then link them here or from the Relationships page.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y bg-card overflow-hidden" data-testid="vendor-list">
          {activeVendors.map(vendor => {
            const isLinked = linkedVendorIds.has(vendor.id);
            const isSelected = selectedVendors.has(vendor.id);

            return (
              <div
                key={vendor.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isLinked
                    ? "bg-muted/20"
                    : "cursor-pointer hover:bg-muted/20 active:bg-muted/30"
                }`}
                onClick={() => !isLinked && toggleVendor(vendor.id)}
                data-testid={`row-vendor-${vendor.id}`}
              >
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isLinked && toggleVendor(vendor.id)}
                    disabled={isLinked}
                    data-testid={`checkbox-vendor-${vendor.id}`}
                  />
                </div>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5 shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" data-testid={`text-vendor-name-${vendor.id}`}>
                    {vendor.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vendor.contactName} · {formatPhone(vendor.phone)}
                  </p>
                </div>
                {isLinked && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0"
                    data-testid={`badge-already-linked-${vendor.id}`}
                  >
                    Already linked
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {newLinkCount > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="text-new-link-count">
          {newLinkCount} new relationship{newLinkCount !== 1 ? "s" : ""} will be created when you continue.
        </p>
      )}

      <div className="flex items-center gap-3 pt-5 border-t">
        <Button variant="outline" onClick={onPrev} data-testid="button-step-prev">
          <ArrowLeft className="h-4 w-4 mr-1.5" />Previous
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {newLinkCount === 0 && selectedVendors.size === 0 && (
            <Button
              variant="ghost"
              onClick={onNext}
              className="text-muted-foreground"
              data-testid="button-step-skip"
              disabled={isPending}
            >
              Skip for now
            </Button>
          )}
          <Button onClick={handleContinue} disabled={isPending} data-testid="button-step-next">
            {isPending ? "Linking..." : newLinkCount > 0 ? `Link ${newLinkCount} Vendor${newLinkCount !== 1 ? "s" : ""}` : "Continue"}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Review & Finish ──────────────────────────────────────────────────

function StepReview({
  restaurantId,
  onPrev,
}: {
  restaurantId: string;
  onPrev: () => void;
}) {
  const [, navigate] = useLocation();

  const { data: restaurant } = useQuery<RestaurantOrg>({
    queryKey: ["/api/restaurant-orgs", restaurantId],
  });
  const { data: attachments = [] } = useQuery<AttachmentMeta[]>({
    queryKey: ["/api/attachments", "restaurant_org", restaurantId],
  });
  const { data: notes = [] } = useQuery<InternalNote[]>({
    queryKey: ["/api/notes", "restaurant_org", restaurantId],
  });
  const { data: allRelationships = [] } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const linkedVendorCount = allRelationships.filter(
    r => r.restaurantOrgId === restaurantId && r.status !== "archived"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Review & Finish</h2>
        <p className="text-sm text-muted-foreground">
          Here's a summary of everything set up for this restaurant. You can always add more from the restaurant profile.
        </p>
      </div>

      {restaurant && (
        <div className="border rounded-lg bg-card p-5 space-y-4" data-testid="review-restaurant-card">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-orange-50 dark:bg-orange-950/40 p-2.5">
              <UtensilsCrossed className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground" data-testid="text-review-restaurant-name">
                {restaurant.name}
              </h3>
              <p className="text-xs text-muted-foreground capitalize">{restaurant.status} restaurant</p>
            </div>
            <div className="ml-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-1.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm border-t pt-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{restaurant.contactName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{restaurant.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{formatPhone(restaurant.phone)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="border rounded-lg p-4 text-center" data-testid="review-card-attachments">
          <p className="text-2xl font-semibold" data-testid="text-review-attachment-count">
            {attachments.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Attachments</p>
        </div>
        <div className="border rounded-lg p-4 text-center" data-testid="review-card-notes">
          <p className="text-2xl font-semibold" data-testid="text-review-note-count">
            {notes.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Notes</p>
        </div>
        <div className="border rounded-lg p-4 text-center" data-testid="review-card-vendors">
          <p className="text-2xl font-semibold" data-testid="text-review-vendor-count">
            {linkedVendorCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Linked Vendors</p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-5 border-t">
        <Button variant="outline" onClick={onPrev} data-testid="button-step-prev">
          <ArrowLeft className="h-4 w-4 mr-1.5" />Previous
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/restaurants")}
            data-testid="button-back-to-restaurants"
          >
            Back to Restaurants
          </Button>
          <Button
            onClick={() => navigate(`/admin/restaurants/${restaurantId}`)}
            data-testid="button-go-to-restaurant"
          >
            View Restaurant Profile
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RestaurantOnboard() {
  const params = useParams<{ id?: string }>();
  const id = params.id;
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const stepParam = parseInt(new URLSearchParams(searchString).get("step") || "1", 10);
  const step = id ? Math.max(1, Math.min(5, stepParam)) : 1;

  function goToStep(s: number) {
    if (id) navigate(`/admin/restaurants/${id}/onboard?step=${s}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/admin/restaurants">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground hover:text-foreground mb-4"
            data-testid="button-back-to-restaurants-header"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Restaurants
          </Button>
        </Link>
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground"
          data-testid="text-page-title"
        >
          Onboard New Restaurant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1
            ? "Start by creating the restaurant record — it will be saved after this step."
            : "Your restaurant record is saved. Complete the remaining optional steps at your own pace."}
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4 mb-6">
        <Stepper current={step - 1} />
      </div>

      <div className="bg-card border rounded-lg p-6">
        {step === 1 && (
          <StepRestaurantInfo
            restaurantId={id}
            onCreated={(restaurantId) =>
              navigate(`/admin/restaurants/${restaurantId}/onboard?step=2`)
            }
            onUpdated={() => goToStep(2)}
          />
        )}
        {step === 2 && id && (
          <StepAttachments
            restaurantId={id}
            onNext={() => goToStep(3)}
            onPrev={() => goToStep(1)}
          />
        )}
        {step === 3 && id && (
          <StepNotes
            restaurantId={id}
            onNext={() => goToStep(4)}
            onPrev={() => goToStep(2)}
          />
        )}
        {step === 4 && id && (
          <StepLinkVendors
            restaurantId={id}
            onNext={() => goToStep(5)}
            onPrev={() => goToStep(3)}
          />
        )}
        {step === 5 && id && (
          <StepReview
            restaurantId={id}
            onPrev={() => goToStep(4)}
          />
        )}
      </div>
    </div>
  );
}
