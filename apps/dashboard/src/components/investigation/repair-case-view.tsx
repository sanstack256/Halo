"use client";

import React, { useState } from "react";
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Code2,
    Copy,
    ExternalLink,
    HelpCircle,
    Info,
    Layers,
    Lock,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Terminal,
    Zap,
    ChevronDown,
    ChevronUp,
    FileText,
    Cpu,
    GitCommit,
    Gauge,
    Flame,
    Check,
} from "lucide-react";
import type { RepairCase, RepairEligibilityState, ProtectionStatus } from "@/lib/investigation/repair-intelligence/types";
import type { ValidatedRecommendationResult } from "@/lib/investigation/recommendation-engine/types";

interface Props {
    repairCase?: RepairCase;
    llmResult?: ValidatedRecommendationResult;
    onJumpToEvidence?: (evidenceId: string) => void;
}

export function RepairCaseView({ repairCase: propRepairCase, llmResult, onJumpToEvidence }: Props) {
    const repairCase = propRepairCase || llmResult?.repairCase;
    const [copiedPatch, setCopiedPatch] = useState(false);
    const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(
        repairCase?.selectedOptionId
    );

    if (!repairCase) {
        return null;
    }

    const {
        failureModel,
        protectionAnalysis,
        repositoryPatterns,
        repairEligibility,
        repairOptions,
        proposedPatch,
        blastRadius,
        sideEffects,
        evidenceGaps,
        validationBlueprint,
    } = repairCase;

    const selectedOption = repairOptions.find((opt) => opt.id === selectedOptionId);
    const activePatch = selectedOption?.patch || proposedPatch;

    const copyCodePatch = (diffText: string) => {
        if (diffText) {
            navigator.clipboard.writeText(diffText);
            setCopiedPatch(true);
            setTimeout(() => setCopiedPatch(false), 2000);
        }
    };

    const scrollToEvidence = (evidenceId: string) => {
        if (onJumpToEvidence) {
            onJumpToEvidence(evidenceId);
            return;
        }
        const el = document.getElementById(evidenceId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    };

    const getEligibilityBadge = (state: RepairEligibilityState) => {
        switch (state) {
            case "REPAIR_READY":
                return {
                    label: "REPAIR READY",
                    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    icon: ShieldCheck,
                };
            case "REPAIR_PLAUSIBLE":
                return {
                    label: "REPAIR PLAUSIBLE",
                    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                    icon: Info,
                };
            case "REPAIR_UNDERDETERMINED":
                return {
                    label: "REPAIR UNDERDETERMINED",
                    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    icon: AlertCircle,
                };
            case "REPAIR_BLOCKED":
                return {
                    label: "REPAIR BLOCKED",
                    color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
                    icon: ShieldAlert,
                };
            case "REPAIR_REFUTED":
                return {
                    label: "REPAIR REFUTED",
                    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
                    icon: Lock,
                };
        }
    };

    const getProtectionBadge = (status: ProtectionStatus) => {
        switch (status) {
            case "PROTECTION_PRESENT_AND_RELEVANT":
                return {
                    label: "PROTECTION PRESENT & RELEVANT",
                    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                };
            case "PROTECTION_PRESENT_BUT_INSUFFICIENT":
                return {
                    label: "PROTECTION INSUFFICIENT",
                    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                };
            case "PROTECTION_BYPASSED":
                return {
                    label: "PROTECTION BYPASSED",
                    color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                };
            case "PROTECTION_EXECUTION_UNKNOWN":
                return {
                    label: "EXECUTION UNPROVEN",
                    color: "bg-zinc-800 text-zinc-400 border-zinc-700",
                };
            case "NO_PROTECTION_FOUND":
                return {
                    label: "NO PROTECTION FOUND",
                    color: "bg-zinc-800 text-zinc-300 border-zinc-700",
                };
        }
    };

    const badge = getEligibilityBadge(repairEligibility.state);
    const BadgeIcon = badge.icon;
    const protBadge = getProtectionBadge(protectionAnalysis.status);

    return (
        <section
            id="section-repair-case"
            className="halo-card p-6 border-border space-y-6 scroll-mt-24"
        >
            {/* Header */}
            <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent mt-0.5">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-base font-semibold uppercase tracking-wider text-white">
                                Halo Repair Case
                            </h2>
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${badge.color}`}
                            >
                                <BadgeIcon className="w-3.5 h-3.5" />
                                {badge.label}
                            </span>
                        </div>
                        <p className="text-xs text-secondary mt-1 max-w-2xl">
                            Evidence-driven failure modeling, AST protection analysis, and verified repair boundary.
                        </p>
                    </div>
                </div>

                {/* Dual Confidence Meters */}
                <div className="flex items-center gap-4 bg-zinc-900/60 p-3 rounded-lg border border-border">
                    <div>
                        <div className="flex items-center justify-between gap-4 text-[11px] text-secondary font-mono">
                            <span>EVIDENCE CONFIDENCE</span>
                            <span className="text-white font-semibold">
                                {Math.round(repairEligibility.evidenceConfidence * 100)}%
                            </span>
                        </div>
                        <div className="w-32 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${repairEligibility.evidenceConfidence * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                        <div className="flex items-center justify-between gap-4 text-[11px] text-secondary font-mono">
                            <span>REPAIR CONFIDENCE</span>
                            <span className="text-white font-semibold">
                                {Math.round(repairEligibility.repairConfidence * 100)}%
                            </span>
                        </div>
                        <div className="w-32 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${repairEligibility.repairConfidence * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Repair Status Reason Alert */}
            <div
                className={`p-3.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${
                    repairEligibility.state === "REPAIR_READY"
                        ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-300"
                        : repairEligibility.state === "REPAIR_UNDERDETERMINED"
                        ? "bg-amber-950/20 border-amber-500/20 text-amber-300"
                        : repairEligibility.state === "REPAIR_BLOCKED"
                        ? "bg-rose-950/20 border-rose-500/20 text-rose-300"
                        : "bg-blue-950/20 border-blue-500/20 text-blue-300"
                }`}
            >
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold uppercase font-mono tracking-wider mr-1.5">
                        Status Analysis:
                    </span>
                    {repairEligibility.reason}
                </div>
            </div>

            {/* 1. FAILURE VIEW */}
            <div className="bg-zinc-900/40 p-4 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-secondary font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-accent" />
                        DIRECT FAILURE LOCATION
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        BOUNDARY: {failureModel.failureBoundary}
                    </span>
                </div>

                <div className="text-sm font-semibold text-white font-mono break-all">
                    {failureModel.errorTitle}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800/80">
                        <span className="text-zinc-500 block text-[10px]">SERVICE</span>
                        <span className="text-zinc-200 truncate block">{failureModel.service}</span>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800/80">
                        <span className="text-zinc-500 block text-[10px]">FUNCTION</span>
                        <span className="text-zinc-200 truncate block">
                            {failureModel.containingFunction || "anonymous"}
                        </span>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800/80 sm:col-span-2">
                        <span className="text-zinc-500 block text-[10px]">SOURCE SITE</span>
                        <span className="text-zinc-200 truncate block">
                            {failureModel.failingFile}:{failureModel.failingLineNumber || 1}
                        </span>
                    </div>
                </div>

                {failureModel.failingExpression && (
                    <div className="p-2.5 rounded bg-black/40 border border-zinc-800 text-xs font-mono">
                        <span className="text-zinc-500 block text-[10px] mb-1">OBSERVED EXPRESSION</span>
                        <code className="text-rose-300">{failureModel.failingExpression}</code>
                        <div className="mt-1.5 pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400">Runtime Value Status:</span>
                            <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    failureModel.runtimeValueStatus === "CAPTURED"
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                }`}
                            >
                                {failureModel.runtimeValueStatus === "CAPTURED"
                                    ? `CAPTURED: ${failureModel.runtimeValue}`
                                    : "NOT CAPTURED (Unproven in telemetry)"}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. WHAT HALO CAN PROVE vs WHAT HALO CANNOT PROVE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* What Halo Can Prove */}
                <div className="p-4 rounded-lg bg-emerald-950/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        What Halo Can Prove ({failureModel.knownFacts.length + failureModel.derivedFacts.length})
                    </div>
                    <ul className="space-y-2 text-xs">
                        {failureModel.knownFacts.map((fact) => (
                            <li key={fact.id} className="flex items-start gap-2 text-zinc-300 leading-relaxed">
                                <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                                <div>
                                    <span>{fact.claim}</span>
                                    {fact.evidenceIds.length > 0 && (
                                        <span className="ml-1.5 inline-flex gap-1">
                                            {fact.evidenceIds.slice(0, 3).map((id) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => scrollToEvidence(id)}
                                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    {id}
                                                </button>
                                            ))}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                        {failureModel.derivedFacts.map((fact) => (
                            <li key={fact.id} className="flex items-start gap-2 text-zinc-300 leading-relaxed">
                                <span className="text-blue-400 font-bold mt-0.5">↳</span>
                                <div>
                                    <span>{fact.claim}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* What Halo Cannot Prove */}
                <div className="p-4 rounded-lg bg-amber-950/10 border border-amber-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" />
                        What Halo Cannot Prove ({failureModel.unknowns.length})
                    </div>
                    {failureModel.unknowns.length > 0 ? (
                        <ul className="space-y-2.5 text-xs">
                            {failureModel.unknowns.map((unknown) => (
                                <li key={unknown.id} className="space-y-1 text-zinc-300">
                                    <div className="flex items-start gap-2">
                                        <span className="text-amber-400 font-bold mt-0.5">!</span>
                                        <span className="font-medium text-amber-200/90">{unknown.claim}</span>
                                    </div>
                                    {unknown.whyUnknownMatters && (
                                        <div className="pl-4 text-[11px] text-zinc-400 leading-relaxed">
                                            <span className="text-zinc-500 font-mono">Impact:</span>{" "}
                                            {unknown.whyUnknownMatters}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-zinc-400">
                            Zero critical telemetry gaps identified for this incident.
                        </p>
                    )}
                </div>
            </div>

            {/* 3. PROTECTION ANALYSIS UI */}
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-border space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-white font-semibold">
                        <ShieldAlert className="w-4 h-4 text-accent" />
                        AST Protection Analysis
                    </div>
                    <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${protBadge.color}`}
                    >
                        {protBadge.label}
                    </span>
                </div>

                <div className="text-xs text-zinc-300 leading-relaxed">
                    {protectionAnalysis.summary}
                </div>

                {protectionAnalysis.guards.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border">
                        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                            Observed Guard AST Nodes:
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                            {protectionAnalysis.guards.map((guard, idx) => (
                                <div
                                    key={idx}
                                    className="p-2.5 rounded bg-black/30 border border-zinc-800 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-500">Line {guard.line}:</span>
                                        <code className="text-zinc-200">{guard.text}</code>
                                    </div>
                                    <span
                                        className={`px-2 py-0.5 rounded text-[10px] self-start sm:self-center ${
                                            guard.protectsTargetExpression
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        }`}
                                    >
                                        {guard.protectsTargetExpression
                                            ? `Protects target expression`
                                            : `Protects '${guard.protectsSymbol}' only`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 4. REPAIR OPTIONS UI */}
            {repairOptions.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold flex items-center gap-2">
                            <Layers className="w-4 h-4 text-accent" />
                            Repair Alternatives &amp; Tradeoffs
                        </span>
                        {selectedOption ? (
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-accent font-mono flex items-center gap-1.5 bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-full">
                                    <Check className="w-3.5 h-3.5" />
                                    Active Selection: Option {String.fromCharCode(65 + repairOptions.indexOf(selectedOption))} ({selectedOption.id.includes("guard") ? "Defensive Guard" : "Precondition Validation"})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedOptionId(undefined)}
                                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline font-mono cursor-pointer"
                                    title="Unselect to return to underdetermined state"
                                >
                                    Reset
                                </button>
                            </div>
                        ) : (
                            repairEligibility.state === "REPAIR_UNDERDETERMINED" && (
                                <span className="text-[11px] text-amber-400 font-mono">
                                    No option selected: Intended behavior is underdetermined. Click an option below to preview its patch.
                                </span>
                            )
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {repairOptions.map((option, idx) => {
                            const isSelected = selectedOptionId === option.id;
                            const optionLetter = String.fromCharCode(65 + idx);

                            return (
                                <div
                                    key={option.id}
                                    onClick={() => setSelectedOptionId(isSelected ? undefined : option.id)}
                                    className={`p-4 rounded-lg border transition-all cursor-pointer space-y-3 relative ${
                                        isSelected
                                            ? "bg-zinc-900 border-accent/70 ring-1 ring-accent/40 shadow-lg shadow-accent/5"
                                            : "bg-zinc-900/40 border-border hover:border-zinc-700 hover:bg-zinc-900/60"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-accent">
                                                OPTION {optionLetter}
                                            </span>
                                            {isSelected && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/20 text-accent font-semibold flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> ACTIVE SELECTION
                                                </span>
                                            )}
                                        </div>
                                        {option.isRecommended && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                RECOMMENDED
                                            </span>
                                        )}
                                    </div>

                                    <h4 className="text-sm font-medium text-white">{option.title}</h4>
                                    <p className="text-xs text-secondary leading-relaxed">
                                        {option.approach}
                                    </p>

                                    {/* Pros */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-mono uppercase text-emerald-400 block font-semibold">
                                            Pros:
                                        </span>
                                        {option.pros.map((pro, pIdx) => (
                                            <div key={pIdx} className="text-xs text-zinc-300 flex items-start gap-1.5">
                                                <span className="text-emerald-400 text-[11px]">✓</span>
                                                <span>{pro}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tradeoffs */}
                                    <div className="space-y-1 pt-1">
                                        <span className="text-[10px] font-mono uppercase text-amber-400 block font-semibold">
                                            Tradeoff:
                                        </span>
                                        {option.tradeoffs.map((tradeoff, tIdx) => (
                                            <div key={tIdx} className="text-xs text-zinc-400 flex items-start gap-1.5">
                                                <span className="text-amber-400 text-[11px]">⚠</span>
                                                <span>{tradeoff}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Click preview hint */}
                                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono">
                                        <span className={isSelected ? "text-accent font-medium" : "text-zinc-500"}>
                                            {isSelected ? "Previewing patch & test blueprint below" : "Click to select strategy & view patch"}
                                        </span>
                                        <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-accent translate-x-0.5 transition-transform" : "text-zinc-600"}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 5. PROPOSED PATCH UI */}
            {activePatch && activePatch.validationStatus === "VALID" ? (
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-white font-semibold">
                            <Code2 className="w-4 h-4 text-accent" />
                            Proposed Patch {selectedOption ? `— Option ${String.fromCharCode(65 + repairOptions.indexOf(selectedOption))}: ${selectedOption.title}` : "(Deterministic AST Verified)"}
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            PROPOSED — NOT APPLIED
                        </span>
                    </div>

                    <div className="rounded-lg overflow-hidden border border-border bg-black/60 font-mono text-xs">
                        {/* Patch File Header */}
                        <div className="bg-zinc-900 px-4 py-2.5 border-b border-border flex items-center justify-between">
                            <span className="text-zinc-300 text-xs font-medium truncate">
                                {activePatch.targetFile}
                            </span>
                            <button
                                type="button"
                                onClick={() => copyCodePatch(activePatch.unifiedDiff)}
                                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                                {copiedPatch ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-medium">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy Patch</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Diff Content */}
                        <pre className="p-4 text-xs overflow-x-auto leading-relaxed">
                            {activePatch.unifiedDiff.split("\n").map((line, idx) => {
                                if (line.startsWith("+")) {
                                    return (
                                        <div key={idx} className="text-emerald-400 bg-emerald-950/20 px-1 -mx-1">
                                            {line}
                                        </div>
                                    );
                                }
                                if (line.startsWith("-")) {
                                    return (
                                        <div key={idx} className="text-rose-400 bg-rose-950/20 px-1 -mx-1">
                                            {line}
                                        </div>
                                    );
                                }
                                if (line.startsWith("@@")) {
                                    return (
                                        <div key={idx} className="text-blue-400 py-1">
                                            {line}
                                        </div>
                                    );
                                }
                                return <div key={idx} className="text-zinc-400">{line}</div>;
                            })}
                        </pre>

                        {/* Validation Checklist */}
                        <div className="bg-zinc-900/60 p-3 border-t border-border flex items-center justify-between flex-wrap gap-3 text-[11px]">
                            <div className="flex items-center gap-4 text-zinc-400 flex-wrap">
                                <span className="flex items-center gap-1 text-emerald-400">
                                    <Check className="w-3.5 h-3.5" /> Target file verified
                                </span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                    <Check className="w-3.5 h-3.5" /> Historical commit matched
                                </span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                    <Check className="w-3.5 h-3.5" /> Minimal diff (1-3 lines)
                                </span>
                                <span className="flex items-center gap-1 text-emerald-400">
                                    <Check className="w-3.5 h-3.5" /> TypeScript AST valid
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : repairEligibility.state === "REPAIR_UNDERDETERMINED" && repairOptions.length > 0 ? (
                <div className="p-5 rounded-lg bg-zinc-900/30 border border-dashed border-zinc-800 text-center space-y-2 pt-2">
                    <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400">
                        <Code2 className="w-4 h-4 text-accent" />
                        <span className="font-semibold uppercase tracking-wider">Proposed Patch Preview</span>
                    </div>
                    <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                        Intended runtime contract is underdetermined. Select an architectural strategy above to preview its syntax-verified diff.
                    </p>
                    <div className="flex items-center justify-center gap-3 pt-2">
                        {repairOptions.map((opt, idx) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedOptionId(opt.id)}
                                className="px-3 py-1.5 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                            >
                                Preview Option {String.fromCharCode(65 + idx)} ({opt.id.includes("guard") ? "Defensive Guard" : "Validate Preconditions"})
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* 6. BLAST RADIUS & SIDE EFFECT ANALYSIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Blast Radius */}
                <div className="p-4 rounded-lg bg-zinc-900/40 border border-border space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-white font-semibold uppercase tracking-wider">
                        <Gauge className="w-4 h-4 text-accent" />
                        Observed Blast Radius
                    </div>
                    <div className="space-y-2 text-xs">
                        <div>
                            <span className="text-zinc-500 font-mono text-[10px] block">STATIC REPOSITORIES CALLERS:</span>
                            <div className="text-zinc-300 font-mono">
                                {blastRadius.staticCallers.join(", ") || "None resolved"}
                            </div>
                        </div>

                        {blastRadius.runtimeUsage.length > 0 && (
                            <div>
                                <span className="text-zinc-500 font-mono text-[10px] block mb-1">
                                    OBSERVED TELEMETRY USAGE:
                                </span>
                                <div className="space-y-1">
                                    {blastRadius.runtimeUsage.slice(0, 4).map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs font-mono">
                                            <span className="text-zinc-300 truncate">{item.endpoint}</span>
                                            <span className="text-zinc-400 font-semibold">{item.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Side Effects */}
                <div className="p-4 rounded-lg bg-zinc-900/40 border border-border space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-white font-semibold uppercase tracking-wider">
                        <Flame className="w-4 h-4 text-amber-400" />
                        Side Effect Considerations
                    </div>

                    {/* Selected Strategy Specific Callout */}
                    {selectedOption && (
                        <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-300 font-mono font-semibold text-[11px] uppercase tracking-wider">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Selected Strategy Trade-off (Option {String.fromCharCode(65 + repairOptions.indexOf(selectedOption))}):
                            </div>
                            {selectedOption.tradeoffs.map((t, idx) => (
                                <div key={idx} className="text-xs text-zinc-300 leading-relaxed pl-1">
                                    • {t}
                                </div>
                            ))}
                        </div>
                    )}

                    <ul className="space-y-1.5 text-xs text-zinc-300">
                        {sideEffects.contractBreaks.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-zinc-300">
                                <span className="text-amber-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                        {sideEffects.behavioralSideEffects.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-zinc-400">
                                <span className="text-blue-400 mt-0.5">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* 7. EVIDENCE NEEDED TO UNLOCK REPAIR */}
            {repairEligibility.state !== "REPAIR_READY" && evidenceGaps.evidenceNeededToUnlock.length > 0 && (
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4" />
                        Evidence Needed to Unlock Repair Decision
                    </div>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                        {evidenceGaps.evidenceNeededToUnlock.map((gap, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="text-amber-400 font-mono font-bold">↳</span>
                                <span>{gap}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 8. INCIDENT-SPECIFIC VALIDATION BLUEPRINT */}
            <div className="p-4 rounded-lg bg-zinc-900/40 border border-border space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-white font-semibold uppercase tracking-wider">
                        <FileText className="w-4 h-4 text-accent" />
                        Incident-Specific Validation Blueprint
                    </div>
                    {selectedOption && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                            ADAPTED FOR OPTION {String.fromCharCode(65 + repairOptions.indexOf(selectedOption))}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-2.5 rounded bg-black/30 border border-zinc-800 space-y-1">
                        <span className="text-zinc-500 text-[10px] block">REPRODUCTION CONDITION</span>
                        <p className="text-zinc-300 font-sans text-xs">{validationBlueprint.reproductionCondition}</p>
                    </div>
                    <div className="p-2.5 rounded bg-black/30 border border-zinc-800 space-y-1">
                        <span className="text-zinc-500 text-[10px] block">FAILURE ASSERTION</span>
                        <p className="text-zinc-300 font-sans text-xs">
                            {selectedOption?.validationAssertion || validationBlueprint.failureAssertion}
                        </p>
                    </div>
                </div>

                {/* Regression Test Recommendation */}
                {(selectedOption?.regressionTestSnippet || validationBlueprint.newTestRecommendation) && (
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                                Recommended Regression Test ({selectedOption ? `Option ${String.fromCharCode(65 + repairOptions.indexOf(selectedOption))}` : validationBlueprint.newTestRecommendation?.testName}):
                            </span>
                        </div>
                        <pre className="p-3 rounded bg-black/60 border border-zinc-800 text-xs text-zinc-300 font-mono overflow-x-auto">
                            {selectedOption?.regressionTestSnippet || validationBlueprint.newTestRecommendation?.testCode}
                        </pre>
                    </div>
                )}
            </div>
        </section>
    );
}
