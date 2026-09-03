import React from "react";
import { AlertCircle, FileSearch, HelpCircle, ShieldAlert } from "lucide-react";

export type EmptyStateType =
    | "NO_DATA"
    | "MISSING_TELEMETRY"
    | "PARTIAL_DATA"
    | "UNSUPPORTED"
    | "INSUFFICIENT";

interface ExploreEmptyStateProps {
    type?: EmptyStateType;
    title?: string;
    description?: string;
    action?: React.ReactNode;
}

export function ExploreEmptyState({
    type = "NO_DATA",
    title,
    description,
    action,
}: ExploreEmptyStateProps) {
    let resolvedIcon = <FileSearch size={24} className="text-zinc-500" />;
    let resolvedTitle = title || "No matching telemetry observed";
    let resolvedDesc =
        description ||
        "No matching telemetry records were observed for the selected filters and time window.";

    if (type === "INSUFFICIENT") {
        resolvedIcon = <AlertCircle size={24} className="text-amber-400" />;
        resolvedTitle = title || "Insufficient Telemetry to Complete Analysis";
        resolvedDesc =
            description ||
            "The observed telemetry sample volume is insufficient to compute an evidence-backed analysis.";
    } else if (type === "MISSING_TELEMETRY") {
        resolvedIcon = <AlertCircle size={24} className="text-amber-400" />;
        resolvedTitle = title || "Missing required telemetry identifiers";
        resolvedDesc =
            description ||
            "This analysis requires correlation identifiers (traceId, requestId, or span context) that were not captured in the observed payload.";
    } else if (type === "PARTIAL_DATA") {
        resolvedIcon = <HelpCircle size={24} className="text-blue-400" />;
        resolvedTitle = title || "Incomplete execution context";
        resolvedDesc =
            description ||
            "Partial telemetry is available, but the upstream or downstream execution boundaries are not fully instrumented.";
    } else if (type === "UNSUPPORTED") {
        resolvedIcon = <ShieldAlert size={24} className="text-zinc-400" />;
        resolvedTitle = title || "Telemetry not supported by active runtime";
        resolvedDesc =
            description ||
            "The active runtime environment or SDK version does not currently emit this telemetry classification.";
    }

    return (
        <div className="p-8 rounded-xl bg-surface border border-border flex flex-col items-center justify-center text-center space-y-3 max-w-lg mx-auto my-8">
            <div className="w-12 h-12 rounded-xl bg-[#080b11] border border-border flex items-center justify-center shrink-0">
                {resolvedIcon}
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white font-sans">{resolvedTitle}</h3>
                <p className="text-xs text-secondary font-sans leading-relaxed">{resolvedDesc}</p>
            </div>
            {action && <div className="pt-2">{action}</div>}
        </div>
    );
}
