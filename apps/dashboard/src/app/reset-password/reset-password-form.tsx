"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");

        if (!token) {
            setError(
                "This password reset link is invalid or has expired.",
            );
            return;
        }

        if (password.length < 8) {
            setError(
                "Password must be at least 8 characters.",
            );
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        const { error } = await authClient.resetPassword({
            newPassword: password,
            token,
        });

        setIsSubmitting(false);

        if (error) {
            setError(
                error.message ??
                    "Something went wrong. Please try again.",
            );
            return;
        }

        router.push("/sign-in?reset=success");
    }

    return (
        <AuthLayout>
            <AuthCard>
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-text">
                        Set a new password
                    </h1>

                    <p className="mt-2 text-sm text-text-muted">
                        Choose a new password for your Halo account.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-5"
                >
                    <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        placeholder="New password"
                        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary"
                    />

                    <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(event) =>
                            setConfirmPassword(
                                event.target.value,
                            )
                        }
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary"
                    />

                    {error && (
                        <p className="text-sm text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="
                            w-full
                            rounded-xl
                            border
                            border-border-strong
                            bg-primary
                            py-3
                            font-medium
                            text-primary-foreground
                            transition-colors
                            hover:bg-primary-hover
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        {isSubmitting
                            ? "Updating password..."
                            : "Update password"}
                    </button>

                    <Link
                        href="/sign-in"
                        className="block text-center text-sm text-text-muted transition-colors hover:text-text"
                    >
                        Back to sign in
                    </Link>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}