"use client";

type UsageBarProps = {
    current: number;
    max: number;
    label?: string;
    /** e.g. "events", "investigations" */
    unit?: string;
};

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

/**
 * Displays usage relative to a plan limit.
 * Color shifts from green → yellow → red as usage approaches/exceeds the max.
 */
export function UsageBar({ current, max, label, unit = "events" }: UsageBarProps) {
    const pct = Math.min((current / max) * 100, 100);
    const isWarning = pct >= 75 && pct < 90;
    const isDanger = pct >= 90;

    const barColor = isDanger
        ? "bg-error"
        : isWarning
          ? "bg-yellow-400"
          : "bg-accent";

    const textColor = isDanger
        ? "text-error"
        : isWarning
          ? "text-yellow-400"
          : "text-secondary";

    return (
        <div className="space-y-2">
            {label && (
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{label}</span>
                    <span className={textColor}>
                        {formatCount(current)} / {formatCount(max)} {unit}
                    </span>
                </div>
            )}

            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            {isDanger && (
                <p className="text-xs text-error font-medium">
                    You&apos;re approaching your plan limit. Upgrade to avoid interruptions.
                </p>
            )}
            {isWarning && !isDanger && (
                <p className="text-xs text-yellow-400/80">
                    {Math.round(pct)}% of monthly {unit} used.
                </p>
            )}
        </div>
    );
}
