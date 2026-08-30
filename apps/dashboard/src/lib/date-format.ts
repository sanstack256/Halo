/**
 * Canonical deterministic date and time formatters for Halo.
 * Prevents SSR / Client hydration mismatches by formatting consistently in UTC.
 */

const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatDeterministicDate(dateInput: Date | string | number | null | undefined): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";

    const month = MONTHS_SHORT[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();

    return `${month} ${day}, ${year}`;
}

export function formatDeterministicTime(dateInput: Date | string | number | null | undefined): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";

    const hours = String(d.getUTCHours()).padStart(2, "0");
    const mins = String(d.getUTCMinutes()).padStart(2, "0");
    const secs = String(d.getUTCSeconds()).padStart(2, "0");

    return `${hours}:${mins}:${secs} UTC`;
}

export function formatDeterministicDateTime(dateInput: Date | string | number | null | undefined): string {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";

    const month = MONTHS_SHORT[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const mins = String(d.getUTCMinutes()).padStart(2, "0");

    return `${month} ${day}, ${year} ${hours}:${mins} UTC`;
}
