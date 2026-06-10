import { useState, useEffect } from "react";
import { restaurantOrderApi, restaurantOrderKeys } from "@/api/restaurant/orders";
import { profileKeys } from "@/api/shared/profile";
import { relationshipKeys } from "@/api/shared/relationships";
import { vendorKeys } from "@/api/vendor/vendors";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { vendorProductKeys } from "@/api/vendor/products";
import { Link, useLocation, useParams } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vendor, VendorRestaurantRelationship, RestaurantOrg, Product, Order, OrderLineItem } from "@shared/schema";
import { formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, UtensilsCrossed, ArrowLeft, Package, ShoppingCart,
  Save, CheckCircle2, LogOut, PenLine, Search, X, ClipboardCheck,
} from "lucide-react";

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

type DraftResponse = { order: Order; lineItems: OrderLineItem[] } | null;
type OrderSheetEntry = {
  id: string; relationshipId: string; productId: string;
  productName: string; sku: string | null; unitType: string; unitSize: string; price: string;
};

export default function RestaurantOrderComposer() {
  const { restaurantId, logout } = useRestaurantAuth();
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [quantitiesLoaded, setQuantitiesLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [viewMode, setViewMode] = useState<"sheet" | "catalog">("catalog");
  const [viewModeInit, setViewModeInit] = useState(false);

  if (!restaurantId) {
    navigate("/restaurant/login");
    return null;
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: restaurant } = useQuery<RestaurantOrg>({
    queryKey: restaurantOrgKeys.detail(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: allRelationships = [], isLoading: relLoading } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: relationshipKeys.all(),
    enabled: !!restaurantId,
  });

  const { data: vendor, isLoading: vendorLoading } = useQuery<Vendor>({
    queryKey: vendorKeys.detail(vendorId),
    enabled: !!vendorId,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: vendorProductKeys.list(vendorId),
    enabled: !!vendorId,
  });

  const draftQueryKey = restaurantOrderKeys.draft(restaurantId, vendorId);
  const submittedQueryKey = restaurantOrderKeys.submittedList(restaurantId, vendorId);

  const { data: draftData, isLoading: draftLoading } = useQuery<DraftResponse>({
    queryKey: draftQueryKey,
    enabled: !!restaurantId && !!vendorId,
  });

  const sheetRelationshipId = allRelationships.find(
    r => r.restaurantOrgId === restaurantId && r.vendorId === vendorId && r.status !== "archived"
  )?.id;

  const { data: orderSheetData = [], isLoading: orderSheetLoading } = useQuery<OrderSheetEntry[]>({
    queryKey: relationshipKeys.orderSheet(sheetRelationshipId),
    enabled: !!sheetRelationshipId,
  });

  // ── Access check ──────────────────────────────────────────────────────────

  const linkedRelationships = allRelationships.filter(
    r => r.restaurantOrgId === restaurantId && r.status !== "archived"
  );
  const relationship = linkedRelationships.find(r => r.vendorId === vendorId) ?? null;

  if (!relLoading && !relationship) {
    navigate("/restaurant/portal");
    return null;
  }

  // ── Pre-load quantities from existing draft ────────────────────────────────

  useEffect(() => {
    if (!draftLoading && !quantitiesLoaded) {
      if (draftData?.lineItems && draftData.lineItems.length > 0) {
        const initial: Record<string, number> = {};
        for (const li of draftData.lineItems) {
          initial[li.productId] = li.quantity;
        }
        setQuantities(initial);
      }
      setQuantitiesLoaded(true);
    }
  }, [draftData, draftLoading, quantitiesLoaded]);

  useEffect(() => {
    if (!viewModeInit && !orderSheetLoading && sheetRelationshipId) {
      if (orderSheetData.length > 0) setViewMode("sheet");
      setViewModeInit(true);
    }
  }, [orderSheetData, orderSheetLoading, sheetRelationshipId, viewModeInit]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const visibleProducts = products.filter(p => p.status !== "archived");

  // Order Sheet products in sheet-addition order, cross-referenced against full catalog
  const orderSheetProducts = orderSheetData
    .map(entry => visibleProducts.find(p => p.id === entry.productId))
    .filter((p): p is Product => p != null);

  const sourceProducts = viewMode === "sheet" && orderSheetProducts.length > 0
    ? orderSheetProducts
    : visibleProducts;

  const q = productSearch.trim().toLowerCase();
  const filteredProducts = q
    ? sourceProducts.filter(p =>
        p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)
      )
    : sourceProducts;

  const selectedItems = visibleProducts
    .filter(p => (quantities[p.id] ?? 0) > 0 && p.status === "active")
    .map(p => ({ product: p, quantity: quantities[p.id] }));

  const orderTotal = selectedItems.reduce(
    (acc, { product, quantity }) => acc + parseFloat(product.price) * quantity,
    0
  );

  const existingDraft = draftData?.order ?? null;
  const isContinuingDraft = existingDraft != null;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const items = selectedItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));
      if (items.length === 0) {
        throw new Error("Please add at least one product with a quantity.");
      }
      if (existingDraft) {
        return restaurantOrderApi.update(restaurantId, existingDraft.id, { items });
      } else {
        return restaurantOrderApi.create(restaurantId, {
          vendorId,
          items,
          status: "draft",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftQueryKey });
      toast({ title: "Draft saved", description: "Your draft order has been saved." });
      navigate(`/restaurant/vendor/${vendorId}`);
    },
    onError: (err: any) => {
      toast({
        title: "Could not save draft",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitOrderMutation = useMutation({
    mutationFn: async () => {
      const items = selectedItems.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
      }));
      if (items.length === 0) throw new Error("Please add at least one product.");

      let orderId = existingDraft?.id;

      if (orderId) {
        await restaurantOrderApi.update(restaurantId, orderId, { items });
      } else {
        const createRes = await restaurantOrderApi.create(restaurantId, {
          vendorId, items, status: "draft",
        });
        const createData = await createRes.json();
        orderId = createData.order?.id ?? createData.id;
      }

      const res = await restaurantOrderApi.update(restaurantId, orderId!, { status: "submitted" });
      return res.json() as Promise<{ order: Order; lineItems: OrderLineItem[] }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(draftQueryKey, null);
      queryClient.setQueryData(
        submittedQueryKey,
        (prev: { order: Order; lineItems: OrderLineItem[] }[] = []) => [data, ...prev],
      );
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
      setConfirmSubmit(false);
      toast({ title: "Order submitted", description: "Your order has been sent to the vendor." });
      navigate(`/restaurant/vendor/${vendorId}`);
    },
    onError: (err: any) => {
      setConfirmSubmit(false);
      toast({
        title: "Could not submit order",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  const isLoading = vendorLoading || productsLoading || relLoading || (draftLoading && !quantitiesLoaded)
    || (!!sheetRelationshipId && orderSheetLoading && !viewModeInit);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (!vendor || !relationship) return null;

  return (
    <div className="flex w-full gap-6 items-start">

        {/* ── Left panel: product list ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-foreground shrink-0" data-testid="text-composer-vendor-name">
                {vendor.name}
              </span>
              {orderSheetProducts.length > 0 ? (
                <div className="flex rounded-md border overflow-hidden shrink-0">
                  <button
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 border-r transition-colors ${viewMode === "sheet" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"}`}
                    onClick={() => { setViewMode("sheet"); setProductSearch(""); }}
                    data-testid="button-view-order-sheet"
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    Order Sheet ({orderSheetProducts.length})
                  </button>
                  <button
                    className={`text-xs px-2.5 py-1 transition-colors ${viewMode === "catalog" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50 text-muted-foreground"}`}
                    onClick={() => { setViewMode("catalog"); setProductSearch(""); }}
                    data-testid="button-view-full-catalog"
                  >
                    Full Catalog
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">· Product Catalog</span>
              )}
            </div>
            <div className="relative w-48 shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search products…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="h-7 pl-7 pr-7 text-xs"
                data-testid="input-product-search"
              />
              {productSearch && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setProductSearch("")}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Product table */}
          {visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="empty-state-catalog">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No products available</p>
              <p className="text-xs text-muted-foreground">This vendor has not added any products yet.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground" data-testid="empty-state-filtered">
              No products match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-medium">Product</TableHead>
                  <TableHead className="font-medium">SKU</TableHead>
                  <TableHead className="font-medium">Storage</TableHead>
                  <TableHead className="font-medium">Unit</TableHead>
                  <TableHead className="font-medium">Price</TableHead>
                  <TableHead className="font-medium w-[110px]">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => {
                  const qty = quantities[product.id] ?? 0;
                  const isSelected = qty > 0;
                  const isOutOfStock = product.status === "inactive";

                  return (
                    <TableRow
                      key={product.id}
                      data-testid={`row-product-${product.id}`}
                      className={
                        isOutOfStock
                          ? "opacity-50"
                          : isSelected
                            ? "bg-blue-50/50 dark:bg-blue-950/10"
                            : ""
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`rounded-md p-1.5 ${isSelected ? "bg-blue-100 dark:bg-blue-900/40" : "bg-blue-50 dark:bg-blue-950/40"}`}>
                            <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <span className="font-medium text-sm" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </span>
                            {isOutOfStock && (
                              <span className="ml-2 text-xs text-amber-600 font-medium">Out of Stock</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.sku || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.stockType || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.unitSize} / {product.unitType}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{formatCurrency(product.price)}</TableCell>
                      <TableCell>
                        {isOutOfStock ? (
                          <span className="text-xs text-muted-foreground italic" data-testid={`text-out-of-stock-${product.id}`}>
                            —
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={qty === 0 ? "" : qty}
                            placeholder="0"
                            onChange={e => {
                              const val = parseInt(e.target.value, 10);
                              setQuantities(prev => ({
                                ...prev,
                                [product.id]: isNaN(val) || val < 0 ? 0 : val,
                              }));
                            }}
                            className="h-8 w-20 text-sm"
                            data-testid={`input-qty-${product.id}`}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ── Right panel: order summary ────────────────────────────────────── */}
        <div className="w-72 shrink-0 sticky top-4 space-y-4">
          {/* Order summary card */}
          <div className="border rounded-lg bg-card overflow-hidden" data-testid="order-summary-panel">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Order Summary</span>
            </div>

            {selectedItems.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No items selected yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Enter a quantity next to any product to add it.</p>
              </div>
            ) : (
              <>
                <div className="divide-y max-h-72 overflow-y-auto">
                  {selectedItems.map(({ product, quantity }) => (
                    <div key={product.id} className="px-4 py-2.5 flex items-center justify-between gap-2" data-testid={`summary-item-${product.id}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(product.price)} × {quantity}</p>
                      </div>
                      <span className="text-xs font-semibold shrink-0">
                        {formatCurrency(String((parseFloat(product.price) * quantity).toFixed(2)))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-foreground" data-testid="text-order-total">
                    {formatCurrency(String(orderTotal.toFixed(2)))}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={selectedItems.length === 0 || submitOrderMutation.isPending || saveDraftMutation.isPending}
              onClick={() => setConfirmSubmit(true)}
              data-testid="button-submit-order"
            >
              <CheckCircle2 className="h-4 w-4" />
              Submit Order
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              disabled={selectedItems.length === 0 || saveDraftMutation.isPending || submitOrderMutation.isPending}
              onClick={() => saveDraftMutation.mutate()}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4" />
              {saveDraftMutation.isPending ? "Saving…" : "Save Draft"}
            </Button>
            <Link href={`/restaurant/vendor/${vendorId}`}>
              <Button variant="ghost" className="w-full gap-2 text-muted-foreground" data-testid="button-cancel-composer">
                <ArrowLeft className="h-4 w-4" />
                Back to Vendor
              </Button>
            </Link>
          </div>

          {/* Vendor context */}
          <div className="border rounded-lg bg-card px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground" data-testid="text-composer-vendor-context">
                {vendor.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{restaurant?.name}</span>
            </div>
            {isContinuingDraft && (
              <div className="flex items-center gap-2 pt-1 border-t mt-1">
                <PenLine className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-600 font-medium">
                  Continuing draft from {formatDate(existingDraft!.createdAt)}
                </span>
              </div>
            )}
          </div>
        </div>

      {/* ── Submit confirmation dialog ──────────────────────────────────────── */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send your order to <strong>{vendor.name}</strong>. You won't be able to edit it after submission.
              {selectedItems.length > 0 && (
                <span className="block mt-2 font-medium text-foreground">
                  {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} · {formatCurrency(String(orderTotal.toFixed(2)))}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-submit">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => submitOrderMutation.mutate()}
              disabled={submitOrderMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {submitOrderMutation.isPending ? "Submitting…" : "Submit Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
