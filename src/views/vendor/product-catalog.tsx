import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { vendorProductApi } from "@/api/vendor/products";
import { vendorKeys } from "@/api/vendor/vendors";
import { vendorProductKeys } from "@/api/vendor/products";
import { useLocation } from "@/lib/wouter-compat";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Papa from "papaparse";
import {
  Archive,
  Download,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Product, Vendor } from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { getUserRole } from "@/lib/portal-auth";
import { canManageVendorProducts } from "@/lib/vendor-portal-labels";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STOCK_TYPES = ["Dry", "Refrigerated", "Frozen"] as const;
const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: "In Stock",
  inactive: "Out of Stock",
  archived: "Archived",
};

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().optional(),
  stockType: z.enum(["Dry", "Refrigerated", "Frozen"]).nullable().optional(),
  unitType: z.string().min(1, "Unit type is required"),
  unitSize: z.string().min(1, "Unit size is required"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid price is required"),
  status: z.enum(["active", "inactive"]).optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

function ProductStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    inactive: "bg-amber-50 text-amber-700 border-amber-200",
    archived: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <Badge variant="outline" className={`text-xs font-medium ${classes[status] ?? classes.active}`}>
      {PRODUCT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function ProductFormDialog({
  open,
  onOpenChange,
  vendorId,
  editProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  editProduct: Product | null;
}) {
  const { toast } = useToast();
  const isEditing = !!editProduct;
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: editProduct?.name ?? "",
      sku: editProduct?.sku ?? "",
      stockType: (editProduct?.stockType as ProductFormValues["stockType"]) ?? null,
      unitType: editProduct?.unitType ?? "",
      unitSize: editProduct?.unitSize ?? "",
      price: editProduct?.price ?? "",
      status: (editProduct?.status as "active" | "inactive") ?? "active",
    },
  });

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: vendorProductKeys.list(vendorId) });
    queryClient.invalidateQueries({ queryKey: vendorProductKeys.list(vendorId, true) });
  };

  const mutation = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      if (isEditing) {
        await vendorProductApi.update(vendorId, editProduct.id, data);
        return;
      }
      await vendorProductApi.create(vendorId, data);
    },
    onSuccess: () => {
      invalidateProducts();
      toast({ title: isEditing ? "Product updated" : "Product added" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message.toLowerCase().includes("sku")) {
        form.setError("sku", { message: err.message });
        return;
      }
      toast({ title: "Product save failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-product-form">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
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
                <FormLabel>Stock <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <Select value={field.value ?? "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}>
                  <FormControl><SelectTrigger data-testid="select-product-stock-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {STOCK_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unitType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-product-unit-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
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
                  <FormLabel>Unit Size</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. 12ct" data-testid="input-product-unit-size" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="price" render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input {...field} className="pl-6" placeholder="0.00" data-testid="input-product-price" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {isEditing && (
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-product-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">In Stock</SelectItem>
                      <SelectItem value="inactive">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-product">
                {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function VendorProductCatalog() {
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();
  const canManageProducts = canManageVendorProducts(getUserRole());
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "archived">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "Dry" | "Refrigerated" | "Frozen">("all");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!vendorId) navigate("/vendor/login");
  }, [vendorId, navigate]);

  const productsQueryKey = showArchived
    ? vendorProductKeys.list(vendorId, true)
    : vendorProductKeys.list(vendorId);

  const { data: vendor } = useQuery<Vendor>({ queryKey: vendorKeys.detail(vendorId), enabled: !!vendorId });
  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: productsQueryKey, enabled: !!vendorId });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !q || product.name.toLowerCase().includes(q) || (product.sku ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || product.status === statusFilter;
      const matchesStock = stockFilter === "all" || product.stockType === stockFilter;
      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [products, search, statusFilter, stockFilter]);

  const activeProductCount = products.filter((product) => product.status !== "archived").length;

  const archiveMutation = useMutation({
    mutationFn: async (productId: string) => {
      await vendorProductApi.archive(vendorId, productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorProductKeys.list(vendorId) });
      queryClient.invalidateQueries({ queryKey: vendorProductKeys.list(vendorId, true) });
      setDeletingProduct(null);
      toast({ title: "Product deleted from active catalog" });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: Array<Record<string, string>>) => {
      const res = await vendorProductApi.import(vendorId, rows);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: vendorProductKeys.list(vendorId) });
      queryClient.invalidateQueries({ queryKey: vendorProductKeys.list(vendorId, true) });
      toast({ title: "CSV imported", description: `${result.summary?.imported ?? 0} products imported.` });
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  function openAddDialog() {
    setEditingProduct(null);
    setProductDialogOpen(true);
  }

  function exportCsv() {
    const rows = products.map((product) => ({
      name: product.name,
      sku: product.sku ?? "",
      stock: product.stockType ?? "",
      unit_type: product.unitType,
      unit_size: product.unitSize,
      price: product.price,
      status: PRODUCT_STATUS_LABELS[product.status] ?? product.status,
    }));
    const blob = new Blob([Papa.unparse(rows, { header: true })], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (vendor?.name ?? "vendor").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    link.href = url;
    link.download = `${safeName}-catalog.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.map((row) => ({
          name: row.name ?? row.Name ?? "",
          sku: row.sku ?? row.SKU ?? "",
          unit_type: row.unit_type ?? row.unitType ?? row["Unit Type"] ?? "",
          unit_size: row.unit_size ?? row.unitSize ?? row["Unit Size"] ?? "",
          price: row.price ?? row.Price ?? "",
        }));
        importMutation.mutate(rows);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (error) => toast({ title: "Import failed", description: error.message, variant: "destructive" }),
    });
  }

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || stockFilter !== "all";

  if (!vendorId) return null;

  return (
    <div data-testid="page-vendor-products">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">My Product Catalog</h1>
            <Badge variant="secondary" data-testid="text-product-count">{activeProductCount}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((value) => !value)} data-testid="button-toggle-archived-products">
              {showArchived ? "Hide Archived" : "Show Archived"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={products.length === 0} data-testid="button-export-csv">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            {canManageProducts ? (
              <>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={importCsv} data-testid="input-import-csv" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} data-testid="button-import-csv">
                  <Upload className="mr-2 h-4 w-4" /> Import CSV
                </Button>
                <Button size="sm" onClick={openAddDialog} data-testid="button-add-product">
                  <Plus className="mr-2 h-4 w-4" /> Add Product
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
                View Only
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-3">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or SKU..." value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-product-search" />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")} data-testid="button-clear-product-search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="w-[160px]" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">In Stock</SelectItem>
              <SelectItem value="inactive">Out of Stock</SelectItem>
              {showArchived && <SelectItem value="archived">Archived</SelectItem>}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as typeof stockFilter)}>
            <SelectTrigger className="w-[170px]" data-testid="select-filter-stock"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Storage</SelectItem>
              {STOCK_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setStockFilter("all"); }} data-testid="button-clear-all-filters">
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center" data-testid="empty-state-products">
            <div className="mb-3 rounded-md bg-blue-50 p-3 text-blue-600"><Package className="h-6 w-6" /></div>
            <h2 className="text-sm font-semibold">No products yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManageProducts
                ? "Add your first product or import a CSV catalog."
                : "No products are available in the catalog yet."}
            </p>
            {canManageProducts ? (
              <Button className="mt-4" size="sm" onClick={openAddDialog}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                {canManageProducts ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow><TableCell colSpan={canManageProducts ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">No products match your filters.</TableCell></TableRow>
              ) : filteredProducts.map((product) => (
                <TableRow key={product.id} className={product.status === "archived" ? "opacity-60" : ""} data-testid={`row-product-${product.id}`}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="rounded-md bg-blue-50 p-1.5 text-blue-600"><Package className="h-4 w-4" /></div>
                      <span className="truncate font-medium" data-testid={`text-product-name-${product.id}`}>{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{product.stockType || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{product.unitSize} / {product.unitType}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(product.price)}</TableCell>
                  <TableCell><ProductStatusBadge status={product.status} /></TableCell>
                  {canManageProducts ? (
                    <TableCell className="text-right">
                      {product.status !== "archived" && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setProductDialogOpen(true); }} data-testid={`button-edit-product-${product.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setDeletingProduct(product)} data-testid={`button-delete-product-${product.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ProductFormDialog
        key={editingProduct?.id ?? "new"}
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        vendorId={vendorId}
        editProduct={editingProduct}
      />

      <Dialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <DialogContent data-testid="dialog-delete-product">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Delete <strong>{deletingProduct?.name}</strong> from the active catalog? It will move to archived products.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProduct(null)}>Cancel</Button>
            <Button variant="destructive" disabled={archiveMutation.isPending} onClick={() => deletingProduct && archiveMutation.mutate(deletingProduct.id)} data-testid="button-confirm-delete">
              <Archive className="mr-2 h-4 w-4" /> {archiveMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
