"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    GitCommit,
    Info,
    Layers,
    Sparkles,
} from "lucide-react";
import type { ChangeExplanation, EvidenceClassification } from "@/lib/analytics/types";

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
        supportingEvidence,
        counterEvidence,
        evidenceItems,
    } = explanation;

    const [showEvidenceLedger, setShowEvidenceLedger] = useState(false);

    const classificationBadgeClass: Record<EvidenceClassification, string> = {
        "Observed": "halo-badge-info",
        "Correlated": "halo-badge-degraded",
        "Strongly correlated": "halo-badge-critical",
        "Causal evidence established": "halo-badge-healthy",
        "Possible": "halo-badge-degraded",
        "Insufficient evidence": "halo-badge-neutral",
        "Unknown": "halo-badge-neutral",
    };

    const primaryService = affectedServices[0]?.service;
    const primaryIncident = relatedIncidents[0];

    const investigateUrl = primaryIncident
        ? `/projects/${projectId || "current"}/investigations/new?issueId=${primaryIncident.id}`
        : `/projects/${projectId || "current"}/investigations/new?service=${primaryService || "all"}`;

    return (
        <div className="halo-panel">
            {/* Header: Title / Subtitle on Left, Status / Confidence / Action on Right */}
            <div className="halo-panel-header">
                <div className="halo-panel-title-group">
                    <div className="halo-dash-icon-box">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="halo-panel-title">Change &amp; Anomaly Explanation</h3>
                            <span className={`halo-badge ${classificationBadgeClass[classification] || "halo-badge-neutral"}`}>
                                {classification}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowEvidenceLedger(!showEvidenceLedger)}
                                className="halo-filter-btn h-6 px-2 text-[11px]"
                                title="Click to view full evidence ledger"
                            >
                                <span>Confidence: {evidenceStrength}</span>
                                <Info size={11} className="text-accent" />
                            </button>
                        </div>
                        <p className="halo-panel-subtitle mt-0.5">
                            Evidence-backed correlation distinguishing observed telemetry changes from causal claims.
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

            {/* Structured What / When / Where / Magnitude Summary Region */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#06080d] p-3.5 rounded-xl border border-border">
                <div className="space-y-1 pr-2">
                    <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider block">What Changed</span>
                    <p className="text-text font-medium text-xs leading-relaxed">{whatChanged}</p>
                </div>
                <div className="space-y-1 sm:border-l sm:border-border sm:pl-3 pr-2">
                    <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider block">When</span>
                    <p className="text-accent font-semibold text-xs font-mono">{when}</p>
                </div>
                <div className="space-y-1 lg:border-l lg:border-border lg:pl-3 pr-2">
                    <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider block">Where</span>
                    <p className="text-text font-medium text-xs font-mono">{where}</p>
                </div>
                <div className="space-y-1 sm:border-l sm:border-border sm:pl-3">
                    <span className="text-[10px] font-semibold uppercase text-text-muted tracking-wider block">Magnitude</span>
                    <p className="text-error font-semibold text-xs font-mono">{magnitudeDescription}</p>
                </div>
            </div>

            {/* Interactive Evidence Ledger Breakdown */}
            {showEvidenceLedger && evidenceItems.length > 0 && (
                <div className="p-4 rounded-xl bg-[#06080d] border border-accent/30 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-semibold text-text border-b border-border pb-2">
                        <span className="flex items-center gap-1.5 text-accent">
                            <Info size={13} />
                            <span>Shared Evidence Ledger ({evidenceItems.length} records)</span>
                        </span>
                        <span className="text-[11px] text-text-muted font-normal">
                            Confidence basis: {evidenceStrength}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {evidenceItems.map((item) => (
                            <div
                                key={item.id}
                                className="p-2.5 rounded-lg bg-surface border border-border flex items-start justify-between gap-3 text-xs"
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-text">{item.title}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#080b11] border border-border text-text-muted font-mono">
                                            {item.source}
                                        </span>
                                    </div>
                                    <p className="text-text-secondary text-xs">{item.description}</p>
                                </div>
                                <span
                                    className={`halo-badge shrink-0 text-[10px] ${
                                        item.relationship === "SUPPORTING"
                                            ? "halo-badge-healthy"
                                            : item.relationship === "COUNTER_EVIDENCE"
                                            ? "halo-badge-degraded"
                                            : "halo-badge-info"
                                    }`}
                                >
                                    {item.relationship.replace("_", " ")}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Contributing Services & Correlated Releases Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Contributing Services */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="text-xs font-semibold text-text border-b border-border pb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <Layers size={13} className="text-accent" />
                            <span>Contributing Services</span>
                        </span>
                        <span className="text-text-muted text-[11px] font-normal">({affectedServices.length})</span>
                    </div>

                    {affectedServices.length === 0 ? (
                        <p className="text-text-muted text-xs">No specific service concentration identified.</p>
                    ) : (
                        <div className="space-y-2">
                            {affectedServices.map((s, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-2 rounded-lg bg-[#080b11] border border-border text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-text font-semibold">{s.service}</span>
                                    </div>
                                    <div className="text-right font-mono">
                                        <span className="text-error font-semibold">{s.errorCount} errors</span>{" "}
                                        <span className="text-text-muted text-[11px]">
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
                    <div className="text-xs font-semibold text-text border-b border-border pb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <GitCommit size={13} className="text-accent" />
                            <span>Correlated Releases &amp; Changes</span>
                        </span>
                        <span className="text-text-muted text-[11px] font-normal">({relatedReleases.length})</span>
                    </div>

                    {relatedReleases.length === 0 ? (
                        <p className="text-text-muted text-xs">No deployment recorded in the immediate vicinity.</p>
                    ) : (
                        <div className="space-y-2">
                            {relatedReleases.map((r, i) => (
                                <div
                                    key={i}
                                    className="p-2 rounded-lg bg-[#080b11] border border-border flex items-center justify-between text-xs font-mono"
                                >
                                    <div className="flex items-center gap-1.5 text-text font-semibold">
                                        <GitCommit size={13} className="text-accent" />
                                        <span>Release {r.version}</span>
                                    </div>
                                    <span className="text-[11px] text-text-muted">{r.temporalRelation}</span>
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
                    <div className="text-xs font-semibold text-success border-b border-border pb-2">
                        Supporting Telemetry Evidence
                    </div>
                    <ul className="space-y-1.5 text-xs text-text-secondary">
                        {supportingEvidence.map((ev, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                                <span className="leading-relaxed">{ev}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Counter Evidence */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                    <div className="text-xs font-semibold text-warning border-b border-border pb-2">
                        Counter-Evidence &amp; Boundary Conditions
                    </div>
                    {counterEvidence.length === 0 ? (
                        <p className="text-text-muted text-xs leading-relaxed">
                            No contradicting telemetry observed (e.g. no pre-existing baseline failures).
                        </p>
                    ) : (
                        <ul className="space-y-1.5 text-xs text-text-secondary">
                            {counterEvidence.map((cev, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                                    <span className="leading-relaxed">{cev}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
