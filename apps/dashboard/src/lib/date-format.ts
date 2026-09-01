/**
 * Canonical deterministic and timezone-aware date and time formatters for Halo.
 * Prevents SSR / Client hydration mismatches by formatting deterministically with explicit IANA timezone support.
 */

import { isValidTimezone } from "./timezone";

const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Gets the standard localized abbreviation or offset for a timezone (e.g. "UTC", "IST", "EDT", "EST").
 */
export function getTimezoneAbbr(dateInput: Date | string | number, timeZone: string = "UTC"): string {
    const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return tz;

    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            timeZoneName: "short",
        }).formatToParts(d);
        const namePart = parts.find((p) => p.type === "timeZoneName");
        return namePart ? namePart.value : tz;
    } catch {
        return tz;
    }
}

/**
 * Formats date into "MMM D, YYYY" in the configured timezone.
 */
export function formatDeterministicDate(
    dateInput: Date | string | number | null | undefined,
    timeZone: string = "UTC"
): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    const tz = isValidTimezone(timeZone) ? timeZone : "UTC";

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
    timeZone: string = "UTC",
    includeAbbr: boolean = true
): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    const tz = isValidTimezone(timeZone) ? timeZone : "UTC";

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
    timeZone: string = "UTC",
    includeAbbr: boolean = true
): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    const tz = isValidTimezone(timeZone) ? timeZone : "UTC";

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
