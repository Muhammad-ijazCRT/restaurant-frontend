import { useEffect } from "react";
import { relationshipKeys } from "@/api/shared/relationships";
import { adminVendorKeys } from "@/api/admin/vendors";
import { Link, useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import type { Vendor, VendorRestaurantRelationship } from "@shared/schema";
import { formatPhone } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, ShoppingCart } from "lucide-react";

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RestaurantPlaceOrder() {
  const { restaurantId } = useRestaurantAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!restaurantId) navigate("/restaurant/login");
  }, [restaurantId, navigate]);

  const { data: relationships = [], isLoading } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: relationshipKeys.all(),
    enabled: !!restaurantId,
  });
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: adminVendorKeys.list(false),
    enabled: !!restaurantId,
  });

  const activeRelationships = relationships.filter(
    (relationship) =>
      relationship.restaurantOrgId === restaurantId && relationship.status === "active",
  );
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  if (!restaurantId) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Place Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start a new order with any of your active linked vendors.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Active Vendors</h2>
          <Badge variant="secondary">{activeRelationships.length}</Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : activeRelationships.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-10 text-muted-foreground">
            <Building2 className="h-8 w-8 opacity-40" />
            <p className="text-sm">No active vendors available for ordering.</p>
          </div>
        ) : (
          <div className="divide-y">
            {activeRelationships.map((relationship) => {
              const vendor = vendorMap.get(relationship.vendorId);
              if (!vendor) return null;

              return (
                <div
                  key={relationship.id}
                  className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/20"
                  onClick={() => navigate(`/restaurant/vendor/${vendor.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{vendor.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                      {vendor.contactName ? <span>{vendor.contactName}</span> : null}
                      <span>{vendor.email}</span>
                      <span>{formatPhone(vendor.phone)}</span>
                      <span>{formatDate(relationship.createdAt)}</span>
                    </div>
                  </div>
                  <Link href={`/restaurant/vendor/${vendor.id}`} onClick={(event) => event.stopPropagation()}>
                    <Button size="sm" className="gap-1.5">
                      <ShoppingCart className="h-4 w-4" />
                      Start Order
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
