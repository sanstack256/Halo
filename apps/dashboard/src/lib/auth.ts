import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "./prisma";
import { sendEmail } from "./email";

const getBaseURL = () => {
  let url =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "http://localhost:3000";

  return url.replace(/\/$/, "");
};

export const auth = betterAuth({
  baseURL: getBaseURL(),
  trustedOrigins: [
    getBaseURL(),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
      : []),
  ],

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

    revokeSessionsOnPasswordReset: true,

    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your Halo password",
        html: `
          <div>
            <h1>Reset your Halo password</h1>

            <p>
              We received a request to reset your Halo password.
            </p>

            <p>
              <a href="${url}">
                Reset your password
              </a>
            </p>

            <p>
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Verify your Halo email",
        html: `
          <div>
            <h1>Verify your Halo email</h1>

            <p>
              Thanks for creating your Halo account.
              Please verify your email address to continue.
            </p>

            <p>
              <a href="${url}">
                Verify your email
              </a>
            </p>

            <p>
              If you didn't create a Halo account, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    },

    sendOnSignUp: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});