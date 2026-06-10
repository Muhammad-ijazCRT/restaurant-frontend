import { useState, useRef, useEffect } from "react";
import { PRODUCT_CSV_TEMPLATE_FILENAME, PRODUCT_CSV_TEMPLATE_URL } from "@/lib/product-csv-template";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/wouter-compat";
import type { Vendor, VendorRestaurantRelationship, RestaurantOrg, Product } from "@shared/schema";
import { insertProductSchema, formatPhone, formatCurrency } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Mail, Phone, UserCircle, Link2, UtensilsCrossed, AlertCircle, Calendar,
  Package, Plus, Pencil, Archive, Upload, Download, FileText, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Eye, ToggleLeft, ToggleRight, Trash2, GripVertical, Search, X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AttachmentsSection } from "@/components/attachments-section";
import { InternalNotesSection } from "@/components/internal-notes-section";
import { CutoffSettingsPanel } from "@/components/cutoff-settings-panel";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

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

const productStatusLabels: Record<string, string> = {
  active: "In Stock",
  inactive: "Out of Stock",
  archived: "Archived",
};

function ProductStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    archived: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${variants[status] || variants.active}`}>
      {productStatusLabels[status] || status}
    </Badge>
  );
}

const STOCK_TYPES = ["Dry", "Refrigerated", "Frozen"] as const;

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  stockType: z.enum(["Dry", "Refrigerated", "Frozen"]).nullable().optional(),
  unitType: z.string().min(1, "Unit type is required"),
  unitSize: z.string().min(1, "Unit size is required"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid price is required (e.g. 12.99)"),
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
      stockType: (editProduct?.stockType as "Dry" | "Refrigerated" | "Frozen" | null) ?? null,
      unitType: editProduct?.unitType || "",
      unitSize: editProduct?.unitSize || "",
      price: editProduct?.price || "",
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
      await apiRequest("POST", `/api/vendors/${vendorId}/products`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products?includeArchived=true"] });
      toast({ title: "Product created" });
      onOpenChange(false);
    },
    onError: handleServerError,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      await apiRequest("PATCH", `/api/vendors/${vendorId}/products/${editProduct!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products?includeArchived=true"] });
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
          <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <FormField control={form.control} name="stockType" render={({ field }) => (
              <FormItem>
                <FormLabel>Stock <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                  value={field.value ?? "__none__"}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-product-stock-type">
                      <SelectValue placeholder="Select storage type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {STOCK_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              )} />
              <FormField control={form.control} name="unitSize" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pack / Unit Size</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. 12 ct, 5 lb" data-testid="input-product-unit-size" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="price" render={({ field }) => (
              <FormItem>
                <FormLabel>Price ($)</FormLabel>
                <FormControl><Input {...field} placeholder="0.00" data-testid="input-product-price" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-product">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-product">
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const VALID_UNIT_TYPES = ["case", "lb", "oz", "each", "bag", "gallon", "pallet"];

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
  results: Array<{ row: number; status: "imported" | "rejected"; errors?: string[] }>;
}

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
    queryKey: ["/api/vendors", vendorId, "products?includeArchived=true"],
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async (rows: Array<{ name: string; sku: string; unit_type: string; unit_size: string; price: string }>) => {
      const res = await apiRequest("POST", `/api/vendors/${vendorId}/products/import`, { rows });
      return (await res.json()) as ImportResult;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "products?includeArchived=true"] });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
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
      toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    const existingSkus = new Set(existingProducts.map(p => p.sku));

    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target?.result as string;
      const cleaned = raw
        .split("\n")
        .filter(line => !line.startsWith("#"))
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
                errors.push(`Invalid unit type "${unit_type}". Valid types: ${VALID_UNIT_TYPES.join(", ")}`);
              }
              if (!unit_size) errors.push("Unit size is required");
              if (!price) {
                errors.push("Price is required");
              } else if (!/^\d+(\.\d{1,2})?$/.test(price)) {
                errors.push("Price must be a valid number (e.g. 12.99)");
              }

              if (sku) {
                if (seenSkus.has(sku.toUpperCase())) {
                  errors.push(`Duplicate SKU "${sku}" within this file`);
                }
                if (existingSkus.has(sku)) {
                  errors.push(`SKU "${sku}" already exists for this vendor`);
                }
              }
            }

            if (sku && errors.length === 0) {
              seenSkus.add(sku.toUpperCase());
            }

            rows.push({ name, sku, unit_type, unit_size, price, rowNum: i + 1, errors });
          }

          if (rows.length === 0) {
            toast({ title: "Empty file", description: "The CSV file contains no data rows.", variant: "destructive" });
            return;
          }

          const requiredHeaders = ["name", "sku", "unit_type", "unit_size", "price"];
          const actualHeaders = result.meta.fields || [];
          const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
          if (missingHeaders.length > 0) {
            toast({
              title: "Invalid CSV format",
              description: `Missing required columns: ${missingHeaders.join(", ")}. Please use the provided template.`,
              variant: "destructive",
            });
            return;
          }

          setParsedRows(rows);
          setStep("preview");
        },
        error: () => {
          toast({ title: "Parse error", description: "Failed to parse the CSV file.", variant: "destructive" });
        },
      });
    };
    reader.onerror = () => {
      toast({ title: "File read error", description: "Could not read the file.", variant: "destructive" });
    };
    reader.readAsText(file);
  }

  function handleConfirmImport() {
    if (validCount === 0) {
      toast({ title: "No valid rows", description: "All rows have errors. Fix the CSV and try again.", variant: "destructive" });
      return;
    }

    const allRows = parsedRows.map(r => ({
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

  const validCount = parsedRows.filter(r => r.errors.length === 0).length;
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-csv-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {step === "upload" && "Import Products from CSV"}
            {step === "preview" && "Preview Import"}
            {step === "done" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file to bulk-add products to this vendor's catalog."}
            {step === "preview" && "Review the rows below before confirming the import."}
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

            <div className="border rounded-lg p-4 border-dashed">
              <div className="flex flex-col items-center justify-center py-4">
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Upload your CSV file</p>
                <p className="text-xs text-muted-foreground mb-4">Only .csv files are supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-csv-file"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-choose-file">
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
                <Badge variant="secondary" className="gap-1" data-testid="badge-valid-count">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {validCount} valid
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="secondary" className="gap-1 text-destructive" data-testid="badge-error-count">
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
                      className={row.errors.length > 0 ? "bg-destructive/5" : ""}
                      data-testid={`row-preview-${row.rowNum}`}
                    >
                      <TableCell className="text-muted-foreground text-xs">{row.rowNum}</TableCell>
                      <TableCell className="text-sm">{row.name || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                      <TableCell className="text-sm">{row.sku || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                      <TableCell className="text-sm">{row.unit_type || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                      <TableCell className="text-sm">{row.unit_size || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                      <TableCell className="text-sm">{row.price || <span className="text-muted-foreground italic">empty</span>}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" data-testid={`status-valid-${row.rowNum}`} />
                        ) : (
                          <div className="space-y-0.5" data-testid={`status-error-${row.rowNum}`}>
                            {row.errors.map((err, idx) => (
                              <p key={idx} className="text-xs text-destructive flex items-start gap-1">
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
              <Button variant="outline" onClick={() => { resetState(); }} data-testid="button-back-to-upload">
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={validCount === 0 || importMutation.isPending}
                data-testid="button-confirm-import"
              >
                {importMutation.isPending
                  ? "Importing..."
                  : `Import ${validCount} Product${validCount !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold" data-testid="text-total-rows">{importResult.summary.total}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="border rounded-lg p-3 text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400" data-testid="text-imported-count">{importResult.summary.imported}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="border rounded-lg p-3 text-center bg-red-50/50 dark:bg-red-950/20">
                <p className="text-2xl font-semibold text-destructive" data-testid="text-rejected-count">{importResult.summary.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>

            {importResult.results.some(r => r.status === "rejected") && (
              <div className="border rounded-md overflow-auto max-h-[250px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[60px] font-medium">Row</TableHead>
                      <TableHead className="font-medium">Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.results.filter(r => r.status === "rejected").map(r => (
                      <TableRow key={r.row} className="bg-destructive/5">
                        <TableCell className="text-muted-foreground text-sm">{r.row}</TableCell>
                        <TableCell>
                          {r.errors?.map((err, idx) => (
                            <p key={idx} className="text-xs text-destructive">{err}</p>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)} data-testid="button-close-import">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkRestaurantDialog({
  open,
  onOpenChange,
  vendorId,
  availableRestaurants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  availableRestaurants: RestaurantOrg[];
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
    mutationFn: async (orgIds: string[]) => {
      await Promise.all(
        orgIds.map(restaurantOrgId =>
          apiRequest("POST", "/api/relationships", { vendorId, restaurantOrgId, status: "active" })
        )
      );
    },
    onSuccess: (_, orgIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors/completeness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orgs/completeness"] });
      toast({
        title: `${orgIds.length} restaurant${orgIds.length !== 1 ? "s" : ""} linked`,
        description: "The linked restaurants list has been updated.",
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
      <DialogContent className="sm:max-w-md" data-testid="dialog-link-restaurant">
        <DialogHeader>
          <DialogTitle>Link Restaurant Organizations</DialogTitle>
          <DialogDescription>
            Select one or more restaurant organizations to link to this vendor. Already-linked and archived organizations are not shown.
          </DialogDescription>
        </DialogHeader>

        {availableRestaurants.length === 0 ? (
          <div className="py-8 text-center" data-testid="empty-state-no-available-orgs">
            <div className="rounded-full bg-muted p-3 mb-3 inline-flex">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">All organizations already linked</p>
            <p className="text-xs text-muted-foreground mt-1">
              Every active restaurant organization is already linked to this vendor.
            </p>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto border rounded-md divide-y divide-border/60" data-testid="list-available-orgs">
            {availableRestaurants.map(org => (
              <label
                key={org.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                data-testid={`option-org-${org.id}`}
              >
                <Checkbox
                  checked={selectedIds.has(org.id)}
                  onCheckedChange={() => handleToggle(org.id)}
                  data-testid={`checkbox-org-${org.id}`}
                />
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/40 p-1 shrink-0">
                    <UtensilsCrossed className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-sm font-medium truncate">{org.name}</span>
                  {org.status === "inactive" && (
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
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-link-restaurant">
            Cancel
          </Button>
          <Button
            onClick={() => linkMutation.mutate(Array.from(selectedIds))}
            disabled={selectedIds.size === 0 || linkMutation.isPending || availableRestaurants.length === 0}
            data-testid="button-confirm-link-restaurant"
          >
            {linkMutation.isPending
              ? "Linking..."
              : selectedIds.size === 0
              ? "Select restaurants"
              : `Link ${selectedIds.size} Restaurant${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableProductRow({
  product,
  onEdit,
  onArchive,
  disableDrag = false,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onArchive: (product: Product) => void;
  disableDrag?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = disableDrag ? undefined : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 1 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  return (
    <TableRow
      ref={disableDrag ? undefined : setNodeRef}
      style={style}
      className={product.status === "archived" ? "opacity-50" : ""}
      data-testid={`row-product-${product.id}`}
    >
      <TableCell className="w-8 pr-0">
        {!disableDrag && product.status !== "archived" && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center"
            data-testid={`drag-handle-product-${product.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
            <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="font-medium" data-testid={`text-product-name-${product.id}`}>{product.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm" data-testid={`text-product-sku-${product.id}`}>
        {product.sku || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm" data-testid={`text-product-stock-${product.id}`}>
        {product.stockType || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {product.unitSize} / {product.unitType}
      </TableCell>
      <TableCell className="font-medium" data-testid={`text-product-price-${product.id}`}>
        {formatCurrency(product.price)}
      </TableCell>
      <TableCell><ProductStatusBadge status={product.status} /></TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {product.status !== "archived" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(product)}
                className="h-8 w-8 p-0"
                data-testid={`button-edit-product-${product.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(product)}
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
  );
}

export default function VendorDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingProduct, setArchivingProduct] = useState<Product | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [linkRestaurantOpen, setLinkRestaurantOpen] = useState(false);
  const [removingRelationship, setRemovingRelationship] = useState<VendorRestaurantRelationship | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "Dry" | "Refrigerated" | "Frozen">("all");

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

  const { data: vendor, isLoading: vendorLoading, isError: vendorError } = useQuery<Vendor>({
    queryKey: ["/api/vendors", id],
  });

  const { data: allRelationships = [] } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
  });

  const { data: allRestaurants = [] } = useQuery<RestaurantOrg[]>({
    queryKey: ["/api/restaurant-orgs"],
  });

  const productsQueryKey = showArchived
    ? ["/api/vendors", id, "products?includeArchived=true"]
    : ["/api/vendors", id, "products"];

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: productsQueryKey,
  });

  const archiveMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("PATCH", `/api/vendors/${id}/products/${productId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", id, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", id, "products?includeArchived=true"] });
      setArchivingProduct(null);
      toast({ title: "Product archived" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const prevProductsRef = useRef<Product[]>([]);
  useEffect(() => {
    setLocalProducts(products);
    prevProductsRef.current = products;
  }, [products]);

  const isFiltering = productSearch.trim() !== "" || statusFilter !== "all" || stockFilter !== "all";

  const filteredProducts = isFiltering
    ? localProducts.filter(p => {
        const q = productSearch.trim().toLowerCase();
        const matchesSearch = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        const matchesStock = stockFilter === "all" || p.stockType === stockFilter;
        return matchesSearch && matchesStatus && matchesStock;
      })
    : localProducts;

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      await apiRequest("POST", `/api/vendors/${id}/products/reorder`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
    },
    onError: (err: Error) => {
      setLocalProducts(prevProductsRef.current);
      toast({ title: "Failed to save order", description: err.message, variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localProducts.findIndex(p => p.id === active.id);
    const newIndex = localProducts.findIndex(p => p.id === over.id);
    const newOrder = arrayMove(localProducts, oldIndex, newIndex);
    setLocalProducts(newOrder);
    reorderMutation.mutate(newOrder.map((p, idx) => ({ id: p.id, sortOrder: idx })));
  }

  const vendorRelationships = allRelationships.filter(r => r.vendorId === id);
  const restaurantMap = new Map(allRestaurants.map(r => [r.id, r]));

  const linkedOrgIds = new Set(vendorRelationships.map(r => r.restaurantOrgId));
  const availableRestaurants = allRestaurants.filter(r => r.status !== "archived" && !linkedOrgIds.has(r.id));

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleExportCsv = () => {
    const rows = localProducts.map(p => ({
      name: p.name,
      sku: p.sku ?? "",
      stock: p.stockType ?? "",
      unit_type: p.unitType,
      unit_size: p.unitSize,
      price: p.price,
      status: p.status === "active" ? "In Stock" : p.status === "inactive" ? "Out of Stock" : "Archived",
    }));
    const csv = Papa.unparse(rows, { header: true });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (vendor?.name ?? "vendor").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    link.href = url;
    link.download = `${safeName}-catalog.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (vendorLoading) {
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

  if (vendorError || !vendor) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/admin/vendors">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Vendors
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-destructive/10 p-4 mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
          <h3 className="text-lg font-semibold mb-1">Vendor not found</h3>
          <p className="text-sm text-muted-foreground">This vendor may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/admin/vendors">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />Back to Vendors
        </Button>
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-vendor-detail-name">
              {vendor.name}
            </h1>
            <StatusBadge status={vendor.status} />
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Added {new Date(vendor.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
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
            <p className="font-medium text-foreground" data-testid="text-vendor-detail-contact">{vendor.contactName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="font-medium text-foreground" data-testid="text-vendor-detail-email">{vendor.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              Phone
            </div>
            <p className="font-medium text-foreground" data-testid="text-vendor-detail-phone">{formatPhone(vendor.phone)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Status */}
      {(() => {
        const activeProducts = products.filter(p => p.status !== "archived");
        const hasProducts = activeProducts.length > 0;
        const hasRestaurants = vendorRelationships.length > 0;
        const isComplete = hasProducts && hasRestaurants;
        const requirements = [
          { label: "At least one product in catalog", met: hasProducts },
          { label: "Linked to at least one restaurant", met: hasRestaurants },
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

      {/* Products Section */}
      <div className="border rounded-lg bg-card overflow-hidden mb-8" data-testid="section-products">
        <div
          className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
          onClick={() => setProductsExpanded(!productsExpanded)}
          data-testid="button-toggle-products"
        >
          <div className="flex items-center gap-2">
            {productsExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Product Catalog</h2>
            <Badge variant="secondary" className="text-xs" data-testid="text-product-count">
              {products.filter(p => p.status !== "archived").length}
            </Badge>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={localProducts.length === 0} data-testid="button-export-csv">
                  <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCsvImportOpen(true)} data-testid="button-import-csv">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />Import CSV
                </Button>
              </>
            )}
            <Button size="sm" onClick={(e) => { e.stopPropagation(); if (!productsExpanded) setProductsExpanded(true); handleAddProduct(); }} data-testid="button-add-product">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add Product
            </Button>
          </div>
        </div>

        {productsExpanded && (
          productsLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-products">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No products yet</h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Add products to this vendor's catalog to get started.
              </p>
              <Button size="sm" className="mt-4" onClick={handleAddProduct} data-testid="button-add-product-empty">
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add First Product
              </Button>
            </div>
          ) : (
            <>
              {/* Search & Filter Bar */}
              <div className="px-4 py-2.5 border-b bg-muted/20 flex flex-wrap items-center gap-2" data-testid="product-filter-bar">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search name or SKU…"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
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
                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="h-8 text-sm w-[140px]" data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">In Stock</SelectItem>
                    <SelectItem value="inactive">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={v => setStockFilter(v as typeof stockFilter)}>
                  <SelectTrigger className="h-8 text-sm w-[150px]" data-testid="select-filter-stock">
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
                    onClick={() => { setProductSearch(""); setStatusFilter("all"); setStockFilter("all"); }}
                    data-testid="button-clear-all-filters"
                  >
                    <X className="h-3 w-3 mr-1" />Clear
                  </Button>
                )}
              </div>

              {isFiltering ? (
                /* Static table — DnD disabled while filtering (DndContext still required by useSortable hook) */
                <DndContext sensors={sensors} collisionDetection={closestCenter}>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8" />
                        <TableHead className="font-medium">Product</TableHead>
                        <TableHead className="font-medium">SKU</TableHead>
                        <TableHead className="font-medium">Stock</TableHead>
                        <TableHead className="font-medium">Unit</TableHead>
                        <TableHead className="font-medium">Price</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <SortableContext items={filteredProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground" data-testid="empty-state-filtered">
                              No products match your search or filters.
                            </TableCell>
                          </TableRow>
                        ) : filteredProducts.map(product => (
                          <SortableProductRow
                            key={product.id}
                            product={product}
                            onEdit={handleEditProduct}
                            onArchive={setArchivingProduct}
                            disableDrag
                          />
                        ))}
                      </TableBody>
                    </SortableContext>
                  </Table>
                </DndContext>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8" />
                        <TableHead className="font-medium">Product</TableHead>
                        <TableHead className="font-medium">SKU</TableHead>
                        <TableHead className="font-medium">Stock</TableHead>
                        <TableHead className="font-medium">Unit</TableHead>
                        <TableHead className="font-medium">Price</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <SortableContext items={localProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      <TableBody>
                        {localProducts.map(product => (
                          <SortableProductRow
                            key={product.id}
                            product={product}
                            onEdit={handleEditProduct}
                            onArchive={setArchivingProduct}
                          />
                        ))}
                      </TableBody>
                    </SortableContext>
                  </Table>
                </DndContext>
              )}
            </>
          )
        )}
      </div>

      {/* Linked Restaurants Section */}
      <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-linked-restaurants">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Linked Restaurant Organizations</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs" data-testid="text-relationship-count">
              {vendorRelationships.length} linked
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setLinkRestaurantOpen(true)}
              data-testid="button-link-restaurant"
            >
              <Plus className="h-3 w-3 mr-1" />Link Restaurant
            </Button>
          </div>
        </div>

        {vendorRelationships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-linked-restaurants">
            <div className="rounded-full bg-muted p-3 mb-3">
              <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No linked restaurants</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Link this vendor to restaurant organizations to complete onboarding.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setLinkRestaurantOpen(true)}
              data-testid="button-link-restaurant-empty"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />Link Restaurant
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Restaurant Organization</TableHead>
                <TableHead className="font-medium">Relationship Status</TableHead>
                <TableHead className="font-medium">Linked Since</TableHead>
                <TableHead className="font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorRelationships.map(rel => {
                const restaurant = restaurantMap.get(rel.restaurantOrgId);
                const isActive = rel.status === "active";
                return (
                  <TableRow key={rel.id} data-testid={`row-linked-restaurant-${rel.id}`}>
                    <TableCell>
                      <Link href={`/admin/restaurants/${rel.restaurantOrgId}`}>
                        <span className="font-medium text-primary hover:underline cursor-pointer flex items-center gap-2" data-testid={`link-restaurant-${rel.restaurantOrgId}`}>
                          <div className="rounded-md bg-orange-50 dark:bg-orange-950/40 p-1.5">
                            <UtensilsCrossed className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                          </div>
                          {restaurant?.name || "Unknown Organization"}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell><StatusBadge status={rel.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(rel.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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

      <AttachmentsSection entityType="vendor" entityId={id!} />

      <div className="mt-6">
        <CutoffSettingsPanel
          vendorId={id!}
          title="Vendor Cutoff Settings"
          description="Admin can set or update the daily order cutoff for this vendor."
        />
      </div>

      <InternalNotesSection entityType="vendor" entityId={id!} />

      <Dialog open={!!removingRelationship} onOpenChange={(open) => { if (!open) setRemovingRelationship(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-remove-relationship">
          <DialogHeader>
            <DialogTitle>Remove Relationship</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove the link between this vendor and{" "}
            <span className="font-medium text-foreground">
              {removingRelationship ? restaurantMap.get(removingRelationship.restaurantOrgId)?.name ?? "this restaurant" : ""}
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

      <Dialog open={!!archivingProduct} onOpenChange={(open) => { if (!open) setArchivingProduct(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-archive-product">
          <DialogHeader>
            <DialogTitle>Archive Product</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to archive <span className="font-medium text-foreground">{archivingProduct?.name}</span>? It will be hidden from the product catalog but can still be viewed with the "Show Archived" filter.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchivingProduct(null)} data-testid="button-cancel-archive">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => archivingProduct && archiveMutation.mutate(archivingProduct.id)}
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkRestaurantDialog
        open={linkRestaurantOpen}
        onOpenChange={setLinkRestaurantOpen}
        vendorId={id!}
        availableRestaurants={availableRestaurants}
      />

      <ProductFormDialog
        key={editingProduct?.id || "new"}
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        vendorId={id!}
        editProduct={editingProduct}
      />

      <CsvImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        vendorId={id!}
      />
    </div>
  );
}
