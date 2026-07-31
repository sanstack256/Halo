import { AuthCard } from "@/components/auth/auth-card";
import { AuthFooter } from "@/components/auth/auth-footer";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
    return (
        <AuthLayout>
            <AuthCard>
                <AuthHeader
                    title="Welcome back"
                    description="Sign in to continue investigating production issues."
                />

                <SignInForm />

                <AuthFooter
                    text="Don't have an account?"
                    href="/sign-up"
                    linkText="Create one"
                />
            </AuthCard>
        </AuthLayout>
    );
}