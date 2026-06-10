import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Fragment,
  type ComponentType,
} from "react";
import { useVendorPortalNav } from "@/contexts/vendor-portal-nav-context";
import { vendorProductApi } from "@/api/vendor/products";
import { relationshipKeys } from "@/api/shared/relationships";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { vendorKeys } from "@/api/vendor/vendors";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { vendorProductKeys } from "@/api/vendor/products";
import { isDisputedOrder } from "@/lib/order-status-utils";
import {
  isWarehouseActiveOrder,
  isWarehouseSubmittedOrder,
} from "@/lib/vendor-warehouse-orders";
import {
  VENDOR_SECTION_IDS,
  type VendorSectionId,
} from "@/lib/vendor-portal-sections";
import {
  PRODUCT_CSV_TEMPLATE_FILENAME,
  PRODUCT_CSV_TEMPLATE_URL,
} from "@/lib/product-csv-template";
import { useLocation } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import type {
  Vendor,
  VendorRestaurantRelationship,
  RestaurantOrg,
  Product,
  Order,
  OrderLineItem,
  LineFulfillment,
  Invoice,
} from "@shared/schema";
import { formatPhone, formatCurrency } from "@shared/schema";
import {
  normalizeInvoiceLineItems,
  getInvoiceRestaurantNotes,
  invoiceSnapshotHasRestaurantNotes,
} from "@/lib/invoice-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Mail,
  Phone,
  UserCircle,
  Package,
  Plus,
  Pencil,
  Archive,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  UtensilsCrossed,
  Search,
  X,
  AlertCircle,
  CalendarDays,
  Inbox,
  ClipboardList,
  Lock,
  Clock,
  ExternalLink,
  CreditCard,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CutoffSettingsPanel } from "@/components/vendor/cutoff-settings-panel";
import Papa from "papaparse";

// ─── Constants ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STOCK_TYPES = ["Dry", "Refrigerated", "Frozen"] as const;
const VALID_UNIT_TYPES = [
  "case",
  "lb",
  "oz",
  "each",
  "bag",
  "gallon",
  "pallet",
];
const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: "In Stock",
  inactive: "Out of Stock",
  archived: "Archived",
};
const DATE_RANGE_OPTIONS = [
  { value: "all-time", label: "All Time" },
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "last-month", label: "Last Month" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "custom-range", label: "Custom Range" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string;
  sku: string;
  unit_type: string;
  unit_size: string;
  price: string;
  rowNum: number;
  errors: string[];
}

interface ImportResult {
  summary: { total: number; imported: number; rejected: number };
  results: Array<{
    row: number;
    status: "imported" | "rejected";
    errors?: string[];
  }>;
}

// ─── ProductStatusBadge ───────────────────────────────────────────────────────

function ProductStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    archived:
      "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${variants[status] || variants.active}`}
    >
      {PRODUCT_STATUS_LABELS[status] || status}
    </Badge>
  );
}

// ─── ProductFormDialog ────────────────────────────────────────────────────────

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  stockType: z.enum(["Dry", "Refrigerated", "Frozen"]).nullable().optional(),
  unitType: z.string().min(1, "Unit type is required"),
  unitSize: z.string().min(1, "Unit size is required"),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Valid price is required (e.g. 12.99)"),
  status: z.enum(["active", "inactive"]).optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

