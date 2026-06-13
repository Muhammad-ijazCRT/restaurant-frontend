import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "@/lib/wouter-compat";
import AuthLayout from "@/components/shared/auth-layout";
import { showAuthFlash } from "@/components/shared/auth-flash";
import { apiRequest } from "@/lib/queryClient";
import { getQueryParam, normalizeFlashMessage, storePendingFlash } from "@/lib/portal-auth";

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

export interface PortalResetPasswordFormProps {
  title: string;
  heading: string;
  subtitle: string;
  apiEndpoint: string;
  loginHref: string;
  forgotPasswordHref: string;
}

export default function PortalResetPasswordForm({
  title,
  heading,
  subtitle,
  apiEndpoint,
  loginHref,
  forgotPasswordHref,
}: PortalResetPasswordFormProps) {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = getQueryParam("token");

  useEffect(() => {
    document.title = title;
  }, [title]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!token) {
      showAuthFlash("This reset link is invalid. Please request a new one.", "error");
      return;
    }

    if (password.length < 8) {
      showAuthFlash("Password must be at least 8 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthFlash("Passwords do not match.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiRequest("POST", apiEndpoint, {
        token,
        password,
        confirmPassword,
      });
      const data = (await res.json()) as { status?: string; message?: string };

      if (data.status === "success") {
        storePendingFlash(data.message || "Your password has been updated.", "success");
        setTimeout(() => navigate(loginHref), 800);
        return;
      }

      showAuthFlash(normalizeFlashMessage(data.message) || "Could not reset your password.", "error");
    } catch (error) {
      showAuthFlash(
        error instanceof Error ? error.message : "Network error. Could not connect to the server.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h2>{heading}</h2>
        <p className="subtitle">This password reset link is invalid or has expired.</p>
        <Link href={forgotPasswordHref} className="custom-link">
          Request a new reset link
        </Link>
        <Link href={loginHref} className="back-link">
          ← Back to Login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>{heading}</h2>
      <p className="subtitle">{subtitle}</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">New Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              className="form-control"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
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
              Updating...
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>

      <Link href={loginHref} className="custom-link">
        Back to Login
      </Link>

      <Link href="/" className="back-link">
        ← Back to Home
      </Link>
    </AuthLayout>
  );
}
