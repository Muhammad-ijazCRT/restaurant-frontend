import { useEffect } from "react";
import { relationshipKeys } from "@/api/shared/relationships";
import { adminVendorKeys } from "@/api/admin/vendors";
import { Link, useLocation } from "@/lib/wouter-compat";
import { useQuery } from "@tanstack/react-query";
import { useRestaurantAuth } from "@/contexts/restaurant-auth-context";
import type { Vendor, VendorRestaurantRelationship } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Building2 } from "lucide-react";

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RestaurantRelationships() {
  const { restaurantId } = useRestaurantAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!restaurantId) navigate("/restaurant/login");
  }, [restaurantId, navigate]);

  const { data: relationships = [], isLoading: relationshipsLoading } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: relationshipKeys.all(),
    enabled: !!restaurantId,
  });
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: adminVendorKeys.list(false),
    enabled: !!restaurantId,
  });

  const linkedRelationships = relationships.filter(
    (relationship) => relationship.restaurantOrgId === restaurantId && relationship.status !== "archived",
  );
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  if (!restaurantId) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Relationships</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your linked vendor relationships.</p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">My Linked Vendors</h2>
          <Badge variant="secondary">{linkedRelationships.length}</Badge>
        </div>

        {relationshipsLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : linkedRelationships.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-10 text-muted-foreground">
            <Building2 className="h-8 w-8 opacity-40" />
            <p className="text-sm">No linked vendors yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {linkedRelationships.map((relationship) => {
              const vendor = vendorMap.get(relationship.vendorId);
              if (!vendor) return null;

              return (
                <div key={relationship.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{vendor.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                      {vendor.contactName ? <span>{vendor.contactName}</span> : null}
                      <span>{formatDate(relationship.createdAt)}</span>
                    </div>
                  </div>
                  <Link href={`/restaurant/vendor/${vendor.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      View Relationship
                      <ArrowRight className="h-3.5 w-3.5" />
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
