import { z } from "zod";

export const signUpSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100),

    email: z
      .email("Enter a valid email address")
      .trim(),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z
    .email("Enter a valid email address")
    .trim(),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export type SignInFormValues = z.infer<typeof signInSchema>;