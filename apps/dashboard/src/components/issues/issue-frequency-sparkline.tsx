"use client";

import React, { useState } from "react";
import { ActivityResult, TimeBucket } from "@/lib/issues/activity-calculator";
import { formatDeterministicDateTime } from "@/lib/date-format";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Props {
    activity: ActivityResult;
}

export function IssueFrequencySparkline({ activity }: Props) {
    const [hoveredBucket, setHoveredBucket] = useState<TimeBucket | null>(null);

    const formatBucketRange = (start: Date, end: Date) => {
        const startStr = formatDeterministicDateTime(start);
        const endStr = formatDeterministicDateTime(end);
        if (start.getTime() === end.getTime()) {
            return startStr;
        }
        return `${startStr} – ${endStr}`;
    };

    return (
        <div className="space-y-1.5 w-[140px] text-right">
            {/* 1. Canonical Activity Badge */}
            <div className="inline-flex items-center gap-1.5 justify-end">
                {activity.state === "INCREASING" && (
                    <TrendingUp size={11} className="text-red-400 shrink-0" />
                )}
                {activity.state === "DECREASING" && (
                    <TrendingDown size={11} className="text-emerald-400 shrink-0" />
                )}
                <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium inline-block ${activity.badgeClass}`}
                >
                    {activity.label}
                </span>
            </div>

            {/* 2. Frequency Bar Sparkline */}
            <div className="relative group/sparkline">
                <div className="flex items-end justify-end gap-[3px] h-[16px] p-0.5 rounded bg-[#04060a] border border-white/5">
                    {activity.buckets.map((b) => {
                        const isHovered = hoveredBucket?.index === b.index;
                        const hasEvents = b.count > 0;

                        // Semantic bar styling
                        let barColor = "bg-zinc-400/80 hover:bg-zinc-200";
                        if (activity.state === "INCREASING") {
                            barColor = b.isNewest ? "bg-red-400" : "bg-red-400/60 hover:bg-red-400";
                        } else if (activity.state === "DECREASING") {
                            barColor = b.isNewest ? "bg-emerald-400" : "bg-emerald-400/60 hover:bg-emerald-400";
                        } else if (activity.state === "ACTIVE") {
                            barColor = b.isNewest ? "bg-blue-400" : "bg-blue-400/60 hover:bg-blue-400";
                        } else if (activity.state === "DORMANT") {
                            barColor = "bg-zinc-600/60 hover:bg-zinc-400";
                        }

                        return (
                            <div
                                key={b.index}
                                onMouseEnter={() => setHoveredBucket(b)}
                                onMouseLeave={() => setHoveredBucket(null)}
                                style={{ height: hasEvents ? `${b.heightPercent}%` : "2px" }}
                                className={`relative flex-1 min-w-[5px] max-w-[14px] rounded-t-sm transition-all cursor-pointer ${
                                    hasEvents ? barColor : "bg-white/10 hover:bg-white/20"
                                } ${isHovered ? "ring-1 ring-white" : ""}`}
                            />
                        );
                    })}
                </div>

                {/* Interactive Tooltip */}
                {hoveredBucket && (
                    <div className="absolute bottom-full right-0 mb-1.5 z-50 p-2 rounded-lg bg-[#0d121d] border border-white/20 shadow-2xl text-[11px] font-mono text-left whitespace-nowrap pointer-events-none space-y-0.5">
                        <div className="text-white font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span>
                                {hoveredBucket.count} occurrence{hoveredBucket.count !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                            {formatBucketRange(hoveredBucket.startTime, hoveredBucket.endTime)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
