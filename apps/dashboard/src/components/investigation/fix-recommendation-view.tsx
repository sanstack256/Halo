"use client";

import React, { useState } from "react";
import { HaloLogo } from "@/components/ui/halo-logo";
import {
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

            if (res && res.recommendation) {
                setRecommendation(res.recommendation);
                setRecommendationId(res.id);
                setIsStale(res.isStale ?? false);
                setVersion(res.version ?? 1);
                setErrorMessage(null);
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

    const formatConfidence = (conf?: string) => {
        switch (conf?.toUpperCase()) {
            case "VERY_HIGH":
                return "Very High";
            case "HIGH":
                return "High";
            case "MEDIUM":
                return "Medium";
            case "LOW":
                return "Low";
            default:
                return conf || "Unknown";
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
                return { label: "Fix Verified", className: "halo-fix-outcome-code" };
            case "SUPPORTED_REPAIR_REQUIRES_VALIDATION":
                return { label: "Supported Repair · Requires Validation", className: "halo-fix-outcome-code" };
            case "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED":
                return { label: "Mechanism Verified · Repair Unresolved", className: "halo-fix-outcome-observability" };
            case "NO_CODE_CHANGE_JUSTIFIED":
                return { label: "No Code Change Required", className: "halo-fix-outcome-fixed" };
            case "EVIDENCE_ACQUISITION_REQUIRED":
                return { label: "Evidence Acquisition Required", className: "halo-fix-outcome-observability" };
            case "BLOCKED_BY_UNAVAILABLE_EVIDENCE":
                return { label: "Telemetry Unavailable", className: "halo-fix-outcome-observability" };
            case "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR":
                return { label: "Mechanism Verified · Repair Withheld", className: "halo-fix-outcome-observability" };
            case "BLOCKED_BY_AMBIGUITY":
                return { label: "Contract Ambiguity · Repair Withheld", className: "halo-fix-outcome-observability" };
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <HaloLogo size={16} className="w-4 h-4 shrink-0" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                                RECOMMENDED FIX
                            </h2>
                        </div>
                        <p className="text-xs text-secondary">
                            Authoritative engineering decision synthesized directly from verified telemetry, repository AST, and contract analysis.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {recommendation && (
                            <>
                                <span className={`halo-fix-badge ${getConfidenceBadgeClass(recommendation.confidence)}`}>
                                    Confidence · {formatConfidence(recommendation.confidence)}
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
                                className="halo-btn halo-btn-xs halo-btn-secondary flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                title="Regenerate recommendation with latest telemetry"
                            >
                                <RotateCw size={12} className={isGenerating ? "animate-spin" : ""} />
                                <span>Regenerate</span>
                            </button>
                        )}
                    </div>
                </div>

                {recommendation?.decomposedConfidence && (
                    <div className="w-full flex items-center gap-2 flex-wrap pt-3 border-t border-border-subtle text-[11px] font-mono">
                        <span
                            className={`halo-fix-badge ${
                                recommendation.decomposedConfidence.failureMechanism === "CONFIRMED"
                                    ? "halo-fix-badge-proposed"
                                    : recommendation.decomposedConfidence.failureMechanism === "PLAUSIBLE"
                                    ? "halo-fix-badge-medium"
                                    : "halo-fix-badge-low"
                            }`}
                        >
                            {recommendation.decomposedConfidence.failureMechanism === "CONFIRMED"
                                ? "Mechanism verified"
                                : `Mechanism · ${recommendation.decomposedConfidence.failureMechanism.toLowerCase()}`}
                        </span>

                        <span
                            className={`halo-fix-badge ${
                                recommendation.decomposedConfidence.repairBoundary === "VERIFIED"
                                    ? "halo-fix-badge-proposed"
                                    : recommendation.decomposedConfidence.repairBoundary === "CANDIDATE"
                                    ? "halo-fix-badge-medium"
                                    : "halo-fix-badge-low"
                            }`}
                        >
                            {recommendation.decomposedConfidence.repairBoundary === "VERIFIED"
                                ? "Fix verified"
                                : `Repair · ${recommendation.decomposedConfidence.repairBoundary.toLowerCase()}`}
                        </span>

                        <span
                            className={`halo-fix-badge ${
                                recommendation.decomposedConfidence.behavioralValidation === "EXECUTED_PASSED"
                                    ? "halo-fix-badge-proposed"
                                    : "halo-fix-badge-low"
                            }`}
                        >
                            {recommendation.decomposedConfidence.behavioralValidation === "EXECUTED_PASSED"
                                ? "Validation passed"
                                : `Validation · ${recommendation.decomposedConfidence.behavioralValidation.toLowerCase().replace(/_/g, " ")}`}
                        </span>

                        {recommendation.decomposedConfidence.regressionAssociation && (
                            <span
                                className={`halo-fix-badge ${
                                    recommendation.decomposedConfidence.regressionAssociation === "HIGH"
                                        ? "halo-fix-badge-medium"
                                        : "halo-fix-badge-low"
                                }`}
                            >
                                Regression · {recommendation.decomposedConfidence.regressionAssociation.toLowerCase()}
                            </span>
                        )}
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
                        <HaloLogo size={24} className="w-6 h-6" />
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
                            className="halo-btn halo-btn-primary inline-flex items-center px-5 py-2.5 text-xs font-semibold"
                        >
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
                    {/* A. Primary Product Hierarchy: RECOMMENDED FIX */}
                    <div className="halo-fix-hero-action space-y-2.5 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-accent flex items-center gap-1.5">
                                <ArrowRight className="w-3.5 h-3.5" />
                                Recommended Action
                            </span>
                            {pill && (
                                <span className={`halo-fix-outcome-pill ${pill.className}`}>
                                    {pill.label}
                                </span>
                            )}
                        </div>
                        <p className="text-sm md:text-base font-semibold text-white leading-relaxed break-words">
                            {recommendation.actionAnswer || recommendation.summary}
                        </p>
                        {recommendation.status === "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR" && (
                            <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-200 space-y-1 min-w-0">
                                <span className="text-[10px] uppercase font-bold font-mono text-amber-400 block">
                                    Failure Mechanism Confirmed • Repair Ownership Unproven
                                </span>
                                <p className="break-words leading-relaxed">
                                    Halo has verified the exact failure mechanism, but repository evidence does not establish contract ownership between caller and callee. Code modifications are withheld to prevent symptom suppression.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* A.1 Invariant Restoration & Formal Broken Invariant */}
                    {recommendation.brokenInvariant && (
                        <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 text-xs space-y-2.5 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] uppercase font-mono text-purple-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5" />
                                    Broken Invariant: {(recommendation.brokenInvariant.classification || "state_invariant").replace(/_/g, " ").toUpperCase()}
                                </span>
                                <span className="text-[10px] font-mono text-purple-300/70">Contract Restoration</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/40 border border-purple-500/10 font-mono text-[11px] text-purple-200 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                {recommendation.brokenInvariant.formalStatement || recommendation.brokenInvariant.description}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-zinc-300 pt-1 min-w-0">
                                <div className="min-w-0 space-y-0.5">
                                    <span className="text-[10px] uppercase font-mono text-red-400 font-semibold block">Violated</span>
                                    <p className="text-[11px] text-zinc-400 break-words leading-relaxed">{recommendation.brokenInvariant.violatedState || recommendation.brokenInvariant.actualViolation}</p>
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold block">Restored</span>
                                    <p className="text-[11px] text-zinc-400 break-words leading-relaxed">{recommendation.brokenInvariant.restoredState || recommendation.brokenInvariant.expectedCondition}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* A.2 Separated Engineering Locations (Observation vs Mechanism vs Repair Boundary) */}
                    {recommendation.separatedLocations && (
                        <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border text-xs space-y-2.5 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <Code2 className="w-3.5 h-3.5 text-accent" />
                                    Engineering Locations
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">Observation · Mechanism · Repair</span>
                            </div>
                            <div className="halo-fix-locations-grid pt-1">
                                <div className="halo-fix-location-card">
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                        <span className="text-[10px] uppercase font-mono text-amber-400 font-semibold">Observation</span>
                                        <span className="text-[9px] font-mono text-zinc-500">{recommendation.separatedLocations.observationLocation?.status === "CONFIRMED" ? "LOCATED" : recommendation.separatedLocations.observationLocation?.status}</span>
                                    </div>
                                    <div className="halo-fix-location-path" title={recommendation.separatedLocations.observationLocation?.filePath}>
                                        {recommendation.separatedLocations.observationLocation?.filePath || "Unknown"}
                                        {recommendation.separatedLocations.observationLocation?.lineNumber ? `:${recommendation.separatedLocations.observationLocation.lineNumber}` : ""}
                                    </div>
                                    {recommendation.separatedLocations.observationLocation?.provenance && (
                                        <div className="text-[10px] text-zinc-400 break-words">{recommendation.separatedLocations.observationLocation.provenance}</div>
                                    )}
                                </div>
                                <div className="halo-fix-location-card">
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                        <span className="text-[10px] uppercase font-mono text-red-400 font-semibold">Mechanism</span>
                                        <span className="text-[9px] font-mono text-zinc-500">{recommendation.separatedLocations.mechanismLocation?.status === "CONFIRMED" ? "LOCATED" : recommendation.separatedLocations.mechanismLocation?.status}</span>
                                    </div>
                                    <div className="halo-fix-location-path" title={recommendation.separatedLocations.mechanismLocation?.filePath}>
                                        {recommendation.separatedLocations.mechanismLocation?.filePath || "Unknown"}
                                        {recommendation.separatedLocations.mechanismLocation?.lineNumber ? `:${recommendation.separatedLocations.mechanismLocation.lineNumber}` : ""}
                                    </div>
                                    {recommendation.separatedLocations.mechanismLocation?.provenance && (
                                        <div className="text-[10px] text-zinc-400 break-words">{recommendation.separatedLocations.mechanismLocation.provenance}</div>
                                    )}
                                </div>
                                <div className="halo-fix-location-card">
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                        <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold">Repair</span>
                                        <span className="text-[9px] font-mono text-zinc-500">{recommendation.separatedLocations.repairLocation?.status}</span>
                                    </div>
                                    <div className="halo-fix-location-path" title={recommendation.separatedLocations.repairLocation?.filePath}>
                                        {recommendation.separatedLocations.repairLocation?.filePath || "Unknown"}
                                        {recommendation.separatedLocations.repairLocation?.lineNumber ? `:${recommendation.separatedLocations.repairLocation.lineNumber}` : ""}
                                    </div>
                                    {recommendation.separatedLocations.repairLocation?.provenance && (
                                        <div className="text-[10px] text-zinc-400 break-words">{recommendation.separatedLocations.repairLocation.provenance}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* A.3 Behavioral Proof */}
                    {recommendation.behavioralProof && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs space-y-1.5 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    Behavioral Proof: {recommendation.behavioralProof.status || (recommendation.behavioralProof.isCleanPass ? "PASS" : "TESTED")}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">Method: {recommendation.behavioralProof.validationMethod || "Runtime Assertions"}</span>
                            </div>
                            <p className="text-[11px] text-zinc-300 leading-relaxed break-words">{recommendation.behavioralProof.summary || recommendation.behavioralProof.executionLog || "Invariant restoration verified."}</p>
                        </div>
                    )}

                    {/* B. Active Investigation Progress (Phase 20 - Real Completed Steps) */}
                    {recommendation.completedSteps && recommendation.completedSteps.length > 0 && (
                        <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2.5 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    Active Investigation Progress ({recommendation.completedSteps.length} Steps Completed)
                                </span>
                                <span className="text-[10px] font-mono text-zinc-500">Autonomous Evidence Acquisition</span>
                            </div>
                            <div className="space-y-2 pt-1 border-t border-white/5">
                                {recommendation.completedSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300 min-w-0">
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <span className="font-semibold text-zinc-200 block break-words">{step.label}</span>
                                            <span className="text-zinc-400 text-[11px] block break-words">{step.detail}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* C. Non-Code Remediation (Phase 14 & 15: External Outage, Dependency Pin, Infrastructure) */}
                    {recommendation.nonCodeRemediationDetails && (
                        <div className="p-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 space-y-2 text-xs text-blue-200 leading-relaxed min-w-0">
                            <span className="text-[10px] uppercase font-mono font-bold text-blue-400 block tracking-wider">
                                Non-Code Remediation ({recommendation.nonCodeRemediationDetails.type})
                            </span>
                            <p className="font-semibold text-white break-words">
                                {recommendation.nonCodeRemediationDetails.remediationInstruction}
                            </p>
                            <p className="text-blue-300/90 text-[11px] break-words">
                                Operational Action: {recommendation.nonCodeRemediationDetails.operationalAction}
                            </p>
                        </div>
                    )}

                    {/* D. Case B: Investigation Exhausted Without Safe Repair (Phase 21) */}
                    {(recommendation.hasInsufficientEvidence || recommendation.status === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE") && (
                        <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs space-y-3 min-w-0">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-amber-400">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
                                        ROOT CAUSE UNKNOWN
                                    </span>
                                </div>
                                <p className="text-xs text-amber-200/90 leading-relaxed">
                                    Available telemetry does not establish the upstream cause.
                                    {(recommendation.decomposedConfidence?.failureMechanism === "CONFIRMED" || recommendation.status === "VERIFIED_REPAIR") && (
                                        <span className="block text-emerald-400 pt-1 font-mono text-[11px]">
                                            The failure mechanism and repair are independently verified.
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-300 pt-1 border-t border-amber-500/10 min-w-0">
                                <div className="space-y-1 min-w-0">
                                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-semibold block">Halo Established</span>
                                    <p className="leading-relaxed break-words">{recommendation.actionExplanation?.whatWeKnow || recommendation.diagnosis}</p>
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <span className="text-[10px] uppercase font-mono text-amber-400 font-semibold block">Halo Could Not Establish</span>
                                    <p className="leading-relaxed break-words">{recommendation.actionExplanation?.whatWeDontKnow || recommendation.missingEvidence?.[0] || "Exact runtime state"}</p>
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <span className="text-[10px] uppercase font-mono text-blue-400 font-semibold block">Halo Attempted Automatically</span>
                                    <p className="leading-relaxed break-words">{recommendation.actionExplanation?.whatWasAlreadyInvestigated || "Repository AST tracing, caller-callee contracts, and release diffs"}</p>
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <span className="text-[10px] uppercase font-mono text-purple-400 font-semibold block">Remaining Blocker</span>
                                    <p className="leading-relaxed break-words">{recommendation.blockedBy || recommendation.actionExplanation?.whyThatMatters || "Dynamic callback dispatch requires runtime argument values to distinguish implementations."}</p>
                                </div>
                            </div>
                            {recommendation.nextActionBeforeRepair && (
                                <div className="pt-2 border-t border-amber-500/10 flex items-start gap-2 text-blue-300 min-w-0">
                                    <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                    <span className="break-words"><strong>Required Next Action:</strong> {recommendation.nextActionBeforeRepair}</span>
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
                        <div className="space-y-4 min-w-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
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
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
                                                <span className="font-semibold text-white break-all">
                                                    {change.filePath || "Target File"}
                                                </span>
                                                {change.startLine && (
                                                    <span className="text-zinc-500 font-mono shrink-0">
                                                        :{change.startLine}
                                                    </span>
                                                )}
                                                {change.symbol && (
                                                    <span className="text-zinc-400 text-[10px] break-all">
                                                        in <code>{change.symbol}()</code>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap shrink-0">
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
                                                        className="text-xs text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                                        title="Copy code"
                                                        aria-label="Copy code"
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
                                                <div className="space-y-1 min-w-0">
                                                    <span className="text-[10px] uppercase font-bold font-mono text-red-400/80 block">
                                                        Current (Verified Source)
                                                    </span>
                                                    <pre className="halo-fix-panel-current">
                                                        <code>{change.currentCode}</code>
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Proposed Change */}
                                            {change.proposedCode && (
                                                <div className="space-y-1 min-w-0">
                                                    <span className="text-[10px] uppercase font-bold font-mono text-emerald-400 block">
                                                        Proposed Change
                                                    </span>
                                                    <pre className="halo-fix-panel-proposed">
                                                        <code>{change.proposedCode}</code>
                                                    </pre>
                                                </div>
                                            )}

                                            {/* Unified Diff if available */}
                                            {change.unifiedDiff && !change.proposedCode && (
                                                <pre className="halo-fix-panel-diff">
                                                    <code>{change.unifiedDiff}</code>
                                                </pre>
                                            )}

                                            {/* Why here */}
                                            <div className="pt-2 border-t border-white/5 text-xs text-secondary space-y-1 min-w-0">
                                                <span className="text-[10px] uppercase font-bold font-mono text-zinc-400 block">
                                                    Why here
                                                </span>
                                                <p className="break-words leading-relaxed">{change.whyHere || change.explanation}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Anti-symptom-masking reasoning card */}
                                {recommendation.whyNotSymptomFix && (
                                    <div className="p-3.5 rounded-xl bg-red-500/[0.04] border border-red-500/15 text-xs text-red-200/90 space-y-1 min-w-0">
                                        <span className="text-[10px] font-mono uppercase font-bold text-red-400 block">
                                            Anti-symptom-masking principle
                                        </span>
                                        <p className="break-words leading-relaxed">{recommendation.whyNotSymptomFix}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* E. Why this is the right fix */}
                    <div className="space-y-3 min-w-0">
                        <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                            Why this fixes it
                        </h3>
                        <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border text-xs text-zinc-200 leading-relaxed space-y-3 min-w-0">
                            <p className="break-words">{recommendation.whyThisFixesIt || recommendation.whyThisAction || recommendation.diagnosis}</p>

                            {/* Evidence Citations */}
                            {recommendation.evidenceReferences.length > 0 && (
                                <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap min-w-0">
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
                        <div className="space-y-2 min-w-0">
                            <h3 className="text-xs font-mono uppercase font-bold text-amber-400/90 tracking-wider">
                                Do not change
                            </h3>
                            <div className="p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-amber-200/90 space-y-1 min-w-0">
                                {recommendation.doNotChange.map((item, idx) => (
                                    <p key={idx} className="break-words leading-relaxed">• {item}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Competing Alternatives */}
                    {recommendation.alternatives && recommendation.alternatives.length > 0 && (
                        <div className="space-y-2 min-w-0">
                            <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                Alternatives considered
                            </h3>
                            <div className="space-y-2 min-w-0">
                                {recommendation.alternatives.map((alt, idx) => (
                                    <div key={idx} className="p-3 rounded-xl bg-surface-elevated/40 border border-border text-xs space-y-1 min-w-0">
                                        <span className="font-semibold text-zinc-200 block break-words">• {alt.description}</span>
                                        <span className="text-secondary text-[11px] block break-words pl-3 leading-relaxed">{alt.whyNotPreferred}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* F. Also Check (Consistency Checks) */}
                    {recommendation.relatedConsistencyChecks &&
                        recommendation.relatedConsistencyChecks.length > 0 && (
                            <div className="space-y-2 min-w-0">
                                <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                    Also check
                                </h3>
                                <ul className="p-4 rounded-xl bg-surface-elevated/40 border border-border text-xs text-zinc-300 space-y-2 min-w-0">
                                    {recommendation.relatedConsistencyChecks.map((check, idx) => (
                                        <li key={idx} className="flex items-start gap-2 min-w-0">
                                            <span className="text-accent font-bold shrink-0">•</span>
                                            <span className="break-words">{check}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                    {/* G. What to Verify (Validation Blueprint) */}
                    {recommendation.validationSteps && recommendation.validationSteps.length > 0 && (
                        <div className="space-y-2 min-w-0">
                            <h3 className="text-xs font-mono uppercase font-bold text-zinc-400 tracking-wider">
                                Verify the fix
                            </h3>
                            <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-2 text-xs text-zinc-300 min-w-0">
                                {recommendation.validationSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 min-w-0">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                                        <span className="break-words leading-relaxed">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* H. Uncertainty (If any) */}
                    {recommendation.uncertainty && recommendation.uncertainty.length > 0 && (
                        <div className="space-y-2 min-w-0">
                            <h3 className="text-xs font-mono uppercase font-bold text-amber-400 tracking-wider">
                                Remaining uncertainty
                            </h3>
                            <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 text-xs text-amber-200/90 space-y-1.5 min-w-0">
                                {recommendation.uncertainty.map((item, idx) => (
                                    <p key={idx} className="break-words leading-relaxed">• {item}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
