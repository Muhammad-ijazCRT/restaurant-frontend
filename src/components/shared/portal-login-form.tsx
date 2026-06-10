import { useEffect, useState, type FormEvent } from "react";
import { profileKeys } from "@/api/shared/profile";
import { Link, useLocation } from "@/lib/wouter-compat";
import AuthLayout from "@/components/shared/auth-layout";
import { showAuthFlash } from "@/components/shared/auth-flash";
import {
  getQueryParam,
  getUserRole,
  isAuthenticatedForRoles,
  loginWithApi,
  normalizeFlashMessage,
  resolvePortalEntityId,
  resolvePostLoginPath,
  setAuthSession,
  storePendingFlash,
} from "@/lib/portal-auth";
import { queryClient } from "@/lib/queryClient";

const PasswordIconShow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20">
    <path
      d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const PasswordIconHide = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="20" height="20">
    <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="M10.6 10.7A3.2 3.2 0 0 0 9 12a3 3 0 0 0 4.3 2.7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.6 6.7C4 8.5 2.3 11.3 1.5 12c0 0 4 7 10.5 7 2 0 3.8-.6 5.3-1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.8 5.4c4.8 1.2 7.7 6.3 7.7 6.6 0 0-1.1 1.9-3.2 3.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface PortalLoginFormProps {
  title: string;
  heading: string;
  subtitle: string;
  emailPlaceholder: string;
  apiEndpoint: string;
  expectedRoles: string[];
  defaultDashboardPath: string;
  registerHref?: string;
  registerLabel?: string;
  hideRegister?: boolean;
  onLoginSuccess?: (role: string, entityId: string | null) => void;
}

export default function PortalLoginForm({
  title,
  heading,
  subtitle,
  emailPlaceholder,
  apiEndpoint,
  expectedRoles,
  defaultDashboardPath,
  registerHref,
  registerLabel,
  hideRegister = false,
  onLoginSuccess,
}: PortalLoginFormProps) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (!isAuthenticatedForRoles(expectedRoles)) return;

    navigate(
      resolvePostLoginPath(getUserRole(), getQueryParam("redirect"), defaultDashboardPath),
    );
  }, [expectedRoles, defaultDashboardPath, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { ok, data, status } = await loginWithApi(apiEndpoint, email, password);

      if (ok && data.status === "success" && data.token && data.user) {
        const role = data.user.role || expectedRoles[0];
        setAuthSession(data.token, role, data.user);
        void queryClient.invalidateQueries({ queryKey: profileKeys.notifications() });

        const entityId = resolvePortalEntityId(data.user, role);
        onLoginSuccess?.(role, entityId);

        storePendingFlash(data.message || "Login successful.", "success");
        const redirectPath = resolvePostLoginPath(
          role,
          getQueryParam("redirect") || data.redirect || null,
          defaultDashboardPath,
        );

        setTimeout(() => navigate(redirectPath), 1000);
        return;
      }

      if (status === 422 && data.errors) {
        showAuthFlash(data.errors, "error", {
          title: "Validation Errors",
          duration: 5000,
        });
      } else {
        showAuthFlash(
          normalizeFlashMessage(data.message) || "Login failed. Please try again.",
          "error",
        );
      }
    } catch {
      showAuthFlash("Network error. Could not connect to the server.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h2>{heading}</h2>
      <p className="subtitle">{subtitle}</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            className="form-control"
            placeholder={emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              className="password-toggle-icon"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <PasswordIconHide /> : <PasswordIconShow />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn-gradient mt-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>

      {!hideRegister && registerHref && registerLabel && (
        <Link href={registerHref} className="custom-link">
          {registerLabel}
        </Link>
      )}

      <Link href="/" className="back-link">
        ← Back to Home
      </Link>
    </AuthLayout>
  );
}
