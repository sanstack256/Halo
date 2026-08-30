"use client";

import React, { useState } from "react";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Code2,
    Copy,
    ExternalLink,
    HelpCircle,
    Info,
    Layers,
    ListTree,
    Network,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Terminal,
    Zap,
} from "lucide-react";
import type { DashboardRecommendationPlan } from "@/lib/investigation/recommendations";

interface Props {
    plan: DashboardRecommendationPlan;
    onJumpToEvidence?: (evidenceId: string) => void;
}

export function RecommendationPlanView({ plan, onJumpToEvidence }: Props) {
    const { primary, secondary } = plan;
    const [copiedPatch, setCopiedPatch] = useState(false);

    const getKindBadge = (kind: string) => {
        switch (kind) {
            case "exact-code-fix":
                return { label: "Exact Code Fix", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" };
            case "rollback":
                return { label: "Deployment Rollback", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" };
            case "config-fix":
                return { label: "Configuration Fix", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
            case "operational-fix":
                return { label: "Operational Remediation", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" };
            case "dependency-fix":
                return { label: "Dependency Remediation", bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" };
            case "insufficient-evidence":
                return { label: "Telemetry Required", bg: "bg-zinc-800", text: "text-zinc-400", border: "border-zinc-700" };
            default:
                return { label: "Targeted Action", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
        }
    };

    const badge = getKindBadge(primary.kind);
    const confidenceLevel =
        primary.confidence >= 0.85 || primary.confidence >= 85
            ? "Very High"
            : primary.confidence >= 0.65 || primary.confidence >= 65
            ? "High"
            : primary.confidence >= 0.4 || primary.confidence >= 40
            ? "Medium"
            : "Low";

    const copyCodePatch = () => {
        if (primary.codePatch?.after) {
            navigator.clipboard.writeText(primary.codePatch.after);
            setCopiedPatch(true);
            setTimeout(() => setCopiedPatch(false), 2000);
        }
    };

    const scrollToEvidence = (evidenceId: string) => {
        if (onJumpToEvidence) {
            onJumpToEvidence(evidenceId);
            return;
        }
        const el = document.getElementById("section-evidence-records") || document.getElementById("section-evidence-graph");
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <section id="section-recommendations" className="halo-card p-6 border-border space-y-6 scroll-mt-24">
            {/* Header */}
            <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Actionable Recommendations & Next Steps
                        </h2>
                        <p className="text-xs text-secondary">
                            Evidence-backed remediation procedure with expected outcomes and verification tests.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full border bg-surface border-border text-zinc-300">
                        Recommendation confidence: <strong className="text-emerald-400 font-bold">{confidenceLevel}</strong>
                    </span>
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border font-semibold ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. MOST USEFUL NEXT ACTION (DOMINANT VISUAL CARD) */}
                <div className="p-5 rounded-2xl bg-surface border border-accent/40 space-y-4 shadow-xl shadow-accent/5 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-accent">
                            <Zap size={16} />
                            <span className="text-xs font-mono uppercase tracking-wider font-bold">
                                Most Useful Next Action
                            </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 bg-surface-hover px-2 py-0.5 rounded border border-border">
                            Priority #1
                        </span>
                    </div>

                    <p className="text-base font-bold text-white leading-snug">
                        {primary.immediateAction}
                    </p>

                    {/* Why Halo recommends it & Evidence Traceability */}
                    <div className="p-3.5 rounded-xl bg-[#080b11] border border-white/10 space-y-2 text-xs">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold block">
                            Why Halo Recommends It
                        </span>
                        <p className="text-zinc-300 leading-relaxed">
                            {primary.rootCauseExplanation}
                        </p>

                        {/* Traceable Evidence Badges */}
                        {primary.evidenceChain && primary.evidenceChain.length > 0 && (
                            <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap text-[11px] font-mono">
                                <span className="text-zinc-500">Based on:</span>
                                {primary.evidenceChain.map((ev, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => scrollToEvidence(ev.evidenceId)}
                                        className="px-2 py-0.5 rounded bg-surface border border-border text-accent hover:text-white hover:border-accent transition-colors flex items-center gap-1 cursor-pointer"
                                        title={`Jump to evidence ${ev.evidenceId}`}
                                    >
                                        <Layers size={11} />
                                        <span>{ev.role} ({ev.evidenceId.slice(0, 8)}…)</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Decision Branching: If Confirmed vs If Disproved */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                                <CheckCircle2 size={13} />
                                <span>What to do if confirmed</span>
                            </div>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                                {primary.verification?.expectedOutcome || "Deploy the verified code fix to staging and observe that error recurrence drops to 0."}
                            </p>
                        </div>

                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                                <AlertCircle size={13} />
                                <span>What to do if disproved</span>
                            </div>
                            <p className="text-zinc-400 text-[11px] leading-relaxed">
                                {primary.insufficientEvidence?.why || "Inspect upstream microservice logs and query execution timeouts to identify the unobserved root cause."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. RECOMMENDED CODE PATCH (IF AVAILABLE) */}
                {primary.codePatch && (
                    <div className="p-5 rounded-2xl bg-surface border border-blue-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-400">
                                <Code2 size={16} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    Recommended Code Patch
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={copyCodePatch}
                                className="halo-btn halo-btn-xs halo-btn-secondary flex items-center gap-1"
                            >
                                <Copy size={12} />
                                <span>{copiedPatch ? "Copied!" : "Copy Patch"}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                            <span>File:</span>
                            <span className="text-emerald-400 font-semibold">{primary.codePatch.filePath}</span>
                            {primary.codePatch.lineRange && <span>:{primary.codePatch.lineRange}</span>}
                            {primary.codePatch.functionOrComponent && (
                                <>
                                    <span>in</span>
                                    <span className="text-accent font-semibold">{primary.codePatch.functionOrComponent}()</span>
                                </>
                            )}
                        </div>

                        <div className="rounded-xl bg-[#080b11] border border-white/10 overflow-hidden text-xs font-mono">
                            <div className="px-3.5 py-2 bg-zinc-900/90 border-b border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
                                <span>Suggested Patch</span>
                                <span className="text-[10px] text-zinc-500">Proposed modification — review before deploying</span>
                            </div>
                            <pre className="p-3.5 text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre font-mono text-xs">
                                <code>{primary.codePatch.after}</code>
                            </pre>
                        </div>

                        <p className="text-xs text-secondary leading-relaxed">
                            {primary.codePatch.explanation}
                        </p>
                    </div>
                )}

                {/* 3. OPERATIONAL STEPS (IF PRESENT) */}
                {primary.operationalSteps && primary.operationalSteps.length > 0 && (
                    <div className="p-5 rounded-2xl bg-surface border border-purple-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-purple-400">
                            <Terminal size={16} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                Step-by-Step Remediation Procedure
                            </h3>
                        </div>
                        <ol className="space-y-2 pt-1 text-xs text-zinc-300 font-mono">
                            {primary.operationalSteps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#080b11] border border-white/5">
                                    <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="leading-relaxed text-zinc-200">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}

                {/* 4. VERIFICATION & PREVENTION GUARDRAILS */}
                {primary.verification && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                <CheckCircle2 size={14} />
                                <span>Verification Procedure</span>
                            </div>
                            <ol className="space-y-1.5 text-xs text-zinc-300">
                                {primary.verification.steps.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-emerald-400 font-bold">{i + 1}.</span>
                                        <span>{s}</span>
                                    </li>
                                ))}
                            </ol>
                            {primary.verification.regressionTest && (
                                <div className="p-2 rounded bg-[#080b11] border border-white/10 text-[11px] font-mono text-zinc-400 mt-2">
                                    <span className="text-emerald-400 font-semibold">Test: </span>
                                    {primary.verification.regressionTest}
                                </div>
                            )}
                        </div>

                        {primary.prevention && (
                            <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                                    <ShieldCheck size={14} />
                                    <span>Long-Term Prevention</span>
                                </div>
                                <ul className="space-y-1.5 text-xs text-zinc-300">
                                    {primary.prevention.items.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="text-blue-400 font-bold">&bull;</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                {primary.prevention.monitoring && (
                                    <div className="p-2 rounded bg-[#080b11] border border-white/10 text-[11px] font-mono text-accent mt-2">
                                        <span className="text-zinc-400">Monitoring: </span>
                                        {primary.prevention.monitoring}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
