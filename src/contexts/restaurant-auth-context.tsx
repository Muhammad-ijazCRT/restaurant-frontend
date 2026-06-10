import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "@/lib/wouter-compat";
import { clearAuthSession, getUserData, resolvePortalEntityId } from "@/lib/portal-auth";

interface RestaurantAuthContextType {
  restaurantId: string | null;
  login: (restaurantId: string) => void;
  logout: () => void;
}

const RestaurantAuthContext = createContext<RestaurantAuthContextType>({
  restaurantId: null,
  login: () => {},
  logout: () => {},
});

function readRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  const user = getUserData();
  if (user?.restaurant_id != null) return String(user.restaurant_id);

  const stored = localStorage.getItem("restaurant_portal_id");
  if (stored) return stored;

  if (!user) return null;
  return resolvePortalEntityId(user, "restaurant");
}

export function RestaurantAuthProvider({ children }: { children: React.ReactNode }) {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    setRestaurantId(readRestaurantId());
  }, []);
  const [, navigate] = useLocation();

  const login = (id: string) => {
    localStorage.setItem("restaurant_portal_id", id);
    setRestaurantId(id);
  };

  const logout = () => {
    localStorage.removeItem("restaurant_portal_id");
    clearAuthSession();
    setRestaurantId(null);
    navigate("/restaurant/login");
  };

  return (
    <RestaurantAuthContext.Provider value={{ restaurantId, login, logout }}>
      {children}
    </RestaurantAuthContext.Provider>
  );
}

export function useRestaurantAuth() {
  return useContext(RestaurantAuthContext);
}