function ProductFormDialog({
  open,
  onOpenChange,
  vendorId,
  editProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  editProduct?: Product | null;
}) {
  const { toast } = useToast();
  const isEditing = !!editProduct;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: editProduct?.name || "",
      sku: editProduct?.sku ?? "",
      stockType:
        (editProduct?.stockType as "Dry" | "Refrigerated" | "Frozen" | null) ??
        null,
      unitType: editProduct?.unitType || "",
      unitSize: editProduct?.unitSize || "",
      price: editProduct?.price || "",
      status: (editProduct?.status as "active" | "inactive") ?? "active",
    },
  });

  function handleServerError(err: Error) {
    const msg = err.message;
    try {
      const jsonStr = msg.substring(msg.indexOf("{"));
      const parsed = JSON.parse(jsonStr);
      const serverMsg = parsed.message || msg;
      if (serverMsg.toLowerCase().includes("sku")) {
        form.setError("sku", { message: serverMsg });
        return;
      }
    } catch {}
    toast({ title: "Error", description: msg, variant: "destructive" });
  }

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      await vendorProductApi.create(vendorId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId, true),
      });
      toast({ title: "Product created" });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      await vendorProductApi.update(vendorId, editProduct!.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId, true),
      });
      toast({ title: "Product updated" });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const onSubmit = (data: ProductFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-product-form">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Product" : "Add Product"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-product-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU / Internal Code</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-product-sku" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stockType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Stock{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <Select
                    onValueChange={(val) =>
                      field.onChange(val === "__none__" ? null : val)
                    }
                    value={field.value ?? "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-product-stock-type">
                        <SelectValue placeholder="Select storage type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {STOCK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unitType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-unit-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="case">Case</SelectItem>
                        <SelectItem value="lb">Pound (lb)</SelectItem>
                        <SelectItem value="oz">Ounce (oz)</SelectItem>
                        <SelectItem value="each">Each</SelectItem>
                        <SelectItem value="bag">Bag</SelectItem>
                        <SelectItem value="gallon">Gallon</SelectItem>
                        <SelectItem value="pallet">Pallet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Size</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. 12ct"
                        data-testid="input-product-unit-size"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        {...field}
                        className="pl-6"
                        placeholder="0.00"
                        data-testid="input-product-price"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">In Stock</SelectItem>
                        <SelectItem value="inactive">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-product"
              >
                {isPending
                  ? "Saving…"
                  : isEditing
                    ? "Save Changes"
                    : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CsvImportDialog ──────────────────────────────────────────────────────────

function CsvImportDialog({
  open,
  onOpenChange,
  vendorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  const { data: existingProducts = [] } = useQuery<Product[]>({
    queryKey: vendorProductKeys.list(vendorId, true),
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async (
      rows: Array<{
        name: string;
        sku: string;
        unit_type: string;
        unit_size: string;
        price: string;
      }>,
    ) => {
      const res = await vendorProductApi.import(vendorId, rows);
      return (await res.json()) as ImportResult;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId),
      });
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId, true),
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function resetState() {
    setStep("upload");
    setParsedRows([]);
    setImportResult(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = PRODUCT_CSV_TEMPLATE_URL;
    a.download = PRODUCT_CSV_TEMPLATE_FILENAME;
    a.click();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }
    setFileName(file.name);
    const existingSkus = new Set(existingProducts.map((p) => p.sku));
    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target?.result as string;
      const cleaned = raw
        .split("\n")
        .filter((line) => !line.startsWith("#"))
        .join("\n");
      Papa.parse(cleaned, {
        header: true,
        skipEmptyLines: "greedy",
        complete: (result) => {
          const rows: ParsedRow[] = [];
          const seenSkus = new Set<string>();
          for (let i = 0; i < result.data.length; i++) {
            const rawRow = result.data[i] as Record<string, string>;
            const errors: string[] = [];
            const name = (rawRow.name || "").trim();
            const sku = (rawRow.sku || "").trim();
            const unit_type = (rawRow.unit_type || "").trim();
            const unit_size = (rawRow.unit_size || "").trim();
            const price = (rawRow.price || "").trim();
            if (!name && !sku && !unit_type && !unit_size && !price) {
              errors.push("Blank row");
            } else {
              if (!name) errors.push("Name is required");
              if (!unit_type) errors.push("Unit type is required");
              else if (!VALID_UNIT_TYPES.includes(unit_type.toLowerCase())) {
                errors.push(
                  `Invalid unit type "${unit_type}". Valid: ${VALID_UNIT_TYPES.join(", ")}`,
                );
              }
              if (!unit_size) errors.push("Unit size is required");
              if (!price) errors.push("Price is required");
              else if (!/^\d+(\.\d{1,2})?$/.test(price))
                errors.push("Price must be a valid number (e.g. 12.99)");
              if (sku) {
                if (seenSkus.has(sku.toUpperCase()))
                  errors.push(`Duplicate SKU "${sku}" within this file`);
                if (existingSkus.has(sku))
                  errors.push(`SKU "${sku}" already exists for this vendor`);
              }
            }
            if (sku && errors.length === 0) seenSkus.add(sku.toUpperCase());
            rows.push({
              name,
              sku,
              unit_type,
              unit_size,
              price,
              rowNum: i + 1,
              errors,
            });
          }
          if (rows.length === 0) {
            toast({
              title: "Empty file",
              description: "The CSV file contains no data rows.",
              variant: "destructive",
            });
            return;
          }
          const requiredHeaders = [
            "name",
            "sku",
            "unit_type",
            "unit_size",
            "price",
          ];
          const actualHeaders = result.meta.fields || [];
          const missingHeaders = requiredHeaders.filter(
            (h) => !actualHeaders.includes(h),
          );
          if (missingHeaders.length > 0) {
            toast({
              title: "Invalid CSV format",
              description: `Missing columns: ${missingHeaders.join(", ")}`,
              variant: "destructive",
            });
            return;
          }
          setParsedRows(rows);
          setStep("preview");
        },
        error: () =>
          toast({
            title: "Parse error",
            description: "Failed to parse the CSV file.",
            variant: "destructive",
          }),
      });
    };
    reader.onerror = () =>
      toast({
        title: "File read error",
        description: "Could not read the file.",
        variant: "destructive",
      });
    reader.readAsText(file);
  }

  function handleConfirmImport() {
    if (validCount === 0) {
      toast({
        title: "No valid rows",
        description: "All rows have errors. Fix the CSV and try again.",
        variant: "destructive",
      });
      return;
    }
    const allRows = parsedRows.map((r) => ({
      name: r.name,
      sku: r.sku,
      unit_type: r.unit_type,
      unit_size: r.unit_size,
      price: r.price,
      _rowNum: r.rowNum,
      _clientErrors: r.errors,
    }));
    importMutation.mutate(allRows as any);
  }

  const validCount = parsedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = parsedRows.filter((r) => r.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] flex flex-col"
        data-testid="dialog-csv-import"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {step === "upload" && "Import Products from CSV"}
            {step === "preview" && "Preview Import"}
            {step === "done" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV file to bulk-add products to your catalog."}
            {step === "preview" &&
              "Review the rows below before confirming the import."}
            {step === "done" && "Here's a summary of the import results."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-2">
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-muted-foreground" />
                CSV Template
              </h4>
              <ul className="text-xs text-muted-foreground mb-3 space-y-1 list-disc list-inside">
                <li>
                  Required columns:{" "}
                  <span className="font-mono">
                    name, sku, unit_type, unit_size, price
                  </span>
                </li>
                <li>One product per row</li>
                <li>Replace or delete the example row before uploading</li>
                <li>Price must be a number (e.g. 12.50)</li>
                <li>Imported products default to In Stock</li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                data-testid="button-download-template"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download Template
              </Button>
            </div>
            <div className="border rounded-lg p-4 border-dashed">
              <div className="flex flex-col items-center justify-center py-4">
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Upload your CSV file</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Only .csv files are supported
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-csv-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-file"
                >
                  Choose File
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{fileName}</span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <Badge
                  variant="secondary"
                  className="gap-1"
                  data-testid="badge-valid-count"
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {validCount} valid
                </Badge>
                {errorCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-destructive"
                    data-testid="badge-error-count"
                  >
                    <XCircle className="h-3 w-3" />
                    {errorCount} errors
                  </Badge>
                )}
              </div>
            </div>
            <div className="overflow-auto flex-1 border rounded-md max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[50px] font-medium">Row</TableHead>
                    <TableHead className="font-medium">Name</TableHead>
                    <TableHead className="font-medium">SKU</TableHead>
                    <TableHead className="font-medium">Unit Type</TableHead>
                    <TableHead className="font-medium">Unit Size</TableHead>
                    <TableHead className="font-medium">Price</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow
                      key={row.rowNum}
                      className={
                        row.errors.length > 0 ? "bg-destructive/5" : ""
                      }
                      data-testid={`row-preview-${row.rowNum}`}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {row.rowNum}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.name || (
                          <span className="text-muted-foreground italic">
                            empty
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.sku || (
                          <span className="text-muted-foreground italic">
                            empty
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.unit_type || (
                          <span className="text-muted-foreground italic">
                            empty
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.unit_size || (
                          <span className="text-muted-foreground italic">
                            empty
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.price || (
                          <span className="text-muted-foreground italic">
                            empty
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <CheckCircle2
                            className="h-4 w-4 text-emerald-600"
                            data-testid={`status-valid-${row.rowNum}`}
                          />
                        ) : (
                          <div
                            className="space-y-0.5"
                            data-testid={`status-error-${row.rowNum}`}
                          >
                            {row.errors.map((err, idx) => (
                              <p
                                key={idx}
                                className="text-xs text-destructive flex items-start gap-1"
                              >
                                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                {err}
                              </p>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetState}
                data-testid="button-back-to-upload"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={validCount === 0 || importMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending
                  ? "Importing…"
                  : `Import ${validCount} Product${validCount !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">
                  {importResult.summary.total}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total rows
                </p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p
                  className="text-2xl font-bold text-emerald-600"
                  data-testid="text-import-imported"
                >
                  {importResult.summary.imported}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Imported</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p
                  className="text-2xl font-bold text-destructive"
                  data-testid="text-import-rejected"
                >
                  {importResult.summary.rejected}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Rejected</p>
              </div>
            </div>
            {importResult.results.filter((r) => r.status === "rejected")
              .length > 0 && (
              <div className="border rounded-md overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-medium">Row</TableHead>
                      <TableHead className="font-medium">Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.results
                      .filter((r) => r.status === "rejected")
                      .map((r) => (
                        <TableRow key={r.row} className="bg-destructive/5">
                          <TableCell className="text-sm">{r.row}</TableCell>
                          <TableCell className="text-xs text-destructive">
                            {r.errors?.join(", ")}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={resetState}
                data-testid="button-import-again"
              >
                Import More
              </Button>
              <Button
                onClick={() => handleClose(false)}
                data-testid="button-done-import"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Vendor Portal Page ──────────────────────────────────────────────────

function DashboardMetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  onClick,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`rounded-lg border-border bg-card shadow-sm ${
        onClick
          ? "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : ""
      }`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={`card-dashboard-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={`rounded-md p-2 ${iconClassName}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {onClick ? (
          <p className="mt-2 text-[11px] font-medium text-primary/80">
            Click to view details
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function VendorPortal() {
  const { vendorId, logout } = useVendorAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const portalNav = useVendorPortalNav();

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [archivingProduct, setArchivingProduct] = useState<Product | null>(
    null,
  );
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [restaurantsExpanded, setRestaurantsExpanded] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<
    Record<string, boolean>
  >({});
  const [submittedVpExpanded, setSubmittedVpExpanded] = useState(false);
  const [deliveredVpExpanded, setDeliveredVpExpanded] = useState(false);
  const [approvalExpanded, setApprovalExpanded] = useState(false);
  const [disputedExpanded, setDisputedExpanded] = useState(true);
  const [invoicedExpanded, setInvoicedExpanded] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [dateRange, setDateRange] = useState("all-time");
  const [stockFilter, setStockFilter] = useState<
    "all" | "Dry" | "Refrigerated" | "Frozen"
  >("all");

  useEffect(() => {
    if (!vendorId) navigate("/vendor/login");
  }, [vendorId, navigate]);

  const scrollToSection = useCallback((sectionId: VendorSectionId) => {
    switch (sectionId) {
      case VENDOR_SECTION_IDS.restaurants:
        setRestaurantsExpanded(true);
        break;
      case VENDOR_SECTION_IDS.submitted:
        setSubmittedVpExpanded(true);
        break;
      case VENDOR_SECTION_IDS.delivered:
        setDeliveredVpExpanded(true);
        break;
      case VENDOR_SECTION_IDS.approval:
        setApprovalExpanded(true);
        break;
      case VENDOR_SECTION_IDS.disputed:
        setDisputedExpanded(true);
        break;
      case VENDOR_SECTION_IDS.invoiced:
        setInvoicedExpanded(true);
        break;
      case VENDOR_SECTION_IDS.orders:
        setOrdersExpanded(true);
        break;
      case VENDOR_SECTION_IDS.products:
        setProductsExpanded(true);
        break;
      default:
        break;
    }
    window.setTimeout(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  useEffect(() => {
    portalNav?.registerScrollToSection(scrollToSection);
  }, [portalNav, scrollToSection]);

  const { data: vendor, isLoading: vendorLoading } = useQuery<Vendor>({
    queryKey: vendorKeys.detail(vendorId),
    enabled: !!vendorId,
  });

  const { data: allRelationships = [] } = useQuery<
    VendorRestaurantRelationship[]
  >({
    queryKey: relationshipKeys.all(),
    enabled: !!vendorId,
  });

  const { data: allRestaurants = [] } = useQuery<RestaurantOrg[]>({
    queryKey: restaurantOrgKeys.list(),
    enabled: !!vendorId,
  });

  const productsQueryKey = showArchived
    ? vendorProductKeys.list(vendorId!, true)
    : vendorProductKeys.list(vendorId!);

  const { data: products = [], isLoading: productsLoading } = useQuery<
    Product[]
  >({
    queryKey: productsQueryKey,
    enabled: !!vendorId,
  });

  type EnrichedLineItem = OrderLineItem & {
    productName: string;
    sku: string | null;
  };
  type VendorOrderEntry = {
    order: Order;
    lineItems: EnrichedLineItem[];
    restaurantName: string;
    fulfillments: LineFulfillment[];
    invoice: Invoice | null;
  };
  const { data: rawVendorOrders = [], isLoading: ordersLoading } = useQuery<
    VendorOrderEntry[]
  >({
    queryKey: vendorOrderKeys.list(vendorId!),
    enabled: !!vendorId,
  });

  const currentUser = getUserData();
  const currentRole = getUserRole() ?? currentUser?.role;
  const isSalesRepresentative = currentRole === "sales_representative";
  const isWarehouseWorker =
    currentRole === "warehouse" || currentRole === "warehouse_worker";
  const currentUserId = currentUser?.id ? String(currentUser.id) : null;

  const vendorOrders = rawVendorOrders.filter(({ order }) => {
    if (currentRole === "driver") {
      return order.driverId === currentUserId;
    }
    if (isWarehouseWorker) {
      return order.warehouseWorkerId === currentUserId;
    }
    return true;
  });

  const warehouseActiveOrders = vendorOrders.filter(({ order }) =>
    isWarehouseActiveOrder(order, currentUserId),
  );
  const warehouseSubmittedOrders = vendorOrders.filter(({ order }) =>
    isWarehouseSubmittedOrder(order, currentUserId),
  );

  const submittedVpOrders = vendorOrders.filter(
    ({ order }) => order.status === "submitted" && !isDisputedOrder(order),
  );
  const deliveredVpOrders = vendorOrders.filter(
    ({ order }) =>
      order.status === "delivered" &&
      !order.restaurantReviewSubmittedAt &&
      !isDisputedOrder(order),
  );
  const needsApprovalOrders = vendorOrders.filter(
    ({ order }) =>
      order.restaurantIssueStatus === "pending_vendor" &&
      !isDisputedOrder(order) &&
      order.status !== "invoiced" &&
      order.status !== "paid",
  );
  const disputedVpOrders = vendorOrders.filter(({ order }) => isDisputedOrder(order));
  const invoicedOrders = vendorOrders.filter(
    ({ order }) => (order.status === "invoiced" || order.restaurantIssueStatus === "resolved_by_driver") && !order.paidAt,
  );
  const historyOrders = vendorOrders
    .filter(({ order }) => !!order.paidAt)
    .sort(
      (a, b) =>
        new Date(b.order.paidAt!).getTime() -
        new Date(a.order.paidAt!).getTime(),
    );
  const getOrderTotal = (entry: VendorOrderEntry) => {
    if (entry.invoice?.approvedTotal) {
      return parseFloat(entry.invoice.approvedTotal);
    }

    return entry.lineItems.reduce(
      (sum, item) =>
        sum + Number(item.quantity) * Number(item.unitPriceAtTimeOfOrder),
      0,
    );
  };
  const paidRevenue = historyOrders.reduce(
    (sum, entry) => sum + getOrderTotal(entry),
    0,
  );
  const unfulfilledRevenue = submittedVpOrders.reduce(
    (sum, entry) => sum + getOrderTotal(entry),
    0,
  );

  const ORDER_STATUS_CONFIG: Record<
    string,
    { label: string; classes: string }
  > = {
    draft: {
      label: "Draft",
      classes:
        "bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400",
    },
    submitted: {
      label: "Submitted",
      classes:
        "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    delivered: {
      label: "Delivered",
      classes:
        "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    },
    pending_driver: {
      label: "Needs Driver Review",
      classes:
        "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    pending_vendor: {
      label: "Needs Vendor Review",
      classes:
        "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    },
    resolved_by_driver: {
      label: "Resolved by Driver",
      classes:
        "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    },
    invoiced: {
      label: "Invoiced",
      classes:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    disputed: {
      label: "Disputed",
      classes:
        "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    },
  };

  const archiveMutation = useMutation({
    mutationFn: async (productId: string) => {
      await vendorProductApi.archive(vendorId, productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId!),
      });
      queryClient.invalidateQueries({
        queryKey: vendorProductKeys.list(vendorId!, true),
      });
      setArchivingProduct(null);
      toast({ title: "Product archived" });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const vendorRelationships = allRelationships.filter(
    (r) => r.vendorId === vendorId && r.status !== "archived",
  );
  const restaurantMap = new Map(allRestaurants.map((r) => [r.id, r]));

  useEffect(() => {
    if (!portalNav || !vendorId) return;
    portalNav.setCounts({
      restaurants: vendorRelationships.length,
      submitted: submittedVpOrders.length,
      delivered: deliveredVpOrders.length,
      approval: needsApprovalOrders.length,
      disputed: disputedVpOrders.length,
      invoiced: invoicedOrders.length,
      orders: historyOrders.length,
      products: products.length,
    });
  }, [
    portalNav,
    vendorId,
    vendorRelationships.length,
    submittedVpOrders.length,
    deliveredVpOrders.length,
    needsApprovalOrders.length,
    disputedVpOrders.length,
    invoicedOrders.length,
    historyOrders.length,
    products.length,
  ]);

  useEffect(() => {
    if (vendorLoading || !vendor) return;
    const hash = window.location.hash.replace("#", "") as VendorSectionId;
    if (Object.values(VENDOR_SECTION_IDS).includes(hash)) {
      portalNav?.scrollToSection(hash);
    }
  }, [vendorLoading, vendor, portalNav]);

  const isFiltering =
    productSearch.trim() !== "" ||
    statusFilter !== "all" ||
    stockFilter !== "all";
  const filteredProducts = isFiltering
    ? products.filter((p) => {
        const q = productSearch.trim().toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all" || p.status === statusFilter;
        const matchesStock =
          stockFilter === "all" || p.stockType === stockFilter;
        return matchesSearch && matchesStatus && matchesStock;
      })
    : products;

  function handleAddProduct() {
    setEditingProduct(null);
    setProductDialogOpen(true);
  }

  function handleEditProduct(product: Product) {
    setEditingProduct(product);
    setProductDialogOpen(true);
  }

  function handleExportCsv() {
    const rows = products.map((p) => ({
      name: p.name,
      sku: p.sku ?? "",
      stock: p.stockType ?? "",
      unit_type: p.unitType,
      unit_size: p.unitSize,
      price: p.price,
      status:
        p.status === "active"
          ? "In Stock"
          : p.status === "inactive"
            ? "Out of Stock"
            : "Archived",
    }));
    const csv = Papa.unparse(rows, { header: true });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (vendor?.name ?? "vendor")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase();
    link.href = url;
    link.download = `${safeName}-catalog.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!vendorId) return null;

  if (vendorLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[50vh]">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Vendor not found. Please sign out and try again.
        </p>
        <Button
          variant="outline"
          onClick={logout}
          data-testid="button-exit-portal-error"
        >
          Exit Portal
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div id={VENDOR_SECTION_IDS.dashboard} className="scroll-mt-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isWarehouseWorker
                ? "A snapshot of your assigned picking activity."
                : "A snapshot of your current activity and revenue."}
            </p>
          </div>
          <div className="hidden items-center gap-3 text-sm text-muted-foreground sm:flex">
            <CalendarDays className="h-4 w-4" />
            <span>Date Range</span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-10 w-44 rounded-md bg-background px-4 text-sm font-normal text-foreground shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="end"
                className="w-44 rounded-md border-border bg-popover p-1 shadow-md"
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="h-9 rounded-sm text-sm"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Order Activity
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {!isWarehouseWorker ? (
              <DashboardMetricCard
                title="Active Restaurants"
                value={vendorRelationships.length}
                description="Linked restaurants"
                icon={UtensilsCrossed}
                iconClassName="bg-orange-100 text-orange-500"
                onClick={() => navigate("/vendor/relationships")}
              />
            ) : null}
            {isWarehouseWorker ? (
              <>
                <DashboardMetricCard
                  title="Active Orders"
                  value={warehouseActiveOrders.length}
                  description="Assigned and in progress"
                  icon={Package}
                  iconClassName="bg-orange-100 text-orange-500"
                  onClick={() => navigate("/vendor/orders?section=submitted")}
                />
                <DashboardMetricCard
                  title="Submitted Orders"
                  value={warehouseSubmittedOrders.length}
                  description="Awaiting manager review"
                  icon={ClipboardList}
                  iconClassName="bg-blue-100 text-blue-500"
                  onClick={() => navigate("/vendor/orders?section=picking-submitted")}
                />
              </>
            ) : null}
            {!isWarehouseWorker && !isSalesRepresentative ? (
              <>
                <DashboardMetricCard
                  title="Submitted Orders"
                  value={submittedVpOrders.length}
                  description="Awaiting delivery"
                  icon={Inbox}
                  iconClassName="bg-blue-100 text-blue-500"
                  onClick={() => navigate("/vendor/orders?section=submitted")}
                />
                <DashboardMetricCard
                  title="Delivered"
                  value={deliveredVpOrders.length}
                  description="Restaurant reviewing"
                  icon={Package}
                  iconClassName="bg-slate-100 text-slate-500"
                  onClick={() => navigate("/vendor/orders?section=delivered")}
                />
                <DashboardMetricCard
                  title="Needs Approval"
                  value={needsApprovalOrders.length}
                  description="Restaurant review or driver resolution"
                  icon={ShieldCheck}
                  iconClassName="bg-violet-100 text-violet-500"
                  onClick={() => navigate("/vendor/orders?section=approval")}
                />
              </>
            ) : null}
          </div>
        </section>

        {!isWarehouseWorker ? (
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Revenue
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard
              title="Invoiced Orders"
              value={invoicedOrders.length}
              description="Approved, awaiting payment"
              icon={CreditCard}
              iconClassName="bg-teal-100 text-teal-500"
              onClick={() => navigate("/vendor/orders?section=invoiced")}
            />
            <DashboardMetricCard
              title="Paid Revenue"
              value={formatCurrency(String(paidRevenue.toFixed(2)))}
              description="Total collected"
              icon={DollarSign}
              iconClassName="bg-emerald-100 text-emerald-500"
              onClick={() => navigate("/vendor/orders?section=history")}
            />
            <DashboardMetricCard
              title="Unfulfilled Revenue"
              value={formatCurrency(String(unfulfilledRevenue.toFixed(2)))}
              description="Ordered vs. approved gap"
              icon={TrendingUp}
              iconClassName="bg-rose-100 text-rose-500"
              onClick={() => navigate("/vendor/orders?section=submitted")}
            />
          </div>
        </section>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div>
        {/* Dashboard */}
        <div id={VENDOR_SECTION_IDS.dashboard} className="scroll-mt-6 mb-8">
          <h1
            className="text-2xl font-bold tracking-tight text-foreground mb-1"
            data-testid="text-portal-company-name"
          >
            {vendor.name}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your vendor portal — manage your product catalog and view your
            linked restaurants.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <UserCircle className="h-4 w-4" />
                  Contact
                </div>
                <p
                  className="font-medium text-foreground"
                  data-testid="text-portal-contact"
                >
                  {vendor.contactName}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <p
                  className="font-medium text-foreground truncate"
                  data-testid="text-portal-email"
                >
                  {vendor.email}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <p
                  className="font-medium text-foreground"
                  data-testid="text-portal-phone"
                >
                  {formatPhone(vendor.phone)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div id={VENDOR_SECTION_IDS.settings} className="scroll-mt-6 mb-8">
          <CutoffSettingsPanel
            vendorId={vendor.id}
            title="Cutoff Settings"
            description="Control when orders lock and what reminder message vendors see."
          />
        </div>

        {/* Linked Restaurants */}
        <div
          id={VENDOR_SECTION_IDS.restaurants}
          className="scroll-mt-6 border rounded-lg bg-card overflow-hidden mb-6"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setRestaurantsExpanded(!restaurantsExpanded)}
            data-testid="button-toggle-restaurants"
          >
            <div className="flex items-center gap-2">
              {restaurantsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                My Restaurants
              </h2>
              <Badge
                variant="secondary"
                className="text-xs"
                data-testid="text-restaurant-count"
              >
                {vendorRelationships.length}
              </Badge>
            </div>
          </div>
          {restaurantsExpanded &&
            (vendorRelationships.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 px-4"
                data-testid="empty-state-restaurants"
              >
                <UtensilsCrossed className="h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No linked restaurants yet.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-medium">Restaurant</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium">Contact</TableHead>
                    <TableHead className="font-medium">Email</TableHead>
                    <TableHead className="font-medium">Phone</TableHead>
                    <TableHead className="font-medium">Linked Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorRelationships.map((rel) => {
                    const restaurant = restaurantMap.get(rel.restaurantOrgId);
                    if (!restaurant) return null;
                    return (
                      <TableRow
                        key={rel.id}
                        data-testid={`row-restaurant-${rel.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                              <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span
                              className="font-medium"
                              data-testid={`text-restaurant-name-${rel.id}`}
                            >
                              {restaurant.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs capitalize ${
                              rel.status === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                            data-testid={`text-relationship-status-${rel.id}`}
                          >
                            {rel.status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          data-testid={`text-restaurant-contact-${rel.id}`}
                        >
                          {restaurant.contactName}
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          data-testid={`text-restaurant-email-${rel.id}`}
                        >
                          <a
                            href={`mailto:${restaurant.email}`}
                            className="hover:text-foreground hover:underline transition-colors"
                          >
                            {restaurant.email}
                          </a>
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          data-testid={`text-restaurant-phone-${rel.id}`}
                        >
                          {formatPhone(restaurant.phone)}
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground"
                          data-testid={`text-relationship-since-${rel.id}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {formatDate(rel.createdAt)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ))}
        </div>

        {/* Submitted Orders — awaiting delivery by vendor */}
        <div
          id={VENDOR_SECTION_IDS.submitted}
          className="scroll-mt-6 border border-orange-200 dark:border-orange-800 rounded-lg bg-card overflow-hidden"
          data-testid="section-vp-submitted"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors bg-orange-50/30 dark:bg-orange-950/10"
            onClick={() => setSubmittedVpExpanded(!submittedVpExpanded)}
            data-testid="button-toggle-vp-submitted"
          >
            <div className="flex items-center gap-2">
              {submittedVpExpanded ? (
                <ChevronDown className="h-4 w-4 text-orange-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-orange-500" />
              )}
              <Inbox className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                Submitted Orders
              </h2>
              <Badge
                className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200 dark:border-orange-700"
                data-testid="text-vp-submitted-count"
              >
                {ordersLoading ? "…" : submittedVpOrders.length}
              </Badge>
              <span className="text-xs text-muted-foreground ml-1">
                Awaiting delivery
              </span>
            </div>
          </div>
          {submittedVpExpanded && (
            <div className="border-t border-orange-100 dark:border-orange-900">
              {ordersLoading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : submittedVpOrders.length === 0 ? (
                <div
                  className="px-5 py-10 flex flex-col items-center gap-2 text-muted-foreground"
                  data-testid="text-vp-submitted-empty"
                >
                  <Inbox className="h-8 w-8 opacity-30" />
                  <p className="text-sm">
                    No submitted orders awaiting delivery
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-medium">
                        Restaurant
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Order ID
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Items
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Total
                      </TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submittedVpOrders.map(
                      ({ order, lineItems, restaurantName }) => {
                        const isExpanded = !!expandedOrderIds[order.id];
                        const total = lineItems.reduce(
                          (sum, li) =>
                            sum +
                            parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity,
                          0,
                        );
                        return (
                          <Fragment key={order.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-orange-50/20 dark:hover:bg-orange-950/10"
                              onClick={() =>
                                setExpandedOrderIds((prev) => ({
                                  ...prev,
                                  [order.id]: !prev[order.id],
                                }))
                              }
                              data-testid={`row-vp-submitted-order-${order.id}`}
                            >
                              <TableCell className="w-8 py-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell
                                className="py-3 font-medium text-sm"
                                data-testid={`text-vp-submitted-restaurant-${order.id}`}
                              >
                                {restaurantName}
                              </TableCell>
                              <TableCell
                                className="py-3 text-xs font-medium text-foreground"
                                data-testid={`text-vp-submitted-display-id-${order.id}`}
                              >
                                #{order.displayId ?? "—"}
                              </TableCell>
                              <TableCell className="py-3 text-sm text-muted-foreground">
                                {order.createdAt
                                  ? new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className="py-3"
                                data-testid={`text-vp-submitted-status-${order.id}`}
                              >
                                <Badge
                                  className={`text-xs ${ORDER_STATUS_CONFIG.submitted.classes}`}
                                >
                                  {ORDER_STATUS_CONFIG.submitted.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 text-sm text-right text-muted-foreground">
                                {lineItems.length}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm font-semibold text-right"
                                data-testid={`text-vp-submitted-total-${order.id}`}
                              >
                                {formatCurrency(total)}
                              </TableCell>
                              <TableCell
                                className="py-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    navigate(`/vendor/orders/${order.id}`)
                                  }
                                  data-testid={`button-vp-submitted-view-${order.id}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow
                                key={`${order.id}-detail`}
                                className="bg-orange-50/10 hover:bg-orange-50/10 dark:bg-orange-950/10"
                              >
                                <TableCell colSpan={8} className="py-0 pb-4">
                                  <div className="pl-8 pr-4 pt-3">
                                    <table
                                      className="w-full text-xs"
                                      data-testid={`table-vp-submitted-detail-${order.id}`}
                                    >
                                      <thead>
                                        <tr className="text-muted-foreground border-b">
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            Product
                                          </th>
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            SKU
                                          </th>
                                          <th className="text-right font-medium pb-1.5 pr-2">
                                            Qty
                                          </th>
                                          <th className="text-right font-medium pb-1.5">
                                            Price
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lineItems.map((li) => (
                                          <tr
                                            key={li.id}
                                            className="border-b border-border/40 last:border-0"
                                            data-testid={`row-vp-submitted-lineitem-${li.id}`}
                                          >
                                            <td className="py-2 pr-2 text-foreground font-medium">
                                              {li.productName}
                                            </td>
                                            <td className="py-2 pr-2 text-muted-foreground font-mono">
                                              {li.sku ?? "—"}
                                            </td>
                                            <td className="py-2 pr-2 text-right text-muted-foreground">
                                              {li.quantity}
                                            </td>
                                            <td className="py-2 text-right text-muted-foreground">
                                              {formatCurrency(
                                                li.unitPriceAtTimeOfOrder,
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr>
                                          <td colSpan={2} />
                                          <td className="pt-2 text-right text-muted-foreground font-medium">
                                            Total
                                          </td>
                                          <td className="pt-2 text-right font-bold text-foreground">
                                            {formatCurrency(
                                              String(total.toFixed(2)),
                                            )}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>

        {/* Delivered — awaiting restaurant review */}
        <div
          id={VENDOR_SECTION_IDS.delivered}
          className="scroll-mt-6 border border-green-200 dark:border-green-800 rounded-lg bg-card overflow-hidden"
          data-testid="section-vp-delivered"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors bg-green-50/30 dark:bg-green-950/10"
            onClick={() => setDeliveredVpExpanded(!deliveredVpExpanded)}
            data-testid="button-toggle-vp-delivered"
          >
            <div className="flex items-center gap-2">
              {deliveredVpExpanded ? (
                <ChevronDown className="h-4 w-4 text-green-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-green-500" />
              )}
              <Package className="h-4 w-4 text-green-500" />
              <h2 className="text-sm font-semibold text-green-700 dark:text-green-300">
                Delivered
              </h2>
              <Badge
                className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-700"
                data-testid="text-vp-delivered-count"
              >
                {ordersLoading ? "…" : deliveredVpOrders.length}
              </Badge>
              <span className="text-xs text-muted-foreground ml-1">
                Awaiting restaurant review
              </span>
            </div>
          </div>
          {deliveredVpExpanded && (
            <div className="border-t border-green-100 dark:border-green-900">
              {ordersLoading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : deliveredVpOrders.length === 0 ? (
                <div
                  className="px-5 py-10 flex flex-col items-center gap-2 text-muted-foreground"
                  data-testid="text-vp-delivered-empty"
                >
                  <Package className="h-8 w-8 opacity-30" />
                  <p className="text-sm">
                    No delivered orders awaiting restaurant review
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-medium">
                        Restaurant
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Order ID
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Items
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Total
                      </TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveredVpOrders.map(
                      ({ order, lineItems, restaurantName }) => {
                        const isExpanded = !!expandedOrderIds[order.id];
                        const total = lineItems.reduce(
                          (sum, li) =>
                            sum +
                            parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity,
                          0,
                        );
                        return (
                          <Fragment key={order.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-green-50/20 dark:hover:bg-green-950/10"
                              onClick={() =>
                                setExpandedOrderIds((prev) => ({
                                  ...prev,
                                  [order.id]: !prev[order.id],
                                }))
                              }
                              data-testid={`row-vp-delivered-order-${order.id}`}
                            >
                              <TableCell className="w-8 py-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell
                                className="py-3 font-medium text-sm"
                                data-testid={`text-vp-delivered-restaurant-${order.id}`}
                              >
                                {restaurantName}
                              </TableCell>
                              <TableCell
                                className="py-3 text-xs font-medium text-foreground"
                                data-testid={`text-vp-delivered-display-id-${order.id}`}
                              >
                                #{order.displayId ?? "—"}
                              </TableCell>
                              <TableCell className="py-3 text-sm text-muted-foreground">
                                {order.createdAt
                                  ? new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className="py-3"
                                data-testid={`text-vp-delivered-status-${order.id}`}
                              >
                                <Badge
                                  className={`text-xs ${ORDER_STATUS_CONFIG.delivered.classes}`}
                                >
                                  {ORDER_STATUS_CONFIG.delivered.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 text-sm text-right text-muted-foreground">
                                {lineItems.length}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm font-semibold text-right"
                                data-testid={`text-vp-delivered-total-${order.id}`}
                              >
                                {formatCurrency(total)}
                              </TableCell>
                              <TableCell
                                className="py-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    navigate(`/vendor/orders/${order.id}`)
                                  }
                                  data-testid={`button-vp-delivered-view-${order.id}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow
                                key={`${order.id}-detail`}
                                className="bg-green-50/10 hover:bg-green-50/10 dark:bg-green-950/10"
                              >
                                <TableCell colSpan={8} className="py-0 pb-4">
                                  <div className="pl-8 pr-4 pt-3">
                                    <table
                                      className="w-full text-xs"
                                      data-testid={`table-vp-delivered-detail-${order.id}`}
                                    >
                                      <thead>
                                        <tr className="text-muted-foreground border-b">
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            Product
                                          </th>
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            SKU
                                          </th>
                                          <th className="text-right font-medium pb-1.5 pr-2">
                                            Qty
                                          </th>
                                          <th className="text-right font-medium pb-1.5">
                                            Price
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lineItems.map((li) => (
                                          <tr
                                            key={li.id}
                                            className="border-b border-border/40 last:border-0"
                                            data-testid={`row-vp-delivered-lineitem-${li.id}`}
                                          >
                                            <td className="py-2 pr-2 text-foreground font-medium">
                                              {li.productName}
                                            </td>
                                            <td className="py-2 pr-2 text-muted-foreground font-mono">
                                              {li.sku ?? "—"}
                                            </td>
                                            <td className="py-2 pr-2 text-right text-muted-foreground">
                                              {li.quantity}
                                            </td>
                                            <td className="py-2 text-right text-muted-foreground">
                                              {formatCurrency(
                                                li.unitPriceAtTimeOfOrder,
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr>
                                          <td colSpan={2} />
                                          <td className="pt-2 text-right text-muted-foreground font-medium">
                                            Total
                                          </td>
                                          <td className="pt-2 text-right font-bold text-foreground">
                                            {formatCurrency(
                                              String(total.toFixed(2)),
                                            )}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>

        {/* Invoiced / Review */}
        <div
          id={VENDOR_SECTION_IDS.approval}
          className="scroll-mt-6 border border-violet-200 dark:border-violet-800 rounded-lg bg-card overflow-hidden"
          data-testid="section-needs-approval"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors bg-violet-50/30 dark:bg-violet-950/10"
            onClick={() => setApprovalExpanded(!approvalExpanded)}
            data-testid="button-toggle-needs-approval"
          >
            <div className="flex items-center gap-2">
              {approvalExpanded ? (
                <ChevronDown className="h-4 w-4 text-violet-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-violet-500" />
              )}
              <AlertCircle className="h-4 w-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                Invoiced / Review
              </h2>
              <Badge
                className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-violet-200 dark:border-violet-700"
                data-testid="text-needs-approval-count"
              >
                {ordersLoading ? "…" : needsApprovalOrders.length}
              </Badge>
            </div>
          </div>
          {approvalExpanded && (
            <div className="border-t border-violet-100 dark:border-violet-900">
              {ordersLoading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : needsApprovalOrders.length === 0 ? (
                <div
                  className="px-5 py-10 flex flex-col items-center gap-2 text-muted-foreground"
                  data-testid="text-needs-approval-empty"
                >
                  <CheckCircle2 className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No invoice-ready reviews</p>
                </div>
              ) : (
                <div>
                  {needsApprovalOrders.map(
                    ({
                      order,
                      lineItems,
                      restaurantName,
                      fulfillments = [],
                    }) => {
                      const fulfillmentMap = new Map(
                        (fulfillments ?? []).map((f) => [f.orderLineItemId, f]),
                      );
                      const reviewedTotal = lineItems.reduce((sum, li) => {
                        const f = fulfillmentMap.get(li.id);
                        const qty = f?.restaurantReceivedQty ?? li.quantity;
                        return (
                          sum + parseFloat(li.unitPriceAtTimeOfOrder) * qty
                        );
                      }, 0);
                      return (
                        <div
                          key={order.id}
                          className="border-b border-violet-100 dark:border-violet-900 last:border-0"
                          data-testid={`section-approval-order-${order.id}`}
                        >
                          <div
                            className="px-5 py-3 flex items-center gap-3"
                            data-testid={`row-approval-order-${order.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-medium"
                                  data-testid={`text-approval-restaurant-${order.id}`}
                                >
                                  {restaurantName}
                                </span>
                                <span
                                  className="text-xs font-medium text-foreground"
                                  data-testid={`text-approval-order-id-${order.id}`}
                                >
                                  #{order.displayId ?? "—"}
                                </span>
                                <Badge className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-700">
                                  Invoiced
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {order.createdAt
                                  ? new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                                {" · "}
                                <span>
                                  {lineItems.length} item
                                  {lineItems.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 ml-auto shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="text-xs text-muted-foreground">
                                  Reviewed Total
                                </div>
                                <div
                                  className="text-sm font-semibold text-violet-700 dark:text-violet-300"
                                  data-testid={`text-approval-reviewed-total-${order.id}`}
                                >
                                  {formatCurrency(
                                    String(reviewedTotal.toFixed(2)),
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1"
                                onClick={() =>
                                  navigate(`/vendor/orders/${order.id}/approve`)
                                }
                                data-testid={`button-view-approve-order-${order.id}`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                View Invoice
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Disputed — vendor rejected restaurant's review */}
        <div
          id={VENDOR_SECTION_IDS.disputed}
          className="scroll-mt-6 border border-red-200 dark:border-red-800 rounded-lg bg-card overflow-hidden"
          data-testid="section-vp-disputed"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors bg-red-50/30 dark:bg-red-950/10"
            onClick={() => setDisputedExpanded(!disputedExpanded)}
            data-testid="button-toggle-vp-disputed"
          >
            <div className="flex items-center gap-2">
              {disputedExpanded ? (
                <ChevronDown className="h-4 w-4 text-red-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-red-500" />
              )}
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
                Disputed Orders
              </h2>
              <Badge
                className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-200 dark:border-red-700"
                data-testid="text-vp-disputed-count"
              >
                {ordersLoading ? "…" : disputedVpOrders.length}
              </Badge>
              <span className="text-xs text-muted-foreground ml-1">
                Review rejected by you
              </span>
            </div>
          </div>
          {disputedExpanded && (
            <div className="border-t border-red-100 dark:border-red-900">
              {ordersLoading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : disputedVpOrders.length === 0 ? (
                <div
                  className="px-5 py-10 flex flex-col items-center gap-2 text-muted-foreground"
                  data-testid="text-vp-disputed-empty"
                >
                  <ShieldAlert className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No disputed orders</p>
                </div>
              ) : (
                <div>
                  {disputedVpOrders.map(
                    ({ order, lineItems, restaurantName }) => {
                      const total = lineItems.reduce(
                        (sum, li) =>
                          sum +
                          parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity,
                        0,
                      );
                      return (
                        <div
                          key={order.id}
                          className="border-b border-red-100 dark:border-red-900 last:border-0"
                          data-testid={`section-vp-disputed-order-${order.id}`}
                        >
                          <div
                            className="px-5 py-3 flex items-center gap-3"
                            data-testid={`row-vp-disputed-order-${order.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-sm font-medium"
                                  data-testid={`text-vp-disputed-restaurant-${order.id}`}
                                >
                                  {restaurantName}
                                </span>
                                <span
                                  className="text-xs font-medium text-foreground"
                                  data-testid={`text-vp-disputed-order-id-${order.id}`}
                                >
                                  #{order.displayId ?? "—"}
                                </span>
                                <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700">
                                  Disputed
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {order.createdAt
                                  ? new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                                {" · "}
                                <span>
                                  {lineItems.length} item
                                  {lineItems.length !== 1 ? "s" : ""}
                                </span>
                                {" · "}
                                <span className="font-medium">
                                  {formatCurrency(String(total.toFixed(2)))}
                                </span>
                              </div>
                              {order.vendorRejectionReason && (
                                <div className="mt-1.5 flex items-start gap-1.5">
                                  <span className="text-xs text-red-600 dark:text-red-400 font-medium shrink-0">
                                    Your rejection reason:
                                  </span>
                                  <span
                                    className="text-xs text-red-700 dark:text-red-300"
                                    data-testid={`text-vp-dispute-reason-${order.id}`}
                                  >
                                    {order.vendorRejectionReason}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 ml-auto shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                                onClick={() =>
                                  navigate(`/vendor/orders/${order.id}/approve`)
                                }
                                data-testid={`button-vp-view-disputed-${order.id}`}
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                                View Dispute
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invoiced — vendor approved, awaiting payment from restaurant */}
        <div
          id={VENDOR_SECTION_IDS.invoiced}
          className="scroll-mt-6 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-card overflow-hidden"
          data-testid="section-invoiced"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors bg-emerald-50/30 dark:bg-emerald-950/10"
            onClick={() => setInvoicedExpanded(!invoicedExpanded)}
            data-testid="button-toggle-invoiced"
          >
            <div className="flex items-center gap-2">
              {invoicedExpanded ? (
                <ChevronDown className="h-4 w-4 text-emerald-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-emerald-500" />
              )}
              <CreditCard className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Invoiced
              </h2>
              <Badge
                className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700"
                data-testid="text-invoiced-count"
              >
                {ordersLoading ? "…" : invoicedOrders.length}
              </Badge>
              <span className="text-xs text-muted-foreground ml-1">
                Awaiting payment from restaurant
              </span>
            </div>
          </div>
          {invoicedExpanded && (
            <div className="border-t border-emerald-100 dark:border-emerald-900">
              {ordersLoading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : invoicedOrders.length === 0 ? (
                <div
                  className="px-5 py-8 flex flex-col items-center gap-2 text-muted-foreground"
                  data-testid="text-invoiced-empty"
                >
                  <CreditCard className="h-7 w-7 opacity-25" />
                  <p className="text-sm">No invoiced orders</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-medium">
                        Restaurant
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Order ID
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Items
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Total
                      </TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicedOrders.map(
                      ({ order, lineItems, restaurantName, invoice }) => {
                        const isExpanded = !!expandedOrderIds[order.id];
                        const snapshotLines = normalizeInvoiceLineItems(invoice?.lineItems);
                        const hasSnapshot = snapshotLines.length > 0;
                        const showRestaurantNoteColumn = invoiceSnapshotHasRestaurantNotes(snapshotLines);
                        const restaurantNotes = getInvoiceRestaurantNotes(snapshotLines);
                        const total = hasSnapshot
                          ? parseFloat(invoice!.approvedTotal)
                          : lineItems.reduce(
                              (sum, li) =>
                                sum +
                                parseFloat(li.unitPriceAtTimeOfOrder) *
                                  li.quantity,
                              0,
                            );
                        return (
                          <Fragment key={order.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"
                              onClick={() =>
                                setExpandedOrderIds((prev) => ({
                                  ...prev,
                                  [order.id]: !prev[order.id],
                                }))
                              }
                              data-testid={`row-invoiced-order-${order.id}`}
                            >
                              <TableCell className="w-8 py-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell
                                className="py-3 font-medium text-sm"
                                data-testid={`text-invoiced-restaurant-${order.id}`}
                              >
                                {restaurantName}
                              </TableCell>
                              <TableCell
                                className="py-3 text-xs font-medium text-foreground"
                                data-testid={`text-invoiced-display-id-${order.id}`}
                              >
                                #{order.displayId ?? "—"}
                              </TableCell>
                              <TableCell className="py-3 text-sm text-muted-foreground">
                                {order.createdAt
                                  ? new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell className="py-3 text-sm text-right text-muted-foreground">
                                {hasSnapshot
                                  ? snapshotLines.length
                                  : lineItems.length}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm font-semibold text-right"
                                data-testid={`text-invoiced-total-${order.id}`}
                              >
                                {formatCurrency(String(total.toFixed(2)))}
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                  Invoiced
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-emerald-50/10 hover:bg-emerald-50/10">
                                <TableCell colSpan={7} className="py-0 pb-4">
                                  <div
                                    className="pl-8 pr-4 pt-3"
                                    data-testid={`table-invoiced-order-detail-${order.id}`}
                                  >
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground border-b">
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            Product
                                          </th>
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            SKU
                                          </th>
                                          <th className="text-right font-medium pb-1.5 pr-2">
                                            Approved Qty
                                          </th>
                                          <th className="text-right font-medium pb-1.5">
                                            Unit Price
                                          </th>
                                          <th className="text-right font-medium pb-1.5">
                                            Total
                                          </th>
                                          {showRestaurantNoteColumn ? (
                                            <th className="text-left font-medium pb-1.5 pl-2">
                                              Restaurant Note
                                            </th>
                                          ) : null}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {hasSnapshot
                                          ? snapshotLines.map((sl) => (
                                              <tr
                                                key={sl.orderLineItemId}
                                                className="border-b border-border/40 last:border-0"
                                                data-testid={`row-invoiced-lineitem-${sl.orderLineItemId}`}
                                              >
                                                <td className="py-2 pr-2 text-foreground font-medium">
                                                  {sl.productName}
                                                </td>
                                                <td className="py-2 pr-2 text-muted-foreground font-mono">
                                                  {sl.sku ?? "—"}
                                                </td>
                                                <td className="py-2 pr-2 text-right text-muted-foreground">
                                                  {sl.approvedQty}
                                                </td>
                                                <td className="py-2 pr-2 text-right text-muted-foreground">
                                                  {formatCurrency(sl.unitPrice)}
                                                </td>
                                                <td className="py-2 text-right font-medium text-foreground">
                                                  {formatCurrency(sl.lineTotal)}
                                                </td>
                                                {showRestaurantNoteColumn ? (
                                                  <td className="py-2 pl-2 text-muted-foreground">
                                                    {sl.restaurantNote || "—"}
                                                  </td>
                                                ) : null}
                                              </tr>
                                            ))
                                          : lineItems.map((li) => {
                                              const lineTotal =
                                                parseFloat(
                                                  li.unitPriceAtTimeOfOrder,
                                                ) * li.quantity;
                                              return (
                                                <tr
                                                  key={li.id}
                                                  className="border-b border-border/40 last:border-0"
                                                  data-testid={`row-invoiced-lineitem-${li.id}`}
                                                >
                                                  <td className="py-2 pr-2 text-foreground font-medium">
                                                    {li.productName}
                                                  </td>
                                                  <td className="py-2 pr-2 text-muted-foreground font-mono">
                                                    {li.sku ?? "—"}
                                                  </td>
                                                  <td className="py-2 pr-2 text-right text-muted-foreground">
                                                    {li.quantity}
                                                  </td>
                                                  <td className="py-2 pr-2 text-right text-muted-foreground">
                                                    {formatCurrency(
                                                      li.unitPriceAtTimeOfOrder,
                                                    )}
                                                  </td>
                                                  <td className="py-2 text-right font-medium text-foreground">
                                                    {formatCurrency(
                                                      String(
                                                        lineTotal.toFixed(2),
                                                      ),
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                      </tbody>
                                      <tfoot>
                                        <tr>
                                          <td colSpan={showRestaurantNoteColumn ? 4 : 3} />
                                          <td className="pt-2 text-right text-muted-foreground font-medium">
                                            Approved Total
                                          </td>
                                          <td className="pt-2 text-right font-bold text-foreground">
                                            {formatCurrency(
                                              String(total.toFixed(2)),
                                            )}
                                          </td>
                                          {showRestaurantNoteColumn ? <td /> : null}
                                        </tr>
                                      </tfoot>
                                    </table>
                                    {order.driverResolutionNote ? (
                                      <div className="mt-4 rounded-md border border-sky-200 bg-sky-50/50 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/20">
                                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                                          Driver Resolution Note
                                        </p>
                                        <p className="mt-1 text-sm text-foreground">
                                          {order.driverResolutionNote}
                                        </p>
                                      </div>
                                    ) : null}
                                    {restaurantNotes.length > 0 && !showRestaurantNoteColumn ? (
                                      <div className="mt-4 rounded-md border border-violet-200 bg-violet-50/50 px-3 py-2 dark:border-violet-800 dark:bg-violet-950/20">
                                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                                          Restaurant Notes
                                        </p>
                                        <div className="mt-1 space-y-1 text-sm text-foreground">
                                          {restaurantNotes.map((note) => (
                                            <p key={note}>{note}</p>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>

        {/* Order History */}
        <div
          id={VENDOR_SECTION_IDS.orders}
          className="scroll-mt-6 border rounded-lg bg-card overflow-hidden"
          data-testid="section-orders"
        >
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setOrdersExpanded(!ordersExpanded)}
            data-testid="button-toggle-orders"
          >
            <div className="flex items-center gap-2">
              {ordersExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Order History
              </h2>
              <Badge
                variant="secondary"
                className="text-xs"
                data-testid="text-orders-count"
              >
                {historyOrders.length}
              </Badge>
            </div>
          </div>
          {ordersExpanded && (
            <div className="border-t">
              {ordersLoading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Loading orders…
                </div>
              ) : historyOrders.length === 0 ? (
                <div
                  className="px-5 py-10 flex flex-col items-center gap-2 text-muted-foreground"
                  data-testid="text-orders-empty"
                >
                  <Lock className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No order history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-medium">
                        Restaurant
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Order ID
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Ordered
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Paid
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Items
                      </TableHead>
                      <TableHead className="text-xs font-medium text-right">
                        Total
                      </TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyOrders.map(
                      ({ order, lineItems, restaurantName, invoice }) => {
                        const isExpanded = !!expandedOrderIds[order.id];
                        const snapshotLines = normalizeInvoiceLineItems(invoice?.lineItems);
                        const hasSnapshot = snapshotLines.length > 0;
                        const showRestaurantNoteColumn = invoiceSnapshotHasRestaurantNotes(snapshotLines);
                        const restaurantNotes = getInvoiceRestaurantNotes(snapshotLines);
                        const total = hasSnapshot
                          ? parseFloat(invoice!.approvedTotal)
                          : lineItems.reduce(
                              (sum, li) =>
                                sum +
                                parseFloat(li.unitPriceAtTimeOfOrder) *
                                  li.quantity,
                              0,
                            );
                        return (
                          <Fragment key={order.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/30"
                              onClick={() => {
                                setExpandedOrderIds((prev) => ({
                                  ...prev,
                                  [order.id]: !prev[order.id],
                                }));
                              }}
                              data-testid={`row-order-${order.id}`}
                            >
                              <TableCell className="w-8 py-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell
                                className="py-3 font-medium text-sm"
                                data-testid={`text-order-restaurant-${order.id}`}
                              >
                                {restaurantName}
                              </TableCell>
                              <TableCell
                                className="py-3 text-xs font-medium text-foreground"
                                data-testid={`text-order-id-${order.id}`}
                              >
                                #{order.displayId ?? "—"}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm text-muted-foreground"
                                data-testid={`text-order-date-${order.id}`}
                              >
                                {order.createdAt
                                  ? new Date(
                                      order.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm text-muted-foreground"
                                data-testid={`text-order-paid-date-${order.id}`}
                              >
                                {order.paidAt
                                  ? new Date(order.paidAt).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )
                                  : "—"}
                              </TableCell>
                              <TableCell
                                className="py-3"
                                data-testid={`text-order-status-${order.id}`}
                              >
                                {order.paidAt ? (
                                  <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                    Paid
                                  </Badge>
                                ) : (
                                  <Badge
                                    className={`text-xs ${(ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.submitted).classes}`}
                                  >
                                    {
                                      (
                                        ORDER_STATUS_CONFIG[order.status] ??
                                        ORDER_STATUS_CONFIG.submitted
                                      ).label
                                    }
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm text-right text-muted-foreground"
                                data-testid={`text-order-items-${order.id}`}
                              >
                                {hasSnapshot
                                  ? snapshotLines.length
                                  : lineItems.length}
                              </TableCell>
                              <TableCell
                                className="py-3 text-sm font-semibold text-right"
                                data-testid={`text-order-total-${order.id}`}
                              >
                                {formatCurrency(String(total.toFixed(2)))}
                              </TableCell>
                              <TableCell
                                className="py-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() =>
                                    navigate(`/vendor/orders/${order.id}/approve`)
                                  }
                                  data-testid={`button-view-order-${order.id}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow
                                key={`${order.id}-detail`}
                                className="bg-muted/20 hover:bg-muted/20"
                              >
                                <TableCell colSpan={9} className="py-0 pb-4">
                                  <div className="pl-8 pr-4 pt-3">
                                    <table
                                      className="w-full text-xs"
                                      data-testid={`table-submitted-order-${order.id}`}
                                    >
                                      <thead>
                                        <tr className="text-muted-foreground border-b">
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            Product
                                          </th>
                                          <th className="text-left font-medium pb-1.5 pr-2">
                                            SKU
                                          </th>
                                          <th className="text-right font-medium pb-1.5 pr-2">
                                            Ordered Qty
                                          </th>
                                          <th className="text-right font-medium pb-1.5 pr-2">
                                            Approved Qty
                                          </th>
                                          <th className="text-right font-medium pb-1.5 pr-2">
                                            Unit Price
                                          </th>
                                          <th className="text-right font-medium pb-1.5">
                                            Total
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {hasSnapshot
                                          ? snapshotLines.map((sl) => (
                                              <tr
                                                key={sl.orderLineItemId}
                                                className="border-b border-border/40 last:border-0"
                                                data-testid={`row-lineitem-${sl.orderLineItemId}`}
                                              >
                                                <td className="py-2 pr-2">
                                                  <div className="text-foreground font-medium">
                                                    {sl.productName}
                                                  </div>
                                                  {sl.restaurantNote && (
                                                    <div
                                                      className="text-xs text-muted-foreground italic mt-0.5"
                                                      data-testid={`text-history-item-note-${sl.orderLineItemId}`}
                                                    >
                                                      "{sl.restaurantNote}"
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="py-2 pr-2 text-muted-foreground font-mono">
                                                  {sl.sku ?? "—"}
                                                </td>
                                                <td
                                                  className="py-2 pr-2 text-right text-muted-foreground"
                                                  data-testid={`text-history-ordered-qty-${sl.orderLineItemId}`}
                                                >
                                                  {lineItems.find(
                                                    (li) =>
                                                      li.id ===
                                                      sl.orderLineItemId,
                                                  )?.quantity ?? "—"}
                                                </td>
                                                <td
                                                  className="py-2 pr-2 text-right text-muted-foreground"
                                                  data-testid={`text-history-approved-qty-${sl.orderLineItemId}`}
                                                >
                                                  {sl.approvedQty}
                                                </td>
                                                <td className="py-2 pr-2 text-right text-muted-foreground">
                                                  {formatCurrency(sl.unitPrice)}
                                                </td>
                                                <td className="py-2 text-right font-medium text-foreground">
                                                  {formatCurrency(sl.lineTotal)}
                                                </td>
                                              </tr>
                                            ))
                                          : lineItems.map((li) => {
                                              const lineTotal =
                                                parseFloat(
                                                  li.unitPriceAtTimeOfOrder,
                                                ) * li.quantity;
                                              return (
                                                <tr
                                                  key={li.id}
                                                  className="border-b border-border/40 last:border-0"
                                                  data-testid={`row-lineitem-${li.id}`}
                                                >
                                                  <td className="py-2 pr-2 text-foreground font-medium">
                                                    {li.productName}
                                                  </td>
                                                  <td className="py-2 pr-2 text-muted-foreground font-mono">
                                                    {li.sku ?? "—"}
                                                  </td>
                                                  <td className="py-2 pr-2 text-right text-muted-foreground">
                                                    {li.quantity}
                                                  </td>
                                                  <td className="py-2 pr-2 text-right text-muted-foreground">
                                                    {li.quantity}
                                                  </td>
                                                  <td className="py-2 pr-2 text-right text-muted-foreground">
                                                    {formatCurrency(
                                                      li.unitPriceAtTimeOfOrder,
                                                    )}
                                                  </td>
                                                  <td className="py-2 text-right font-medium text-foreground">
                                                    {formatCurrency(
                                                      String(
                                                        lineTotal.toFixed(2),
                                                      ),
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                      </tbody>
                                      <tfoot>
                                        <tr>
                                          <td colSpan={4} />
                                          <td className="pt-2 text-right text-muted-foreground font-medium">
                                            Approved Total
                                          </td>
                                          <td
                                            className="pt-2 text-right font-bold text-foreground"
                                            data-testid={`text-order-total-submitted-${order.id}`}
                                          >
                                            {formatCurrency(
                                              String(total.toFixed(2)),
                                            )}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>

        {/* Product Catalog */}
        <div
          id={VENDOR_SECTION_IDS.products}
          className="scroll-mt-6 border rounded-lg bg-card overflow-hidden"
          data-testid="section-products"
        >
          {/* Catalog Header */}
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setProductsExpanded(!productsExpanded)}
            data-testid="button-toggle-products"
          >
            <div className="flex items-center gap-2">
              {productsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                My Product Catalog
              </h2>
              <Badge
                variant="secondary"
                className="text-xs"
                data-testid="text-product-count"
              >
                {products.filter((p) => p.status !== "archived").length}
              </Badge>
            </div>
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {productsExpanded && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    className="text-xs text-muted-foreground"
                    data-testid="button-toggle-archived-products"
                  >
                    {showArchived ? "Hide Archived" : "Show Archived"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={products.length === 0}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCsvImportOpen(true)}
                    data-testid="button-import-csv"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import CSV
                  </Button>
                </>
              )}
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!productsExpanded) setProductsExpanded(true);
                  handleAddProduct();
                }}
                data-testid="button-add-product"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Product
              </Button>
            </div>
          </div>

          {productsExpanded && (
            <>
              {/* Search & Filter Bar */}
              {products.length > 0 && (
                <div
                  className="px-4 py-2.5 border-b bg-muted/20 flex flex-wrap items-center gap-2"
                  data-testid="product-filter-bar"
                >
                  <div className="relative flex-1 min-w-[160px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search name or SKU…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-product-search"
                    />
                    {productSearch && (
                      <button
                        onClick={() => setProductSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        data-testid="button-clear-product-search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                      setStatusFilter(v as typeof statusFilter)
                    }
                  >
                    <SelectTrigger
                      className="h-8 text-sm w-[140px]"
                      data-testid="select-filter-status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">In Stock</SelectItem>
                      <SelectItem value="inactive">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={stockFilter}
                    onValueChange={(v) =>
                      setStockFilter(v as typeof stockFilter)
                    }
                  >
                    <SelectTrigger
                      className="h-8 text-sm w-[150px]"
                      data-testid="select-filter-stock"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Storage</SelectItem>
                      <SelectItem value="Dry">Dry</SelectItem>
                      <SelectItem value="Refrigerated">Refrigerated</SelectItem>
                      <SelectItem value="Frozen">Frozen</SelectItem>
                    </SelectContent>
                  </Select>
                  {isFiltering && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground px-2"
                      onClick={() => {
                        setProductSearch("");
                        setStatusFilter("all");
                        setStockFilter("all");
                      }}
                      data-testid="button-clear-all-filters"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              )}

              {/* Product Table */}
              {productsLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : products.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-12 px-4"
                  data-testid="empty-state-products"
                >
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    No products yet
                  </h3>
                  <p className="text-xs text-muted-foreground text-center max-w-xs">
                    Add your first product or import from a CSV file.
                  </p>
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={handleAddProduct}
                    data-testid="button-add-product-empty"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add First Product
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-medium">Product</TableHead>
                      <TableHead className="font-medium">SKU</TableHead>
                      <TableHead className="font-medium">Stock</TableHead>
                      <TableHead className="font-medium">Unit</TableHead>
                      <TableHead className="font-medium">Price</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-10 text-sm text-muted-foreground"
                          data-testid="empty-state-filtered"
                        >
                          No products match your search or filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow
                          key={product.id}
                          className={
                            product.status === "archived" ? "opacity-50" : ""
                          }
                          data-testid={`row-product-${product.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
                                <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span
                                className="font-medium"
                                data-testid={`text-product-name-${product.id}`}
                              >
                                {product.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground text-sm"
                            data-testid={`text-product-sku-${product.id}`}
                          >
                            {product.sku || "—"}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground text-sm"
                            data-testid={`text-product-stock-${product.id}`}
                          >
                            {product.stockType || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {product.unitSize} / {product.unitType}
                          </TableCell>
                          <TableCell
                            className="font-medium"
                            data-testid={`text-product-price-${product.id}`}
                          >
                            {formatCurrency(product.price)}
                          </TableCell>
                          <TableCell>
                            <ProductStatusBadge status={product.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {product.status !== "archived" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditProduct(product)}
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-edit-product-${product.id}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setArchivingProduct(product)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    data-testid={`button-archive-product-${product.id}`}
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Product Form Dialog */}
      <ProductFormDialog
        key={editingProduct?.id || "new"}
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        vendorId={vendorId}
        editProduct={editingProduct}
      />

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        vendorId={vendorId}
      />

      {/* Archive Confirm Dialog */}
      <Dialog
        open={!!archivingProduct}
        onOpenChange={(open) => {
          if (!open) setArchivingProduct(null);
        }}
      >
        <DialogContent data-testid="dialog-archive-product">
          <DialogHeader>
            <DialogTitle>Archive Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive{" "}
              <strong>{archivingProduct?.name}</strong>? It will be hidden from
              the active catalog but can be viewed by toggling "Show Archived."
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchivingProduct(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                archivingProduct && archiveMutation.mutate(archivingProduct.id)
              }
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
