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
import type { FixRecommendation, FollowUpQuestionMessage } from "@/lib/investigation/recommendation-engine/types";
import { generateFixRecommendationAction } from "@/actions/fix-recommendation";

interface Props {
    projectId: string;
    issueId: string;
    investigationId?: string;
    eventId?: string;
    initialRecommendation?: FixRecommendation | null;
    initialStale?: boolean;
    initialVersion?: number;
    initialHistory?: FollowUpQuestionMessage[];
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
    initialHistory = [],
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

    const getOutcomePill = (type?: string) => {
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

    const pill = recommendation ? getOutcomePill(recommendation.outcomeType) : null;

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
                    {/* A. Hero Recommended Action */}
                    <div className="halo-fix-hero-action space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-accent flex items-center gap-1.5">
                                <ArrowRight className="w-3.5 h-3.5" />
                                RECOMMENDED ACTION
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
                    </div>

                    {/* B. Missing Evidence & Next Action (If Underdetermined or Insufficient Evidence) */}
                    {recommendation.missingEvidence && recommendation.missingEvidence.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <h3 className="text-xs font-mono uppercase font-bold text-amber-400 tracking-wider">
                                    Missing Critical Evidence
                                </h3>
                            </div>
                            <div className="halo-fix-missing-card space-y-1.5">
                                {recommendation.missingEvidence.map((item, idx) => (
                                    <p key={idx}>• {item}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {recommendation.nextActionBeforeRepair && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                                <h3 className="text-xs font-mono uppercase font-bold text-blue-400 tracking-wider">
                                    Next Action Before Repair
                                </h3>
                            </div>
                            <div className="halo-fix-next-action-card flex items-start gap-2.5">
                                <ChevronRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                <span>{recommendation.nextActionBeforeRepair}</span>
                            </div>
                        </div>
                    )}

                    {/* C. Already Fixed Notice (If applicable) */}
                    {recommendation.outcomeType === "ALREADY_FIXED" && (
                        <div className="p-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 text-xs text-blue-200 leading-relaxed space-y-2">
                            <span className="text-[10px] uppercase font-bold font-mono text-blue-400 block">
                                Verified Repository State
                            </span>
                            <p>
                                The current repository commit already contains the defensive fix. Historical telemetry was emitted by sessions executing an earlier deployment.
                            </p>
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
