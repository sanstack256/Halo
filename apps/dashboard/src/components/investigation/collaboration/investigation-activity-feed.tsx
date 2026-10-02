"use client";

import React, { useState } from "react";
import { MessageSquare, CheckCircle2, XCircle, HelpCircle, Activity, ChevronRight, Filter } from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import type { InvestigationActivityType } from "@/generated/prisma/client";

interface ActivityItem {
    id: string;
    actorId: string;
    actorName: string;
    actorEmail: string;
    type: InvestigationActivityType;
    summary: string;
    targetType: string | null;
    targetId: string | null;
    metadata: any;
    createdAt: string;
}

interface Props {
    activities: ActivityItem[];
    onTargetSelect: (target: {
        type: "INVESTIGATION" | "HYPOTHESIS" | "EVIDENCE" | "CAUSAL_EDGE" | "TOPOLOGY_NODE" | "REPLAY";
        id?: string;
        title?: string;
    }) => void;
}

export function InvestigationActivityFeed({ activities, onTargetSelect }: Props) {
    const [filter, setFilter] = useState<"ALL" | "COMMENTS" | "VERDICTS" | "RELATIONS">("ALL");

    const filtered = activities.filter((a) => {
        if (filter === "ALL") return true;
        if (filter === "COMMENTS") return a.type.startsWith("COMMENT");
        if (filter === "VERDICTS") return a.type === "VERDICT_RECORDED";
        if (filter === "RELATIONS") return a.type === "RELATIONSHIP_PROPOSED";
        return true;
    });

    const getIcon = (type: InvestigationActivityType) => {
        switch (type) {
            case "VERDICT_RECORDED":
                return <CheckCircle2 size={13} className="text-emerald-400" />;
            case "COMMENT_ADDED":
            case "COMMENT_EDITED":
                return <MessageSquare size={13} className="text-indigo-400" />;
            case "COMMENT_DELETED":
                return <XCircle size={13} className="text-zinc-500" />;
            case "RELATIONSHIP_PROPOSED":
                return <Activity size={13} className="text-cyan-400" />;
            default:
                return <Activity size={13} className="text-zinc-400" />;
        }
    };

    return (
        <div className="space-y-3">
            {/* Header with filter chips */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Activity size={14} className="text-indigo-400" />
                    <span>Investigation Activity Stream</span>
                    <span className="text-[11px] font-mono text-zinc-500">({activities.length})</span>
                </div>

                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                    {(["ALL", "COMMENTS", "VERDICTS", "RELATIONS"] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                                filter === f
                                    ? "bg-zinc-800 text-zinc-200"
                                    : "text-zinc-400 hover:text-zinc-300"
                            }`}
                        >
                            {f === "ALL" ? "All" : f === "COMMENTS" ? "Comments" : f === "VERDICTS" ? "Verdicts" : "Proposed"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable feed list */}
            {filtered.length === 0 ? (
                <div className="text-xs text-zinc-500 py-3 text-center border border-dashed border-zinc-800/80 rounded-lg">
                    No activity recorded yet for this filter.
                </div>
            ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {filtered.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-3 py-1.5 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-lg text-xs transition group"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0">{getIcon(item.type)}</span>
                                <span className="text-zinc-300 truncate font-mono text-[11px]">
                                    {item.summary}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[10px] text-zinc-500 font-mono">
                                    <RelativeTime date={new Date(item.createdAt)} />
                                </span>

                                {item.targetType && (
                                    <button
                                        onClick={() =>
                                            onTargetSelect({
                                                type: item.targetType as any,
                                                id: item.targetId || undefined,
                                                title: `${item.targetType} ${item.targetId || ""}`,
                                            })
                                        }
                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] transition"
                                    >
                                        <span>View</span>
                                        <ChevronRight size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
