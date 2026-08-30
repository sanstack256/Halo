import React from "react";
import { EventSeverity } from "@/generated/prisma/client";

type Props = {
    severity: EventSeverity | string;
    className?: string;
};

const severityStyles: Record<string, { className: string; label: string }> = {
    FATAL: {
        className: "bg-red-500/15 text-red-400 border-red-500/30 font-semibold",
        label: "FATAL",
    },
    ERROR: {
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        label: "ERROR",
    },
    WARN: {
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        label: "WARN",
    },
    WARNING: {
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        label: "WARNING",
    },
    INFO: {
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: "INFO",
    },
    DEBUG: {
        className: "bg-zinc-800 text-zinc-400 border-zinc-700",
        label: "DEBUG",
    },
};

export function SeverityBadge({ severity, className = "" }: Props) {
    const s = String(severity || "INFO").toUpperCase();
    const style = severityStyles[s] || severityStyles.INFO;

    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${style.className} ${className}`}
        >
            {style.label}
        </span>
    );
}