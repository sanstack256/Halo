"use client";

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
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        console.dir(result.error, { depth: null });
        return;
      }

      router.push("/overview");
    } catch (err) {
      console.error("UNEXPECTED:", err);
    }
  }

  async function handleGoogleSignIn() {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/overview",
      });
    } catch (err) {
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
        "
      >
        Continue with Google
      </button>
    </form>
  );
}