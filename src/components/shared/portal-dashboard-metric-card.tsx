"use client";

import type { ComponentType } from "react";
import { useLocation } from "@/lib/wouter-compat";
import { cn } from "@/lib/utils";

type PortalDashboardMetricCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
  href?: string;
  testIdPrefix?: string;
};

const DETAIL_LABEL = "Click to view details";

export function PortalDashboardMetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  onClick,
  href,
  testIdPrefix = "card-dashboard-metric",
}: PortalDashboardMetricCardProps) {
  const [, navigate] = useLocation();
  const isClickable = Boolean(onClick || href);
  const slug = title.toLowerCase().replace(/\s+/g, "-");

  const handleActivate = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (href) navigate(href);
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        isClickable &&
          "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      onClick={isClickable ? handleActivate : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      data-testid={`${testIdPrefix}-${slug}`}
    >
      <div className="flex-1 p-3 sm:p-5">
        <div className="mb-2 flex items-start justify-between gap-3 sm:mb-3">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
          <div className={cn("rounded-md p-1.5 sm:p-2", iconClassName)}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">{description}</p>
      </div>

      <div className="border-t border-border/70 bg-card px-3 py-3 sm:px-5 sm:py-3.5">
        <span
          className="block text-xs font-medium text-blue-600 dark:text-blue-400"
          data-testid={`${testIdPrefix}-detail-link-${slug}`}
        >
          {DETAIL_LABEL}
        </span>
      </div>
    </div>
  );
}
