import { Link } from "@/lib/wouter-compat";
import { cn } from "@/lib/utils";

export function RodexBrandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 32V8h12.5c6.9 0 11.5 4.2 11.5 10.2S27.4 28.5 20.5 28.5H16v3.5H8z"
        fill="#111"
      />
      <path
        d="M16 14.5h4.2c3.4 0 5.6 1.9 5.6 4.8s-2.2 4.7-5.6 4.7H16V14.5z"
        fill="#fff"
      />
      <path d="M30 8h6v24h-6V8z" fill="#F05A28" />
    </svg>
  );
}

export function RodexBrandName({
  className,
  accentClassName,
}: {
  className?: string;
  accentClassName?: string;
}) {
  return (
    <span className={cn("font-bold tracking-tight text-sidebar-foreground", className)}>
      Rodex<span className={cn("text-[#F05A28]", accentClassName)}>OS</span>
    </span>
  );
}

export function PortalSidebarBrand({
  subtitle,
  href,
  className,
}: {
  subtitle: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <RodexBrandIcon className="h-8 w-8" />
      <div className="min-w-0">
        <p className="text-sm leading-tight">
          <RodexBrandName />
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block no-underline hover:opacity-90 transition-opacity"
        aria-label={`RodexOS ${subtitle}`}
        data-testid="portal-sidebar-brand"
      >
        {content}
      </Link>
    );
  }

  return <div data-testid="portal-sidebar-brand">{content}</div>;
}

export function RodexBrandLink({
  href = "/",
  className,
  iconClassName,
  textClassName,
}: {
  href?: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 no-underline text-[#111111] hover:opacity-90 transition-opacity",
        className,
      )}
      aria-label="RodexOS home"
    >
      <RodexBrandIcon className={cn("h-9 w-9", iconClassName)} />
      <RodexBrandName
        className={cn("text-[1.35rem]", textClassName)}
      />
    </Link>
  );
}
