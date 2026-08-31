"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    BellRing,
    CheckCircle2,
    Clock,
    GitCommit,
    HelpCircle,
    Info,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";
import type { ChangeExplanation, EvidenceClassification, QualitativeConfidence } from "@/lib/analytics/types";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface ChangeExplanationPanelProps {
    explanation: ChangeExplanation;
    projectId?: string;
    environment?: string;
}

export function ChangeExplanationPanel({
    explanation,
    projectId,
    environment,
}: ChangeExplanationPanelProps) {
    const {
        detected,
        headline,
        explanation: text,
        whatChanged,
        when,
        where,
        magnitudeDescription,
        classification,
        evidenceStrength,
        affectedServices,
        relatedReleases,
        relatedIncidents,
        relatedMonitorAlerts,
        supportingEvidence,
        counterEvidence,
        evidenceItems,
    } = explanation;

    const [showEvidenceLedger, setShowEvidenceLedger] = useState(false);

    const classificationBadgeClass: Record<EvidenceClassification, string> = {
        "Observed": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        "Correlated": "bg-amber-500/10 text-amber-400 border-amber-500/30",
        "Strongly correlated": "bg-purple-500/10 text-purple-400 border-purple-500/30",
        "Causal evidence established": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        "Possible": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
        "Insufficient evidence": "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
        "Unknown": "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    };

    const primaryService = affectedServices[0]?.service;
    const primaryIncident = relatedIncidents[0];

    const investigateUrl = primaryIncident
        ? `/projects/${projectId || "current"}/investigations/new?issueId=${primaryIncident.id}`
        : `/projects/${projectId || "current"}/investigations/new?service=${primaryService || "all"}`;

    return (
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-6 font-mono text-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                Change &amp; Anomaly Explanation
                            </h3>
                            <span
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${classificationBadgeClass[classification] || classificationBadgeClass["Correlated"]}`}
                            >
                                {classification}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowEvidenceLedger(!showEvidenceLedger)}
                                className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-zinc-300 text-[10px] hover:border-accent/40 transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <span>Confidence: {evidenceStrength}</span>
                                <Info size={11} className="text-accent" />
                            </button>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-sans">
                            Evidence-backed correlation distinguishing observed changes from causal claims.
                        </p>
                    </div>
                </div>

                {detected && (
                    <Link
                        href={investigateUrl}
                        className="halo-btn halo-btn-primary halo-btn-sm shrink-0"
                    >
                        <Sparkles size={12} />
                        <span>Launch Investigation</span>
                    </Link>
                )}
            </div>

            {/* Structured What / When / Where Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">What Changed</span>
                    <p className="text-white font-semibold">{whatChanged}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">When</span>
                    <p className="text-accent font-semibold">{when}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Where</span>
                    <p className="text-white font-semibold">{where}</p>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Magnitude</span>
                    <p className="text-red-400 font-semibold">{magnitudeDescription}</p>
                </div>
            </div>

            {/* Interactive Evidence Ledger Breakdown */}
            {showEvidenceLedger && evidenceItems.length > 0 && (
                <div className="p-4 rounded-xl bg-[#06080d] border border-accent/30 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-1.5">
                        <span className="flex items-center gap-1.5 text-accent">
                            <Info size={13} />
                            <span>Shared Evidence Ledger ({evidenceItems.length} records)</span>
                        </span>
                        <span className="text-[10px] text-muted normal-case">
                            Confidence basis: {evidenceStrength}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {evidenceItems.map((item) => (
                            <div
                                key={item.id}
                                className="p-2.5 rounded-lg bg-surface border border-border flex items-start justify-between gap-3 text-[11px]"
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white">{item.title}</span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#080b11] border border-border text-muted">
                                            {item.source}
                                        </span>
                                    </div>
                                    <p className="text-zinc-300 font-sans">{item.description}</p>
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                        item.relationship === "SUPPORTING"
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : item.relationship === "COUNTER_EVIDENCE"
                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                            : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                    }`}
                                >
                                    {item.relationship}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Affected Services & Correlated Entities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Affected Services */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-2 flex items-center justify-between">
                        <span>Contributing Services</span>
                        <span className="text-muted font-normal">({affectedServices.length})</span>
                    </div>

                    {affectedServices.length === 0 ? (
                        <p className="text-muted text-[11px]">No specific service concentration identified.</p>
                    ) : (
                        <div className="space-y-2">
                            {affectedServices.map((s, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-2 rounded-lg bg-[#080b11] border border-border"
                                >
                                    <div className="flex items-center gap-2">
                                        <Layers size={13} className="text-accent" />
                                        <span className="text-white font-semibold">{s.service}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-red-400 font-bold">{s.errorCount} errors</span>{" "}
                                        <span className="text-muted text-[10px]">
                                            ({s.shareOfTotalErrorsPct}%)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Correlated Releases */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-2 flex items-center justify-between">
                        <span>Correlated Releases &amp; Changes</span>
                        <span className="text-muted font-normal">({relatedReleases.length})</span>
                    </div>

                    {relatedReleases.length === 0 ? (
                        <p className="text-muted text-[11px]">No deployment recorded in the immediate vicinity.</p>
                    ) : (
                        <div className="space-y-2">
                            {relatedReleases.map((r, i) => (
                                <div
                                    key={i}
                                    className="p-2 rounded-lg bg-[#080b11] border border-border space-y-1"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-purple-400 font-semibold">
                                            <GitCommit size={13} />
                                            <span>Release {r.version}</span>
                                        </div>
                                        <span className="text-[10px] text-muted">{r.temporalRelation}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Supporting & Counter Evidence Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supporting Evidence */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                    <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider border-b border-border/60 pb-2">
                        Supporting Telemetry Evidence
                    </div>
                    <ul className="space-y-1.5 text-[11px] font-sans text-zinc-300">
                        {supportingEvidence.map((ev, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                <span>{ev}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Counter Evidence */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                    <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider border-b border-border/60 pb-2">
                        Counter-Evidence &amp; Boundary Conditions
                    </div>
                    {counterEvidence.length === 0 ? (
                        <p className="text-muted text-[11px] font-sans">
                            No contradicting telemetry observed (e.g. no pre-existing baseline failures).
                        </p>
                    ) : (
                        <ul className="space-y-1.5 text-[11px] font-sans text-zinc-300">
                            {counterEvidence.map((cev, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                    <span>{cev}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
