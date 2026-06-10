"use client";

import { useEffect, useState } from "react";
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

type AuthStatus = "pending" | "allowed" | "denied";

export default function PortalAuthGuard({
  children,
  expectedRoles,
  loginPath,
}: PortalAuthGuardProps) {
  const [location, navigate] = useLocation();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("pending");

  useEffect(() => {
    const role = getUserRole();
    const hasToken = !!getAuthToken();

    if (hasToken && role && !expectedRoles.includes(role)) {
      const homePath = resolveRoleHomePath(role);
      if (homePath && homePath !== location) {
        navigate(homePath);
      }
      setAuthStatus("denied");
      return;
    }

    if (!isAuthenticatedForRoles(expectedRoles)) {
      const redirect = encodeURIComponent(location);
      navigate(`${loginPath}?redirect=${redirect}`);
      setAuthStatus("denied");
      return;
    }

    setAuthStatus("allowed");
  }, [location, navigate, expectedRoles, loginPath]);

  if (authStatus !== "allowed") {
    return null;
  }

  return <>{children}</>;
}
