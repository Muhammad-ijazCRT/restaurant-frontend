import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";

type RestaurantDashboardMetricCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
};

export function RestaurantDashboardMetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  onClick,
}: RestaurantDashboardMetricCardProps) {
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
      data-testid={`card-restaurant-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={`rounded-md p-2 ${iconClassName}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
