"use client";

import { useState, useEffect } from "react";
import { GitCompare, Clock, AlertTriangle, ShieldCheck, CheckCircle2, HelpCircle } from "lucide-react";
import { computeDifferentialTrace, type DifferentialTraceAnalysis } from "@/actions/differential-trace";

export function DifferentialTraceView({
    projectId,
    eventId,
    isTeamPlan,
}: {
    projectId: string;
    eventId?: string;
    isTeamPlan: boolean;
}) {
    const [analysis, setAnalysis] = useState<DifferentialTraceAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isTeamPlan || !eventId) return;

        let isMounted = true;
        setLoading(true);
        setError(null);

        computeDifferentialTrace(projectId, eventId)
            .then((res) => {
                if (isMounted) setAnalysis(res);
            })
            .catch((err: any) => {
                if (isMounted) setError(err.message || "Failed to compute differential trace");
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [projectId, eventId, isTeamPlan]);

    if (!isTeamPlan) {
        return (
            <div className="bg-[#121316] border border-amber-800/40 rounded-xl p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-700/50 flex items-center justify-center mx-auto text-amber-400">
                    <GitCompare size={20} />
                </div>
                <h3 className="text-sm font-semibold text-white">Differential Trace Analysis</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Compare this failing execution against successful baseline runs to isolate latency anomalies, payload deviations, and execution path branching. Available exclusively on the <strong>Team Plan</strong>.
                </p>
                <div className="pt-1">
                    <a
                        href="/settings/billing"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
                    >
                        Upgrade to Team Plan
                    </a>
                </div>
            </div>
        );
    }

    if (!eventId) {
        return (
            <div className="bg-[#121316] border border-[#27272a] rounded-xl p-6 text-center text-xs text-zinc-500">
                Select an event or trace span to run differential analysis against baseline runs.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-[#121316] border border-[#27272a] rounded-xl p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Contrasting failing trace against historical baseline runs...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-4 flex items-center gap-3 text-xs text-rose-300">
                <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                <span>{error}</span>
            </div>
        );
    }

    if (!analysis) return null;

    return (
        <div className="bg-[#121316] border border-[#27272a] rounded-xl overflow-hidden space-y-5 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                        <GitCompare size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">Differential Trace Analysis</h3>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                                Team Feature
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">
                            {analysis.service} :: {analysis.operation}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {analysis.hasBaseline ? (
                        <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1.5">
                            <CheckCircle2 size={12} />
                            {analysis.baselineCount} Baseline Spans
                        </span>
                    ) : (
                        <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Baseline Unavailable
                        </span>
                    )}
                </div>
            </div>

            {/* Uncertainty Warning if baseline missing or small */}
            {analysis.uncertainty === "HIGH" && (
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3.5 flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
                    <HelpCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <strong>Honest Uncertainty Notice:</strong> No successful baseline traces exist for this operation in the last 7 days. Halo refuses to fabricate hypothetical baseline metrics.
                    </div>
                </div>
            )}

            {/* Latency Comparison Card */}
            {analysis.hasBaseline && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3.5">
                        <p className="text-[11px] uppercase font-mono text-zinc-500">Failing Duration</p>
                        <p className="text-lg font-bold text-rose-400 mt-1">
                            {analysis.failingTrace.durationMs !== null ? `${analysis.failingTrace.durationMs}ms` : "N/A"}
                        </p>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3.5">
                        <p className="text-[11px] uppercase font-mono text-zinc-500">Baseline Average (7d)</p>
                        <p className="text-lg font-bold text-emerald-400 mt-1">
                            {analysis.baselineAverageDurationMs !== null ? `${analysis.baselineAverageDurationMs}ms` : "N/A"}
                        </p>
                    </div>

                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3.5">
                        <p className="text-[11px] uppercase font-mono text-zinc-500">Latency Delta</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-bold text-white">
                                {analysis.durationDeltaMs !== null
                                    ? `${analysis.durationDeltaMs > 0 ? "+" : ""}${analysis.durationDeltaMs}ms`
                                    : "N/A"}
                            </span>
                            {analysis.durationMultiplier && analysis.durationMultiplier > 1 && (
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                                    {analysis.durationMultiplier}x slower
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Divergent Tags / Payload Comparison */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                    Parameter &amp; Tag Divergence
                </h4>

                {analysis.divergentTags.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">
                        {analysis.hasBaseline
                            ? "No tag anomalies or divergent parameters detected between failure and baseline executions."
                            : "Baseline data unavailable for parameter divergence."}
                    </p>
                ) : (
                    <div className="border border-[#27272a] rounded-lg overflow-hidden divide-y divide-[#27272a] text-xs">
                        <div className="grid grid-cols-3 bg-zinc-900/80 px-3 py-2 font-mono text-zinc-400 text-[11px]">
                            <span>Parameter / Tag</span>
                            <span>Failing Execution</span>
                            <span>Common Baseline</span>
                        </div>
                        {analysis.divergentTags.map((dt) => (
                            <div key={dt.key} className="grid grid-cols-3 px-3 py-2 items-center font-mono">
                                <span className="text-zinc-300 font-semibold">{dt.key}</span>
                                <span className="text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded inline-block max-w-fit">
                                    {String(dt.failingValue)}
                                </span>
                                <span className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded inline-block max-w-fit">
                                    {String(dt.baselineCommonValue)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Structural Anomalies */}
            {analysis.structuralAnomalies.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                        Execution Anomalies
                    </h4>
                    <ul className="space-y-1.5 text-xs text-zinc-400">
                        {analysis.structuralAnomalies.map((anom, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="text-rose-400 font-bold">•</span>
                                <span>{anom}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
