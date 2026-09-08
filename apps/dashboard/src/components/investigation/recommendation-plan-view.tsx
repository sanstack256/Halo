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
    ChevronDown,
    ChevronUp,
    Lock,
} from "lucide-react";
import type { DashboardRecommendationPlan } from "@/lib/investigation/recommendations";
import type { ValidatedRecommendationResult } from "@/lib/investigation/recommendation-engine/types";
import { RepairCaseView } from "./repair-case-view";

interface Props {
    plan: DashboardRecommendationPlan;
    llmResult?: ValidatedRecommendationResult;
    onJumpToEvidence?: (evidenceId: string) => void;
}

export function RecommendationPlanView({ plan, llmResult, onJumpToEvidence }: Props) {
    if (llmResult?.repairCase) {
        return (
            <RepairCaseView
                repairCase={llmResult.repairCase}
                llmResult={llmResult}
                onJumpToEvidence={onJumpToEvidence}
            />
        );
    }

    const { primary, secondary } = plan;

    const [copiedPatch, setCopiedPatch] = useState(false);
    const [showAudit, setShowAudit] = useState(false);

    const confidenceLevel = llmResult
        ? llmResult.confidence
        : primary.confidence >= 0.85 || primary.confidence >= 85
        ? "Very High"
        : primary.confidence >= 0.65 || primary.confidence >= 65
        ? "High"
        : primary.confidence >= 0.4 || primary.confidence >= 40
        ? "Medium"
        : "Low";

    const copyCodePatch = (code: string) => {
        if (code) {
            navigator.clipboard.writeText(code);
            setCopiedPatch(true);
            setTimeout(() => setCopiedPatch(false), 2000);
        }
    };

    const scrollToEvidence = (evidenceId: string) => {
        if (onJumpToEvidence) {
            onJumpToEvidence(evidenceId);
            return;
        }
        const el =
            document.getElementById(evidenceId) ||
            document.getElementById("section-evidence-records") ||
            document.getElementById("section-evidence-graph");
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    };

    const getClaimBadge = (cat: string) => {
        switch (cat) {
            case "OBSERVED":
                return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "DERIVED":
                return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "SUPPORTED":
                return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            default:
                return "bg-zinc-800 text-zinc-400 border-zinc-700";
        }
    };

    return (
        <section
            id="section-recommendations"
            className="halo-card p-6 border-border space-y-6 scroll-mt-24"
        >
            {/* Header */}
            <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Evidence-Bound Recommendations & Next Steps
                        </h2>
                        <p className="text-xs text-secondary">
                            Truth-constrained developer remediation derived strictly from verified telemetry and resolved source code.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {llmResult && (
                        <span className="text-xs font-mono px-2.5 py-1 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-400 font-semibold">
                            {llmResult.source === "LLM_VERIFIED"
                                ? "Verified LLM Analysis"
                                : llmResult.source === "REFUSAL_INSUFFICIENT_EVIDENCE"
                                ? "Gate Refusal"
                                : "Deterministic Fallback"}
                        </span>
                    )}
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full border bg-surface border-border text-zinc-300">
                        Confidence:{" "}
                        <strong className="text-emerald-400 font-bold">
                            {confidenceLevel}
                        </strong>
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. FAILURE MECHANISM / WHAT HAPPENED */}
                {llmResult && (
                    <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
                        <div className="flex items-center gap-2 text-zinc-300">
                            <Info size={15} className="text-accent" />
                            <h3 className="text-xs font-mono uppercase tracking-wider font-bold">
                                Observed Failure Mechanism
                            </h3>
                        </div>
                        <p className="text-xs text-zinc-200 leading-relaxed">
                            {llmResult.whatHappened}
                        </p>
                    </div>
                )}

                {/* 2. VERIFIED EVIDENCE CLAIMS (PROVENANCE BOUNDARY) */}
                {llmResult && llmResult.claims.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                                Verified Evidence Claims
                            </h3>
                            <span className="text-[11px] text-muted">
                                Every claim is anchored to actual telemetry IDs
                            </span>
                        </div>
                        <div className="space-y-2">
                            {llmResult.claims.map((claim, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 rounded-lg bg-[#080b11] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                >
                                    <div className="flex items-start sm:items-center gap-2">
                                        <span
                                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold shrink-0 mt-0.5 sm:mt-0 ${getClaimBadge(
                                                claim.category
                                            )}`}
                                        >
                                            {claim.category}
                                        </span>
                                        <span className="text-zinc-200 leading-normal">
                                            {claim.statement}
                                        </span>
                                    </div>
                                    {claim.evidenceIds.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap pl-6 sm:pl-0">
                                            {claim.evidenceIds.map((evId) => (
                                                <button
                                                    key={evId}
                                                    onClick={() => scrollToEvidence(evId)}
                                                    className="text-[10px] font-mono text-zinc-400 bg-surface px-1.5 py-0.5 rounded border border-border hover:text-accent hover:border-accent/40 transition-colors flex items-center gap-1"
                                                    title={`Jump to evidence ${evId}`}
                                                >
                                                    <span>{evId}</span>
                                                    <ExternalLink size={9} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. IMMEDIATE ACTION */}
                <div className="p-5 rounded-xl bg-surface border border-accent/40 space-y-4 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-accent">
                            <Zap size={16} />
                            <span className="text-xs font-mono uppercase tracking-wider font-bold">
                                Recommended Developer Action
                            </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 bg-surface-hover px-2 py-0.5 rounded border border-border">
                            Priority #1
                        </span>
                    </div>

                    <p className="text-sm font-semibold text-white leading-relaxed">
                        {llmResult?.action?.instruction || primary.immediateAction}
                    </p>

                    <div className="p-3 rounded-lg bg-surface-elevated/70 border border-border/60 text-xs text-zinc-300 leading-relaxed">
                        <span className="font-semibold text-zinc-200">Reasoning: </span>
                        {llmResult?.action?.reasoning || primary.rootCauseExplanation}
                    </div>

                    {llmResult?.action?.location && (
                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 pt-1">
                            <span>Target:</span>
                            <span className="text-emerald-400 font-semibold">
                                {llmResult.action.location.file}
                            </span>
                            {llmResult.action.location.line && (
                                <span>:{llmResult.action.location.line}</span>
                            )}
                            {llmResult.action.location.function && (
                                <span>in {llmResult.action.location.function}()</span>
                            )}
                        </div>
                    )}
                </div>

                {/* 4. PROPOSED CODE PATCH (PROPOSAL ONLY — NEVER EDITS FILES) */}
                {llmResult?.patch?.status === "AVAILABLE" &&
                llmResult.patch.files.length > 0 ? (
                    <div className="p-5 rounded-xl bg-surface border border-emerald-500/30 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <Code2 size={16} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    Proposed Code Patch
                                </h3>
                                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                                    Proposal Only — Not Applied
                                </span>
                            </div>

                            <button
                                onClick={() => copyCodePatch(llmResult.patch!.files[0].diff)}
                                className="halo-btn halo-btn-sm halo-btn-secondary flex items-center gap-1.5 text-xs"
                            >
                                <Copy size={12} />
                                <span>{copiedPatch ? "Copied Diff!" : "Copy Diff"}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                            <span>File:</span>
                            <span className="text-emerald-400 font-semibold">
                                {llmResult.patch.files[0].path}
                            </span>
                        </div>

                        <div className="rounded-xl bg-[#080b11] border border-white/10 overflow-hidden text-xs font-mono">
                            <div className="px-3.5 py-2 bg-zinc-900/90 border-b border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
                                <span>Unified Diff</span>
                                <span className="text-[10px] text-zinc-500">
                                    {llmResult.patch.validationNote}
                                </span>
                            </div>
                            <pre className="p-3.5 text-zinc-200 overflow-x-auto leading-relaxed whitespace-pre font-mono text-xs">
                                <code>
                                    {llmResult.patch.files[0].diff
                                        .split("\n")
                                        .map((line, idx) => (
                                            <span
                                                key={idx}
                                                className={
                                                    line.startsWith("+")
                                                        ? "text-emerald-400 block bg-emerald-500/10 -mx-3.5 px-3.5"
                                                        : line.startsWith("-")
                                                        ? "text-red-400 block bg-red-500/10 -mx-3.5 px-3.5"
                                                        : line.startsWith("@@")
                                                        ? "text-blue-400 block"
                                                        : "block"
                                                }
                                            >
                                                {line}
                                            </span>
                                        ))}
                                </code>
                            </pre>
                        </div>

                        <p className="text-xs text-secondary leading-relaxed">
                            {llmResult.patch.files[0].explanation}
                        </p>
                    </div>
                ) : llmResult?.patch ? (
                    <div className="p-4 rounded-xl bg-surface border border-border text-xs text-secondary flex items-start gap-2.5">
                        <Lock size={15} className="text-muted shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-zinc-300">
                                Code Patch Withheld:{" "}
                            </span>
                            <span>
                                {llmResult.patch.refusalReason ||
                                    "Telemetry does not provide sufficient source-level certainty to propose a safe patch."}
                            </span>
                        </div>
                    </div>
                ) : primary.codePatch ? (
                    /* Fallback to deterministic code patch if present */
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <Code2 size={16} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    Deterministic Source Patch
                                </h3>
                            </div>
                            <button
                                onClick={() => copyCodePatch(primary.codePatch!.after)}
                                className="halo-btn halo-btn-sm halo-btn-secondary flex items-center gap-1.5 text-xs"
                            >
                                <Copy size={12} />
                                <span>{copiedPatch ? "Copied" : "Copy"}</span>
                            </button>
                        </div>
                        <div className="rounded-xl bg-[#080b11] border border-white/10 overflow-hidden text-xs font-mono">
                            <pre className="p-3.5 text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre font-mono text-xs">
                                <code>{primary.codePatch.after}</code>
                            </pre>
                        </div>
                    </div>
                ) : null}

                {/* 5. UNKNOWNS & LIMITATIONS */}
                {llmResult &&
                    (llmResult.unknowns.length > 0 ||
                        llmResult.limitations.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {llmResult.unknowns.length > 0 && (
                                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                    <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                                        <AlertCircle size={14} />
                                        <span>Unknowns (Not Established by Evidence)</span>
                                    </div>
                                    <ul className="space-y-1 text-xs text-zinc-300">
                                        {llmResult.unknowns.map((u, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-amber-400">&bull;</span>
                                                <span>{u}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {llmResult.limitations.length > 0 && (
                                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                    <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                                        <Info size={14} />
                                        <span>Limitations &amp; Scope</span>
                                    </div>
                                    <ul className="space-y-1 text-xs text-zinc-300">
                                        {llmResult.limitations.map((l, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-blue-400">&bull;</span>
                                                <span>{l}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                {/* 6. VERIFICATION & PREVENTION GUARDRAILS */}
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
                                        <span className="text-emerald-400 font-bold">
                                            {i + 1}.
                                        </span>
                                        <span>{s}</span>
                                    </li>
                                ))}
                            </ol>
                            {primary.verification.regressionTest && (
                                <div className="p-2 rounded bg-[#080b11] border border-white/10 text-[11px] font-mono text-zinc-400 mt-2">
                                    <span className="text-emerald-400 font-semibold">
                                        Test:{" "}
                                    </span>
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
                                            <span className="text-blue-400 font-bold">
                                                &bull;
                                            </span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                {primary.prevention.monitoring && (
                                    <div className="p-2 rounded bg-[#080b11] border border-white/10 text-[11px] font-mono text-accent mt-2">
                                        <span className="text-zinc-400">
                                            Monitoring:{" "}
                                        </span>
                                        {primary.prevention.monitoring}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 7. AUDIT & INSPECTABILITY DRAWER */}
                {llmResult?.audit && (
                    <div className="pt-2 border-t border-border">
                        <button
                            onClick={() => setShowAudit(!showAudit)}
                            className="text-[11px] font-mono text-muted hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
                        >
                            <span>Inspect Recommendation Truth Audit</span>
                            {showAudit ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {showAudit && (
                            <div className="mt-3 p-3.5 rounded-lg bg-[#080b11] border border-white/5 text-[11px] font-mono text-zinc-400 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span>Snapshot ID:</span>
                                    <span className="text-zinc-200">
                                        {llmResult.audit.snapshotId}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Eligibility Gate Verdict:</span>
                                    <span className="text-emerald-400">
                                        {llmResult.audit.gateVerdict.canGenerateRecommendation
                                            ? "ELIGIBLE"
                                            : "INELIGIBLE"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Patch Gate Verdict:</span>
                                    <span className="text-zinc-200">
                                        {llmResult.audit.gateVerdict.patchEligibility}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Model Provider / Latency:</span>
                                    <span className="text-zinc-200">
                                        {llmResult.audit.modelInfo.provider} (
                                        {llmResult.audit.modelInfo.durationMs}ms)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Deterministic Validation:</span>
                                    <span
                                        className={
                                            llmResult.audit.validation.passed
                                                ? "text-emerald-400 font-bold"
                                                : "text-red-400 font-bold"
                                        }
                                    >
                                        {llmResult.audit.validation.passed
                                            ? "PASSED (0 Hallucinations)"
                                            : "REJECTED"}
                                    </span>
                                </div>
                                {llmResult.audit.validation.rejectionReasons.length > 0 && (
                                    <div className="pt-2 text-red-400 border-t border-white/5 space-y-1">
                                        <span>Rejection reasons:</span>
                                        <ul className="list-disc pl-4 space-y-0.5">
                                            {llmResult.audit.validation.rejectionReasons.map(
                                                (r, i) => (
                                                    <li key={i}>{r}</li>
                                                )
                                            )}
                                        </ul>
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
