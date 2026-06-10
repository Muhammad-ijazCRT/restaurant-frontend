import { useEffect } from "react";
import { useLocation } from "@/lib/wouter-compat";
import {
  getAuthToken,
  getUserRole,
  isAuthenticatedForRoles,
  resolveRoleHomePath,
} from "@/lib/portal-auth";

interface PortalAuthGuardProps {
  children: React.ReactNode;
  expectedRoles: string[];
  loginPath: string;
}

export default function PortalAuthGuard({
  children,
  expectedRoles,
  loginPath,
}: PortalAuthGuardProps) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const role = getUserRole();
    const hasToken = !!getAuthToken();

    if (hasToken && role && !expectedRoles.includes(role)) {
      const homePath = resolveRoleHomePath(role);
      if (homePath && homePath !== location) {
        navigate(homePath);
      }
      return;
    }

    if (!isAuthenticatedForRoles(expectedRoles)) {
      const redirect = encodeURIComponent(location);
      navigate(`${loginPath}?redirect=${redirect}`);
    }
  }, [location, navigate, expectedRoles, loginPath]);

  const role = getUserRole();
  const hasToken = !!getAuthToken();

  if (hasToken && role && !expectedRoles.includes(role)) {
    return null;
  }

  if (!isAuthenticatedForRoles(expectedRoles)) {
    return null;
  }

  return <>{children}</>;
}
