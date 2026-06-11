import { cn } from "@/lib/utils";

type PortalPageContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function PortalPageContainer({ children, className }: PortalPageContainerProps) {
  return (
    <div className="px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
      <div
        className={cn(
          "mx-auto w-full min-w-0 max-w-7xl rounded-none border-0 bg-background p-3 shadow-none sm:rounded-xl sm:border sm:border-border/60 sm:p-6 sm:shadow-sm md:p-8",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
