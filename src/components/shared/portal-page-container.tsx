import { cn } from "@/lib/utils";

type PortalPageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function PortalPageContainer({ children, className }: PortalPageContainerProps) {
  return (
    <div className="px-6 py-6 md:px-8 md:py-8">
      <div
        className={cn(
          "mx-auto w-full max-w-7xl rounded-xl border border-border/60 bg-background p-6 shadow-sm md:p-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
