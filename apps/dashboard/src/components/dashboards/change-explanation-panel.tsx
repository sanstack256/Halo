"use client";

import React from "react";
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
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";
import type { ChangeExplanation, EvidenceClassification } from "@/lib/analytics/types";
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
        peakTimestamp,
        magnitudeDescription,
        classification,
        affectedServices,
        relatedReleases,
        relatedIncidents,
        relatedMonitorAlerts,
        supportingEvidence,
    } = explanation;

    const classificationConfig: Record<
        EvidenceClassification,
        { label: string; badgeClass: string; desc: string }
    > = {
        "Observed": {
            label: "Observed",
            badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
            desc: "Signals were temporally observed without definitive cross-service causality.",
        },
        "Correlated": {
            label: "Correlated",
            badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
            desc: "Telemetry shifts align chronologically across multiple services or releases.",
        },
        "Strongly correlated": {
            label: "Strongly Correlated",
            badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
            desc: "High-confidence temporal alignment with sharp telemetry deviation immediately following change.",
        },
        "Causal evidence established": {
            label: "Causal Evidence Established",
            badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
            desc: "Direct causal chain validated through distributed trace context and error payloads.",
        },
        "Possible": {
            label: "Possible",
            badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
            desc: "Plausible relationship with partial supporting evidence.",
        },
        "Insufficient evidence": {
            label: "Insufficient Evidence",
            badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
            desc: "Sample size or telemetry records are insufficient to establish a reliable conclusion.",
        },
    };

    const currentClass = classificationConfig[classification] || classificationConfig["Correlated"];

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
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${currentClass.badgeClass}`}
                                title={currentClass.desc}
                            >
                                {currentClass.label}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-sans">
                            Evidence-backed correlation derived from synchronized telemetry signals.
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

            {/* Headline & Core Summary */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle size={15} className="text-accent shrink-0" />
                    <span>{headline}</span>
                </div>
                <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                    {text}
                </p>

                {magnitudeDescription && (
                    <div className="pt-2 border-t border-border/60 flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="text-muted">Magnitude:</span>
                        <span className="text-white font-semibold">{magnitudeDescription}</span>
                        {peakTimestamp && (
                            <>
                                <span className="text-muted">· Peak Time:</span>
                                <span className="text-accent">
                                    {formatDeterministicDateTime(new Date(peakTimestamp))}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>

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

                {/* 2. Correlated Releases / Changes */}
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

            {/* Supporting Evidence Bullets */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-2">
                    Supporting Telemetry Evidence
                </div>

                <ul className="space-y-1.5 text-[11px] font-sans text-zinc-300">
                    {supportingEvidence.map((ev, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                            <span>{ev}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
