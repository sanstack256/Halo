import { AuthCard } from "@/components/auth/auth-card";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Create your account"
          description="Start investigating production issues with Halo."
        />

        <SignUpForm />

        <AuthFooter
          text="Already have an account?"
          href="/sign-in"
          linkText="Sign in"
        />
      </AuthCard>
    </AuthLayout>
  );
}