"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

import {
    signUpSchema,
    type SignUpFormValues,
} from "@/schemas/auth";

export function SignUpForm() {
    const router = useRouter();
    const [googleLoading, setGoogleLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormValues>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    async function onSubmit(data: SignUpFormValues) {
        try {
            setFormError(null);
            const result = await authClient.signUp.email({
                name: data.name,
                email: data.email,
                password: data.password,
            });

            console.log("RESULT:", result);

            if (result.error) {
                setFormError(result.error.message || "Failed to create account.");
                console.dir(result.error, { depth: null });
                return;
            }

            router.push("/overview");
            router.refresh();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unexpected error occurred.";
            setFormError(message);
            console.error("UNEXPECTED:", err);
        }
    }

    async function handleGoogleSignUp() {
        try {
            setGoogleLoading(true);
            setFormError(null);
            await authClient.signIn.social({
                provider: "google",
                callbackURL: "/overview",
            });
        } catch (err: unknown) {
            setGoogleLoading(false);
            const message = err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
            setFormError(message);
            console.error("GOOGLE SIGN-UP ERROR:", err);
        }
    }

    const inputClass =
        "w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary";

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {formError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {formError}
                </div>
            )}

            <div>
                <input
                    {...register("name")}
                    placeholder="Full name"
                    className={inputClass}
                />

                {errors.name && (
                    <p className="mt-2 text-sm text-red-400">
                        {errors.name.message}
                    </p>
                )}
            </div>

            <div>
                <input
                    {...register("email")}
                    type="email"
                    placeholder="Email"
                    className={inputClass}
                />

                {errors.email && (
                    <p className="mt-2 text-sm text-red-400">
                        {errors.email.message}
                    </p>
                )}
            </div>

            <div>
                <input
                    {...register("password")}
                    type="password"
                    placeholder="Password"
                    className={inputClass}
                />

                {errors.password && (
                    <p className="mt-2 text-sm text-red-400">
                        {errors.password.message}
                    </p>
                )}
            </div>

            <div>
                <input
                    {...register("confirmPassword")}
                    type="password"
                    placeholder="Confirm password"
                    className={inputClass}
                />

                {errors.confirmPassword && (
                    <p className="mt-2 text-sm text-red-400">
                        {errors.confirmPassword.message}
                    </p>
                )}
            </div>

            <button
                type="submit"
                disabled={isSubmitting || googleLoading}
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
                {isSubmitting ? "Creating account..." : "Create account"}
            </button>

            <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-border" />

                <span className="text-xs text-text-muted">
                    OR
                </span>

                <div className="h-px flex-1 bg-border" />
            </div>

            <button
                type="button"
                disabled={googleLoading || isSubmitting}
                onClick={handleGoogleSignUp}
                className="
          flex
          w-full
          items-center
          justify-center
          gap-3
          rounded-xl
          border
          border-border
          bg-surface
          py-3
          font-medium
          text-text
          transition-all
          duration-200
          hover:border-border-strong
          hover:bg-surface-hover
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
            >
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
                {googleLoading ? "Connecting to Google..." : "Continue with Google"}
            </button>
        </form>
    );
}