import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "@/lib/wouter-compat";
import { clearAuthSession, getUserData, resolvePortalEntityId } from "@/lib/portal-auth";

interface VendorAuthContextType {
  vendorId: string | null;
  login: (vendorId: string) => void;
  logout: () => void;
}

const VendorAuthContext = createContext<VendorAuthContextType>({
  vendorId: null,
  login: () => {},
  logout: () => {},
});

function readVendorId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("vendor_portal_id");
  if (stored) return stored;

  const user = getUserData();
  if (!user) return null;
  return resolvePortalEntityId(user, user.role ?? "vendor_admin");
}

export function VendorAuthProvider({ children }: { children: React.ReactNode }) {
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    setVendorId(readVendorId());
  }, []);
  const [, navigate] = useLocation();

  const login = (id: string) => {
    localStorage.setItem("vendor_portal_id", id);
    setVendorId(id);
  };

  const logout = () => {
    localStorage.removeItem("vendor_portal_id");
    clearAuthSession();
    setVendorId(null);
    navigate("/vendor/login");
  };

  return (
    <VendorAuthContext.Provider value={{ vendorId, login, logout }}>
      {children}
    </VendorAuthContext.Provider>
  );
}

export function useVendorAuth() {
  return useContext(VendorAuthContext);
}
