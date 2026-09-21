"use client";

import React, { useState } from "react";
import {
    Sparkles,
    CheckCircle2,
    Copy,
    Check,
    Code2,
    ArrowRight,
    AlertTriangle,
    RotateCw,
    Terminal,
    ShieldAlert,
    ExternalLink,
    FileCode,
    Layers,
    Info,
    ChevronRight,
} from "lucide-react";
import type { FixRecommendation } from "@/lib/investigation/recommendation-engine/types";
import { generateFixRecommendationAction } from "@/actions/fix-recommendation";

interface Props {
    projectId: string;
    issueId: string;
    investigationId?: string;
    eventId?: string;
    initialRecommendation?: FixRecommendation | null;
    initialStale?: boolean;
    initialVersion?: number;
    initialRecommendationId?: string;
    modelName?: string;
    onJumpToEvidence?: (evidenceId: string) => void;
}

export function FixRecommendationView({
    projectId,
    issueId,
    investigationId,
    eventId,
    initialRecommendation = null,
    initialStale = false,
    initialVersion = 1,
    initialRecommendationId = "",
    modelName = "Halo Engine",
    onJumpToEvidence,
}: Props) {
    const [recommendation, setRecommendation] = useState<FixRecommendation | null>(initialRecommendation);
    const [recommendationId, setRecommendationId] = useState<string>(initialRecommendationId);
    const [isStale, setIsStale] = useState<boolean>(initialStale);
    const [version, setVersion] = useState<number>(initialVersion);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleGenerate = async (forceRegenerate = false) => {
        setIsGenerating(true);
        setErrorMessage(null);
        try {
            const res = await generateFixRecommendationAction({
                projectId,
                issueId,
                investigationId,
                eventId,
                forceRegenerate,
            });

            if (res.success && res.recommendation) {
                setRecommendation(res.recommendation);
                setRecommendationId(res.id);
                setIsStale(res.isStale);
                setVersion(res.version);
            } else {
                setErrorMessage("Unable to generate recommendation from current evidence.");
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "Failed to generate engineering recommendation.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (code: string, idx: number) => {
        navigator.clipboard.writeText(code);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const scrollToEvidence = (evidenceId: string) => {
        if (onJumpToEvidence) {
            onJumpToEvidence(evidenceId);
            return;
        }
        const el = document.getElementById(evidenceId) || document.getElementById(`evidence-${evidenceId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-accent", "ring-offset-2", "ring-offset-black");
            setTimeout(() => {
                el.classList.remove("ring-2", "ring-accent", "ring-offset-2", "ring-offset-black");
            }, 2500);
        }
    };

    const getConfidenceBadgeClass = (conf: string) => {
        switch (conf?.toUpperCase()) {
            case "VERY_HIGH":
            case "HIGH":
                return "halo-fix-badge-high";
            case "MEDIUM":
                return "halo-fix-badge-medium";
            default:
                return "halo-fix-badge-low";
        }
    };

    const getOutcomePill = (type?: string, status?: string) => {
        switch (status) {
            case "VERIFIED_REPAIR":
                return { label: "Verified Repair (Validated)", className: "halo-fix-outcome-code" };
            case "SUPPORTED_REPAIR_REQUIRES_VALIDATION":
                return { label: "Supported Repair (Validation Required)", className: "halo-fix-outcome-code" };
            case "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED":
                return { label: "Diagnosis Established (Repair Withheld)", className: "halo-fix-outcome-observability" };
            case "NO_CODE_CHANGE_JUSTIFIED":
                return { label: "No Code Change Required", className: "halo-fix-outcome-fixed" };
            case "EVIDENCE_ACQUISITION_REQUIRED":
                return { label: "Evidence Acquisition Required", className: "halo-fix-outcome-observability" };
            case "BLOCKED_BY_UNAVAILABLE_EVIDENCE":
                return { label: "Blocked by Unavailable Evidence", className: "halo-fix-outcome-observability" };
            case "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR":
                return { label: "Diagnosis Established (Repair Withheld)", className: "halo-fix-outcome-observability" };
            case "BLOCKED_BY_AMBIGUITY":
                return { label: "Contract Ambiguity (Repair Withheld)", className: "halo-fix-outcome-observability" };
        }
        switch (type) {
            case "CODE_CHANGE_RECOMMENDED":
                return { label: "Code Change Recommended", className: "halo-fix-outcome-code" };
            case "MULTI_FILE_CHANGE_RECOMMENDED":
                return { label: "Multi-File Change Recommended", className: "halo-fix-outcome-code" };
            case "CONFIGURATION_CHANGE_RECOMMENDED":
                return { label: "Configuration Change Required", className: "halo-fix-outcome-config" };
            case "TEST_CHANGE_RECOMMENDED":
                return { label: "Test Change Recommended", className: "halo-fix-outcome-code" };
            case "NO_CODE_CHANGE_REQUIRED":
                return { label: "No Code Change Required", className: "halo-fix-outcome-fixed" };
            case "ALREADY_FIXED":
                return { label: "Already Fixed in Current Commit", className: "halo-fix-outcome-fixed" };
            case "INSUFFICIENT_EVIDENCE":
                return { label: "Insufficient Telemetry", className: "halo-fix-outcome-observability" };
            case "AMBIGUOUS_ROOT_CAUSE":
                return { label: "Ambiguous Root Cause", className: "halo-fix-outcome-observability" };
            case "EXTERNAL_DEPENDENCY_ACTION":
                return { label: "External Dependency Action", className: "halo-fix-outcome-config" };
            case "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR":
            default:
                return { label: "Observability Step Required Before Repair", className: "halo-fix-outcome-observability" };
        }
    };

    const pill = recommendation ? getOutcomePill(recommendation.outcomeType, recommendation.status) : null;

    return (
        <section id="section-fix-recommendation" className="halo-fix-container space-y-6 scroll-mt-24">
            {/* Header */}
            <div className="halo-fix-header">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                            WHAT SHOULD I DO TO FIX THIS ISSUE?
                        </h2>
                    </div>
                    <p className="text-xs text-secondary">
                        Authoritative engineering decision synthesized directly from verified telemetry, repository AST, and contract analysis.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {recommendation && (
                        <>
                            <span className={`halo-fix-badge ${getConfidenceBadgeClass(recommendation.confidence)}`}>
                                Confidence: {recommendation.confidence}
                            </span>
                            <span className="halo-fix-badge">
                                Version {version}
                            </span>
                        </>
                    )}
                    <span className="halo-fix-badge">
                        {modelName}
                    </span>
                    {recommendation && (
                        <button
                            type="button"
                            onClick={() => handleGenerate(true)}
                            disabled={isGenerating}
                            className="halo-btn halo-btn-xs halo-btn-secondary flex items-center gap-1.5"
                            title="Regenerate recommendation with latest telemetry"
                        >
                            <RotateCw size={12} className={isGenerating ? "animate-spin" : ""} />
                            <span>Regenerate</span>
                        </button>
                    )}
                </div>

                {recommendation?.decomposedConfidence && (
                    <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5 border-t border-white/5 text-[11px] font-mono mt-3">
                        <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                            <span className="text-zinc-400">Mechanism:</span>
                            <span className={recommendation.decomposedConfidence.failureMechanism === "CONFIRMED" ? "text-emerald-400 font-bold" : recommendation.decomposedConfidence.failureMechanism === "PLAUSIBLE" ? "text-blue-400 font-bold" : "text-amber-400 font-bold"}>
                                {recommendation.decomposedConfidence.failureMechanism}
                            </span>
                        </div>
                        <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                            <span className="text-zinc-400">Regression:</span>
                            <span className={recommendation.decomposedConfidence.regressionAssociation === "HIGH" ? "text-blue-400 font-bold" : "text-zinc-400"}>
                                {recommendation.decomposedConfidence.regressionAssociation}
                            </span>
                        </div>
                        <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                            <span className="text-zinc-400">Repair Boundary:</span>
                            <span className={recommendation.decomposedConfidence.repairBoundary === "VERIFIED" ? "text-emerald-400 font-bold" : recommendation.decomposedConfidence.repairBoundary === "CANDIDATE" ? "text-blue-400" : "text-zinc-500"}>
                                {recommendation.decomposedConfidence.repairBoundary}
                            </span>
                        </div>
                        <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                            <span className="text-zinc-400">Validation:</span>
                            <span className={recommendation.decomposedConfidence.behavioralValidation === "EXECUTED_PASSED" ? "text-emerald-400 font-bold" : "text-zinc-400"}>
                                {recommendation.decomposedConfidence.behavioralValidation}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Stale Banner */}
            {isStale && recommendation && (
                <div className="halo-fix-stale-banner">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Investigation telemetry has been updated since this recommendation was generated.</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleGenerate(true)}
                        disabled={isGenerating}
                        className="halo-btn halo-btn-xs halo-btn-primary shrink-0"
                    >
                        Regenerate Now
                    </button>
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button
                        type="button"
                        onClick={() => handleGenerate(true)}
                        className="underline hover:text-red-300 font-semibold"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* State 1: Un-generated State */}
            {!recommendation && !isGenerating && (
                <div className="py-10 px-6 rounded-xl bg-[#080b11] border border-dashed border-white/10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                        <h3 className="text-sm font-bold text-white">Determine Engineering Fix</h3>
                        <p className="text-xs text-secondary leading-relaxed">
                            Have the engine inspect the repository AST, caller-callee contracts, and verified telemetry to determine the exact action to fix this issue.
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={() => handleGenerate(false)}
                            className="halo-btn halo-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold"
                        >
                            <Sparkles size={14} />
                            <span>Generate recommendation</span>
                        </button>
                    </div>
                </div>
            )}

            {/* State 2: Generating State */}
            {isGenerating && (
                <div className="py-12 px-6 rounded-xl bg-[#080b11] border border-white/5 text-center space-y-3">
                    <RotateCw className="w-6 h-6 text-accent animate-spin mx-auto" />
                    <p className="text-xs font-mono text-zinc-300">
                        Synthesizing engineering decision & contract analysis...
                    </p>
                    <p className="text-[11px] text-muted">
                        Comparing caller/callee boundaries and evaluating anti-symptom-masking constraints.
                    </p>
                </div>
            )}

            {/* State 3: Rendered Recommendation */}
            {recommendation && !isGenerating && (
                <div className="space-y-6">
                    {/* A. Primary Product Hierarchy: WHAT SHOULD I DO TO FIX THIS ISSUE? */}
                    <div className="halo-fix-hero-action space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-accent flex items-center gap-1.5">
                                <ArrowRight className="w-3.5 h-3.5" />
                                WHAT SHOULD I DO TO FIX THIS ISSUE?
                            </span>
                            {pill && (
                                <span className={`halo-fix-outcome-pill ${pill.className}`}>
                                    {pill.label}
                                </span>
                            )}
                        </div>
                        <p className="text-sm md:text-base font-semibold text-white leading-relaxed">
                            {recommendation.actionAnswer || recommendation.summary}
                        </p>
                        {recommendation.status === "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR" && (
                            <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-200 space-y-1">
                                <span className="text-[10px] uppercase font-bold font-mono text-amber-400 block">
                                    Failure Mechanism Confirmed • Repair Ownership Unproven
                                </span>
                                <p>
                                    Halo has verified the exact failure mechanism, but repository evidence does not establish contract ownership between caller and callee. Code modifications are withheld to prevent symptom suppression.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* A.1 Invariant Restoration & Formal Broken Invariant */}
                    {recommendation.brokenInvariant && (
                        <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 text-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono text-purple-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5" />
                                    Broken Invariant: {recommendation.brokenInvariant.classification.replace(/_/g, " ").toUpperCase()}
                                </span>
                                <span className="text-[10px] font-mono text-purple-300/70">Contract Restoration</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/40 border border-purple-500/10 font-mono text-[11px] text-purple-200">
                                {recommendation.brokenInvariant.formalStatement || recommendation.brokenInvariant.description}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300 pt-1">
                                <div>
                                    <span className="text-[10px] uppercase font-mono text-red-400 font-semibold block">Violated State</span>
                                    <p className="text-[11px] text-zinc-400">{recommendation.brokenInvariant.violatedState || recommendation.brokenInvariant.actualViolation}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold block">Restored State</span>
                                    <p className="text-[11px] text-zinc-400">{recommendation.brokenInvariant.restoredState || recommendation.brokenInvariant.expectedCondition}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* A.2 Separated Engineering Locations (Observation vs Mechanism vs Repair Boundary) */}
                    {recommendation.separatedLocations && (
                        <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border text-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <Code2 className="w-3.5 h-3.5 text-accent" />
                                    Separated Engineering Locations
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">Observation vs Mechanism vs Repair</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-mono text-amber-400 font-semibold">1. Observation</span>
                                        <span className="text-[9px] font-mono text-zinc-500">{recommendation.separatedLocations.observationLocation?.status}</span>
                                    </div>
                                    <div className="font-mono text-[11px] text-white truncate" title={recommendation.separatedLocations.observationLocation?.filePath}>
                                        {recommendation.separatedLocations.observationLocation?.filePath || "Unknown"}
                                        {recommendation.separatedLocations.observationLocation?.lineNumber ? `:${recommendation.separatedLocations.observationLocation.lineNumber}` : ""}
                                    </div>
                                    <div className="text-[10px] text-zinc-400">{recommendation.separatedLocations.observationLocation?.provenance}</div>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-mono text-red-400 font-semibold">2. Mechanism</span>
                                        <span className="text-[9px] font-mono text-zinc-500">{recommendation.separatedLocations.mechanismLocation?.status}</span>
                                    </div>
                                    <div className="font-mono text-[11px] text-white truncate" title={recommendation.separatedLocations.mechanismLocation?.filePath}>
                                        {recommendation.separatedLocations.mechanismLocation?.filePath || "Unknown"}
                                        {recommendation.separatedLocations.mechanismLocation?.lineNumber ? `:${recommendation.separatedLocations.mechanismLocation.lineNumber}` : ""}
                                    </div>
                                    <div className="text-[10px] text-zinc-400">{recommendation.separatedLocations.mechanismLocation?.provenance}</div>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold">3. Repair Boundary</span>
                                        <span className="text-[9px] font-mono text-zinc-500">{recommendation.separatedLocations.repairLocation?.status}</span>
                                    </div>
                                    <div className="font-mono text-[11px] text-white truncate" title={recommendation.separatedLocations.repairLocation?.filePath}>
                                        {recommendation.separatedLocations.repairLocation?.filePath || "Unknown"}
                                        {recommendation.separatedLocations.repairLocation?.lineNumber ? `:${recommendation.separatedLocations.repairLocation.lineNumber}` : ""}
                                    </div>
                                    <div className="text-[10px] text-zinc-400">{recommendation.separatedLocations.repairLocation?.provenance}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* A.3 Behavioral Proof */}
                    {recommendation.behavioralProof && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    Behavioral Proof: {recommendation.behavioralProof.status || (recommendation.behavioralProof.isCleanPass ? "PASS" : "TESTED")}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">Method: {recommendation.behavioralProof.validationMethod || "Runtime Assertions"}</span>
                            </div>
                            <p className="text-[11px] text-zinc-300 leading-relaxed">{recommendation.behavioralProof.summary || recommendation.behavioralProof.executionLog || "Invariant restoration verified."}</p>
                        </div>
                    )}

                    {/* B. Active Investigation Progress (Phase 20 - Real Completed Steps) */}
                    {recommendation.completedSteps && recommendation.completedSteps.length > 0 && (
                        <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    Active Investigation Progress ({recommendation.completedSteps.length} Steps Completed)
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">Autonomous Evidence Acquisition</span>
                            </div>
                            <div className="space-y-2 pt-1 border-t border-white/5">
                                {recommendation.completedSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold text-zinc-200">{step.label}</span>
                                            <span className="text-zinc-400 text-[11px] block">{step.detail}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* C. Non-Code Remediation (Phase 14 & 15: External Outage, Dependency Pin, Infrastructure) */}
                    {recommendation.nonCodeRemediationDetails && (
                        <div className="p-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 space-y-2 text-xs text-blue-200 leading-relaxed">
                            <span className="text-[10px] uppercase font-mono font-bold text-blue-400 block tracking-wider">
                                Non-Code Remediation ({recommendation.nonCodeRemediationDetails.type})
                            </span>
                            <p className="font-semibold text-white">
                                {recommendation.nonCodeRemediationDetails.remediationInstruction}
                            </p>
                            <p className="text-blue-300/90 text-[11px]">
                                Operational Action: {recommendation.nonCodeRemediationDetails.operationalAction}
                            </p>
                        </div>
                    )}

                    {/* D. Case B: Investigation Exhausted Without Safe Repair (Phase 21) */}
                    {(recommendation.hasInsufficientEvidence || recommendation.status === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE") && (
                        <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs space-y-3">
                            <div className="flex items-center gap-2 text-amber-400">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
                                    Evidence Boundary — Investigation Findings
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-300 pt-1 border-t border-amber-500/10">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold block">Halo Established</span>
                                    <p className="leading-relaxed">{recommendation.actionExplanation?.whatWeKnow || recommendation.diagnosis}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-amber-400 font-semibold block">Halo Could Not Establish</span>
                                    <p className="leading-relaxed">{recommendation.actionExplanation?.whatWeDontKnow || recommendation.missingEvidence?.[0] || "Exact runtime state"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-blue-400 font-semibold block">Halo Attempted Automatically</span>
                                    <p className="leading-relaxed">{recommendation.actionExplanation?.whatWasAlreadyInvestigated || "Repository AST tracing, caller-callee contracts, and release diffs"}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-purple-400 font-semibold block">Remaining Blocker</span>
                                    <p className="leading-relaxed">{recommendation.blockedBy || recommendation.actionExplanation?.whyThatMatters || "Dynamic callback dispatch requires runtime argument values to distinguish implementations."}</p>
                                </div>
                            </div>
                            {recommendation.nextActionBeforeRepair && (
                                <div className="pt-2 border-t border-amber-500/10 flex items-start gap-2 text-blue-300">
                                    <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                    <span><strong>Required Next Action:</strong> {recommendation.nextActionBeforeRepair}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* E. Information Frontier & Explanation Structure */}
                    {recommendation.actionExplanation && !recommendation.hasInsufficientEvidence && (
                        <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 text-xs space-y-3">
                            <span className="text-[10px] uppercase font-bold font-mono text-zinc-400 block tracking-wider">
                                Engineering Decision Context
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold block">What Halo Established</span>
                                    <p className="text-zinc-300 leading-relaxed">{recommendation.actionExplanation.whatWeKnow}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-amber-400 font-semibold block">What Remains Unknown Statically</span>
                                    <p className="text-zinc-300 leading-relaxed">{recommendation.actionExplanation.whatWeDontKnow}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-blue-400 font-semibold block">Repository Analysis Performed</span>
                                    <p className="text-zinc-300 leading-relaxed">{recommendation.actionExplanation.whatWasAlreadyInvestigated}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-mono text-purple-400 font-semibold block">Why This Action Has Highest Value</span>
                                    <p className="text-zinc-300 leading-relaxed">{recommendation.actionExplanation.whyThatActionHasHighestValue}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* D. Code Changes (File by File) */}
                    {recommendation.changes.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                    Proposed Code Changes
                                </h3>
                                <span className="text-[11px] text-muted font-mono">
                                    Minimal change principle applied
                                </span>
                            </div>

                            <div className="space-y-5">
                                {recommendation.changes.map((change, idx) => (
                                    <div key={idx} className="halo-fix-code-block space-y-0">
                                        {/* File Header */}
                                        <div className="halo-fix-code-header">
                                            <div className="flex items-center gap-2">
                                                <FileCode className="w-3.5 h-3.5 text-accent" />
                                                <span className="font-semibold text-white">
                                                    {change.filePath || "Target File"}
                                                </span>
                                                {change.startLine && (
                                                    <span className="text-zinc-500">
                                                        :{change.startLine}
                                                    </span>
                                                )}
                                                {change.symbol && (
                                                    <span className="text-zinc-400 text-[10px]">
                                                        in <code>{change.symbol}()</code>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`halo-fix-badge ${
                                                        change.isExactSourceVerified
                                                            ? "halo-fix-badge-proposed"
                                                            : change.codeType === "EXISTING_AND_PROPOSED"
                                                            ? "halo-fix-badge-proposed"
                                                            : change.codeType === "PROPOSED_ONLY"
                                                            ? "halo-fix-badge-existing"
                                                            : "halo-fix-badge-conceptual"
                                                    }`}
                                                >
                                                    {change.isExactSourceVerified
                                                        ? "Verified Source & Fix"
                                                        : change.codeType === "EXISTING_AND_PROPOSED"
                                                        ? "Verified Source & Fix"
                                                        : change.codeType === "PROPOSED_ONLY"
                                                        ? "Proposed Modification"
                                                        : "Conceptual Guidance"}
                                                </span>

                                                {(change.proposedCode || change.unifiedDiff) && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleCopy(
                                                                change.proposedCode || change.unifiedDiff || "",
                                                                idx
                                                            )
                                                        }
                                                        className="text-xs text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
                                                        title="Copy code"
                                                    >
                                                        {copiedIndex === idx ? (
                                                            <Check size={12} className="text-emerald-400" />
                                                        ) : (
                                                            <Copy size={12} />
                                                        )}
                                                        <span className="text-[10px]">
                                                            {copiedIndex === idx ? "Copied" : "Copy"}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Code Body */}
                                        <div className="halo-fix-code-content space-y-3">
                                            {/* Existing Code */}
                                            {change.currentCode && (
                                                <div className="space-y-1">
                                                    <span className="text-[10px] uppercase font-bold text-red-400/80 block">
                                                        CURRENT (VERIFIED SOURCE)
                                                    </span>
                                                    <pre className="halo-fix-panel-current">
                                                        <code>{change.currentCode}</code>
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Proposed Change */}
                                            {change.proposedCode && (
                                                <div className="space-y-1">
                                                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                                                        PROPOSED CHANGE
                                                    </span>
                                                    <pre className="halo-fix-panel-proposed">
                                                        <code>{change.proposedCode}</code>
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Unified Diff if available */}
                                            {change.unifiedDiff && !change.proposedCode && (
                                                <pre className="p-2.5 rounded bg-black/40 border border-white/5 text-zinc-300 overflow-x-auto text-xs">
                                                    <code>{change.unifiedDiff}</code>
                                                </pre>
                                            )}

                                            {/* Why here */}
                                            <div className="pt-2 border-t border-white/5 text-xs text-secondary space-y-1">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                                                    Why this location:
                                                </span>
                                                <p>{change.whyHere || change.explanation}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Anti-symptom-masking reasoning card */}
                                {recommendation.whyNotSymptomFix && (
                                    <div className="p-3.5 rounded-xl bg-red-500/[0.04] border border-red-500/15 text-xs text-red-200/90 space-y-1">
                                        <span className="text-[10px] font-mono uppercase font-bold text-red-400 block">
                                            Why Not Symptom Fix (Anti-Masking Rule)
                                        </span>
                                        <p>{recommendation.whyNotSymptomFix}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* E. Why this is the right fix */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                            Why this fixes it
                        </h3>
                        <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border text-xs text-zinc-200 leading-relaxed space-y-3">
                            <p>{recommendation.whyThisFixesIt || recommendation.whyThisAction || recommendation.diagnosis}</p>

                            {/* Evidence Citations */}
                            {recommendation.evidenceReferences.length > 0 && (
                                <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-mono text-muted">Evidence used:</span>
                                    {recommendation.evidenceReferences.map((evId) => (
                                        <button
                                            key={evId}
                                            type="button"
                                            onClick={() => scrollToEvidence(evId)}
                                            className="halo-fix-evidence-tag"
                                            title={`Jump to evidence ${evId}`}
                                        >
                                            <span>{evId}</span>
                                            <ExternalLink size={9} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Do Not Change */}
                    {recommendation.doNotChange && recommendation.doNotChange.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-mono uppercase font-bold text-amber-400/90 tracking-wider">
                                Do Not Change
                            </h3>
                            <div className="p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-amber-200/90 space-y-1">
                                {recommendation.doNotChange.map((item, idx) => (
                                    <p key={idx}>• {item}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Competing Alternatives */}
                    {recommendation.alternatives && recommendation.alternatives.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                Competing Fixes Considered
                            </h3>
                            <div className="space-y-2">
                                {recommendation.alternatives.map((alt, idx) => (
                                    <div key={idx} className="p-3 rounded-xl bg-surface-elevated/40 border border-border text-xs space-y-1">
                                        <span className="font-semibold text-zinc-200 block">• {alt.description}</span>
                                        <span className="text-secondary text-[11px] block">{alt.whyNotPreferred}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* F. Also Check (Consistency Checks) */}
                    {recommendation.relatedConsistencyChecks &&
                        recommendation.relatedConsistencyChecks.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                    Also check
                                </h3>
                                <ul className="p-4 rounded-xl bg-surface-elevated/40 border border-border text-xs text-zinc-300 space-y-2">
                                    {recommendation.relatedConsistencyChecks.map((check, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-accent font-bold">•</span>
                                            <span>{check}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                    {/* G. What to Verify (Validation Blueprint) */}
                    {recommendation.validationSteps && recommendation.validationSteps.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                Suggested Verification
                            </h3>
                            <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2 text-xs text-zinc-300">
                                {recommendation.validationSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                                        <span>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* H. Uncertainty (If any) */}
                    {recommendation.uncertainty && recommendation.uncertainty.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-mono uppercase font-bold text-amber-400 tracking-wider">
                                Remaining Uncertainty
                            </h3>
                            <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-amber-200/90 space-y-1.5">
                                {recommendation.uncertainty.map((item, idx) => (
                                    <p key={idx}>• {item}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
