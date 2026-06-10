import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "@/lib/wouter-compat";
import AuthLayout from "@/components/shared/auth-layout";
import { showAuthFlash } from "@/components/shared/auth-flash";
import { formatPhone, normalizePhoneDigits } from "@shared/schema";
import {
  getReactDashboardPath,
  isAuthenticatedForRoles,
  normalizeFlashMessage,
  registerWithApi,
  resolvePortalEntityId,
  setAuthSession,
  storePendingFlash,
  type RegisterPayload,
} from "@/lib/portal-auth";

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

export interface PortalRegisterFormProps {
  title: string;
  heading: string;
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  apiEndpoint: string;
  expectedRoles: string[];
  defaultDashboardPath: string;
  loginHref: string;
  loginLabel: string;
  onRegisterSuccess?: (role: string, entityId: string | null) => void;
}

export default function PortalRegisterForm({
  title,
  heading,
  subtitle,
  nameLabel,
  namePlaceholder,
  apiEndpoint,
  expectedRoles,
  defaultDashboardPath,
  loginHref,
  loginLabel,
  onRegisterSuccess,
}: PortalRegisterFormProps) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (!isAuthenticatedForRoles(expectedRoles)) return;
    navigate(defaultDashboardPath);
  }, [expectedRoles, defaultDashboardPath, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      showAuthFlash("Passwords do not match.", "error");
      return;
    }

    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length !== 10) {
      showAuthFlash("Phone must be exactly 10 digits.", "error");
      return;
    }

    setIsSubmitting(true);

    const payload: RegisterPayload = {
      name: name.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phoneDigits,
      password,
    };

    try {
      const { ok, data, status } = await registerWithApi(apiEndpoint, payload);

      if (ok && data.status === "success" && data.token && data.user) {
        const role = data.user.role || expectedRoles[0];
        setAuthSession(data.token, role, data.user);

        const entityId = resolvePortalEntityId(data.user, role);
        onRegisterSuccess?.(role, entityId);

        storePendingFlash(data.message || "Registration successful.", "success");
        const redirectPath = getReactDashboardPath(role) || defaultDashboardPath;
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
          normalizeFlashMessage(data.message) || "Registration failed. Please try again.",
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
          <label htmlFor="name">{nameLabel}</label>
          <input
            type="text"
            id="name"
            name="name"
            className="form-control"
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="contactName">Contact Name</label>
          <input
            type="text"
            id="contactName"
            name="contactName"
            className="form-control"
            placeholder="Jane Smith"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            className="form-control"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            className="form-control"
            placeholder="(555) 123-4567"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            required
            autoComplete="tel"
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
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
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
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              className="form-control"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              className="password-toggle-icon"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? <PasswordIconHide /> : <PasswordIconShow />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn-gradient mt-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <Link href={loginHref} className="custom-link">
        {loginLabel}
      </Link>

      <Link href="/" className="back-link">
        ← Back to Home
      </Link>
    </AuthLayout>
  );
}
