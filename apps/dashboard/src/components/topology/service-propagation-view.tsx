"use client";

import React, { useState, useEffect } from "react";
import {
    GitFork,
    ArrowRight,
    AlertTriangle,
    ShieldCheck,
    Clock,
    Server,
    Activity,
    Layers,
    GitCompare,
} from "lucide-react";
import {
    getServiceFailurePropagation,
    type ServiceFailurePropagation,
    type FailurePropagationStep,
} from "@/actions/topology";
import Link from "next/link";

interface Props {
    projectId: string;
    eventId: string;
    isTeamPlan: boolean;
}

export function ServicePropagationView({
    projectId,
    eventId,
    isTeamPlan,
}: Props) {
    const [propagation, setPropagation] = useState<ServiceFailurePropagation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isTeamPlan || !eventId) return;
        let isMounted = true;
        setLoading(true);
        setError(null);

        getServiceFailurePropagation({ projectId, eventId })
            .then((res) => {
                if (isMounted) setPropagation(res);
            })
            .catch((err: any) => {
                if (isMounted) setError(err.message || "Failed to reconstruct failure propagation");
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
                    <GitFork size={20} />
                </div>
                <h3 className="text-sm font-semibold text-white">Cross-Service Failure Propagation</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Trace how upstream service exceptions propagated across microservice boundaries to impact downstream dependencies and edge APIs. Available on the <strong>Team Plan</strong>.
                </p>
                <div className="pt-1">
                    <Link
                        href="/settings/billing"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
                    >
                        Upgrade to Team Plan
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-[#121316] border border-[#27272a] rounded-xl p-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Reconstructing multi-service failure propagation path...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-4 flex items-center gap-3 text-xs text-rose-300">
                <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                <span>{error}</span>
            </div>
        );
    }

    if (!propagation) return null;

    return (
        <div className="bg-[#121316] border border-[#27272a] rounded-xl overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a] pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                        <GitFork size={15} />
                    </div>
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                            Cross-Service Failure Propagation Path
                        </h4>
                        <p className="text-[11px] text-zinc-400 font-mono">
                            Trace ID: {propagation.traceId} • {propagation.steps.length} participating span{propagation.steps.length === 1 ? "" : "s"}
                        </p>
                    </div>
                </div>

                <div className="text-[11px] font-mono text-zinc-400">
                    <span className="text-zinc-500">Origin: </span>
                    <span className="text-rose-400 font-semibold">{propagation.originService}</span>
                    <span className="text-zinc-600 mx-1.5">→</span>
                    <span className="text-zinc-500">Impacted: </span>
                    <span className="text-amber-400 font-semibold">{propagation.impactedService}</span>
                </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-mono bg-[#0d0e11] p-2.5 rounded-lg border border-zinc-800">
                {propagation.explanation}
            </p>

            {/* Propagation Steps Sequence */}
            <div className="space-y-2 pt-1">
                {propagation.steps.map((step, idx) => {
                    const isLast = idx === propagation.steps.length - 1;
                    return (
                        <div key={step.stepIndex} className="relative">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-[#141519] border border-zinc-800 hover:border-zinc-700 transition">
                                <div className="flex flex-col items-center">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                                        step.role === "ORIGIN_ROOT_CAUSE"
                                            ? "bg-rose-500 text-black"
                                            : step.role === "IMPACTED_SURFACE"
                                            ? "bg-amber-500 text-black"
                                            : "bg-indigo-600 text-white"
                                    }`}>
                                        {step.stepIndex}
                                    </span>
                                </div>

                                <div className="flex-1 space-y-1 text-xs">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white font-mono">{step.service}</span>
                                            <span className="text-zinc-500">•</span>
                                            <span className="text-zinc-300 font-mono">{step.operation}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold ${
                                                step.role === "ORIGIN_ROOT_CAUSE"
                                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                                    : step.role === "IMPACTED_SURFACE"
                                                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                                                    : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                                            }`}>
                                                {step.role.replace(/_/g, " ")}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-[11px] font-mono">
                                            {step.status && (
                                                <span className={String(step.status).startsWith("5") ? "text-rose-400 font-bold" : "text-zinc-400"}>
                                                    HTTP {step.status}
                                                </span>
                                            )}
                                            {step.durationMs !== null && (
                                                <span className="text-zinc-400">{step.durationMs}ms</span>
                                            )}
                                            <span className="text-zinc-500">
                                                {new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                            </span>
                                        </div>
                                    </div>

                                    {(step.spanId || step.parentSpanId) && (
                                        <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-3">
                                            {step.spanId && <span>span: {step.spanId}</span>}
                                            {step.parentSpanId && <span>parent: {step.parentSpanId}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!isLast && (
                                <div className="ml-5 h-2 w-0.5 bg-zinc-700 my-0.5" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
