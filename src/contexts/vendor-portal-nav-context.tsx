import { createContext, useContext, useCallback, useRef, useState } from "react";
import type { VendorPortalCounts, VendorSectionId } from "@/lib/vendor-portal-sections";

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
  const [counts, setCounts] = useState<VendorPortalCounts | null>(null);
  const [activeSection, setActiveSection] = useState<VendorSectionId | null>(null);
  const scrollRef = useRef<((id: VendorSectionId) => void) | null>(null);

  const registerScrollToSection = useCallback((fn: (id: VendorSectionId) => void) => {
    scrollRef.current = fn;
  }, []);

  const scrollToSection = useCallback((id: VendorSectionId) => {
    setActiveSection(id);
    scrollRef.current?.(id);
  }, []);

  return (
    <VendorPortalNavContext.Provider
      value={{
        counts,
        setCounts,
        activeSection,
        setActiveSection,
        registerScrollToSection,
        scrollToSection,
      }}
    >
      {children}
    </VendorPortalNavContext.Provider>
  );
}

export function useVendorPortalNav() {
  return useContext(VendorPortalNavContext);
}
