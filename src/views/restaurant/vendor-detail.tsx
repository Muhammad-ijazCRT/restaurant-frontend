import { useState, useEffect } from "react";
import { restaurantOrderApi } from "@/api/restaurant/orders";
import { profileKeys } from "@/api/shared/profile";
import { adminDashboardKeys } from "@/api/admin/dashboard";
import { restaurantReviewApi, restaurantReviewKeys, restaurantReviewPaths } from "@/api/restaurant/review";
import { relationshipApi, relationshipKeys } from "@/api/shared/relationships";
import { vendorKeys } from "@/api/vendor/vendors";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { vendorProductKeys } from "@/api/vendor/products";
import { restaurantOrderKeys } from "@/api/restaurant/orders";
import { Link, useLocation, useParams } from "@/lib/wouter-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
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
import { resolveInvoicedOrderDisplay } from "@/lib/invoice-utils";
import { isDisputedOrder, isInvoicedUnpaidOrder } from "@/lib/order-status-utils";
import {
  getEffectiveLineQty,
  getOriginalOrderTotal,
  getVendorAdjustedQty,
  getVendorAdjustedTotal,
  getVendorNote,
  normalizeLineFulfillment,
} from "@/lib/vendor-order-fulfillment";
import { formatPhone, formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Mail, Phone, UserCircle, LogOut, Package,
  UtensilsCrossed, ChevronDown, ChevronRight, CalendarDays,
  ArrowLeft, Search, X, ShoppingCart, PenLine, ReceiptText,
  CheckCircle2, Lock, Trash2, Truck, ClipboardCheck, CreditCard, ShieldAlert, GripVertical,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: "In Stock",
  inactive: "Out of Stock",
};

