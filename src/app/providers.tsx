"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { VendorAuthProvider } from "@/contexts/vendor-auth-context";
import { RestaurantAuthProvider } from "@/contexts/restaurant-auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VendorAuthProvider>
          <RestaurantAuthProvider>{children}</RestaurantAuthProvider>
        </VendorAuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
