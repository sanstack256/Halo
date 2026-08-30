import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "./prisma";
import { sendEmail } from "./email";

const getBaseURL = () => {
  let url =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined) ||
    "http://localhost:3000";

  return url.replace(/\/$/, "");
};

const trustedOrigins = [
  getBaseURL(),
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://halo-trace-ten.vercel.app",
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
    : []),
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
    : []),
];

const getAuthSecret = () => {
  if (!process.env.BETTER_AUTH_SECRET && process.env.NODE_ENV === "production") {
    console.error(
      "[Halo Auth CRITICAL] BETTER_AUTH_SECRET is not set in production! A fallback development secret is being used, which is insecure. Please generate a strong secret (e.g. openssl rand -base64 32) and set BETTER_AUTH_SECRET."
    );
  }
  return (
    process.env.BETTER_AUTH_SECRET ||
    "cd31eb49309dd6fd09970e2c21847f43648f9d94da6cca572686179f7e6b90d8"
  );
};

export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: Array.from(new Set(trustedOrigins.filter(Boolean))),

  secret: getAuthSecret(),

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,

    sendResetPassword: async ({ user, url }) => {
      try {
        if (process.env.RESEND_API_KEY) {
          await sendEmail({
            to: user.email,
            subject: "Reset your Halo password",
            html: `
              <div>
                <h1>Reset your Halo password</h1>
                <p>We received a request to reset your Halo password.</p>
                <p><a href="${url}">Reset your password</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          });
        }
      } catch (err) {
        console.error("[Auth] Failed to send password reset email:", err);
      }
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      try {
        if (process.env.RESEND_API_KEY) {
          await sendEmail({
            to: user.email,
            subject: "Verify your Halo email",
            html: `
              <div>
                <h1>Verify your Halo email</h1>
                <p>Thanks for creating your Halo account. Please verify your email address to continue.</p>
                <p><a href="${url}">Verify your email</a></p>
                <p>If you didn't create a Halo account, you can safely ignore this email.</p>
              </div>
            `,
          });
        }
      } catch (err) {
        console.error("[Auth] Failed to send verification email:", err);
      }
    },

    sendOnSignUp: false,
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
});