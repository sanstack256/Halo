"use client";

import React from "react";
import { Repeat, Clock, Layers, ArrowUpRight } from "lucide-react";

interface RecurringPattern {
    id: string;
    patternKey: string;
    title: string;
    primaryService: string;
    affectedServices: string[];
    incidentCount: number;
    firstSeenAt: string;
    lastSeenAt: string;
    investigationIds: string[];
}

interface RecurringPatternsCardProps {
    pattern: RecurringPattern;
    onSelectIncident?: (investigationId: string) => void;
}

export function RecurringPatternsCard({ pattern, onSelectIncident }: RecurringPatternsCardProps) {
    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 space-y-3 hover:border-zinc-700 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-950/40 text-amber-300 font-semibold flex items-center gap-1">
                            <Repeat className="w-3 h-3 text-amber-400" />
                            {pattern.incidentCount} Occurrences
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                            {pattern.primaryService}
                        </span>
                    </div>
                    <h4 className="text-sm font-medium text-zinc-200">
                        {pattern.title}
                    </h4>
                </div>
            </div>

            {/* Time Span */}
            <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono bg-zinc-900/40 p-2 rounded border border-zinc-800/40">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>First: {formatDate(pattern.firstSeenAt)}</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-1.5">
                    <span>Recent: {formatDate(pattern.lastSeenAt)}</span>
                </div>
            </div>

            {/* Affected Services */}
            <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-zinc-400" /> Involved Services ({pattern.affectedServices.length})
                </span>
                <div className="flex flex-wrap gap-1">
                    {pattern.affectedServices.map((svc) => (
                        <span
                            key={svc}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
                        >
                            {svc}
                        </span>
                    ))}
                </div>
            </div>

            {/* Associated Incident Links */}
            <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-mono text-[11px]">
                    {pattern.investigationIds.length} Linked Investigations
                </span>
                {onSelectIncident && pattern.investigationIds.length > 0 && (
                    <button
                        onClick={() => onSelectIncident(pattern.investigationIds[0])}
                        className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                        <span>View Latest</span>
                        <ArrowUpRight className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}