const ORDER_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  draft:     { label: "Draft",      classes: "bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400" },
  submitted: { label: "Submitted",  classes: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  delivered: { label: "Delivered",  classes: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
};

type DraftResponse = { order: Order; lineItems: OrderLineItem[] } | null;
type SubmittedOrderEntry = { order: Order; lineItems: OrderLineItem[]; fulfillments?: LineFulfillment[]; invoice?: Invoice | null };
type OrderSheetEntry = {
  id: string; relationshipId: string; productId: string;
  productName: string; sku: string | null; unitType: string; unitSize: string; price: string;
};

// ─── Delivered Order Review Sub-component ─────────────────────────────────────

interface ReviewDraftItem { receivedQty: string; note: string; }

function DeliveredOrderReview({
  order, lineItems, productMap, restaurantId, readOnly = false,
}: {
  order: Order;
  lineItems: OrderLineItem[];
  productMap: Map<string, Product>;
  restaurantId: string;
  readOnly?: boolean;
}) {
  const submittedOrdersQueryKey = restaurantOrderKeys.submittedList(restaurantId, order.vendorId);

  const { data: existingFulfillments = [] } = useQuery<LineFulfillment[]>({
    queryKey: restaurantReviewKeys.review(restaurantId, order.id),
    queryFn: async () => {
      const res = await fetch(apiUrl(restaurantReviewPaths.review(restaurantId, order.id)));
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const [draft, setDraft] = useState<Record<string, ReviewDraftItem>>({});

  useEffect(() => {
    if (lineItems.length === 0) return;
    const fulfillmentByLine = new Map(
      existingFulfillments.map((f) => [f.orderLineItemId, normalizeLineFulfillment(f)!]),
    );
    const map: Record<string, ReviewDraftItem> = {};
    for (const li of lineItems) {
      const fulfillment = fulfillmentByLine.get(li.id);
      const expectedQty = getEffectiveLineQty(fulfillment, li.quantity, order);
      const savedReceived = fulfillment?.restaurantReceivedQty;
      map[li.id] = {
        receivedQty: savedReceived != null ? String(savedReceived) : String(expectedQty),
        note: fulfillment?.restaurantNote ?? "",
      };
    }
    setDraft(map);
  }, [existingFulfillments, lineItems, order]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const items = lineItems.map(li => ({
        lineItemId: li.id,
        receivedQty: draft[li.id]?.receivedQty !== "" && draft[li.id]?.receivedQty != null
          ? parseInt(draft[li.id].receivedQty, 10)
          : null,
        note: draft[li.id]?.note || null,
      }));
      const res = await restaurantReviewApi.submit(restaurantId, order.id, { items });
      return res.json();
    },
    onSuccess: (result: { pendingVendorReview?: boolean; invoiced?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: restaurantReviewKeys.review(restaurantId, order.id) });
      queryClient.invalidateQueries({ queryKey: submittedOrdersQueryKey });
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(order.vendorId) });
      void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });
    },
  });

  function setField(lineItemId: string, field: keyof ReviewDraftItem, value: string) {
    setDraft(prev => ({
      ...prev,
      [lineItemId]: { ...prev[lineItemId] ?? { receivedQty: "", note: "" }, [field]: value },
    }));
  }

  const accentColor = readOnly ? "blue" : "amber";

  if (lineItems.length === 0) {
    return (
      <div className="border-t py-6 text-center text-sm text-muted-foreground">
        No items in this order.
      </div>
    );
  }

  const fulfillmentMap = new Map(
    existingFulfillments.map((f) => [f.orderLineItemId, normalizeLineFulfillment(f)!]),
  );
  const orderedTotal = getOriginalOrderTotal(lineItems);
  const vendorTotal = getVendorAdjustedTotal(lineItems, (lineItemId) =>
    fulfillmentMap.get(lineItemId),
  );
  const orderTotal = lineItems.reduce((acc, li) => {
    const liDraft = draft[li.id] ?? { receivedQty: "", note: "" };
    const expectedQty = getEffectiveLineQty(fulfillmentMap.get(li.id), li.quantity, order);
    const receivedQtyNum =
      liDraft.receivedQty !== "" ? parseInt(liDraft.receivedQty, 10) : expectedQty;
    return acc + parseFloat(li.unitPriceAtTimeOfOrder) * receivedQtyNum;
  }, 0);

  return (
    <div className="border-t" data-testid={`section-review-form-${order.id}`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium pl-10">Product</TableHead>
              <TableHead className="font-medium text-right w-16">Ordered</TableHead>
              <TableHead className="font-medium text-right w-16">Vendor</TableHead>
              <TableHead className="font-medium min-w-[100px]">Vendor Note</TableHead>
              <TableHead className="font-medium text-right w-20">Unit Price</TableHead>
              <TableHead className="font-medium text-right w-24">Received Qty</TableHead>
              <TableHead className="font-medium text-right w-20">Line Total</TableHead>
              <TableHead className="font-medium min-w-[140px]">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map(li => {
              const product = productMap.get(li.productId);
              const fulfillment = fulfillmentMap.get(li.id);
              const vendorQty = getVendorAdjustedQty(fulfillment, li.quantity);
              const expectedQty = getEffectiveLineQty(fulfillment, li.quantity, order);
              const liDraft = draft[li.id] ?? { receivedQty: String(expectedQty), note: "" };
              const receivedQtyNum =
                liDraft.receivedQty !== "" ? parseInt(liDraft.receivedQty, 10) : expectedQty;
              const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * receivedQtyNum;
              const hasDiscrepancy = receivedQtyNum !== expectedQty;
              return (
                <TableRow key={li.id} data-testid={`row-review-item-${li.id}`}>
                  <TableCell className="pl-10">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-md p-1.5 shrink-0 ${accentColor === "blue" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-amber-50 dark:bg-amber-950/40"}`}>
                        <Package className={`h-3 w-3 ${accentColor === "blue" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`} />
                      </div>
                      <span className="text-sm font-medium" data-testid={`text-review-product-${li.id}`}>
                        {product?.name ?? li.productId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground" data-testid={`text-review-ordered-qty-${li.id}`}>
                    {li.quantity}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {vendorQty}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getVendorNote(fulfillment) || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatCurrency(li.unitPriceAtTimeOfOrder)}
                  </TableCell>
                  <TableCell className="text-right">
                    {readOnly ? (
                      <span className="text-sm font-medium" data-testid={`text-received-qty-${li.id}`}>
                        {liDraft.receivedQty !== "" ? liDraft.receivedQty : <span className="text-muted-foreground">—</span>}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-7 text-sm text-right ml-auto"
                        placeholder="—"
                        value={liDraft.receivedQty}
                        onChange={e => setField(li.id, "receivedQty", e.target.value)}
                        data-testid={`input-received-qty-${li.id}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold" data-testid={`text-review-line-total-${li.id}`}>
                    <span className={hasDiscrepancy ? "text-red-600 dark:text-red-400" : ""}>
                      {formatCurrency(String(lineTotal.toFixed(2)))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-sm text-muted-foreground" data-testid={`text-review-note-${li.id}`}>
                        {liDraft.note || <span className="italic">—</span>}
                      </span>
                    ) : (
                      <Input
                        type="text"
                        className="h-7 text-sm"
                        placeholder="Add note…"
                        maxLength={500}
                        value={liDraft.note}
                        onChange={e => setField(li.id, "note", e.target.value)}
                        data-testid={`input-review-note-${li.id}`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className={`px-5 py-3 flex items-center justify-between border-t ${accentColor === "blue" ? "bg-blue-50/40 dark:bg-blue-950/10" : "bg-amber-50/40 dark:bg-amber-950/10"}`}>
        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-400" data-testid={`text-review-submitted-${order.id}`}>
              <CheckCircle2 className="h-4 w-4" />
              Review submitted
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className="text-xs text-muted-foreground">
            Ordered: {formatCurrency(String(orderedTotal.toFixed(2)))}
          </span>
          <span className="text-xs text-muted-foreground">
            Vendor: {formatCurrency(String(vendorTotal.toFixed(2)))}
          </span>
          <span className={`text-sm font-semibold ${accentColor === "blue" ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`} data-testid={`text-review-footer-total-${order.id}`}>
            Review: {formatCurrency(String(orderTotal.toFixed(2)))}
          </span>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              data-testid={`button-submit-review-${order.id}`}
            >
              <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
              {submitMutation.isPending ? "Submitting…" : "Submit Review"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RestaurantVendorDetail() {
  const { restaurantId, logout } = useRestaurantAuth();
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── Layout state ──────────────────────────────────────────────────────────
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [orderSheetExpanded, setOrderSheetExpanded] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [activeSubmittedExpanded, setActiveSubmittedExpanded] = useState(false);
  const [needsReviewExpanded, setNeedsReviewExpanded] = useState(false);
  const [invoicedExpanded, setInvoicedExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [disputedRpExpanded, setDisputedRpExpanded] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // ── Order/dialog state ────────────────────────────────────────────────────
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set());
  const [orderSheetEditMode, setOrderSheetEditMode] = useState(false);
  const [sortMode, setSortMode] = useState<"alpha" | "custom">("custom");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  const { data: draftData, isLoading: draftLoading } = useQuery<DraftResponse>({
    queryKey: restaurantOrderKeys.draft(restaurantId, vendorId),
    enabled: !!restaurantId && !!vendorId,
  });

  const { data: submittedOrdersData = [], isLoading: submittedLoading } = useQuery<SubmittedOrderEntry[]>({
    queryKey: restaurantOrderKeys.submittedList(restaurantId, vendorId),
    enabled: !!restaurantId && !!vendorId,
  });

  const sheetRelationshipId = allRelationships.find(
    r => r.restaurantOrgId === restaurantId && r.vendorId === vendorId && r.status !== "archived"
  )?.id;

  const { data: orderSheetData = [] } = useQuery<OrderSheetEntry[]>({
    queryKey: relationshipKeys.orderSheet(sheetRelationshipId),
    enabled: !!sheetRelationshipId,
  });

  // ── Access check ──────────────────────────────────────────────────────────

  const linkedRelationships = allRelationships.filter(
    r => r.restaurantOrgId === restaurantId && r.status !== "archived"
  );
  const relationship = linkedRelationships.find(r => r.vendorId === vendorId) ?? null;

  // ── Product filtering ──────────────────────────────────────────────────────

  const visibleProducts = products.filter(p => p.status !== "archived");
  const orderSheetProductIds = new Set(orderSheetData.map(item => item.productId));
  const addableProducts = visibleProducts.filter(p => !orderSheetProductIds.has(p.id));
  const sortedOrderSheetData = sortMode === "alpha"
    ? [...orderSheetData].sort((a, b) => a.productName.localeCompare(b.productName))
    : customOrder.length > 0
      ? (() => {
          const orderMap = new Map(customOrder.map((id, i) => [id, i]));
          return [...orderSheetData].sort((a, b) =>
            (orderMap.get(a.productId) ?? Infinity) - (orderMap.get(b.productId) ?? Infinity)
          );
        })()
      : orderSheetData;

  const isFiltering = productSearch.trim() !== "" || statusFilter !== "all";
  const filteredProducts = isFiltering
    ? visibleProducts.filter(p => {
        const q = productSearch.trim().toLowerCase();
        const matchesSearch = !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku?.toLowerCase().includes(q) ?? false);
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
    : visibleProducts;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const draftQueryKey = restaurantOrderKeys.draft(restaurantId, vendorId);
  const submittedQueryKey = restaurantOrderKeys.submittedList(restaurantId, vendorId);
  const orderSheetQueryKey = relationshipKeys.orderSheet(sheetRelationshipId);

  useEffect(() => {
    if (!sheetRelationshipId) return;
    const stored = localStorage.getItem(`order_sheet_sort_${sheetRelationshipId}`);
    if (stored === "alpha" || stored === "custom") setSortMode(stored as "alpha" | "custom");
  }, [sheetRelationshipId]);

  useEffect(() => {
    if (!sheetRelationshipId) return;
    localStorage.setItem(`order_sheet_sort_${sheetRelationshipId}`, sortMode);
  }, [sortMode, sheetRelationshipId]);

  useEffect(() => {
    if (!sheetRelationshipId) return;
    const stored = localStorage.getItem(`order_sheet_custom_order_${sheetRelationshipId}`);
    if (stored) {
      try { setCustomOrder(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [sheetRelationshipId]);

  useEffect(() => {
    if (!sheetRelationshipId || customOrder.length === 0) return;
    localStorage.setItem(`order_sheet_custom_order_${sheetRelationshipId}`, JSON.stringify(customOrder));
  }, [customOrder, sheetRelationshipId]);

  const bulkAddMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      await Promise.all(
        productIds.map(id => relationshipApi.addOrderSheetItem(sheetRelationshipId, { productId: id }))
      );
      return productIds;
    },
    onSuccess: (addedIds) => {
      queryClient.invalidateQueries({ queryKey: orderSheetQueryKey });
      setSelectedToAdd(new Set());
      setCustomOrder(prev => {
        const existing = prev.length > 0 ? prev : orderSheetData.map(i => i.productId);
        const fresh = addedIds.filter(id => !existing.includes(id));
        return [...existing, ...fresh];
      });
      toast({ title: `${addedIds.length} product${addedIds.length !== 1 ? "s" : ""} added to Order Sheet` });
    },
    onError: () => {
      toast({ title: "Could not add products", variant: "destructive" });
    },
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      await Promise.all(
        productIds.map(id => relationshipApi.removeOrderSheetItem(sheetRelationshipId, id))
      );
      return productIds;
    },
    onSuccess: (removedIds) => {
      queryClient.invalidateQueries({ queryKey: orderSheetQueryKey });
      setSelectedToRemove(new Set());
      setCustomOrder(prev => prev.filter(id => !removedIds.includes(id)));
      toast({ title: `${removedIds.length} product${removedIds.length !== 1 ? "s" : ""} removed from Order Sheet` });
    },
    onError: () => {
      toast({ title: "Could not remove products", variant: "destructive" });
    },
  });

  const existingDraft = draftData?.order ?? null;

  const submitOrderMutation = useMutation({
    mutationFn: async () => {
      if (!existingDraft) throw new Error("No draft order to submit.");
      const res = await restaurantOrderApi.update(restaurantId, existingDraft.id, { status: "submitted" });
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
      toast({ title: "Order submitted", description: "Your order has been submitted to the vendor." });
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

  const deleteDraftMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await restaurantOrderApi.delete(restaurantId, orderId);
    },
    onSuccess: () => {
      queryClient.setQueryData(draftQueryKey, null);
      setConfirmDelete(false);
      toast({ title: "Draft deleted", description: "Your draft order has been removed." });
    },
    onError: (err: any) => {
      setConfirmDelete(false);
      toast({
        title: "Could not delete draft",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const payOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await restaurantOrderApi.pay(restaurantId, orderId);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: submittedQueryKey });
      // Sync VP so the order leaves "Invoiced" and moves to "History" there too
      queryClient.invalidateQueries({ queryKey: vendorOrderKeys.list(vendorId) });
      // Refresh admin dashboard recent activity to show the payment entry
      queryClient.invalidateQueries({ queryKey: adminDashboardKeys.recentActivity() });
      toast({ title: "Order marked as paid", description: "The invoice has been marked as paid." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not mark as paid",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!restaurantId) {
      navigate("/restaurant/login");
    }
  }, [restaurantId, navigate]);

  useEffect(() => {
    if (restaurantId && !relLoading && !relationship) {
      navigate("/restaurant/portal");
    }
  }, [restaurantId, relLoading, relationship, navigate]);

  // ── Loading state ──────────────────────────────────────────────────────────

  const isLoading = vendorLoading || relLoading;

  if (!restaurantId) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!vendor || !relationship) return null;

  const relStatus = relationship.status;
  const existingLineItems = draftData?.lineItems ?? [];
  const submittedOrders = submittedOrdersData;
  const activeSubmittedOrders = submittedOrders.filter(e => e.order.status === "submitted");
  const needsReviewOrders = submittedOrders.filter(e => e.order.status === "delivered" && !e.order.restaurantReviewSubmittedAt);
  const waitingForApprovalOrders = submittedOrders.filter(e => e.order.status === "delivered" && !!e.order.restaurantReviewSubmittedAt && !e.order.vendorApprovedAt && !e.order.vendorRejectedAt);
  const disputedRpOrders = submittedOrders.filter((e) => isDisputedOrder(e.order));
  const invoicedOrders = submittedOrders.filter((e) => isInvoicedUnpaidOrder(e.order));
  const historyOrders = submittedOrders
    .filter(e => !!e.order.paidAt)
    .sort((a, b) => new Date(b.order.paidAt!).getTime() - new Date(a.order.paidAt!).getTime());
  function toggleOrderExpanded(orderId: string) {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  }

  // Build a map for line item display
  const productMap = new Map(products.map(p => [p.id, p]));

  return (
    <div className="space-y-6 pb-12">

        {/* Vendor Info Card */}
        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground" data-testid="text-vendor-name">
                  {vendor.name}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    className={`text-xs capitalize ${
                      relStatus === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                    data-testid="text-vendor-status"
                  >
                    {relStatus === "active" ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal">
                    Linked Vendor
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCircle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Contact</span>
                </div>
                <p className="text-sm font-medium text-foreground" data-testid="text-vendor-contact">
                  {vendor.contactName}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Email</span>
                </div>
                <p className="text-sm font-medium text-foreground" data-testid="text-vendor-email">
                  {vendor.email}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Phone</span>
                </div>
                <p className="text-sm font-medium text-foreground" data-testid="text-vendor-phone">
                  {formatPhone(vendor.phone)}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Linked Since</span>
                </div>
                <p className="text-sm font-medium text-foreground" data-testid="text-vendor-since">
                  {formatDate(relationship.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Section */}
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-orders">
          {/* Section header */}
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setOrdersExpanded(!ordersExpanded)}
            data-testid="button-toggle-orders"
          >
            <div className="flex items-center gap-2">
              {ordersExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Orders</h2>
              {existingDraft && (
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  Draft
                </Badge>
              )}
              {needsReviewOrders.length > 0 && (
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {needsReviewOrders.length} Needs Review
                </Badge>
              )}
              {waitingForApprovalOrders.length > 0 && (
                <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {waitingForApprovalOrders.length} Pending Invoice
                </Badge>
              )}
              {activeSubmittedOrders.length > 0 && (
                <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                  {activeSubmittedOrders.length === 1 ? "1 Submitted" : `${activeSubmittedOrders.length} Submitted`}
                </Badge>
              )}
            </div>
            {!existingDraft && !draftLoading && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/restaurant/vendor/${vendorId}/order`);
                }}
                data-testid="button-start-order"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Start Order
              </Button>
            )}
          </div>

          {ordersExpanded && (
            <div className="border-t">
              {(draftLoading || submittedLoading) ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              ) : (!existingDraft && submittedOrders.length === 0) ? (
                /* ── Empty state ─────────────────────────────────────────── */
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center" data-testid="empty-state-orders">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No orders yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Start a draft to select products and quantities from this vendor.
                  </p>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(`/restaurant/vendor/${vendorId}/order`)}
                    data-testid="button-start-order-empty"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Start Order
                  </Button>
                </div>
              ) : (
                <>
                  {/* ── Draft view (shown when a draft exists) ───────────── */}
                  {existingDraft && (
                    <div data-testid="section-existing-draft">
                      <div className="px-5 py-3 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/10 border-b">
                        <div className="flex items-center gap-2">
                          <PenLine className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-sm font-medium text-foreground">Draft Order</span>
                          <span className="text-xs text-muted-foreground">
                            · Started {formatDate(existingDraft.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
                            onClick={() => setConfirmDelete(true)}
                            disabled={deleteDraftMutation.isPending}
                            data-testid="button-delete-draft"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete Draft
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => navigate(`/restaurant/vendor/${vendorId}/order`)}
                            data-testid="button-edit-draft"
                          >
                            <PenLine className="h-3 w-3" />
                            Edit Draft
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setConfirmSubmit(true)}
                            disabled={existingLineItems.length === 0}
                            data-testid="button-submit-order"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Submit Order
                          </Button>
                        </div>
                      </div>

                      {existingLineItems.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground" data-testid="draft-empty">
                          No items in this draft yet.
                        </div>
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="font-medium">Product</TableHead>
                                <TableHead className="font-medium text-right">Unit Price</TableHead>
                                <TableHead className="font-medium text-right">Qty</TableHead>
                                <TableHead className="font-medium text-right">Line Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {existingLineItems.map(li => {
                                const product = productMap.get(li.productId);
                                const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity;
                                return (
                                  <TableRow key={li.id} data-testid={`row-draft-item-${li.productId}`}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
                                          <Package className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <span className="text-sm font-medium" data-testid={`text-draft-item-name-${li.productId}`}>
                                          {product?.name ?? li.productId}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">
                                      {formatCurrency(li.unitPriceAtTimeOfOrder)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-medium" data-testid={`text-draft-item-qty-${li.productId}`}>
                                      {li.quantity}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-semibold">
                                      {formatCurrency(String(lineTotal.toFixed(2)))}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                          <div className="px-5 py-3 flex justify-end border-t bg-muted/10">
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-muted-foreground">{existingLineItems.length} item{existingLineItems.length !== 1 ? "s" : ""}</span>
                              <span className="text-sm font-semibold text-foreground" data-testid="text-draft-total">
                                Total: {formatCurrency(String(
                                  existingLineItems.reduce(
                                    (acc, li) => acc + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0
                                  ).toFixed(2)
                                ))}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Submitted (awaiting vendor action) ──────────── */}
                  {activeSubmittedOrders.length > 0 && (
                    <div
                      className={existingDraft ? "border-t" : ""}
                      data-testid="section-submitted-orders"
                    >
                      <div
                        className="px-5 py-2.5 bg-orange-50 dark:bg-orange-950/20 flex items-center gap-2 border-b cursor-pointer select-none hover:bg-orange-50/70 dark:hover:bg-orange-950/30 transition-colors"
                        onClick={() => setActiveSubmittedExpanded(v => !v)}
                        data-testid="button-toggle-submitted-section"
                      >
                        {activeSubmittedExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                        <ClipboardCheck className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">Submitted</span>
                        <Badge className="text-xs bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                          {activeSubmittedOrders.length}
                        </Badge>
                      </div>
                      {activeSubmittedExpanded && activeSubmittedOrders.map(({ order, lineItems }, idx) => {
                        const isExpanded = expandedOrderIds[order.id] ?? false;
                        const orderTotal = lineItems.reduce(
                          (acc, li) => acc + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0
                        );
                        const orderNum = order.displayId;
                        return (
                          <div
                            key={order.id}
                            className={`${idx > 0 ? "border-t" : ""} bg-orange-50/30 dark:bg-orange-950/10`}
                            data-testid={`section-submitted-order-${order.id}`}
                          >
                            <div
                              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
                              onClick={() => toggleOrderExpanded(order.id)}
                              data-testid={`button-toggle-order-${order.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <ClipboardCheck className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                                <span className="text-sm font-medium text-foreground">Order #{orderNum}</span>
                                <span className="text-xs text-muted-foreground">· {formatDate(order.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                                </span>
                                <span className="text-sm font-semibold text-foreground" data-testid={`text-submitted-total-${order.id}`}>
                                  {formatCurrency(String(orderTotal.toFixed(2)))}
                                </span>
                                <Badge className={`text-xs ${ORDER_STATUS_CONFIG.submitted.classes}`} data-testid={`badge-order-status-${order.id}`}>
                                  {ORDER_STATUS_CONFIG.submitted.label}
                                </Badge>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t bg-muted/5">
                                {lineItems.length === 0 ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">No items in this order.</div>
                                ) : (
                                  <>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                          <TableHead className="font-medium pl-10">Product</TableHead>
                                          <TableHead className="font-medium text-right">Unit Price</TableHead>
                                          <TableHead className="font-medium text-right">Qty</TableHead>
                                          <TableHead className="font-medium text-right">Line Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {lineItems.map(li => {
                                          const product = productMap.get(li.productId);
                                          const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity;
                                          return (
                                            <TableRow key={li.id} data-testid={`row-submitted-item-${li.productId}-${order.id}`}>
                                              <TableCell className="pl-10">
                                                <div className="flex items-center gap-2">
                                                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/40 p-1.5">
                                                    <Package className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                                  </div>
                                                  <span className="text-sm font-medium" data-testid={`text-submitted-item-name-${li.productId}`}>
                                                    {product?.name ?? li.productId}
                                                  </span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right text-sm text-muted-foreground">
                                                {formatCurrency(li.unitPriceAtTimeOfOrder)}
                                              </TableCell>
                                              <TableCell className="text-right text-sm font-medium" data-testid={`text-submitted-item-qty-${li.productId}`}>
                                                {li.quantity}
                                              </TableCell>
                                              <TableCell className="text-right text-sm font-semibold">
                                                {formatCurrency(String(lineTotal.toFixed(2)))}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                    <div className="px-5 py-2.5 flex justify-end border-t bg-orange-50/30 dark:bg-orange-950/10">
                                      <div className="flex items-center gap-3">
                                        <Lock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Read-only</span>
                                        <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                                          Total: {formatCurrency(String(orderTotal.toFixed(2)))}
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Needs Review (Delivered orders) ─────────────── */}
                  {needsReviewOrders.length > 0 && (
                    <div
                      className={existingDraft || activeSubmittedOrders.length > 0 ? "border-t" : ""}
                      data-testid="section-needs-review"
                    >
                      <div
                        className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-2 border-b cursor-pointer select-none hover:bg-amber-50/70 dark:hover:bg-amber-950/30 transition-colors"
                        onClick={() => setNeedsReviewExpanded(v => !v)}
                        data-testid="button-toggle-needs-review-section"
                      >
                        {needsReviewExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        <Truck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Needs Review</span>
                        <Badge className="text-xs bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                          {needsReviewOrders.length}
                        </Badge>
                      </div>
                      {needsReviewExpanded && needsReviewOrders.map(({ order, lineItems }, idx) => {
                        const orderTotal = lineItems.reduce(
                          (acc, li) => acc + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0
                        );
                        const orderNum = order.displayId;
                        return (
                          <div
                            key={order.id}
                            className={`${idx > 0 ? "border-t" : ""} bg-amber-50/40 dark:bg-amber-950/10`}
                            data-testid={`section-delivered-order-${order.id}`}
                          >
                            <div className="px-5 py-3 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Truck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span className="text-sm font-medium text-foreground" data-testid={`text-needs-review-order-id-${order.id}`}>Order #{orderNum}</span>
                                <span className="text-xs text-muted-foreground hidden sm:inline">· {formatDate(order.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                                </span>
                                <span className="text-sm font-semibold text-foreground" data-testid={`text-needs-review-total-${order.id}`}>
                                  {formatCurrency(String(orderTotal.toFixed(2)))}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 h-7 px-3 text-xs font-medium"
                                  onClick={() => navigate(`/restaurant/vendor/${vendorId}/review/${order.id}`)}
                                  data-testid={`button-review-order-${order.id}`}
                                >
                                  <ClipboardCheck className="h-3 w-3 mr-1.5" />
                                  Review Order
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* ── Pending Invoice (Delivered + review submitted) ── */}
                  {waitingForApprovalOrders.length > 0 && (
                    <div
                      className={existingDraft || needsReviewOrders.length > 0 ? "border-t" : ""}
                      data-testid="section-waiting-for-approval"
                    >
                      <div className="px-5 py-2.5 bg-blue-50 dark:bg-blue-950/20 flex items-center gap-2 border-b">
                        <ClipboardCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Waiting for Approval</span>
                        <Badge className="text-xs bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          {waitingForApprovalOrders.length}
                        </Badge>
                      </div>
                      {waitingForApprovalOrders.map(({ order, lineItems }, idx) => {
                        const isExpanded = expandedOrderIds[order.id] ?? false;
                        const orderNum = order.displayId;
                        return (
                          <div
                            key={order.id}
                            className={`${idx > 0 ? "border-t" : ""} bg-blue-50/30 dark:bg-blue-950/10`}
                            data-testid={`section-waiting-order-${order.id}`}
                          >
                            <div
                              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors"
                              onClick={() => toggleOrderExpanded(order.id)}
                              data-testid={`button-toggle-order-${order.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <ClipboardCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                <span className="text-sm font-medium text-foreground">Order #{orderNum}</span>
                                <span className="text-xs text-muted-foreground">· {formatDate(order.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                                </span>
                                <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" data-testid={`badge-order-status-${order.id}`}>
                          Pending Invoice
                                </Badge>
                              </div>
                            </div>
                            {isExpanded && (
                              <DeliveredOrderReview
                                order={order}
                                lineItems={lineItems}
                                productMap={productMap}
                                restaurantId={restaurantId!}
                                readOnly={true}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Disputed (Vendor rejected restaurant's review) ── */}
                  {disputedRpOrders.length > 0 && (
                    <div
                      className={existingDraft || needsReviewOrders.length > 0 || waitingForApprovalOrders.length > 0 ? "border-t" : ""}
                      data-testid="section-rp-disputed"
                    >
                      <div
                        className="px-5 py-2.5 bg-red-50 dark:bg-red-950/20 flex items-center gap-2 border-b cursor-pointer select-none hover:bg-red-100/50 dark:hover:bg-red-950/40 transition-colors"
                        onClick={() => setDisputedRpExpanded(!disputedRpExpanded)}
                        data-testid="button-toggle-rp-disputed-section"
                      >
                        {disputedRpExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                        <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Disputed</span>
                        <Badge className="text-xs bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300">
                          {disputedRpOrders.length}
                        </Badge>
                      </div>
                      {disputedRpExpanded && disputedRpOrders.map(({ order, lineItems }, idx) => {
                        const orderNum = order.displayId;
                        const total = lineItems.reduce((sum, li) => sum + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0);
                        return (
                          <div
                            key={order.id}
                            className={`${idx > 0 ? "border-t" : ""} bg-red-50/20 dark:bg-red-950/10`}
                            data-testid={`section-rp-disputed-order-${order.id}`}
                          >
                            <div className="px-5 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <ShieldAlert className="h-3.5 w-3.5 text-red-600 shrink-0" />
                                <span className="text-sm font-medium text-foreground" data-testid={`text-rp-disputed-order-num-${order.id}`}>Order #{orderNum}</span>
                                <span className="text-xs text-muted-foreground">· {formatDate(order.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-foreground" data-testid={`text-rp-disputed-total-${order.id}`}>{formatCurrency(String(total.toFixed(2)))}</span>
                                <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" data-testid={`badge-rp-disputed-status-${order.id}`}>Disputed</Badge>
                              </div>
                            </div>
                            <div className="px-5 pb-3 flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0">
                                <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-red-700 dark:text-red-400">Vendor rejected your review</span>
                                  {order.vendorRejectionReason && (
                                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5" data-testid={`text-rp-dispute-reason-${order.id}`}>
                                      "{order.vendorRejectionReason}"
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs h-7 gap-1.5"
                                onClick={() => navigate(`/restaurant/vendor/${vendorId}/dispute/${order.id}`)}
                                data-testid={`button-resolve-dispute-${order.id}`}
                              >
                                <ShieldAlert className="h-3 w-3" />
                                Resolve Dispute
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Invoiced (Vendor approved, not yet paid) ─────── */}
                  {invoicedOrders.length > 0 && (
                    <div
                      className={existingDraft || needsReviewOrders.length > 0 || waitingForApprovalOrders.length > 0 || disputedRpOrders.length > 0 ? "border-t" : ""}
                      data-testid="section-invoiced-orders"
                    >
                      <div
                        className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-2 border-b cursor-pointer select-none hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40 transition-colors"
                        onClick={() => setInvoicedExpanded(!invoicedExpanded)}
                        data-testid="button-toggle-invoiced-section"
                      >
                        {invoicedExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Invoiced</span>
                        <Badge className="text-xs bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                          {invoicedOrders.length}
                        </Badge>
                      </div>
                      {invoicedExpanded && invoicedOrders.map(({ order, invoice, lineItems, fulfillments }, idx) => {
                        const isExpanded = expandedOrderIds[order.id] ?? false;
                        const { snapshotLines, orderTotal } = resolveInvoicedOrderDisplay({
                          invoice,
                          lineItems,
                          fulfillments,
                          productMap,
                        });
                        const orderNum = order.displayId;
                        return (
                          <div
                            key={order.id}
                            className={`${idx > 0 ? "border-t" : ""} bg-emerald-50/20 dark:bg-emerald-950/10`}
                            data-testid={`section-invoiced-order-${order.id}`}
                          >
                            <div
                              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 transition-colors"
                              onClick={() => toggleOrderExpanded(order.id)}
                              data-testid={`button-toggle-invoiced-order-${order.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="text-sm font-medium text-foreground">Order #{orderNum}</span>
                                <span className="text-xs text-muted-foreground">· {formatDate(order.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                <span className="text-sm font-semibold text-foreground" data-testid={`text-invoiced-order-total-${order.id}`}>
                                  {formatCurrency(String(orderTotal.toFixed(2)))}
                                </span>
                                <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" data-testid={`badge-order-status-${order.id}`}>
                                  Invoiced
                                </Badge>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  onClick={() => payOrderMutation.mutate(order.id)}
                                  disabled={payOrderMutation.isPending}
                                  data-testid={`button-mark-paid-${order.id}`}
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Mark as Paid
                                </Button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="px-5 pb-4 pt-1">
                                <table className="w-full text-xs" data-testid={`table-invoiced-order-${order.id}`}>
                                  <thead>
                                    <tr className="text-muted-foreground border-b">
                                      <th className="text-left font-medium pb-1.5 pr-2">Product</th>
                                      <th className="text-left font-medium pb-1.5 pr-2">SKU</th>
                                      <th className="text-right font-medium pb-1.5 pr-2">Approved Qty</th>
                                      <th className="text-right font-medium pb-1.5">Unit Price</th>
                                      <th className="text-right font-medium pb-1.5">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {snapshotLines.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="py-4 text-center text-muted-foreground">
                                          No invoice line items found for this order.
                                        </td>
                                      </tr>
                                    ) : (
                                      snapshotLines.map((sl) => (
                                        <tr key={sl.orderLineItemId} className="border-b border-border/40 last:border-0" data-testid={`row-invoiced-item-${sl.orderLineItemId}`}>
                                          <td className="py-2 pr-2 text-foreground font-medium">{sl.productName}</td>
                                          <td className="py-2 pr-2 text-muted-foreground font-mono">{sl.sku ?? "—"}</td>
                                          <td className="py-2 pr-2 text-right text-muted-foreground">{sl.approvedQty}</td>
                                          <td className="py-2 pr-2 text-right text-muted-foreground">{formatCurrency(sl.unitPrice)}</td>
                                          <td className="py-2 text-right font-medium text-foreground">{formatCurrency(sl.lineTotal)}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr>
                                      <td colSpan={3} />
                                      <td className="pt-2 text-right text-muted-foreground font-medium">Approved Total</td>
                                      <td className="pt-2 text-right font-bold text-foreground" data-testid={`text-invoiced-footer-total-${order.id}`}>{formatCurrency(String(orderTotal.toFixed(2)))}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                                {order.driverResolutionNote ? (
                                  <div className="mt-4 rounded-md border border-sky-200 bg-sky-50/50 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/20">
                                    <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                                      Driver Resolution Note
                                    </p>
                                    <p className="mt-1 text-sm text-foreground">{order.driverResolutionNote}</p>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Order History (closed / paid orders) ────────── */}
                  {historyOrders.length > 0 && (
                    <div
                      className={existingDraft || activeSubmittedOrders.length > 0 || needsReviewOrders.length > 0 || waitingForApprovalOrders.length > 0 || invoicedOrders.length > 0 ? "border-t" : ""}
                      data-testid="section-order-history"
                    >
                      <div
                        className="px-5 py-2.5 bg-muted/20 flex items-center gap-2 border-b cursor-pointer select-none hover:bg-muted/30 transition-colors"
                        onClick={() => setHistoryExpanded(v => !v)}
                        data-testid="button-toggle-history-section"
                      >
                        {historyExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Order History</span>
                        <Badge className="text-xs bg-muted text-muted-foreground border border-border">
                          {historyOrders.length}
                        </Badge>
                      </div>
                      {historyExpanded && historyOrders.map(({ order, lineItems, invoice, fulfillments }, idx) => {
                        const isExpanded = expandedOrderIds[order.id] ?? false;
                        const { snapshotLines, orderTotal } = resolveInvoicedOrderDisplay({
                          invoice,
                          lineItems,
                          fulfillments,
                          productMap,
                        });
                        const hasSnapshot = snapshotLines.length > 0;
                        const orderNum = order.displayId;
                        return (
                          <div
                            key={order.id}
                            className={idx > 0 ? "border-t" : ""}
                            data-testid={`section-history-order-${order.id}`}
                          >
                            <div
                              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                              onClick={() => toggleOrderExpanded(order.id)}
                              data-testid={`button-toggle-order-${order.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="text-sm font-medium text-foreground">Order #{orderNum}</span>
                                <span className="text-xs text-muted-foreground">
                                  · Ordered {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                                {order.paidAt && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400" data-testid={`text-history-paid-date-${order.id}`}>
                                    · Paid {new Date(order.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
                                </span>
                                <span className="text-sm font-semibold text-foreground" data-testid={`text-submitted-total-${order.id}`}>
                                  {formatCurrency(String(orderTotal.toFixed(2)))}
                                </span>
                                {order.paidAt ? (
                                  <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid={`badge-order-status-${order.id}`}>Paid</Badge>
                                ) : (
                                  <Badge className={`text-xs ${(ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.submitted).classes}`} data-testid={`badge-order-status-${order.id}`}>
                                    {(ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.submitted).label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t bg-muted/5">
                                {(hasSnapshot ? snapshotLines.length === 0 : lineItems.length === 0) ? (
                                  <div className="py-6 text-center text-sm text-muted-foreground">No items in this order.</div>
                                ) : (
                                  <>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                          <TableHead className="font-medium pl-10">Product</TableHead>
                                          <TableHead className="font-medium text-right">Unit Price</TableHead>
                                          <TableHead className="font-medium text-right">Ordered Qty</TableHead>
                                          <TableHead className="font-medium text-right">Approved Qty</TableHead>
                                          <TableHead className="font-medium text-right">Line Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {hasSnapshot
                                          ? snapshotLines.map(sl => (
                                            <TableRow key={sl.orderLineItemId} data-testid={`row-submitted-item-${sl.productId}-${order.id}`}>
                                              <TableCell className="pl-10">
                                                <div className="flex items-center gap-2">
                                                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-1.5 shrink-0">
                                                    <Package className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                  </div>
                                                  <span className="text-sm font-medium" data-testid={`text-submitted-item-name-${sl.productId}`}>
                                                    {sl.productName}
                                                  </span>
                                                </div>
                                                {sl.restaurantNote && (
                                                  <p className="text-xs text-muted-foreground italic mt-1 pl-8" data-testid={`text-history-item-note-${sl.orderLineItemId}`}>
                                                    "{sl.restaurantNote}"
                                                  </p>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right text-sm text-muted-foreground">
                                                {formatCurrency(sl.unitPrice)}
                                              </TableCell>
                                              <TableCell className="text-right text-sm text-muted-foreground" data-testid={`text-history-ordered-qty-${sl.orderLineItemId}`}>
                                                {lineItems.find(li => li.id === sl.orderLineItemId)?.quantity ?? "—"}
                                              </TableCell>
                                              <TableCell className="text-right text-sm font-medium" data-testid={`text-history-approved-qty-${sl.orderLineItemId}`}>
                                                {sl.approvedQty}
                                              </TableCell>
                                              <TableCell className="text-right text-sm font-semibold">
                                                {formatCurrency(sl.lineTotal)}
                                              </TableCell>
                                            </TableRow>
                                          ))
                                          : lineItems.map(li => {
                                            const product = productMap.get(li.productId);
                                            const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity;
                                            return (
                                              <TableRow key={li.id} data-testid={`row-submitted-item-${li.productId}-${order.id}`}>
                                                <TableCell className="pl-10">
                                                  <div className="flex items-center gap-2">
                                                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-1.5">
                                                      <Package className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                    </div>
                                                    <span className="text-sm font-medium" data-testid={`text-submitted-item-name-${li.productId}`}>
                                                      {product?.name ?? li.productId}
                                                    </span>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                  {formatCurrency(li.unitPriceAtTimeOfOrder)}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-muted-foreground">
                                                  {li.quantity}
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-medium">
                                                  {li.quantity}
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-semibold">
                                                  {formatCurrency(String(lineTotal.toFixed(2)))}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                      </TableBody>
                                    </Table>
                                    <div className="px-5 py-2.5 flex justify-end border-t bg-emerald-50/30 dark:bg-emerald-950/10">
                                      <div className="flex items-center gap-3">
                                        <Lock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Read-only</span>
                                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                          Approved Total: {formatCurrency(String(orderTotal.toFixed(2)))}
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Order Sheet */}
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-order-sheet">
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setOrderSheetExpanded(!orderSheetExpanded)}
            data-testid="button-toggle-order-sheet"
          >
            <div className="flex items-center gap-2">
              {orderSheetExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Order Sheet</h2>
              <Badge variant="secondary" className="text-xs" data-testid="text-order-sheet-count">{orderSheetData.length}</Badge>
            </div>
            {orderSheetExpanded && (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {orderSheetData.length > 0 && (
                  <div className="flex items-center rounded border bg-background overflow-hidden text-xs" data-testid="sort-mode-control">
                    <button
                      className={`px-2.5 py-1 transition-colors ${sortMode === "custom" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setSortMode("custom")}
                      data-testid="button-sort-custom"
                    >
                      Custom
                    </button>
                    <div className="w-px h-3.5 bg-border" />
                    <button
                      className={`px-2.5 py-1 transition-colors ${sortMode === "alpha" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setSortMode("alpha")}
                      data-testid="button-sort-alpha"
                    >
                      A–Z
                    </button>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (orderSheetEditMode) {
                      setOrderSheetEditMode(false);
                      setSelectedToAdd(new Set());
                      setSelectedToRemove(new Set());
                    } else {
                      setOrderSheetEditMode(true);
                    }
                  }}
                  data-testid="button-order-sheet-edit-mode"
                >
                  {orderSheetEditMode ? "Done" : "Edit"}
                </Button>
              </div>
            )}
          </div>
          {orderSheetExpanded && (() => {
            const allRemoveSelected = orderSheetData.length > 0 && selectedToRemove.size === orderSheetData.length;
            const allAddSelected = addableProducts.length > 0 && selectedToAdd.size === addableProducts.length;
            return (
              <div className="border-t">

                {/* ── Empty state ─────────────────────────────────────────────── */}
                {orderSheetData.length === 0 && (!orderSheetEditMode || addableProducts.length === 0) && (
                  <div className="px-5 py-8 flex flex-col items-center gap-2 text-muted-foreground" data-testid="text-order-sheet-empty">
                    <ClipboardCheck className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">No order sheet created yet</p>
                    <p className="text-xs text-center max-w-sm">
                      Build a saved order sheet from this vendor's catalog so you don't have to browse the full catalog every time.
                    </p>
                  </div>
                )}

                {/* ── Sheet items ──────────────────────────────────────────────── */}
                {orderSheetData.length > 0 && (
                  <div>
                    {/* Edit mode: select-all action bar */}
                    {orderSheetEditMode && (
                      <div className="px-4 py-2 border-b flex items-center justify-between gap-2 bg-muted/10">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary cursor-pointer"
                            checked={allRemoveSelected}
                            onChange={() => setSelectedToRemove(
                              allRemoveSelected ? new Set() : new Set(orderSheetData.map(i => i.productId))
                            )}
                            data-testid="checkbox-select-all-sheet-items"
                          />
                          <span className="text-xs text-muted-foreground">
                            {selectedToRemove.size > 0
                              ? `${selectedToRemove.size} of ${orderSheetData.length} selected`
                              : `${orderSheetData.length} item${orderSheetData.length !== 1 ? "s" : ""}`}
                          </span>
                        </label>
                        {selectedToRemove.size > 0 && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs gap-1"
                            disabled={bulkRemoveMutation.isPending}
                            onClick={() => bulkRemoveMutation.mutate([...selectedToRemove])}
                            data-testid="button-bulk-remove-sheet-items"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove ({selectedToRemove.size})
                          </Button>
                        )}
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          {orderSheetEditMode && <TableHead className="w-10" />}
                          {orderSheetEditMode && sortMode === "custom" && <TableHead className="w-8" />}
                          <TableHead className="text-xs font-medium">Product</TableHead>
                          <TableHead className="text-xs font-medium">Unit</TableHead>
                          <TableHead className="text-xs font-medium text-right pr-4">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedOrderSheetData.map((item) => {
                          const isChecked = orderSheetEditMode && selectedToRemove.has(item.productId);
                          const isDragging = draggedId === item.productId;
                          const isDragOver = dragOverId === item.productId && draggedId !== item.productId;
                          return (
                            <TableRow
                              key={item.id}
                              draggable={orderSheetEditMode && sortMode === "custom"}
                              onDragStart={() => setDraggedId(item.productId)}
                              onDragOver={e => { e.preventDefault(); setDragOverId(item.productId); }}
                              onDrop={e => {
                                e.preventDefault();
                                if (!draggedId || draggedId === item.productId) {
                                  setDraggedId(null);
                                  setDragOverId(null);
                                  return;
                                }
                                setCustomOrder(prev => {
                                  const current = prev.length > 0 ? prev : orderSheetData.map(i => i.productId);
                                  const from = current.indexOf(draggedId);
                                  const to = current.indexOf(item.productId);
                                  if (from === -1 || to === -1) return current;
                                  const next = [...current];
                                  next.splice(from, 1);
                                  next.splice(to, 0, draggedId);
                                  return next;
                                });
                                setDraggedId(null);
                                setDragOverId(null);
                              }}
                              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                              className={isDragging ? "opacity-40" : isDragOver ? "bg-primary/10" : ""}
                              data-testid={`row-order-sheet-item-${item.productId}`}
                            >
                              {orderSheetEditMode && (
                                <TableCell className="py-3 pl-4 pr-0 w-10">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary cursor-pointer"
                                    checked={isChecked}
                                    onChange={() => setSelectedToRemove(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.productId)) next.delete(item.productId);
                                      else next.add(item.productId);
                                      return next;
                                    })}
                                    data-testid={`checkbox-sheet-item-${item.productId}`}
                                  />
                                </TableCell>
                              )}
                              {orderSheetEditMode && sortMode === "custom" && (
                                <TableCell className="py-3 px-1 w-8">
                                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" data-testid={`handle-drag-${item.productId}`} />
                                </TableCell>
                              )}
                              <TableCell className="text-sm font-medium py-3">
                                <div>{item.productName}</div>
                                {item.sku && <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground py-3">
                                {item.unitType} · {item.unitSize}
                              </TableCell>
                              <TableCell className="text-sm text-right py-3 pr-4">
                                {formatCurrency(item.price)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* ── Add from catalog: edit mode only ─────────────────────── */}
                {orderSheetEditMode && addableProducts.length > 0 && (
                  <div className={orderSheetData.length > 0 ? "border-t bg-muted/30" : "bg-muted/30"}>
                    <div className="px-4 py-2 border-b border-border/60 flex items-center justify-between gap-2 bg-muted/50">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary cursor-pointer"
                          checked={allAddSelected}
                          onChange={() => setSelectedToAdd(
                            allAddSelected ? new Set() : new Set(addableProducts.map(p => p.id))
                          )}
                          data-testid="checkbox-select-all-addable"
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          Add from Catalog
                          {selectedToAdd.size > 0 && (
                            <span className="font-normal"> · {selectedToAdd.size} selected</span>
                          )}
                        </span>
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={selectedToAdd.size === 0 || bulkAddMutation.isPending}
                        onClick={() => bulkAddMutation.mutate([...selectedToAdd])}
                        data-testid="button-bulk-add-sheet-products"
                      >
                        {selectedToAdd.size > 0 ? `Add (${selectedToAdd.size})` : "Add"}
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10" />
                          <TableHead className="text-xs font-medium">Product</TableHead>
                          <TableHead className="text-xs font-medium">Unit</TableHead>
                          <TableHead className="text-xs font-medium text-right pr-4">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {addableProducts.map(p => {
                          const isChecked = selectedToAdd.has(p.id);
                          return (
                            <TableRow
                              key={p.id}
                              data-testid={`row-addable-product-${p.id}`}
                            >
                              <TableCell className="py-3 pl-4 pr-0 w-10">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary cursor-pointer"
                                  checked={isChecked}
                                  onChange={() => setSelectedToAdd(prev => {
                                    const next = new Set(prev);
                                    if (next.has(p.id)) next.delete(p.id);
                                    else next.add(p.id);
                                    return next;
                                  })}
                                  data-testid={`checkbox-addable-product-${p.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-sm font-medium py-3">
                                <div>{p.name}</div>
                                {p.sku && <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground py-3">
                                {p.unitType} · {p.unitSize}
                              </TableCell>
                              <TableCell className="text-sm text-right py-3 pr-4">
                                {formatCurrency(p.price)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

              </div>
            );
          })()}
        </div>

        {/* Product Catalog */}
        <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-catalog">

          {/* Catalog header */}
          <div
            className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setCatalogExpanded(!catalogExpanded)}
            data-testid="button-toggle-catalog"
          >
            <div className="flex items-center gap-2">
              {catalogExpanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Product Catalog</h2>
              <Badge variant="secondary" className="text-xs" data-testid="text-product-count">
                {visibleProducts.length}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">Read-only</span>
          </div>

          {catalogExpanded && (<>
            {/* Search & filter bar — only when not in order mode (ordering mode uses all products) */}
            {visibleProducts.length > 0 && (
              <div className="portal-filter-bar px-4 py-2.5 border-b bg-muted/20" data-testid="catalog-filter-bar">
                <div className="relative flex-1 min-w-0 sm:min-w-[160px] sm:max-w-xs">
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
                      onClick={e => { e.stopPropagation(); setProductSearch(""); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                  <SelectTrigger className="h-8 w-full text-sm sm:w-[150px]" data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Availability</SelectItem>
                    <SelectItem value="active">In Stock</SelectItem>
                    <SelectItem value="inactive">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                {isFiltering && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground px-2"
                    onClick={() => { setProductSearch(""); setStatusFilter("all"); }}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3 w-3 mr-1" />Clear
                  </Button>
                )}
              </div>
            )}

            {/* Product table — read-only reference */}
            {productsLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center" data-testid="empty-state-catalog">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No products available</p>
                <p className="text-xs text-muted-foreground">
                  This vendor has not added any products yet.
                </p>
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
                    <TableHead className="font-medium">Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground" data-testid="empty-state-filtered">
                        No products match your search or filters.
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.map(product => (
                    <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="rounded-md p-1.5 bg-blue-50 dark:bg-blue-950/40">
                            <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="font-medium text-sm" data-testid={`text-product-name-${product.id}`}>
                            {product.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.sku || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{product.stockType || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.unitSize} / {product.unitType}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{formatCurrency(product.price)}</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            product.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                          data-testid={`text-product-status-${product.id}`}
                        >
                          {PRODUCT_STATUS_LABELS[product.status] ?? product.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>)}
        </div>

      {/* ── Submit order confirmation dialog ───────────────────────────── */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will finalize your draft and send it to <strong>{vendor?.name}</strong>. You won't be able to edit the order after submission.
              {existingLineItems.length > 0 && (
                <span className="block mt-2 font-medium text-foreground">
                  {existingLineItems.length} item{existingLineItems.length !== 1 ? "s" : ""} ·{" "}
                  {formatCurrency(String(
                    existingLineItems.reduce(
                      (acc, li) => acc + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0
                    ).toFixed(2)
                  ))}
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

      {/* ── Delete draft confirmation ──────────────────────────────────────── */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove your draft order and all items in it.
              This action cannot be undone, but you can start a new draft at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => existingDraft && deleteDraftMutation.mutate(existingDraft.id)}
              disabled={deleteDraftMutation.isPending}
              data-testid="button-confirm-delete-draft"
            >
              {deleteDraftMutation.isPending ? "Deleting…" : "Delete Draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
