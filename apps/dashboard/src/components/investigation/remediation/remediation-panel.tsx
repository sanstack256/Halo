"use client";

import React, { useState, useEffect } from "react";
import {
    getInvestigationRecommendations,
    regenerateInvestigationRecommendations,
    updateRecommendationStatus,
    recordRecommendationNote,
} from "@/actions/remediation-intelligence";
import type {
    RemediationRecommendationDomain,
    RemediationPlanResult,
    RemediationStatus,
} from "@/lib/remediation-intelligence/types";
import {
    Wrench,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Shield,
    ChevronDown,
    ChevronUp,
    FileCode,
    Activity,
    Info,
    Check,
    X,
    MessageSquare,
    HelpCircle,
    Layers,
} from "lucide-react";

interface RemediationPanelProps {
    investigationId: string;
    projectId: string;
}

export function RemediationPanel({
    investigationId,
    projectId,
}: RemediationPanelProps) {
    const [plan, setPlan] = useState<RemediationPlanResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});
    const [activeNoteInput, setActiveNoteInput] = useState<Record<string, string>>({});
    const [isSubmittingNote, setIsSubmittingNote] = useState<Record<string, boolean>>({});
    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [dismissReason, setDismissReason] = useState<string>("");

    useEffect(() => {
        let isMounted = true;
        async function fetchRecommendations() {
            try {
                setIsLoading(true);
                const result = await getInvestigationRecommendations(investigationId);
                if (isMounted) {
                    setPlan(result);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.message || "Failed to load remediation recommendations.");
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        fetchRecommendations();
        return () => {
            isMounted = false;
        };
    }, [investigationId]);

    const handleRegenerate = async () => {
        try {
            setIsRefreshing(true);
            const fresh = await regenerateInvestigationRecommendations(investigationId);
            setPlan(fresh);
            setError(null);
        } catch (err: any) {
            setError(err?.message || "Failed to recalculate recommendations.");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleStatusUpdate = async (recommendationId: string, status: RemediationStatus, reason?: string) => {
        try {
            const updated = await updateRecommendationStatus({
                recommendationId,
                projectId,
                status,
                reason,
            });
            setPlan((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    recommendations: prev.recommendations.map((r) =>
                        r.id === updated.id ? updated : r
                    ),
                };
            });
            if (status === "DISMISSED") {
                setDismissingId(null);
                setDismissReason("");
            }
        } catch (err: any) {
            alert(err?.message || "Failed to update recommendation status.");
        }
    };

    const handleAddNote = async (recommendationId: string) => {
        const text = (activeNoteInput[recommendationId] || "").trim();
        if (!text) return;

        try {
            setIsSubmittingNote((prev) => ({ ...prev, [recommendationId]: true }));
            const note = await recordRecommendationNote({
                recommendationId,
                projectId,
                content: text,
            });
            setPlan((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    recommendations: prev.recommendations.map((r) => {
                        if (r.id === recommendationId) {
                            return {
                                ...r,
                                notes: [...(r.notes || []), note],
                            };
                        }
                        return r;
                    }),
                };
            });
            setActiveNoteInput((prev) => ({ ...prev, [recommendationId]: "" }));
        } catch (err: any) {
            alert(err?.message || "Failed to record human note.");
        } finally {
            setIsSubmittingNote((prev) => ({ ...prev, [recommendationId]: false }));
        }
    };

    const toggleEvidence = (recId: string) => {
        setExpandedEvidence((prev) => ({ ...prev, [recId]: !prev[recId] }));
    };

    return (
        <section
            id="section-remediation-intelligence"
            className="halo-card p-6 border-border space-y-6 scroll-mt-24"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-xl font-semibold tracking-tight text-white">
                            Evidence-Backed Remediation Intelligence
                        </h2>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                            Team Pillar H
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Concrete, evidence-grounded engineering action proposals. Zero automated mutations. Human engineer decides.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRegenerate}
                        disabled={isLoading || isRefreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span>Recalculate Actions</span>
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Contradiction banner */}
            {plan?.contradictionsPresent && (
                <div className="p-3 text-xs rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold">Multiple Remediation Paths Supported:</span> Different evidence dimensions support alternative actions (e.g. Rollback Review vs. Forward Code Fix). Human engineering judgment is required to evaluate operational tradeoffs.
                    </div>
                </div>
            )}

            {/* Insufficient Evidence warning */}
            {plan?.hasInsufficientEvidence && (
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-300 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                        <Info className="w-4 h-4" />
                        <span>Insufficient Telemetry Context for Direct Remediation</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {plan.insufficientEvidenceReason}
                    </p>
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className="space-y-4 py-8 text-center text-xs text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Synthesizing evidence-backed remediation recommendations...
                </div>
            )}

            {/* Recommendations List */}
            {!isLoading && plan && (
                <div className="space-y-4">
                    {plan.recommendations.map((rec) => {
                        const isExpanded = Boolean(expandedEvidence[rec.id]);
                        const isCompleted = rec.status === "COMPLETED";
                        const isDismissed = rec.status === "DISMISSED";

                        return (
                            <div
                                key={rec.id || rec.recommendationKey}
                                className={`rounded-lg border transition-all ${
                                    isCompleted
                                        ? "bg-emerald-950/10 border-emerald-500/30"
                                        : isDismissed
                                        ? "bg-zinc-900/30 border-zinc-800 opacity-60"
                                        : "bg-surface/50 border-border/80 hover:border-indigo-500/30"
                                } p-5 space-y-4`}
                            >
                                {/* Card Header */}
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                    <div className="space-y-1.5 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Type badge */}
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                                {rec.type.replace(/_/g, " ")}
                                            </span>

                                            {/* Status badge */}
                                            <span
                                                className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                                                    rec.status === "ACTIONABLE"
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                        : rec.status === "COMPLETED"
                                                        ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                                        : rec.status === "DISMISSED"
                                                        ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                }`}
                                            >
                                                {rec.status}
                                            </span>

                                            {/* Support level badge */}
                                            <span
                                                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                                    rec.supportLevel === "EVIDENCE_BACKED"
                                                        ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                                                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                                }`}
                                            >
                                                {rec.supportLevel.replace(/_/g, " ")}
                                            </span>

                                            {/* Risk badge */}
                                            <span
                                                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                                    rec.riskLevel === "HIGH"
                                                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                        : rec.riskLevel === "MEDIUM"
                                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                                }`}
                                            >
                                                RISK: {rec.riskLevel}
                                            </span>
                                        </div>

                                        <h3 className="text-sm font-semibold text-white tracking-tight pt-1">
                                            {rec.title}
                                        </h3>
                                    </div>

                                    {/* Action Status Controls */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {!isCompleted && !isDismissed && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate(rec.id, "COMPLETED")}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    <span>Mark Complete</span>
                                                </button>
                                                <button
                                                    onClick={() => setDismissingId(rec.id)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                    <span>Dismiss</span>
                                                </button>
                                            </>
                                        )}
                                        {isCompleted && (
                                            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Verified Complete</span>
                                                <button
                                                    onClick={() => handleStatusUpdate(rec.id, "ACTIONABLE")}
                                                    className="ml-2 text-[10px] text-zinc-400 hover:text-white underline"
                                                >
                                                    Reopen
                                                </button>
                                            </div>
                                        )}
                                        {isDismissed && (
                                            <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                                                <span>Dismissed</span>
                                                <button
                                                    onClick={() => handleStatusUpdate(rec.id, "ACTIONABLE")}
                                                    className="ml-2 text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                                                >
                                                    Restore
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Dismissal Modal / Inline Input */}
                                {dismissingId === rec.id && (
                                    <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 space-y-2">
                                        <p className="text-xs text-zinc-300 font-medium">
                                            Reason for dismissing recommendation:
                                        </p>
                                        <input
                                            type="text"
                                            value={dismissReason}
                                            onChange={(e) => setDismissReason(e.target.value)}
                                            placeholder="e.g. Handled via alternative hotfix, intentional architectural exception..."
                                            className="w-full text-xs px-2.5 py-1.5 rounded bg-black/50 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setDismissingId(null)}
                                                className="px-2.5 py-1 text-[11px] rounded bg-secondary text-zinc-400 hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(rec.id, "DISMISSED", dismissReason)}
                                                className="px-2.5 py-1 text-[11px] rounded bg-red-600/80 hover:bg-red-600 text-white font-medium"
                                            >
                                                Confirm Dismissal
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Recommended Action Body */}
                                <div className="space-y-3 text-xs">
                                    <div className="p-3 rounded-md bg-black/30 border border-white/5 space-y-1.5">
                                        <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-semibold">
                                            Recommended Action (Manual Engineering Action)
                                        </span>
                                        <p className="text-zinc-100 font-mono text-[11px] leading-relaxed">
                                            {rec.action}
                                        </p>
                                    </div>

                                    {/* Why / Rationale */}
                                    {rec.rationale && (
                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-zinc-300">
                                                Why This Action:
                                            </span>
                                            <p className="text-muted-foreground leading-relaxed">
                                                {rec.rationale}
                                            </p>
                                        </div>
                                    )}

                                    {/* Expected Outcome & Validation Method Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                        {rec.expectedOutcome && (
                                            <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800 space-y-1">
                                                <span className="text-[10px] uppercase font-mono text-zinc-400 font-medium">
                                                    Expected Outcome
                                                </span>
                                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                                    {rec.expectedOutcome}
                                                </p>
                                            </div>
                                        )}
                                        {rec.validationMethod && (
                                            <div className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800 space-y-1">
                                                <span className="text-[10px] uppercase font-mono text-zinc-400 font-medium">
                                                    Validation Method
                                                </span>
                                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                                    {rec.validationMethod}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Prerequisites */}
                                    {rec.prerequisites && rec.prerequisites.length > 0 && (
                                        <div className="space-y-1">
                                            <span className="text-[11px] font-semibold text-zinc-300">
                                                Prerequisites:
                                            </span>
                                            <ul className="list-disc pl-4 space-y-0.5 text-zinc-400 text-[11px]">
                                                {rec.prerequisites.map((p, idx) => (
                                                    <li key={idx}>{p}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Uncertainty Callout (Mandatory & Visible) */}
                                    {rec.uncertainty && (
                                        <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/20 text-amber-300/90 space-y-0.5">
                                            <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-amber-400">
                                                Remaining Uncertainty:
                                            </span>
                                            <p className="text-[11px] leading-relaxed">
                                                {rec.uncertainty}
                                            </p>
                                        </div>
                                    )}

                                    {/* Contradiction Note */}
                                    {rec.contradictionNotes && (
                                        <div className="p-2.5 rounded bg-red-500/5 border border-red-500/20 text-red-300 space-y-0.5">
                                            <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-red-400">
                                                Contradictory Path Notice:
                                            </span>
                                            <p className="text-[11px] leading-relaxed">
                                                {rec.contradictionNotes}
                                            </p>
                                        </div>
                                    )}

                                    {/* Historical Context */}
                                    {rec.historicalContext && (
                                        <div className="p-2.5 rounded bg-purple-500/5 border border-purple-500/20 text-purple-300 space-y-1">
                                            <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-purple-400">
                                                Historical Remediation Context (Pillar D Memory)
                                            </span>
                                            <p className="text-[11px] text-zinc-300">
                                                {rec.historicalContext.historicalRecommendation}
                                            </p>
                                            {rec.historicalContext.mismatchNote && (
                                                <p className="text-[11px] text-amber-300 italic">
                                                    {rec.historicalContext.mismatchNote}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Owner Context (Routing Context Only — No Blame) */}
                                    {rec.ownerContext && (
                                        <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                                            <div className="flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                                                <span>Declared Owner:</span>
                                                <span className="font-semibold text-zinc-200">
                                                    {rec.ownerContext.declaredOwner}
                                                </span>
                                            </div>
                                            {rec.ownerContext.source && (
                                                <span className="text-[10px] font-mono text-zinc-500">
                                                    (Source: {rec.ownerContext.source})
                                                </span>
                                            )}
                                            {rec.ownerContext.conflict && (
                                                <span className="text-[10px] font-mono text-amber-400">
                                                    [Ownership Conflict Detected]
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Supporting Evidence Toggle */}
                                    <div className="pt-2 border-t border-border/40">
                                        <button
                                            onClick={() => toggleEvidence(rec.id)}
                                            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                                        >
                                            <span>
                                                {isExpanded
                                                    ? "Hide Supporting Evidence Provenance"
                                                    : `Inspect Supporting Evidence Provenance (${rec.evidenceReferences.length} refs)`}
                                            </span>
                                            {isExpanded ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            )}
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-2.5 p-3 rounded-md bg-black/40 border border-zinc-800 space-y-2">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] uppercase font-mono text-zinc-400 font-medium">
                                                        Supporting Evidence References:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {rec.evidenceReferences.map((ref, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                                                            >
                                                                {ref}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {rec.supportingClaimIds && rec.supportingClaimIds.length > 0 && (
                                                    <div className="space-y-1 pt-1 border-t border-zinc-800">
                                                        <span className="text-[10px] uppercase font-mono text-zinc-400 font-medium">
                                                            Pillar G Claims:
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {rec.supportingClaimIds.map((cid, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/40"
                                                                >
                                                                    {cid}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Human Notes / Assertions Section */}
                                    <div className="pt-2 border-t border-border/40 space-y-2">
                                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                                            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>Engineer Notes & Peer Assertions ({rec.notes?.length || 0})</span>
                                        </div>

                                        {rec.notes && rec.notes.length > 0 && (
                                            <div className="space-y-1.5 pl-2 border-l border-zinc-800">
                                                {rec.notes.map((n) => (
                                                    <div key={n.id} className="text-[11px] space-y-0.5">
                                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                                                            <span className="text-zinc-300 font-medium">
                                                                {n.userName || n.userEmail || "Engineer"}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                                                        </div>
                                                        <p className="text-zinc-300 pl-1">{n.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Note Input */}
                                        <div className="flex items-center gap-2 pt-1">
                                            <input
                                                type="text"
                                                value={activeNoteInput[rec.id] || ""}
                                                onChange={(e) =>
                                                    setActiveNoteInput((prev) => ({
                                                        ...prev,
                                                        [rec.id]: e.target.value,
                                                    }))
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleAddNote(rec.id);
                                                    }
                                                }}
                                                placeholder="Add engineer note or status update (human assertion)..."
                                                className="flex-1 text-xs px-2.5 py-1.5 rounded bg-black/40 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                                            />
                                            <button
                                                onClick={() => handleAddNote(rec.id)}
                                                disabled={
                                                    isSubmittingNote[rec.id] ||
                                                    !(activeNoteInput[rec.id] || "").trim()
                                                }
                                                className="px-3 py-1.5 text-xs font-medium rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:opacity-40 transition-colors"
                                            >
                                                Add Note
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
