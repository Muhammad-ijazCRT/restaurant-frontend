import { createContext, useContext, useCallback, useMemo, useRef, useState } from "react";
import type { VendorPortalCounts, VendorSectionId } from "@/lib/vendor-portal-sections";

function countsEqual(a: VendorPortalCounts | null, b: VendorPortalCounts | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.restaurants === b.restaurants &&
    a.submitted === b.submitted &&
    a.delivered === b.delivered &&
    a.approval === b.approval &&
    a.disputed === b.disputed &&
    a.invoiced === b.invoiced &&
    a.orders === b.orders &&
    a.products === b.products
  );
}

interface VendorPortalNavContextValue {
  counts: VendorPortalCounts | null;
  setCounts: (counts: VendorPortalCounts | null) => void;
  activeSection: VendorSectionId | null;
  setActiveSection: (id: VendorSectionId | null) => void;
  registerScrollToSection: (fn: (id: VendorSectionId) => void) => void;
  scrollToSection: (id: VendorSectionId) => void;
}

const VendorPortalNavContext = createContext<VendorPortalNavContextValue | null>(null);

export function VendorPortalNavProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCountsState] = useState<VendorPortalCounts | null>(null);
  const [activeSection, setActiveSectionState] = useState<VendorSectionId | null>(null);
  const scrollRef = useRef<((id: VendorSectionId) => void) | null>(null);

  const setCounts = useCallback((next: VendorPortalCounts | null) => {
    setCountsState((prev) => (countsEqual(prev, next) ? prev : next));
  }, []);

  const setActiveSection = useCallback((id: VendorSectionId | null) => {
    setActiveSectionState((prev) => (prev === id ? prev : id));
  }, []);

  const registerScrollToSection = useCallback((fn: (id: VendorSectionId) => void) => {
    scrollRef.current = fn;
  }, []);

  const scrollToSection = useCallback((id: VendorSectionId) => {
    setActiveSectionState((prev) => (prev === id ? prev : id));
    scrollRef.current?.(id);
  }, []);

  const value = useMemo(
    () => ({
      counts,
      setCounts,
      activeSection,
      setActiveSection,
      registerScrollToSection,
      scrollToSection,
    }),
    [counts, activeSection, setCounts, setActiveSection, registerScrollToSection, scrollToSection],
  );

  return (
    <VendorPortalNavContext.Provider value={value}>
      {children}
    </VendorPortalNavContext.Provider>
  );
}

export function useVendorPortalNav() {
  return useContext(VendorPortalNavContext);
}
