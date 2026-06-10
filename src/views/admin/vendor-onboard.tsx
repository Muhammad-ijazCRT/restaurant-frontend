import { useState, useRef, useMemo, useEffect } from "react";
import { PRODUCT_CSV_TEMPLATE_FILENAME, PRODUCT_CSV_TEMPLATE_URL } from "@/lib/product-csv-template";
import { useParams, useSearch, useLocation, Link } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  insertVendorSchema, formatPhone, formatCurrency,
  type InsertVendor, type Vendor, type Product, type AttachmentMeta, type InternalNote,
  type RestaurantOrg, type VendorRestaurantRelationship,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, UserCircle, Mail, Phone, Package, Plus, Upload,
  Download, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Check, UtensilsCrossed,
  Eye, EyeOff,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AttachmentsSection } from "@/components/shared/attachments-section";
import { InternalNotesSection } from "@/components/shared/internal-notes-section";
import Papa from "papaparse";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_UNIT_TYPES = ["case", "lb", "oz", "each", "bag", "gallon", "pallet"];

const STEPS = [
  { id: 1, label: "Vendor Info" },
  { id: 2, label: "Product Catalog" },
  { id: 3, label: "Attachments" },
  { id: 4, label: "Internal Notes" },
  { id: 5, label: "Link Restaurants" },
  { id: 6, label: "Review & Finish" },
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
  canSkip = false,
}: {
  onPrev?: () => void;
  onNext: () => void;
  nextLabel?: string;
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
          >
            Skip for now
          </Button>
        )}
        <Button onClick={onNext} data-testid="button-step-next">
          {nextLabel}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Product form schema ──────────────────────────────────────────────────────

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  unitType: z.string().min(1, "Unit type is required"),
  unitSize: z.string().min(1, "Unit size is required"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid price required (e.g. 12.99)"),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

interface ParsedRow {
  name: string; sku: string; unit_type: string; unit_size: string; price: string;
  rowNum: number; errors: string[];
}

// ─── Step 1: Vendor Info ──────────────────────────────────────────────────────

function StepVendorInfo({
  vendorId,
  onCreated,
  onUpdated,
}: {
  vendorId?: string;
  onCreated: (id: string) => void;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!vendorId;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: existingVendor } = useQuery<Vendor>({
    queryKey: ["/api/vendors", vendorId],
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
    values: existingVendor
      ? {
          name: existingVendor.name,
          contactName: existingVendor.contactName,
          email: existingVendor.email,
          phone: existingVendor.phone,
          status: existingVendor.status as "active" | "inactive" | "archived",
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
      const res = await apiRequest("POST", "/api/vendors", payload);
      return res.json() as Promise<Vendor>;
    },
    onSuccess: (vendor) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      onCreated(vendor.id);
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
      return apiRequest("PATCH", `/api/vendors/${vendorId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors?includeArchived=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId] });
      toast({ title: "Vendor updated" });
      onUpdated?.();
    },
    onError: handleError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && !existingVendor) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">
          {isEditing ? "Edit Vendor Information" : "Vendor Information"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditing
            ? "Update the vendor's basic details, then continue to the next step."
            : "Enter the basic details for this new vendor. All fields are required."}
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(d => isEditing ? updateMutation.mutate(d) : createMutation.mutate(d))}
          className="space-y-5"
        >
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />Company Name
              </FormLabel>
              <FormControl>
                <Input placeholder="Acme Foods Inc." {...field} data-testid="input-vendor-name" />
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
                <Input placeholder="Jane Smith" {...field} data-testid="input-vendor-contact" />
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
                    placeholder="jane@acme.com"
                    {...field}
                    onKeyDown={e => { if (e.key === " ") e.preventDefault(); }}
                    onChange={e => field.onChange(e.target.value.replace(/\s/g, ""))}
                    onBlur={() => { field.onChange(field.value.trim()); field.onBlur(); }}
                    data-testid="input-vendor-email"
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
                    data-testid="input-vendor-phone"
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
                  <SelectTrigger data-testid="select-vendor-status">
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
                : (isEditing ? "Save & Continue" : "Create Vendor & Continue")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ─── Add Product Dialog ───────────────────────────────────────────────────────

function AddProductDialog({
  open,
  onOpenChange,
  vendorId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  vendorId: string;
}) {
  const { toast } = useToast();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { name: "", sku: "", unitType: "", unitSize: "", price: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: ProductFormValues) =>
      apiRequest("POST", `/api/vendors/${vendorId}/products`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products"] });
      form.reset();
      toast({ title: "Product added" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      const msg = err.message;
      try {
        const parsed = JSON.parse(msg.substring(msg.indexOf("{")));
        if ((parsed.message || "").toLowerCase().includes("sku")) {
          form.setError("sku", { message: parsed.message });
          return;
        }
      } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) form.reset(); onOpenChange(b); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-product">
        <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-product-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="sku" render={({ field }) => (
              <FormItem>
                <FormLabel>SKU / Internal Code</FormLabel>
                <FormControl><Input {...field} data-testid="input-product-sku" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unitType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-product-unit-type">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VALID_UNIT_TYPES.map(t => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Size</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. 12 ct" data-testid="input-product-unit-size" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="price" render={({ field }) => (
              <FormItem>
                <FormLabel>Price ($)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="0.00" data-testid="input-product-price" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-product">
                {mutation.isPending ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV Import Dialog (wizard version) ──────────────────────────────────────

function CsvImportDialog({
  open,
  onOpenChange,
  vendorId,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  vendorId: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvStep, setCsvStep] = useState<"upload" | "preview">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");

  const { data: existingProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/vendors", vendorId, "products"],
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async (rows: object[]) => {
      const res = await apiRequest("POST", `/api/vendors/${vendorId}/products/import`, { rows });
      return res.json() as Promise<{ summary: { imported: number } }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products"] });
      toast({
        title: "Import complete",
        description: `${data.summary.imported} product${data.summary.imported !== 1 ? "s" : ""} imported.`,
      });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  function reset() {
    setCsvStep("upload");
    setParsedRows([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = PRODUCT_CSV_TEMPLATE_URL;
    a.download = PRODUCT_CSV_TEMPLATE_FILENAME;
    a.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    const existingSkus = new Set(existingProducts.map(p => p.sku));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const required = ["name", "sku", "unit_type", "unit_size", "price"];
        const missing = required.filter(h => !(result.meta.fields || []).includes(h));
        if (missing.length > 0) {
          toast({
            title: "Invalid format",
            description: `Missing columns: ${missing.join(", ")}`,
            variant: "destructive",
          });
          return;
        }
        const seenSkus = new Set<string>();
        const rows: ParsedRow[] = (result.data as Record<string, string>[]).map((raw, i) => {
          const name = (raw.name || "").trim();
          const sku = (raw.sku || "").trim();
          const unit_type = (raw.unit_type || "").trim();
          const unit_size = (raw.unit_size || "").trim();
          const price = (raw.price || "").trim();
          const errors: string[] = [];
          if (!name) errors.push("Name required");
          if (sku) {
            if (seenSkus.has(sku.toUpperCase())) errors.push(`Duplicate SKU "${sku}"`);
            else if (existingSkus.has(sku)) errors.push(`SKU "${sku}" already exists`);
            if (errors.length === 0) seenSkus.add(sku.toUpperCase());
          }
          if (!unit_type) errors.push("Unit type required");
          else if (!VALID_UNIT_TYPES.includes(unit_type.toLowerCase()))
            errors.push(`Invalid unit type "${unit_type}"`);
          if (!unit_size) errors.push("Unit size required");
          if (!price) errors.push("Price required");
          else if (!/^\d+(\.\d{1,2})?$/.test(price)) errors.push("Invalid price");
          return { name, sku, unit_type, unit_size, price, rowNum: i + 1, errors };
        });
        if (rows.length === 0) {
          toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
          return;
        }
        setParsedRows(rows);
        setCsvStep("preview");
      },
      error: () => toast({ title: "Parse error", description: "Failed to read the CSV.", variant: "destructive" }),
    });
  }

  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-csv-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {csvStep === "upload" ? "Import Products from CSV" : "Preview Import"}
          </DialogTitle>
        </DialogHeader>

        {csvStep === "upload" && (
          <div className="space-y-4 py-2">
            <div className="border rounded-lg p-4 bg-muted/30">
              <ul className="text-xs text-muted-foreground mb-3 space-y-1 list-disc list-inside">
                <li>Required columns: <span className="font-mono">name, sku, unit_type, unit_size, price</span></li>
                <li>One product per row</li>
                <li>Replace or delete the example row before uploading</li>
                <li>Price must be a number (e.g. 12.50)</li>
                <li>Imported products default to In Stock</li>
              </ul>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="h-3.5 w-3.5 mr-1.5" />Download Template
              </Button>
            </div>
            <div className="border border-dashed rounded-lg p-6 flex flex-col items-center gap-3">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Upload your CSV file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
                data-testid="input-csv-file"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-choose-file">
                Choose File
              </Button>
            </div>
          </div>
        )}

        {csvStep === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{fileName}</span>
              <div className="flex gap-2 ml-auto">
                <Badge variant="secondary" className="gap-1" data-testid="badge-valid-count">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />{validRows.length} valid
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="secondary" className="gap-1 text-destructive" data-testid="badge-error-count">
                    <XCircle className="h-3 w-3" />{errorCount} errors
                  </Badge>
                )}
              </div>
            </div>
            <div className="overflow-auto border rounded-md flex-1 max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit Type / Size</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map(row => (
                    <TableRow
                      key={row.rowNum}
                      className={row.errors.length > 0 ? "bg-destructive/5" : ""}
                      data-testid={`row-preview-${row.rowNum}`}
                    >
                      <TableCell className="text-xs text-muted-foreground">{row.rowNum}</TableCell>
                      <TableCell className="text-sm">
                        {row.name || <em className="text-muted-foreground">empty</em>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.sku || <em className="text-muted-foreground">empty</em>}
                      </TableCell>
                      <TableCell className="text-sm">{row.unit_type} / {row.unit_size}</TableCell>
                      <TableCell className="text-sm">{row.price}</TableCell>
                      <TableCell>
                        {row.errors.length === 0
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : (
                            <div className="space-y-0.5">
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-xs text-destructive">{e}</p>
                              ))}
                            </div>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset} data-testid="button-back-to-upload">Back</Button>
              <Button
                onClick={() => importMutation.mutate(
                  parsedRows.map(r => ({
                    name: r.name, sku: r.sku,
                    unit_type: r.unit_type, unit_size: r.unit_size, price: r.price,
                  }))
                )}
                disabled={validRows.length === 0 || importMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending
                  ? "Importing..."
                  : `Import ${validRows.length} Product${validRows.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 2: Product Catalog ──────────────────────────────────────────────────

function StepProducts({
  vendorId,
  onNext,
  onPrev,
}: {
  vendorId: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/vendors", vendorId, "products"],
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">Product Catalog</h2>
          <Badge variant="secondary" className="text-xs" data-testid="text-product-count">
            {products.length} added
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Add products to this vendor's catalog now, or skip and add them later from the vendor profile.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-product">
          <Plus className="h-3.5 w-3.5 mr-1.5" />Add Product
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)} data-testid="button-import-csv">
          <Upload className="h-3.5 w-3.5 mr-1.5" />Import CSV
        </Button>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden" data-testid="table-products">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-10 px-4" data-testid="empty-state-products">
            <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No products added yet. You can skip this step and add them later.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Product</TableHead>
                <TableHead className="font-medium">SKU</TableHead>
                <TableHead className="font-medium">Unit</TableHead>
                <TableHead className="font-medium">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(p => (
                <TableRow key={p.id} data-testid={`row-product-${p.id}`}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.sku}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.unitSize} / {p.unitType}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <StepNav onPrev={onPrev} onNext={onNext} canSkip={products.length === 0} />

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} vendorId={vendorId} />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} vendorId={vendorId} />
    </div>
  );
}

// ─── Step 3: Attachments ──────────────────────────────────────────────────────

function StepAttachments({
  vendorId,
  onNext,
  onPrev,
}: {
  vendorId: string;
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
          Upload contracts, certificates, or any relevant files. You can also do this later from the vendor profile.
        </p>
      </div>
      <AttachmentsSection entityType="vendor" entityId={vendorId} />
      <StepNav onPrev={onPrev} onNext={onNext} canSkip />
    </div>
  );
}

// ─── Step 4: Internal Notes ───────────────────────────────────────────────────

function StepNotes({
  vendorId,
  onNext,
  onPrev,
}: {
  vendorId: string;
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
          Record onboarding notes, agreements, or internal context for this vendor. You can also add notes later.
        </p>
      </div>
      <InternalNotesSection entityType="vendor" entityId={vendorId} />
      <StepNav onPrev={onPrev} onNext={onNext} canSkip />
    </div>
  );
}

// ─── Step 5: Link Restaurant Organizations ────────────────────────────────────

function StepLinkRestaurants({
  vendorId,
  onNext,
  onPrev,
}: {
  vendorId: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const { data: allOrgs = [], isLoading: orgsLoading } = useQuery<RestaurantOrg[]>({
    queryKey: ["/api/restaurant-orgs"],
  });

  const { data: allRelationships = [], isLoading: relsLoading } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const activeOrgs = useMemo(
    () => allOrgs.filter(o => o.status !== "archived"),
    [allOrgs]
  );

  const linkedOrgIds = useMemo(
    () =>
      new Set(
        allRelationships
          .filter(r => r.vendorId === vendorId)
          .map(r => r.restaurantOrgId)
      ),
    [allRelationships, vendorId]
  );

  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && !relsLoading) {
      setSelectedOrgs(new Set(linkedOrgIds));
      setInitialized(true);
    }
  }, [linkedOrgIds, initialized, relsLoading]);

  function toggleOrg(orgId: string) {
    if (linkedOrgIds.has(orgId)) return;
    setSelectedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  }

  const newLinkCount = useMemo(
    () => [...selectedOrgs].filter(id => !linkedOrgIds.has(id)).length,
    [selectedOrgs, linkedOrgIds]
  );

  async function handleContinue() {
    const toCreate = [...selectedOrgs].filter(restaurantOrgId => !linkedOrgIds.has(restaurantOrgId));

    if (toCreate.length === 0) {
      onNext();
      return;
    }

    setIsPending(true);
    try {
      await Promise.all(
        toCreate.map(restaurantOrgId =>
          apiRequest("POST", "/api/relationships", {
            vendorId,
            restaurantOrgId,
            status: "active",
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      toast({
        title: `${toCreate.length} restaurant${toCreate.length !== 1 ? "s" : ""} linked`,
      });
      onNext();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error linking restaurants", description: message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  }

  const isLoading = orgsLoading || relsLoading;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold">Link Restaurant Organizations</h2>
          <Badge variant="secondary" className="text-xs" data-testid="text-linked-count">
            {selectedOrgs.size} selected
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">Optional</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Select which restaurants will order from this vendor. Already-linked restaurants are shown locked.
          Use the Relationships page to remove existing links.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : activeOrgs.length === 0 ? (
        <div className="border rounded-lg p-8 flex flex-col items-center text-center" data-testid="empty-state-restaurants">
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">No restaurant organizations available</p>
          <p className="text-xs text-muted-foreground">
            Onboard restaurants first, then link them here or from the Relationships page.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y bg-card overflow-hidden" data-testid="restaurant-list">
          {activeOrgs.map(org => {
            const isLinked = linkedOrgIds.has(org.id);
            const isSelected = selectedOrgs.has(org.id);

            return (
              <div
                key={org.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isLinked
                    ? "bg-muted/20"
                    : "cursor-pointer hover:bg-muted/20 active:bg-muted/30"
                }`}
                onClick={() => !isLinked && toggleOrg(org.id)}
                data-testid={`row-restaurant-${org.id}`}
              >
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => !isLinked && toggleOrg(org.id)}
                    disabled={isLinked}
                    data-testid={`checkbox-restaurant-${org.id}`}
                  />
                </div>
                <div className="rounded-md bg-orange-50 dark:bg-orange-950/40 p-1.5 shrink-0">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" data-testid={`text-restaurant-name-${org.id}`}>
                    {org.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {org.contactName} · {formatPhone(org.phone)}
                  </p>
                </div>
                {isLinked && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0"
                    data-testid={`badge-already-linked-${org.id}`}
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
          {newLinkCount === 0 && selectedOrgs.size === 0 && (
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
            {isPending
              ? "Linking..."
              : newLinkCount > 0
              ? `Link ${newLinkCount} Restaurant${newLinkCount !== 1 ? "s" : ""}`
              : "Continue"}
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 6: Review & Finish ──────────────────────────────────────────────────

function StepReview({
  vendorId,
  onPrev,
}: {
  vendorId: string;
  onPrev: () => void;
}) {
  const [, navigate] = useLocation();
  const { data: vendor } = useQuery<Vendor>({ queryKey: ["/api/vendors", vendorId] });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/vendors", vendorId, "products"],
  });
  const { data: attachments = [] } = useQuery<AttachmentMeta[]>({
    queryKey: ["/api/attachments", "vendor", vendorId],
  });
  const { data: notes = [] } = useQuery<InternalNote[]>({
    queryKey: ["/api/notes", "vendor", vendorId],
  });
  const { data: allRelationships = [] } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });
  const linkedRestaurantCount = allRelationships.filter(
    r => r.vendorId === vendorId && r.status !== "archived"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Review & Finish</h2>
        <p className="text-sm text-muted-foreground">
          Here's a summary of everything set up for this vendor. You can always add more from the vendor profile.
        </p>
      </div>

      {vendor && (
        <div className="border rounded-lg bg-card p-5 space-y-4" data-testid="review-vendor-card">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2.5">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground" data-testid="text-review-vendor-name">
                {vendor.name}
              </h3>
              <p className="text-xs text-muted-foreground capitalize">{vendor.status} vendor</p>
            </div>
            <div className="ml-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-1.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm border-t pt-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{vendor.contactName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{vendor.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{formatPhone(vendor.phone)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4 text-center" data-testid="review-card-products">
          <p className="text-2xl font-semibold" data-testid="text-review-product-count">
            {products.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Products</p>
        </div>
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
        <div className="border rounded-lg p-4 text-center" data-testid="review-card-restaurants">
          <p className="text-2xl font-semibold" data-testid="text-review-restaurant-count">
            {linkedRestaurantCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Linked Restaurants</p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-5 border-t">
        <Button variant="outline" onClick={onPrev} data-testid="button-step-prev">
          <ArrowLeft className="h-4 w-4 mr-1.5" />Previous
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/vendors")}
            data-testid="button-back-to-vendors"
          >
            Back to Vendors List
          </Button>
          <Button
            onClick={() => navigate(`/admin/vendors/${vendorId}`)}
            data-testid="button-go-to-vendor"
          >
            View Vendor Profile
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorOnboard() {
  const params = useParams<{ id?: string }>();
  const id = params.id;
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const stepParam = parseInt(new URLSearchParams(searchString).get("step") || "1", 10);
  const step = id ? Math.max(1, Math.min(6, stepParam)) : 1;

  function goToStep(s: number) {
    if (id) navigate(`/admin/vendors/${id}/onboard?step=${s}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/admin/vendors">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground hover:text-foreground mb-4"
            data-testid="button-back-to-vendors-header"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Vendors
          </Button>
        </Link>
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground"
          data-testid="text-page-title"
        >
          Onboard New Vendor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1
            ? "Start by creating the vendor record — it will be saved after this step."
            : "Your vendor record is saved. Complete the remaining optional steps at your own pace."}
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4 mb-6">
        <Stepper current={step - 1} />
      </div>

      <div className="bg-card border rounded-lg p-6">
        {step === 1 && (
          <StepVendorInfo
            vendorId={id}
            onCreated={(vendorId) => navigate(`/admin/vendors/${vendorId}/onboard?step=2`)}
            onUpdated={() => goToStep(2)}
          />
        )}
        {step === 2 && id && (
          <StepProducts
            vendorId={id}
            onNext={() => goToStep(3)}
            onPrev={() => goToStep(1)}
          />
        )}
        {step === 3 && id && (
          <StepAttachments
            vendorId={id}
            onNext={() => goToStep(4)}
            onPrev={() => goToStep(2)}
          />
        )}
        {step === 4 && id && (
          <StepNotes
            vendorId={id}
            onNext={() => goToStep(5)}
            onPrev={() => goToStep(3)}
          />
        )}
        {step === 5 && id && (
          <StepLinkRestaurants
            vendorId={id}
            onNext={() => goToStep(6)}
            onPrev={() => goToStep(4)}
          />
        )}
        {step === 6 && id && (
          <StepReview
            vendorId={id}
            onPrev={() => goToStep(5)}
          />
        )}
      </div>
    </div>
  );
}
