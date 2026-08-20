"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authClient } from "@/lib/auth-client";
import {
  signInSchema,
  type SignInFormValues,
} from "@/schemas/auth";

export function SignInForm() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: SignInFormValues) {
    try {
      setFormError(null);
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        setFormError(result.error.message || "Failed to sign in. Please check your credentials.");
        console.dir(result.error, { depth: null });
        return;
      }

      router.push("/overview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFormError(message);
      console.error("UNEXPECTED:", err);
    }
  }

  async function handleGoogleSignIn() {
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
      console.error("GOOGLE SIGN-IN ERROR:", err);
    }
  }

  async function handleResendVerification() {
    const email = window.prompt(
      "Enter your Halo account email",
    );

    if (!email) {
      return;
    }

    try {
      const result =
        await authClient.sendVerificationEmail({
          email,
          callbackURL: "/sign-in",
        });

      if (result.error) {
        console.dir(result.error, { depth: null });
        return;
      }

      window.alert(
        "Verification email sent. Check your inbox.",
      );
    } catch (err) {
      console.error(
        "RESEND VERIFICATION ERROR:",
        err,
      );
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-8 space-y-5"
    >
      {formError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {formError}
        </div>
      )}

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

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleResendVerification}
          className="text-sm text-text-muted transition-colors hover:text-text"
        >
          Resend verification
        </button>

        <a
          href="/forgot-password"
          className="text-sm text-primary transition-colors hover:text-primary-hover"
        >
          Forgot password?
        </a>
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
          shadow-[0_0_18px_var(--primary-glow)]
          transition-all
          duration-200
          hover:-translate-y-px
          hover:bg-primary-hover
          active:translate-y-0
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
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
        onClick={handleGoogleSignIn}
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
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
          />
        </svg>
        {googleLoading ? "Connecting to Google..." : "Continue with Google"}
      </button>
    </form>
  );
}