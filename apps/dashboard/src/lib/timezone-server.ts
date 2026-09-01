import { cookies } from "next/headers";
import { TIMEZONE_COOKIE_NAME, isValidTimezone } from "./timezone";

/**
 * Resolves the authenticated user's timezone preference on the server from cookies.
 */
export async function getServerTimezone(): Promise<string> {
    try {
        const cookieStore = await cookies();
        const tzCookie = cookieStore.get(TIMEZONE_COOKIE_NAME);
        if (tzCookie?.value && isValidTimezone(tzCookie.value)) {
            return tzCookie.value;
        }
    } catch {}

    return "UTC";
}
