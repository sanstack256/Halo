import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";

export async function getSession() {
  try {
    const h = await headers();
    if (process.env.NODE_ENV !== "production") {
      const cookie = h.get("cookie") || "";
      if (cookie.includes("halo-dev-auth=true")) {
        const userEmailMatch = cookie.match(/halo-dev-email=([^;]+)/);
        const targetEmail = userEmailMatch ? decodeURIComponent(userEmailMatch[1]) : undefined;
        const user = targetEmail
          ? await prisma.user.findUnique({ where: { email: targetEmail } })
          : await prisma.user.findFirst();
        if (user) {
          return {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              emailVerified: user.emailVerified,
              image: user.image,
            },
            session: {
              id: "dev-session",
              userId: user.id,
              expiresAt: new Date(Date.now() + 86400000),
              createdAt: new Date(),
              updatedAt: new Date(),
              token: "dev-token",
            },
          };
        }
      }
    }

    return await auth.api.getSession({
      headers: h,
    });
  } catch (error: any) {
    if (error?.digest === "DYNAMIC_SERVER_USAGE" || error?.message?.includes("Dynamic server usage")) {
      throw error;
    }
    console.error("[Session] Error retrieving session:", error);
    return null;
  }
}