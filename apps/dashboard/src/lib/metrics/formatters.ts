/**
 * Deterministic timestamp and metric formatting utilities for Halo Metrics Intelligence.
 * Strictly adheres to UTC formatting and prevents negative time representations.
 */

export function formatUtcDateTime(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");

  return `${month} ${day}, ${hours}:${minutes} UTC`;
}

export function formatUtcTime(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";

  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes} UTC`;
}

export function formatThroughput(
  requestCount: number,
  firstTimestampMs: number | null,
  lastTimestampMs: number | null
): { value: string; label: string; isInsufficient: boolean } {
  if (requestCount === 0) {
    return { value: "—", label: "No observed requests", isInsufficient: true };
  }

  if (requestCount === 1 || firstTimestampMs === null || lastTimestampMs === null) {
    return { value: "—", label: "Insufficient observation interval", isInsufficient: true };
  }

  const elapsedSeconds = Math.max(1, (lastTimestampMs - firstTimestampMs) / 1000);
  if (elapsedSeconds < 5) {
    return { value: "—", label: "Insufficient observation interval", isInsufficient: true };
  }

  const rps = requestCount / elapsedSeconds;
  if (rps >= 1) {
    return { value: `${rps.toFixed(1)} rps`, label: `${requestCount} req across ${Math.round(elapsedSeconds)}s`, isInsufficient: false };
  }

  const rpm = (requestCount / elapsedSeconds) * 60;
  if (rpm >= 1) {
    return { value: `${rpm.toFixed(1)} rpm`, label: `${requestCount} req across ${Math.round(elapsedSeconds / 60)}m`, isInsufficient: false };
  }

  return { value: `${rps.toFixed(3)} rps`, label: `${requestCount} requests`, isInsufficient: false };
}
