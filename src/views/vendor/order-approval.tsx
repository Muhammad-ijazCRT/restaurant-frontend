import { useParams, useLocation } from "@/lib/wouter-compat";
import { vendorOrderPaths } from "@/api/vendor/orders";
import { vendorOrderKeys } from "@/api/vendor/orders";
import { apiUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { isDisputedOrder } from "@/lib/order-status-utils";
import { formatCurrency } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Package, CalendarDays, UtensilsCrossed,
  Hash, AlertCircle, ShieldAlert, CreditCard, Download,
} from "lucide-react";
import Papa from "papaparse";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedLineItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceAtTimeOfOrder: string;
  productName: string;
  sku: string | null;
}

interface VendorOrderDetailResponse {
  order: {
    id: string;
    displayId: number | null;
    restaurantOrgId: string;
    vendorId: string;
    status: string;
    createdAt: string;
    restaurantReviewSubmittedAt: string | null;
    vendorApprovedAt: string | null;
    vendorRejectedAt: string | null;
    vendorRejectionReason: string | null;
    paidAt: string | null;
  };
  lineItems: EnrichedLineItem[];
  restaurantName: string;
  vendorName: string;
}

interface LineFulfillment {
  id: string;
  orderLineItemId: string;
  restaurantReceivedQty: number | null;
  restaurantNote: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorOrderApproval() {
  const { orderId } = useParams<{ orderId: string }>();
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();

  if (!vendorId) {
    navigate("/vendor/login");
    return null;
  }

  // ── Fetch order detail ────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<VendorOrderDetailResponse>({
    queryKey: vendorOrderKeys.detail(vendorId, orderId),
    enabled: !!vendorId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(vendorOrderPaths.detail(vendorId, orderId)));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
  });

  // ── Fetch fulfillments (restaurant/driver resolution details) ────────────

  const { data: fulfillments = [] } = useQuery<LineFulfillment[]>({
    queryKey: vendorOrderKeys.fulfillments(vendorId, orderId),
    enabled: !!vendorId && !!orderId,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(apiUrl(vendorOrderPaths.fulfillments(vendorId, orderId)));
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <header className="h-14 bg-background border-b flex items-center px-6 gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-32" />
        </header>
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-sm font-medium" data-testid="text-approval-error">
          Order not found or access denied.
        </p>
        <Button variant="outline" onClick={() => navigate("/vendor/portal")} data-testid="button-back-on-error">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Portal
        </Button>
      </div>
    );
  }

  const { order, lineItems, restaurantName, vendorName } = data;

  const fulfillmentMap = new Map(fulfillments.map(f => [f.orderLineItemId, f]));

  const orderedTotal = lineItems.reduce(
    (sum, li) => sum + parseFloat(li.unitPriceAtTimeOfOrder) * li.quantity, 0
  );
  const reviewedTotal = lineItems.reduce((sum, li) => {
    const f = fulfillmentMap.get(li.id);
    const qty = f?.restaurantReceivedQty ?? li.quantity;
    return sum + parseFloat(li.unitPriceAtTimeOfOrder) * qty;
  }, 0);

  const isAlreadyApproved = order.status === "invoiced" || !!order.vendorApprovedAt;
  const isDisputed = isDisputedOrder(order);
  const invoiceTotal = isAlreadyApproved ? reviewedTotal : orderedTotal;

  function buildCsvRows() {
    return lineItems.map((li) => {
      const f = fulfillmentMap.get(li.id);
      const receivedQty = f?.restaurantReceivedQty ?? li.quantity;
      const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * receivedQty;
      return {
        order_id: order.displayId ?? order.id,
        restaurant: restaurantName,
        vendor: vendorName,
        product: li.productName,
        sku: li.sku ?? "",
        ordered_qty: li.quantity,
        received_qty: receivedQty,
        unit_price: li.unitPriceAtTimeOfOrder,
        line_total: lineTotal.toFixed(2),
        restaurant_note: f?.restaurantNote ?? "",
      };
    });
  }

  function downloadCsv() {
    const rows = buildCsvRows();
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${safeFileName(String(order.displayId ?? order.id))}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    const rows = buildCsvRows();
    const html = `
      <html>
        <head>
          <title>Invoice ${order.displayId ?? order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .meta { margin-bottom: 18px; font-size: 13px; color: #444; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f4f4f4; }
            .total { margin-top: 16px; font-weight: bold; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Invoice #${order.displayId ?? order.id}</h1>
          <div class="meta">
            Restaurant: ${restaurantName}<br />
            Vendor: ${vendorName}<br />
            Date: ${formatDate(order.createdAt)}<br />
            Status: ${isAlreadyApproved ? "Invoiced" : "Pending"}
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Ordered Qty</th>
                <th>Received Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${row.product}</td>
                  <td>${row.sku}</td>
                  <td>${row.ordered_qty}</td>
                  <td>${row.received_qty}</td>
                  <td>${row.unit_price}</td>
                  <td>${row.line_total}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="total">Invoice Total: ${formatCurrency(String(invoiceTotal.toFixed(2)))}</div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => {
      win.print();
    }, 400);
    win.onafterprint = () => {
      win.close();
    };
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="h-14 bg-background border-b flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate("/vendor/portal")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            data-testid="button-back-to-portal"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Portal</span>
          </button>
          <span className="text-muted-foreground/40 text-sm shrink-0">/</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate" data-testid="text-breadcrumb-order-id">
              Order #{order.displayId ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="rounded-md bg-primary/10 p-1">
            <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline" data-testid="text-header-vendor-name">
            {vendorName}
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* ── Order Info Card ─────────────────────────────────────────── */}
        <div className="bg-card border rounded-lg p-5 space-y-4" data-testid="card-order-info">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-bold text-foreground" data-testid="text-order-display-id">
                Order #{order.displayId ?? "—"}
              </span>
              <Badge className={`text-xs ${isAlreadyApproved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700" : isDisputed ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-700" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
                {isAlreadyApproved ? "Invoiced" : isDisputed ? "Disputed" : "Awaiting Restaurant/Driver Action"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-emerald-500/10 p-1.5 shrink-0">
                <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Restaurant</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-order-restaurant-name">
                  {restaurantName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-order-vendor-name">
                  {vendorName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-muted p-1.5 shrink-0">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order Date</p>
                <p className="text-sm font-medium text-foreground" data-testid="text-order-date">
                  {formatDate(order.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {!isAlreadyApproved && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mt-2" data-testid="banner-discrepancy">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Vendor approval is disabled. This screen is for viewing the restaurant review and invoice only.
              </p>
            </div>
          )}
        </div>

        {/* ── Restaurant Review Table ──────────────────────────────────── */}
        <div className="bg-card border rounded-lg overflow-hidden" data-testid="card-approval-table">
          <div className="px-5 py-3 border-b flex items-center gap-2 bg-violet-50/40 dark:bg-violet-950/10">
            <AlertCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-semibold text-foreground">Restaurant Review and Invoice</h2>
            <span className="text-xs text-muted-foreground ml-1">
              {lineItems.length} item{lineItems.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="font-semibold pl-5 w-[35%]">Product</TableHead>
                  <TableHead className="font-semibold text-right w-24">Ordered Qty</TableHead>
                  <TableHead className="font-semibold text-right w-24">Unit Price</TableHead>
                  <TableHead className="font-semibold text-right w-28 text-violet-700 dark:text-violet-300">Received Qty</TableHead>
                  <TableHead className="font-semibold min-w-[160px] text-violet-700 dark:text-violet-300">Restaurant Note</TableHead>
                  <TableHead className="font-semibold text-right w-28 text-violet-700 dark:text-violet-300">Invoice Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li, idx) => {
                  const f = fulfillmentMap.get(li.id);
                  const receivedQty = f?.restaurantReceivedQty ?? li.quantity;
                  const lineTotal = parseFloat(li.unitPriceAtTimeOfOrder) * receivedQty;
                  const hasLineDiscrepancy = receivedQty !== li.quantity;

                  return (
                    <TableRow
                      key={li.id}
                      className={idx % 2 === 1 ? "bg-muted/20" : ""}
                      data-testid={`row-approval-item-${li.id}`}
                    >
                      <TableCell className="pl-5 py-4">
                        <div className="flex items-start gap-2.5">
                          <div className="rounded-md bg-violet-50 dark:bg-violet-950/40 p-1.5 shrink-0 mt-0.5">
                            <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground" data-testid={`text-approval-product-${li.id}`}>
                              {li.productName}
                            </p>
                            {li.sku && (
                              <p className="text-xs text-muted-foreground mt-0.5">SKU: {li.sku}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm text-muted-foreground" data-testid={`text-approval-ordered-qty-${li.id}`}>
                          {li.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span className="text-sm text-muted-foreground" data-testid={`text-approval-unit-price-${li.id}`}>
                          {formatCurrency(li.unitPriceAtTimeOfOrder)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span
                          className={`text-sm font-semibold ${hasLineDiscrepancy ? "text-amber-600 dark:text-amber-400" : "text-violet-700 dark:text-violet-300"}`}
                          data-testid={`text-approval-received-qty-${li.id}`}
                        >
                          {receivedQty}
                          {hasLineDiscrepancy && (
                            <span className="block text-xs font-normal text-amber-500 dark:text-amber-400">
                              (ordered {li.quantity})
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span
                          className={`text-sm ${f?.restaurantNote ? "text-foreground" : "text-muted-foreground italic"}`}
                          data-testid={`text-approval-note-${li.id}`}
                        >
                          {f?.restaurantNote || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <span
                          className={`text-sm font-semibold ${hasLineDiscrepancy ? "text-amber-600 dark:text-amber-400" : "text-violet-700 dark:text-violet-300"}`}
                          data-testid={`text-approval-line-total-${li.id}`}
                        >
                          {formatCurrency(String(lineTotal.toFixed(2)))}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t bg-violet-50/20 dark:bg-violet-950/10 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-6">
                <div className="text-sm text-muted-foreground">
                  Original total:
                  <span className="ml-1.5 line-through" data-testid="text-original-total">
                    {formatCurrency(String(orderedTotal.toFixed(2)))}
                  </span>
                </div>
                <div className="text-sm">
                  Reviewed total:
                  <span className="ml-1.5 font-bold text-violet-700 dark:text-violet-300" data-testid="text-reviewed-total">
                    {formatCurrency(String(invoiceTotal.toFixed(2)))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/vendor/portal")}
                  data-testid="button-back-footer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    Back
                </Button>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-readonly-note">
                <CreditCard className="h-4 w-4" />
                View only
              </div>
              <Button variant="outline" size="sm" onClick={downloadCsv} data-testid="button-download-csv">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPdf} data-testid="button-download-pdf">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                PDF
              </Button>
            </div>
          </div>
            {isDisputed && order.vendorRejectionReason && (
              <div className="border border-red-200 dark:border-red-800 rounded-md bg-red-50/50 dark:bg-red-950/20 p-4 flex items-start gap-2" data-testid="banner-dispute-reason">
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">Rejection reason on record</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-0.5" data-testid="text-dispute-reason-display">{order.vendorRejectionReason}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
