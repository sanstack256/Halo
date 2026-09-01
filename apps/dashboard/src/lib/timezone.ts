/**
 * Canonical Timezone Management for Halo.
 * Single source of truth for user timezone preferences across server & client.
 */

export const SUPPORTED_TIMEZONES = [
    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
    { value: "America/New_York", label: "America/New_York (Eastern Time)" },
    { value: "America/Chicago", label: "America/Chicago (Central Time)" },
    { value: "America/Denver", label: "America/Denver (Mountain Time)" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific Time)" },
    { value: "Europe/London", label: "Europe/London (GMT/BST)" },
    { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
    { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
    { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
    { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
    { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
    { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
] as const;

export const TIMEZONE_COOKIE_NAME = "halo_tz";

/**
 * Validates whether a string is a recognized IANA timezone identifier.
 */
export function isValidTimezone(tz: string | null | undefined): boolean {
    if (!tz || typeof tz !== "string") return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/**
 * Resolves user timezone on client side with fallback to UTC.
 */
export function getClientTimezone(): string {
    if (typeof window === "undefined") return "UTC";

    // 1. Check cookie
    const cookies = document.cookie.split("; ");
    const match = cookies.find((c) => c.startsWith(`${TIMEZONE_COOKIE_NAME}=`));
    if (match) {
        const val = decodeURIComponent(match.split("=")[1]);
        if (isValidTimezone(val)) return val;
    }

    // 2. Check localStorage
    try {
        const stored = localStorage.getItem(TIMEZONE_COOKIE_NAME);
        if (stored && isValidTimezone(stored)) return stored;
    } catch {}

    // 3. Fallback to system / UTC
    try {
        const sys = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (isValidTimezone(sys)) return sys;
    } catch {}

    return "UTC";
}

/**
 * Persists user timezone preference across cookies and localStorage.
 */
export function setClientTimezone(timeZone: string): void {
    if (!isValidTimezone(timeZone)) return;

    if (typeof window !== "undefined") {
        document.cookie = `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(
            timeZone
        )}; path=/; max-age=31536000; SameSite=Lax`;
        try {
            localStorage.setItem(TIMEZONE_COOKIE_NAME, timeZone);
        } catch {}
        window.dispatchEvent(new CustomEvent("halo-timezone-changed", { detail: { timeZone } }));
    }
}
