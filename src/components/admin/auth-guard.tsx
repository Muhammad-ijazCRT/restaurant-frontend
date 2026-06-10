import { useEffect } from "react";
import { useLocation } from "@/lib/wouter-compat";
import { isAuthenticatedForRoles } from "@/lib/portal-auth";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticatedForRoles(["super_admin"])) {
      const redirect = encodeURIComponent(location);
      navigate(`/super-admin/login?redirect=${redirect}`);
    }
  }, [location, navigate]);

  if (!isAuthenticatedForRoles(["super_admin"])) {
    return null;
  }

  return <>{children}</>;
}
