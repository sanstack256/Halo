import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.error("[Session] Error retrieving session:", error);
    return null;
  }
}