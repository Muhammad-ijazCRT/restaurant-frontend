import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/lib/wouter-compat";
import { useVendorAuth } from "@/contexts/vendor-auth-context";
import { useVendorPortalNav } from "@/contexts/vendor-portal-nav-context";
import { VENDOR_SECTION_IDS } from "@/lib/vendor-portal-sections";
import type { RestaurantOrg, VendorRestaurantRelationship } from "@shared/schema";
import { formatPhone } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  UtensilsCrossed,
} from "lucide-react";

const RELATIONSHIP_SORT_OPTIONS = [
  { value: "most-recent", label: "Most Recent" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
] as const;

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function VendorRelationships() {
  const { vendorId } = useVendorAuth();
  const [, navigate] = useLocation();
  const portalNav = useVendorPortalNav();
  const [restaurantsExpanded, setRestaurantsExpanded] = useState(true);
  const [relationshipSort, setRelationshipSort] = useState("most-recent");

  useEffect(() => {
    if (!vendorId) navigate("/vendor/login");
  }, [vendorId, navigate]);

  useEffect(() => {
    portalNav?.setActiveSection(VENDOR_SECTION_IDS.restaurants);
  }, [portalNav]);

  const {
    data: allRelationships = [],
    isLoading: relationshipsLoading,
  } = useQuery<VendorRestaurantRelationship[]>({
    queryKey: ["/api/relationships"],
    enabled: !!vendorId,
  });

  const { data: allRestaurants = [], isLoading: restaurantsLoading } =
    useQuery<RestaurantOrg[]>({
      queryKey: ["/api/restaurant-orgs"],
      enabled: !!vendorId,
    });

  const vendorRelationships = allRelationships.filter(
    (relationship) =>
      relationship.vendorId === vendorId && relationship.status !== "archived",
  );
  const restaurantMap = new Map(
    allRestaurants.map((restaurant) => [restaurant.id, restaurant]),
  );
  const sortedVendorRelationships = [...vendorRelationships].sort((a, b) => {
    if (relationshipSort === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }

    if (relationshipSort === "name-asc") {
      const restaurantA = restaurantMap.get(a.restaurantOrgId)?.name ?? "";
      const restaurantB = restaurantMap.get(b.restaurantOrgId)?.name ?? "";
      return restaurantA.localeCompare(restaurantB);
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const isLoading = relationshipsLoading || restaurantsLoading;

  if (!vendorId) return null;

  return (
    <div className="px-7 py-7">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Relationships
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your linked restaurant partners.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => setRestaurantsExpanded((expanded) => !expanded)}
            data-testid="button-toggle-restaurants"
          >
            {restaurantsExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            <span className="text-base font-semibold text-foreground">
              My Restaurants
            </span>
            <Badge variant="secondary" className="ml-1 h-7 px-3 text-sm">
              {vendorRelationships.length}
            </Badge>
          </button>

          <Select value={relationshipSort} onValueChange={setRelationshipSort}>
            <SelectTrigger className="h-9 w-36 rounded-md bg-background text-sm font-normal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {RELATIONSHIP_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {restaurantsExpanded && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 px-5 font-medium">
                  Restaurant
                </TableHead>
                <TableHead className="h-12 font-medium">Status</TableHead>
                <TableHead className="h-12 font-medium">Contact</TableHead>
                <TableHead className="h-12 font-medium">Email</TableHead>
                <TableHead className="h-12 font-medium">Phone</TableHead>
                <TableHead className="h-12 font-medium">Linked Since</TableHead>
                <TableHead className="h-12 w-24 text-right font-medium" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-5 py-5">
                    <Skeleton className="h-12 w-full" />
                  </TableCell>
                </TableRow>
              ) : sortedVendorRelationships.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No linked restaurants yet.
                  </TableCell>
                </TableRow>
              ) : (
                sortedVendorRelationships.map((relationship) => {
                  const restaurant = restaurantMap.get(
                    relationship.restaurantOrgId,
                  );
                  if (!restaurant) return null;

                  return (
                    <TableRow
                      key={relationship.id}
                      data-testid={`row-restaurant-${relationship.id}`}
                    >
                      <TableCell className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-blue-100 p-2 text-blue-600">
                            <UtensilsCrossed className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-foreground">
                            {restaurant.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          {formatStatus(relationship.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {restaurant.contactName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {restaurant.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPhone(restaurant.phone)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {formatDate(relationship.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 px-2 text-foreground"
                          onClick={() =>
                            navigate(`/vendor/relationships/${relationship.id}`)
                          }
                          data-testid={`button-view-restaurant-${relationship.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
