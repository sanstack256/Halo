/**
 * Canonical deterministic and timezone-aware date and time formatters for Halo.
 * Prevents SSR / Client hydration mismatches by formatting deterministically with explicit IANA timezone support.
 */

import { isValidTimezone, getClientTimezone } from "./timezone";

const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Gets the standard localized abbreviation or offset for a timezone (e.g. "UTC", "IST", "EDT", "EST").
 */
export function getTimezoneAbbr(dateInput: Date | string | number, timeZone?: string): string {
    const resolvedTz = timeZone || getClientTimezone();
    const tz = isValidTimezone(resolvedTz) ? resolvedTz : "UTC";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return tz;

    if (tz === "Asia/Kolkata") return "IST";
    if (tz === "UTC") return "UTC";

    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            timeZoneName: "short",
        }).formatToParts(d);
        const namePart = parts.find((p) => p.type === "timeZoneName");
        if (namePart) {
            if (namePart.value === "GMT+1" && tz === "Europe/London") return "BST";
            if (namePart.value === "GMT" && tz === "Europe/London") return "GMT";
            return namePart.value;
        }
        return tz;
    } catch {
        return tz;
    }
}

/**
 * Formats date into "MMM D, YYYY" in the configured timezone.
 */
export function formatDeterministicDate(
    dateInput: Date | string | number | null | undefined,
    timeZone?: string
): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    const resolvedTz = timeZone || getClientTimezone();
    const tz = isValidTimezone(resolvedTz) ? resolvedTz : "UTC";

    try {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        return formatter.format(d);
    } catch {
        const month = MONTHS_SHORT[d.getUTCMonth()];
        const day = d.getUTCDate();
        const year = d.getUTCFullYear();
        return `${month} ${day}, ${year}`;
    }
}

/**
 * Formats time into "HH:mm:ss [TZ]" in the configured timezone.
 */
export function formatDeterministicTime(
    dateInput: Date | string | number | null | undefined,
    timeZone?: string,
    includeAbbr: boolean = true
): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    const resolvedTz = timeZone || getClientTimezone();
    const tz = isValidTimezone(resolvedTz) ? resolvedTz : "UTC";

    try {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const timeStr = formatter.format(d);
        if (!includeAbbr) return timeStr;
        const abbr = getTimezoneAbbr(d, tz);
        return `${timeStr} ${abbr}`;
    } catch {
        const hours = String(d.getUTCHours()).padStart(2, "0");
        const mins = String(d.getUTCMinutes()).padStart(2, "0");
        const secs = String(d.getUTCSeconds()).padStart(2, "0");
        return `${hours}:${mins}:${secs} UTC`;
    }
}

/**
 * Formats date and time into "MMM D, YYYY HH:mm [TZ]" in the configured timezone.
 */
export function formatDeterministicDateTime(
    dateInput: Date | string | number | null | undefined,
    timeZone?: string,
    includeAbbr: boolean = true
): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    const resolvedTz = timeZone || getClientTimezone();
    const tz = isValidTimezone(resolvedTz) ? resolvedTz : "UTC";

    try {
        const datePart = formatDeterministicDate(d, tz);
        const timeFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        const timePart = timeFormatter.format(d);
        if (!includeAbbr) return `${datePart} ${timePart}`;
        const abbr = getTimezoneAbbr(d, tz);
        return `${datePart} ${timePart} ${abbr}`;
    } catch {
        const month = MONTHS_SHORT[d.getUTCMonth()];
        const day = d.getUTCDate();
        const year = d.getUTCFullYear();
        const hours = String(d.getUTCHours()).padStart(2, "0");
        const mins = String(d.getUTCMinutes()).padStart(2, "0");
        return `${month} ${day}, ${year} ${hours}:${mins} UTC`;
    }
}
