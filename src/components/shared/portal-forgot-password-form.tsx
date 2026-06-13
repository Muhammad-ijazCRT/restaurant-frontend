import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@/lib/wouter-compat";
import AuthLayout from "@/components/shared/auth-layout";
import { showAuthFlash } from "@/components/shared/auth-flash";
import { apiRequest } from "@/lib/queryClient";
import { normalizeFlashMessage } from "@/lib/portal-auth";

export interface PortalForgotPasswordFormProps {
  title: string;
  heading: string;
  subtitle: string;
  emailPlaceholder: string;
  apiEndpoint: string;
  loginHref: string;
}

export default function PortalForgotPasswordForm({
  title,
  heading,
  subtitle,
  emailPlaceholder,
  apiEndpoint,
  loginHref,
}: PortalForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = title;
  }, [title]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await apiRequest("POST", apiEndpoint, { email });
      const data = (await res.json()) as { status?: string; message?: string };
      if (data.status === "success") {
        setSubmitted(true);
        showAuthFlash(
          data.message ||
            "If an account exists with that email, password reset instructions have been sent.",
          "success",
        );
        return;
      }

      showAuthFlash(normalizeFlashMessage(data.message) || "Could not send reset instructions.", "error");
    } catch (error) {
      showAuthFlash(
        error instanceof Error ? error.message : "Network error. Could not connect to the server.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h2>{heading}</h2>
      <p className="subtitle">{subtitle}</p>

      {submitted ? (
        <p className="auth-info-text">
          Check your email for a password reset link. If you do not see it, check your spam folder
          or try again with the correct email address.
        </p>
      ) : (
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
          <button type="submit" className="btn-gradient mt-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner" />
                Sending...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>
      )}

      <Link href={loginHref} className="custom-link">
        Back to Login
      </Link>

      <Link href="/" className="back-link">
        ← Back to Home
      </Link>
    </AuthLayout>
  );
}
