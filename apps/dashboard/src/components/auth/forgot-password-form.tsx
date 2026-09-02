"use client";

import { useState } from "react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");

        const { error } =
            await authClient.requestPasswordReset({
                email,
                redirectTo:
                    `${window.location.origin}/reset-password`,
            });

        if (error) {
            setError(
                error.message ?? "Something went wrong. Please try again.",
            );
            return;
        }

        setSubmitted(true);
    }

    if (submitted) {
        return (
            <div className="mt-8 space-y-5">
                <p className="text-sm text-text-muted">
                    If an account exists for that email, we've sent
                    you a password reset link.
                </p>

                <Link
                    href="/sign-in"
                    className="block text-center text-sm text-primary transition-colors hover:text-primary-hover"
                >
                    Back to sign in
                </Link>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
        >
            <div>
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) =>
                        setEmail(event.target.value)
                    }
                    placeholder="Email"
                    className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary"
                />
            </div>

            {error && (
                <p className="text-sm text-red-400">
                    {error}
                </p>
            )}

            <button
                type="submit"
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
        "
            >
                Send reset link
            </button>

            <Link
                href="/sign-in"
                className="block text-center text-sm text-text-muted transition-colors hover:text-text"
            >
                Back to sign in
            </Link>
        </form>
    );
}