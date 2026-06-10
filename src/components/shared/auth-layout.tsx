import { AuthFlashContainer } from "@/components/shared/auth-flash";
import "@/styles/auth.css";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <AuthFlashContainer />
      <div className="auth-wrapper">
        <div className="login-box">{children}</div>
      </div>
    </div>
  );
}
