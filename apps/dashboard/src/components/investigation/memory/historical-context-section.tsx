"use client";

import React, { useState, useEffect } from "react";
import { SimilarIncidentCard } from "./similar-incident-card";
import { RecurringPatternsCard } from "./recurring-patterns-card";
import { PostmortemModal } from "./postmortem-modal";
import {
    getRelevantHistoricalIncidents,
    getRecurringFailurePatterns,
    generateInvestigationPostmortemAction,
} from "@/actions/incident-memory";
import { type IncidentComparisonResult } from "@/lib/investigation/incident-memory/similarity-engine";
import { type GeneratedPostmortem } from "@/lib/investigation/incident-memory/postmortem-generator";
import { History, FileText, Repeat, Info, Sparkles } from "lucide-react";

interface HistoricalContextSectionProps {
    investigationId: string;
    projectId: string;
}

export function HistoricalContextSection({
    investigationId,
    projectId,
}: HistoricalContextSectionProps) {
    const [matches, setMatches] = useState<IncidentComparisonResult[]>([]);
    const [patterns, setPatterns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [explanation, setExplanation] = useState("");

    // Postmortem state
    const [postmortemOpen, setPostmortemOpen] = useState(false);
    const [postmortem, setPostmortem] = useState<GeneratedPostmortem | null>(null);
    const [postmortemLoading, setPostmortemLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchMemory() {
            setLoading(true);
            try {
                const [matchRes, patternRes] = await Promise.all([
                    getRelevantHistoricalIncidents(investigationId),
                    getRecurringFailurePatterns(projectId),
                ]);
                if (isMounted) {
                    setMatches(matchRes.matches);
                    setExplanation(matchRes.explanationSummary);
                    setPatterns(patternRes);
                }
            } catch (err) {
                console.error("Failed to load organizational failure memory:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchMemory();
        return () => {
            isMounted = false;
        };
    }, [investigationId, projectId]);

    const handleOpenPostmortem = async () => {
        setPostmortemOpen(true);
        if (!postmortem) {
            setPostmortemLoading(true);
            try {
                const res = await generateInvestigationPostmortemAction(investigationId);
                setPostmortem(res);
            } catch (err) {
                console.error("Failed to generate postmortem:", err);
            } finally {
                setPostmortemLoading(false);
            }
        }
    };

    return (
        <section id="historical-memory" className="space-y-6 pt-6 border-t border-zinc-800">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base font-semibold text-zinc-100">
                            Organizational Failure Memory & Context
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-semibold uppercase tracking-wider">
                            Pillar D
                        </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                        Contextual retrieval of historical incidents, recurring failure patterns, and previous human resolutions.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenPostmortem}
                        className="px-3 py-1.5 text-xs font-mono rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 shadow transition-colors"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Generate Postmortem</span>
                    </button>
                </div>
            </div>

            {/* Invariant Reminder Banner */}
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3 flex items-start gap-2.5 text-xs text-zinc-400">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    <strong className="text-zinc-300">Epistemic Invariant:</strong> Historical similarity provides investigative context; current telemetry remains authoritative for current causality. Historical similarity never overrides or inflates current investigation root-cause confidence.
                </p>
            </div>

            {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                    <Sparkles className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-xs font-mono text-zinc-500">
                        Querying organizational memory...
                    </span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Section 1: Similar Historical Incidents */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5 text-zinc-400" />
                                Structurally Similar Incidents ({matches.length})
                            </span>
                            <span className="text-[11px] font-mono text-zinc-500">
                                {explanation}
                            </span>
                        </div>

                        {matches.length === 0 ? (
                            <div className="bg-zinc-950/40 border border-dashed border-zinc-800 rounded-lg p-6 text-center space-y-1">
                                <p className="text-xs font-mono text-zinc-400">
                                    No relevant historical incidents found.
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                    Current failure characteristics do not match prior completed investigations in this organization.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {matches.map((match) => (
                                    <SimilarIncidentCard key={match.historicalInvestigationId} match={match} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Recurring Failure Patterns */}
                    {patterns.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-zinc-850">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                    <Repeat className="w-3.5 h-3.5 text-amber-400" />
                                    Recurring Failure Patterns ({patterns.length})
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500">
                                    Clustered across organizational incident history
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {patterns.map((pattern) => (
                                    <RecurringPatternsCard key={pattern.id} pattern={pattern} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Postmortem Modal */}
            <PostmortemModal
                isOpen={postmortemOpen}
                onClose={() => setPostmortemOpen(false)}
                postmortem={postmortem}
                isLoading={postmortemLoading}
            />
        </section>
    );
}
