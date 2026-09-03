"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    FileWarning,
    Copy,
    Check,
    Search,
    ChevronRight,
    ShieldAlert,
    AlertTriangle,
    Layers,
    Clock,
    Terminal,
    Waypoints,
    Globe,
    Cpu,
    Info,
} from "lucide-react";
import type { ErrorReproductionRecipe, ObservedCondition } from "@/lib/explore/error-recipe";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";
import { ExploreHeader } from "./explore-header";
import { DetailDrawer } from "./detail-drawer";
import { ExploreEmptyState } from "./empty-state";
import { CopyButton } from "./copy-button";
import { RelativeTime } from "@/components/ui/relative-time";

interface ErrorRecipeClientProps {
    recipe: ErrorReproductionRecipe | null;
    recentErrors: CanonicalEvidenceRecord[];
    currentFingerprint?: string;
    currentEventId?: string;
}

export function ErrorRecipeClient({
    recipe,
    recentErrors,
    currentFingerprint,
    currentEventId,
}: ErrorRecipeClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [selectedRecord, setSelectedRecord] = useState<CanonicalEvidenceRecord | null>(null);
    const [searchInput, setSearchInput] = useState(currentFingerprint || currentEventId || "");

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (searchInput.trim()) {
            params.set("fingerprint", searchInput.trim());
        } else {
            params.delete("fingerprint");
        }
        router.push(`/explore/errors?${params.toString()}`);
    };

    const handleSelectError = (err: CanonicalEvidenceRecord) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("eventId", err.id);
        params.delete("fingerprint");
        router.push(`/explore/errors?${params.toString()}`);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Errors"
                subtitle="Extract the environmental and execution conditions that repeatedly surround a failure so an engineer can reproduce it."
                icon={FileWarning}
                badgeText={recipe ? `${recipe.totalOccurrences} occurrences evaluated` : undefined}
                actions={
                    recipe && (
                        <CopyButton
                            text={recipe.rawRecipeText}
                            label="Copy Reproduction Recipe"
                            className="halo-btn halo-btn-sm halo-btn-primary font-sans"
                        />
                    )
                }
            />

            {/* Error Selector & Search Bar */}
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-3">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2.5 text-xs">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Target error title, fingerprint, or event ID..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-sans"
                        />
                    </div>
                    <button type="submit" className="halo-btn halo-btn-secondary halo-btn-sm shrink-0">
                        Extract Recipe
                    </button>
                </form>

                {/* Quick Error Chips */}
                {recentErrors.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono pt-1 border-t border-border/60">
                        <span className="text-muted">RECENT FAILURES:</span>
                        {recentErrors.slice(0, 5).map((err) => {
                            const isActive = recipe?.sampleEvent.id === err.id;
                            return (
                                <button
                                    key={err.id}
                                    type="button"
                                    onClick={() => handleSelectError(err)}
                                    className={`px-2 py-0.5 rounded border transition-colors truncate max-w-xs ${
                                        isActive
                                            ? "bg-red-500/15 border-red-500/40 text-red-300 font-bold"
                                            : "bg-[#06080e] border-border text-zinc-400 hover:text-white hover:border-zinc-500"
                                    }`}
                                >
                                    {err.title}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recipe Content */}
            {!recipe ? (
                <ExploreEmptyState
                    type="NO_DATA"
                    title="No error occurrences found"
                    description="Select an error from the list above or enter a failure signature to extract its environmental reproduction conditions."
                />
            ) : (
                <div className="space-y-5">
                    {/* Failure Profile Banner */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                                    OBSERVED FAILURE
                                </span>
                                <span className="text-xs font-mono text-muted">
                                    Fingerprint: {recipe.fingerprint.slice(0, 16)}...
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRecord(recipe.sampleEvent)}
                                className="halo-btn halo-btn-xs halo-btn-secondary text-[11px] font-mono"
                            >
                                Inspect Event Payload
                            </button>
                        </div>

                        <h2 className="text-base font-bold text-white font-sans">
                            {recipe.title}
                        </h2>

                        <div className="halo-metric-strip grid-cols-2 sm:grid-cols-4">
                            <div className="halo-metric-cell space-y-1">
                                <span className="text-[10px] text-muted uppercase font-semibold font-mono">Occurrences</span>
                                <span className="text-xl font-bold text-white block font-sans">{recipe.totalOccurrences}</span>
                            </div>
                            <div className="halo-metric-cell space-y-1">
                                <span className="text-[10px] text-muted uppercase font-semibold font-mono">100% Failures</span>
                                <span className="text-xl font-bold text-emerald-400 block font-sans">{recipe.conditionMatrix.observedAcrossFailures.length}</span>
                            </div>
                            <div className="halo-metric-cell space-y-1">
                                <span className="text-[10px] text-muted uppercase font-semibold font-mono">Common (≥60%)</span>
                                <span className="text-xl font-bold text-blue-400 block font-sans">{recipe.conditionMatrix.common.length}</span>
                            </div>
                            <div className="halo-metric-cell space-y-1">
                                <span className="text-[10px] text-muted uppercase font-semibold font-mono">Success Comparators</span>
                                <span className="text-xl font-bold text-purple-400 block font-sans">{recipe.totalComparators}</span>
                            </div>
                        </div>
                    </div>

                    {/* Sufficiency Notice if Limited or 1 Occurrence */}
                    {recipe.sufficiency.status !== "SUFFICIENT" && (
                        <div className="p-3.5 rounded-xl bg-surface border border-amber-500/30 text-xs font-mono space-y-1">
                            <div className="flex items-center gap-2 text-amber-300 font-semibold">
                                <AlertTriangle size={14} className="shrink-0" />
                                <span>EVIDENCE QUALITY: {recipe.sufficiency.status}</span>
                            </div>
                            <p className="text-muted text-[11px] font-sans">
                                {recipe.sufficiency.reasons[0] || "A single observation cannot establish condition requirement."}
                            </p>
                        </div>
                    )}

                    {/* The Reproduction Matrix */}
                    <div className="rounded-xl bg-surface border border-border overflow-hidden">
                        <div className="p-3 bg-[#06080e] border-b border-border flex items-center justify-between text-xs font-mono">
                            <span className="text-muted uppercase font-semibold">
                                OBSERVED REPRODUCTION MATRIX
                            </span>
                            <span className="text-[11px] text-secondary">
                                Observed frequency across {recipe.totalOccurrences} failures & {recipe.totalComparators} successes
                            </span>
                        </div>

                        <div className="divide-y divide-border/40 font-mono text-xs">
                            {recipe.conditions.map((cond, idx) => {
                                const is100 = cond.classification === "OBSERVED ACROSS FAILURES";
                                const isAbsentInComp = cond.classification === "ABSENT FROM COMPARATORS";
                                const isCom = cond.classification === "COMMON";
                                const isVar = cond.classification === "VARIABLE";

                                return (
                                    <div
                                        key={idx}
                                        className="p-3 grid grid-cols-12 gap-3 items-center hover:bg-surface-elevated transition-colors"
                                    >
                                        <div className="col-span-3 text-secondary text-[11px]">
                                            [{cond.category}] {cond.label}
                                        </div>
                                        <div className="col-span-4 text-white font-semibold truncate font-sans text-xs">
                                            {cond.value}
                                        </div>
                                        <div className="col-span-2 text-right text-zinc-300">
                                            <span>Failures: {cond.failureFraction}</span>
                                            {cond.successFraction && (
                                                <span className="text-muted text-[10px] block">
                                                    Success: {cond.successFraction}
                                                </span>
                                            )}
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                                    isAbsentInComp
                                                        ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                                        : is100
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                        : isCom
                                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                        : isVar
                                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                                                }`}
                                            >
                                                {cond.classification}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Plain-Text Recipe Preview */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-muted uppercase font-semibold">
                                Plain-Text Investigation Recipe (Observed Facts Only)
                            </span>
                            <CopyButton text={recipe.rawRecipeText} label="Copy Recipe" />
                        </div>
                        <pre className="p-4 rounded-xl bg-[#04060a] border border-border font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre">
                            {recipe.rawRecipeText}
                        </pre>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            <DetailDrawer
                record={selectedRecord}
                provenance={recipe?.provenance}
                onClose={() => setSelectedRecord(null)}
            />
        </div>
    );
}
