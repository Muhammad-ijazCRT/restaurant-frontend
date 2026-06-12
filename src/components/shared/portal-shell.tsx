"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useLocation } from "@/lib/wouter-compat";
import { Button } from "@/components/ui/button";
import { PortalPageContainer } from "@/components/shared/portal-page-container";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  children: React.ReactNode;
  brand: React.ReactNode;
  nav: React.ReactNode;
  footer?: React.ReactNode;
  headerTitle: React.ReactNode;
  headerActions?: React.ReactNode;
  sidebarWidthClass?: string;
  testId?: string;
};

function SidebarPanel({
  brand,
  nav,
  footer,
  onClose,
  showCloseButton = false,
}: {
  brand: React.ReactNode;
  nav: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
}) {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-5">
        <div className="min-w-0 flex-1">{brand}</div>
        {showCloseButton && onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-2 shrink-0 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">{nav}</nav>
      {footer ? (
        <div className="mt-auto shrink-0 border-t border-sidebar-border px-6 py-4">{footer}</div>
      ) : null}
    </>
  );
}

export function PortalShell({
  children,
  brand,
  nav,
  footer,
  headerTitle,
  headerActions,
  sidebarWidthClass = "lg:w-[280px]",
  testId,
}: PortalShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  return (
    <div className="flex h-full overflow-hidden bg-background" data-testid={testId}>
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
          sidebarWidthClass,
        )}
      >
        <SidebarPanel brand={brand} nav={nav} footer={footer} />
      </aside>

      <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex h-full w-[min(300px,88vw)] flex-col border-r border-sidebar-border bg-sidebar shadow-xl outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200",
              "lg:hidden",
            )}
          >
            <SidebarPanel
              brand={brand}
              nav={nav}
              footer={footer}
              showCloseButton
              onClose={() => setMobileNavOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4 lg:px-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            data-testid="portal-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 text-sm">{headerTitle}</div>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">{headerActions}</div>
          ) : null}
        </header>
        <main
          data-portal-main
          className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-muted/40 [-webkit-overflow-scrolling:touch]"
        >
          <PortalPageContainer>{children}</PortalPageContainer>
        </main>
      </div>
    </div>
  );
}
