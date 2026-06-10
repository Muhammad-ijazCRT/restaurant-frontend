import { createContext, useContext, useCallback, useRef, useState } from "react";
import type { RestaurantSectionId } from "@/lib/restaurant-portal-sections";

interface RestaurantPortalNavContextValue {
  activeSection: RestaurantSectionId | null;
  setActiveSection: (id: RestaurantSectionId | null) => void;
  registerScrollToSection: (fn: (id: RestaurantSectionId) => void) => void;
  scrollToSection: (id: RestaurantSectionId) => void;
  vendorCount: number | null;
  setVendorCount: (count: number | null) => void;
}

const RestaurantPortalNavContext = createContext<RestaurantPortalNavContextValue | null>(null);

export function RestaurantPortalNavProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<RestaurantSectionId | null>(null);
  const [vendorCount, setVendorCount] = useState<number | null>(null);
  const scrollRef = useRef<((id: RestaurantSectionId) => void) | null>(null);

  const registerScrollToSection = useCallback((fn: (id: RestaurantSectionId) => void) => {
    scrollRef.current = fn;
  }, []);

  const scrollToSection = useCallback((id: RestaurantSectionId) => {
    setActiveSection(id);
    scrollRef.current?.(id);
  }, []);

  return (
    <RestaurantPortalNavContext.Provider
      value={{
        activeSection,
        setActiveSection,
        registerScrollToSection,
        scrollToSection,
        vendorCount,
        setVendorCount,
      }}
    >
      {children}
    </RestaurantPortalNavContext.Provider>
  );
}

export function useRestaurantPortalNav() {
  return useContext(RestaurantPortalNavContext);
}
