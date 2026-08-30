"use client";

import React, { useState } from "react";
import { Layers, ChevronDown, ChevronUp } from "lucide-react";

interface TelemetryItem {
    service?: string;
    title?: string;
    type?: string;
    [key: string]: any;
}

interface Props {
    relatedTraces: TelemetryItem[];
    relatedLogs: TelemetryItem[];
    relatedMetrics: TelemetryItem[];
    relatedThirdParty: TelemetryItem[];
}

const INITIAL_VISIBLE_COUNT = 3;

export function RelatedTelemetryView({
    relatedTraces = [],
    relatedLogs = [],
    relatedMetrics = [],
    relatedThirdParty = [],
}: Props) {
    const totalCount =
        relatedTraces.length +
        relatedLogs.length +
        relatedMetrics.length +
        relatedThirdParty.length;

    const [expandedCategories, setExpandedCategories] = useState<{
        traces: boolean;
        logs: boolean;
        metrics: boolean;
        thirdParty: boolean;
    }>({
        traces: false,
        logs: false,
        metrics: false,
        thirdParty: false,
    });

    if (totalCount === 0) {
        return null;
    }

    const toggleCategory = (cat: "traces" | "logs" | "metrics" | "thirdParty") => {
        setExpandedCategories((prev) => ({
            ...prev,
            [cat]: !prev[cat],
        }));
    };

    const hasAnyHidden =
        (relatedTraces.length > INITIAL_VISIBLE_COUNT && !expandedCategories.traces) ||
        (relatedLogs.length > INITIAL_VISIBLE_COUNT && !expandedCategories.logs) ||
        (relatedMetrics.length > INITIAL_VISIBLE_COUNT && !expandedCategories.metrics) ||
        (relatedThirdParty.length > INITIAL_VISIBLE_COUNT && !expandedCategories.thirdParty);

    const toggleAll = () => {
        const nextState = hasAnyHidden;
        setExpandedCategories({
            traces: nextState,
            logs: nextState,
            metrics: nextState,
            thirdParty: nextState,
        });
    };

    const hasMultipleLongCategories =
        [relatedTraces, relatedLogs, relatedMetrics, relatedThirdParty].filter(
            (arr) => arr.length > INITIAL_VISIBLE_COUNT
        ).length > 0;

    return (
        <section id="section-telemetry" className="halo-card p-6 border-border space-y-4 scroll-mt-24">
            <div className="border-b border-border pb-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        Related Telemetry Signals
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-secondary">
                        {totalCount} items
                    </span>
                    {hasMultipleLongCategories && (
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="text-[11px] font-mono text-accent hover:underline flex items-center gap-1"
                        >
                            {hasAnyHidden ? "Expand all" : "Collapse all"}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* 1. Distributed Traces */}
                {relatedTraces.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    Distributed Traces &amp; Spans ({relatedTraces.length})
                                </span>
                            </div>
                            <ul className="space-y-1.5 text-zinc-300">
                                {(expandedCategories.traces
                                    ? relatedTraces
                                    : relatedTraces.slice(0, INITIAL_VISIBLE_COUNT)
                                ).map((t, i) => (
                                    <li key={i} className="truncate flex items-center gap-1.5">
                                        <span className="text-blue-400 font-semibold">{t.service || "app"}</span>
                                        <span className="text-zinc-600">:</span>
                                        <span className="text-zinc-200 truncate">{t.title || "Span"}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {relatedTraces.length > INITIAL_VISIBLE_COUNT && (
                            <div className="pt-1 border-t border-border/40">
                                <button
                                    type="button"
                                    onClick={() => toggleCategory("traces")}
                                    className="text-[11px] font-medium text-accent hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    {expandedCategories.traces ? (
                                        <>
                                            <ChevronUp size={13} />
                                            <span>Show less</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={13} />
                                            <span>View all ({relatedTraces.length})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Logs */}
                {relatedLogs.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    Logs ({relatedLogs.length})
                                </span>
                            </div>
                            <ul className="space-y-1.5 text-zinc-400">
                                {(expandedCategories.logs
                                    ? relatedLogs
                                    : relatedLogs.slice(0, INITIAL_VISIBLE_COUNT)
                                ).map((l, i) => (
                                    <li key={i} className="truncate flex items-center gap-1.5">
                                        {l.service && (
                                            <>
                                                <span className="text-zinc-500 font-semibold">{l.service}</span>
                                                <span className="text-zinc-700">:</span>
                                            </>
                                        )}
                                        <span className="text-zinc-300 truncate">{l.title || "Log"}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {relatedLogs.length > INITIAL_VISIBLE_COUNT && (
                            <div className="pt-1 border-t border-border/40">
                                <button
                                    type="button"
                                    onClick={() => toggleCategory("logs")}
                                    className="text-[11px] font-medium text-accent hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    {expandedCategories.logs ? (
                                        <>
                                            <ChevronUp size={13} />
                                            <span>Show less</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={13} />
                                            <span>View all ({relatedLogs.length})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Metrics */}
                {relatedMetrics.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    Metrics ({relatedMetrics.length})
                                </span>
                            </div>
                            <ul className="space-y-1.5 text-zinc-400">
                                {(expandedCategories.metrics
                                    ? relatedMetrics
                                    : relatedMetrics.slice(0, INITIAL_VISIBLE_COUNT)
                                ).map((m, i) => (
                                    <li key={i} className="truncate flex items-center gap-1.5">
                                        {m.service && (
                                            <>
                                                <span className="text-purple-400 font-semibold">{m.service}</span>
                                                <span className="text-zinc-700">:</span>
                                            </>
                                        )}
                                        <span className="text-zinc-300 truncate">{m.title || "Metric"}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {relatedMetrics.length > INITIAL_VISIBLE_COUNT && (
                            <div className="pt-1 border-t border-border/40">
                                <button
                                    type="button"
                                    onClick={() => toggleCategory("metrics")}
                                    className="text-[11px] font-medium text-accent hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    {expandedCategories.metrics ? (
                                        <>
                                            <ChevronUp size={13} />
                                            <span>Show less</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={13} />
                                            <span>View all ({relatedMetrics.length})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Infrastructure & Third Party */}
                {relatedThirdParty.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5 flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    Infrastructure &amp; Third Party ({relatedThirdParty.length})
                                </span>
                            </div>
                            <ul className="space-y-1.5 text-zinc-400">
                                {(expandedCategories.thirdParty
                                    ? relatedThirdParty
                                    : relatedThirdParty.slice(0, INITIAL_VISIBLE_COUNT)
                                ).map((tp, i) => (
                                    <li key={i} className="truncate flex items-center gap-1.5">
                                        {tp.service && (
                                            <>
                                                <span className="text-amber-400 font-semibold">{tp.service}</span>
                                                <span className="text-zinc-700">:</span>
                                            </>
                                        )}
                                        <span className="text-zinc-300 truncate">{tp.title || "Event"}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {relatedThirdParty.length > INITIAL_VISIBLE_COUNT && (
                            <div className="pt-1 border-t border-border/40">
                                <button
                                    type="button"
                                    onClick={() => toggleCategory("thirdParty")}
                                    className="text-[11px] font-medium text-accent hover:text-white flex items-center gap-1 transition-colors"
                                >
                                    {expandedCategories.thirdParty ? (
                                        <>
                                            <ChevronUp size={13} />
                                            <span>Show less</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={13} />
                                            <span>View all ({relatedThirdParty.length})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
