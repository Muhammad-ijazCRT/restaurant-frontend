import { useQuery } from "@tanstack/react-query";
import { restaurantOrgKeys } from "@/api/restaurant/orgs";
import { Link, useParams } from "@/lib/wouter-compat";
import type { Vendor, Product, RestaurantOrg } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Building2, Mail, Phone, UserCircle, Package, AlertCircle, ShieldAlert,
} from "lucide-react";
import { formatPhone, formatCurrency } from "@shared/schema";

const productStatusLabels: Record<string, string> = {
  active: "In Stock",
  inactive: "Out of Stock",
};

function ProductStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    inactive: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${variants[status] || variants.active}`} data-testid={`badge-product-status-${status}`}>
      {productStatusLabels[status] || status}
    </Badge>
  );
}

interface CatalogResponse {
  vendor: Vendor;
  products: Product[];
}

export default function RestaurantCatalog() {
  const params = useParams<{ id: string; vendorId: string }>();
  const restaurantId = params.id;
  const vendorId = params.vendorId;

  const { data: org, isLoading: orgLoading } = useQuery<RestaurantOrg>({
    queryKey: restaurantOrgKeys.detail(restaurantId),
  });

  const { data: catalog, isLoading: catalogLoading, isError: catalogError, error } = useQuery<CatalogResponse>({
    queryKey: restaurantOrgKeys.catalog(restaurantId, vendorId),
  });

  const isLoading = orgLoading || catalogLoading;
  const isForbidden = catalogError && (error as Error)?.message?.includes("403");

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div>
        <Link href={`/admin/restaurants/${restaurantId}`}>
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Restaurant
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1" data-testid="text-access-denied">Access Denied</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            This vendor is not linked to this restaurant organization. Only linked vendor catalogs can be viewed.
          </p>
        </div>
      </div>
    );
  }

  if (catalogError || !catalog) {
    return (
      <div>
        <Link href={`/admin/restaurants/${restaurantId}`}>
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" />Back to Restaurant
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Catalog not found</h3>
          <p className="text-sm text-muted-foreground">Unable to load this vendor's catalog.</p>
        </div>
      </div>
    );
  }

  const { vendor, products } = catalog;
  const activeProducts = products.filter(p => p.status !== "archived");

  return (
    <div>
      <Link href={`/admin/restaurants/${restaurantId}`}>
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />Back to {org?.name || "Restaurant"}
        </Button>
      </Link>

      <div className="mb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1" data-testid="text-browsing-as">
          Linked vendor catalog for: {org?.name}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2.5">
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-catalog-vendor-name">
            {vendor.name}
          </h1>
          <p className="text-sm text-muted-foreground">Product Catalog</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <UserCircle className="h-4 w-4" />
              Contact
            </div>
            <p className="font-medium text-foreground" data-testid="text-catalog-contact">{vendor.contactName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="font-medium text-foreground" data-testid="text-catalog-email">{vendor.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              Phone
            </div>
            <p className="font-medium text-foreground" data-testid="text-catalog-phone">{formatPhone(vendor.phone)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden" data-testid="section-catalog-products">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Products</h2>
            <Badge variant="secondary" className="text-xs" data-testid="text-catalog-product-count">
              {activeProducts.length}
            </Badge>
          </div>
        </div>

        {activeProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4" data-testid="empty-state-catalog">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No products available</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              This vendor has not added any products to their catalog yet.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium">Product</TableHead>
                <TableHead className="font-medium">SKU</TableHead>
                <TableHead className="font-medium">Unit</TableHead>
                <TableHead className="font-medium">Price</TableHead>
                <TableHead className="font-medium">Availability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProducts.map(product => (
                <TableRow key={product.id} data-testid={`row-catalog-product-${product.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 p-1.5">
                        <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-medium" data-testid={`text-catalog-product-name-${product.id}`}>{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm" data-testid={`text-catalog-product-sku-${product.id}`}>
                    {product.sku}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {product.unitSize} / {product.unitType}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-catalog-product-price-${product.id}`}>
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge status={product.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
