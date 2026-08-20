import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            Forgot your password?
          </h1>

          <p className="mt-2 text-sm text-text-muted">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        <ForgotPasswordForm />
      </AuthCard>
    </AuthLayout>
  );
}