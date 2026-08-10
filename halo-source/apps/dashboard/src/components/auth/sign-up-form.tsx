"use client";

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
            const result = await authClient.signUp.email({
                name: data.name,
                email: data.email,
                password: data.password,
            });

            console.log("RESULT:", result);

            if (result.error) {
                console.dir(result.error, { depth: null });
                return;
            }

            router.push("/overview");
        } catch (err) {
            console.error("UNEXPECTED:", err);
        }
    }

    const inputClass =
        "w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted outline-none transition-colors focus:border-primary";

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
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
                {isSubmitting ? "Creating account..." : "Create account"}
            </button>
        </form>
    );
}