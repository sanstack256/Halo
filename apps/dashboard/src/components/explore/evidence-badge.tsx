import React from "react";
import type { RelationshipType } from "@/lib/explore/evidence-types";
import { GitCommit, Globe, Radio, Clock, HelpCircle, CheckCircle2 } from "lucide-react";

interface EvidenceBadgeProps {
    linkage: RelationshipType | string;
    reason?: string;
    compact?: boolean;
}

export function EvidenceBadge({ linkage, reason, compact = false }: EvidenceBadgeProps) {
    switch (linkage) {
        case "DIRECT":
            return (
                <span
                    title={reason || "Anchor Signal"}
                    className={`inline-flex items-center gap-1 font-mono font-semibold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 ${
                        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                    }`}
                >
                    <CheckCircle2 size={compact ? 10 : 11} />
                    <span>ANCHOR</span>
                </span>
            );
        case "TRACE_LINK":
            return (
                <span
                    title={reason || "Directly correlated via shared distributed trace"}
                    className={`inline-flex items-center gap-1 font-mono font-semibold rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 ${
                        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                    }`}
                >
                    <GitCommit size={compact ? 10 : 11} />
                    <span>TRACE LINK</span>
                </span>
            );
        case "REQUEST_LINK":
            return (
                <span
                    title={reason || "Correlated via shared HTTP request"}
                    className={`inline-flex items-center gap-1 font-mono font-semibold rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 ${
                        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                    }`}
                >
                    <Globe size={compact ? 10 : 11} />
                    <span>REQUEST LINK</span>
                </span>
            );
        case "SESSION_LINK":
            return (
                <span
                    title={reason || "Correlated via client/user session"}
                    className={`inline-flex items-center gap-1 font-mono font-semibold rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 ${
                        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                    }`}
                >
                    <Radio size={compact ? 10 : 11} />
                    <span>SESSION LINK</span>
                </span>
            );
        case "TEMPORAL_CONTEXT":
            return (
                <span
                    title={reason || "Observed within surrounding temporal window (no direct ID linkage)"}
                    className={`inline-flex items-center gap-1 font-mono font-medium rounded bg-zinc-800 text-zinc-300 border border-zinc-700 ${
                        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                    }`}
                >
                    <Clock size={compact ? 10 : 11} />
                    <span>TEMPORAL CONTEXT</span>
                </span>
            );
        case "NO_DIRECT_LINK":
        default:
            return (
                <span
                    title={reason || "No direct trace, request, or session linkage observed"}
                    className={`inline-flex items-center gap-1 font-mono font-medium rounded bg-zinc-900 text-zinc-400 border border-zinc-800 ${
                        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                    }`}
                >
                    <HelpCircle size={compact ? 10 : 11} />
                    <span>NO DIRECT LINK</span>
                </span>
            );
    }
}
