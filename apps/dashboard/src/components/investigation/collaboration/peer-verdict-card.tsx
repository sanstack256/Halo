"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, HelpCircle, MinusCircle, Users, Send, Shield } from "lucide-react";
import { recordPeerVerdict } from "@/actions/collaboration";
import type { PeerVerdictType } from "@/generated/prisma/client";

interface VerdictItem {
    id: string;
    hypothesisId: string;
    authorId: string;
    authorName: string;
    authorEmail: string;
    verdict: PeerVerdictType;
    reasoning: string | null;
    evidenceReferences: string[];
    createdAt: string;
    updatedAt: string;
}

interface Props {
    investigationId: string;
    hypothesisId: string;
    engineConfidence: number;
    verdicts: VerdictItem[];
    currentUserId?: string;
    isTeamPlan: boolean;
}

export function PeerVerdictCard({
    investigationId,
    hypothesisId,
    engineConfidence,
    verdicts,
    currentUserId,
    isTeamPlan,
}: Props) {
    const [selectedVerdict, setSelectedVerdict] = useState<PeerVerdictType>("SUPPORTED");
    const [reasoning, setReasoning] = useState("");
    const [evidenceInput, setEvidenceInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hypothesisVerdicts = verdicts.filter((v) => v.hypothesisId === hypothesisId);

    const supportCount = hypothesisVerdicts.filter((v) => v.verdict === "SUPPORTED").length;
    const disputeCount = hypothesisVerdicts.filter((v) => v.verdict === "DISPUTED").length;
    const needsEvidenceCount = hypothesisVerdicts.filter((v) => v.verdict === "NEEDS_EVIDENCE").length;

    const myVerdict = hypothesisVerdicts.find((v) => v.authorId === currentUserId);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!isTeamPlan) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const evRefs = evidenceInput
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            await recordPeerVerdict({
                investigationId,
                hypothesisId,
                verdict: selectedVerdict,
                reasoning: reasoning.trim() || undefined,
                evidenceReferences: evRefs.length > 0 ? evRefs : undefined,
                idempotencyKey: `verdict_${investigationId}_${hypothesisId}_${Date.now()}`,
            });

            setShowForm(false);
            setReasoning("");
            setEvidenceInput("");
        } catch (err: any) {
            setError(err.message || "Failed to record verdict.");
        } finally {
            setIsSubmitting(false);
        }
    }

    const getVerdictBadge = (verdict: PeerVerdictType) => {
        switch (verdict) {
            case "SUPPORTED":
                return (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        <CheckCircle2 size={11} />
                        SUPPORTED
                    </span>
                );
            case "DISPUTED":
                return (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                        <XCircle size={11} />
                        DISPUTED
                    </span>
                );
            case "NEEDS_EVIDENCE":
                return (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        <HelpCircle size={11} />
                        NEEDS EVIDENCE
                    </span>
                );
            default:
                return (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
                        <MinusCircle size={11} />
                        UNRESOLVED
                    </span>
                );
        }
    };

    return (
        <div className="mt-3 p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-3">
            {/* Split header: Halo Engine vs Team Peer Verdicts */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 font-mono text-[11px]">
                        Engine Confidence: {engineConfidence}%
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="flex items-center gap-1 text-zinc-300 font-medium">
                        <Users size={12} className="text-indigo-400" />
                        Team Consensus:
                    </span>
                    <span className="text-emerald-400 font-mono text-[11px]">+{supportCount}</span>
                    <span className="text-rose-400 font-mono text-[11px]">-{disputeCount}</span>
                    {needsEvidenceCount > 0 && (
                        <span className="text-amber-400 font-mono text-[11px]">?{needsEvidenceCount}</span>
                    )}
                </div>

                {isTeamPlan && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded text-[11px] font-medium transition"
                    >
                        {myVerdict ? "Update My Verdict" : "Record Verdict"}
                    </button>
                )}
            </div>

            {/* Individual member positions */}
            {hypothesisVerdicts.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                    {hypothesisVerdicts.map((v) => (
                        <div
                            key={v.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-2 bg-zinc-900/40 border border-zinc-850 rounded-lg text-xs"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-200">{v.authorName}</span>
                                {getVerdictBadge(v.verdict)}
                            </div>
                            {v.reasoning && (
                                <p className="text-zinc-400 italic text-[11px] w-full pl-1">
                                    "{v.reasoning}"
                                </p>
                            )}
                            {v.evidenceReferences && v.evidenceReferences.length > 0 && (
                                <div className="text-[10px] font-mono text-zinc-500 w-full pl-1">
                                    Referenced Evidence: {v.evidenceReferences.join(", ")}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Verdict Submission Form */}
            {showForm && isTeamPlan && (
                <form onSubmit={handleSubmit} className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-zinc-200">
                        Record Engineering Position on Hypothesis {hypothesisId}
                    </div>

                    {error && (
                        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["SUPPORTED", "DISPUTED", "NEEDS_EVIDENCE", "UNRESOLVED"] as const).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setSelectedVerdict(v)}
                                className={`px-2 py-1.5 rounded text-xs font-mono transition border ${
                                    selectedVerdict === v
                                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300"
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    <div>
                        <textarea
                            value={reasoning}
                            onChange={(e) => setReasoning(e.target.value)}
                            placeholder="Optional technical rationale or reproduction note..."
                            rows={2}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <input
                            type="text"
                            value={evidenceInput}
                            onChange={(e) => setEvidenceInput(e.target.value)}
                            placeholder="Optional evidence IDs (comma-separated event IDs)..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-2.5 py-1 text-zinc-400 hover:text-zinc-200 text-xs transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-medium transition"
                        >
                            <Send size={11} />
                            <span>{isSubmitting ? "Saving..." : "Submit Verdict"}</span>
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
