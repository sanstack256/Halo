"use client";

import React, { useState, useEffect } from "react";
import {
    ShieldCheck,
    AlertTriangle,
    FileCode,
    Layers,
    Clock,
    UserCheck,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    ExternalLink,
} from "lucide-react";
import { getInvestigationOwnership } from "@/actions/ownership";
import type { InvestigationOwnershipContext, ServiceRoleContext } from "@/lib/ownership/ownership-engine";

interface OwnershipContextPanelProps {
    investigationId: string;
    projectId: string;
}

export function OwnershipContextPanel({
    investigationId,
    projectId,
}: OwnershipContextPanelProps) {
    const [context, setContext] = useState<InvestigationOwnershipContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedService, setExpandedService] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        async function fetchOwnership() {
            try {
                setLoading(true);
                const result = await getInvestigationOwnership(investigationId);
                if (mounted) {
                    setContext(result);
                    if (result.affectedServices.length > 0) {
                        setExpandedService(result.affectedServices[0].serviceName);
                    }
                }
            } catch (err: any) {
                if (mounted) {
                    // If capability is missing or forbidden, don't crash UI
                    setError(err?.message || "Failed to load ownership context");
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }
        fetchOwnership();
        return () => {
            mounted = false;
        };
    }, [investigationId, projectId]);

    if (loading) {
        return (
            <div
                id="section-ownership-intelligence"
                className="halo-card p-6 border border-border/40 bg-surface/50 animate-pulse my-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck size={18} className="text-muted" />
                    <div className="h-4 w-48 bg-surface-elevated rounded" />
                </div>
                <div className="h-16 w-full bg-surface-elevated/40 rounded" />
            </div>
        );
    }

    if (error || !context) {
        return null; // Gracefully degrade if not entitled or error
    }

    return (
        <section
            id="section-ownership-intelligence"
            className="halo-card border border-border/50 bg-surface/60 overflow-hidden my-6 transition-all duration-200"
        >
            {/* Header */}
            <div className="p-5 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 bg-surface-elevated/20">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10 border border-accent/20 text-accent">
                        <ShieldCheck size={17} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white tracking-wide">
                                Ownership Intelligence & Engineering Responsibility
                            </h3>
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                                Team Pillar E
                            </span>
                        </div>
                        <p className="text-xs text-secondary mt-0.5">
                            Authoritative declared ownership, code area mapping, and incident routing context. Zero developer blame.
                        </p>
                    </div>
                </div>

                {/* Summary badges */}
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-surface-elevated border border-border text-foreground flex items-center gap-1.5">
                        <Layers size={13} className="text-muted" />
                        <span>{context.summary.totalAffectedServices} Affected Services</span>
                    </span>
                    {context.summary.conflictCount > 0 && (
                        <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            <span>{context.summary.conflictCount} Conflict Detected</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Code Path Ownership Banner if present */}
            {context.codeOwnership && (
                <div className="px-5 py-3.5 bg-surface-elevated/30 border-b border-border/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <FileCode size={14} className="text-accent shrink-0" />
                        <span className="text-muted">Associated Code Path:</span>
                        <code className="font-mono text-white bg-black/30 px-2 py-0.5 rounded border border-border/50">
                            {context.codeOwnership.filePath}
                        </code>
                        {context.codeOwnership.matchingRule && (
                            <span className="text-[11px] text-secondary">
                                (Matched: <code className="font-mono text-muted">{context.codeOwnership.matchingRule}</code>)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted">Code Owners:</span>
                        {context.codeOwnership.codeOwners.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                                {context.codeOwnership.codeOwners.map((owner) => (
                                    <span
                                        key={owner}
                                        className="font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded"
                                    >
                                        {owner}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-muted italic">Owner Unknown</span>
                        )}
                    </div>
                </div>
            )}

            {/* Service Ownership Cards */}
            <div className="divide-y divide-border/30">
                {context.affectedServices.length === 0 ? (
                    <div className="p-8 text-center text-secondary text-xs">
                        <HelpCircle size={20} className="mx-auto mb-2 text-muted" />
                        No service-level ownership records observed for this investigation.
                    </div>
                ) : (
                    context.affectedServices.map((serviceCtx) => (
                        <ServiceOwnershipRow
                            key={serviceCtx.serviceName}
                            serviceCtx={serviceCtx}
                            isExpanded={expandedService === serviceCtx.serviceName}
                            onToggle={() =>
                                setExpandedService(
                                    expandedService === serviceCtx.serviceName
                                        ? null
                                        : serviceCtx.serviceName
                                )
                            }
                        />
                    ))
                )}
            </div>
        </section>
    );
}

function ServiceOwnershipRow({
    serviceCtx,
    isExpanded,
    onToggle,
}: {
    serviceCtx: ServiceRoleContext;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { serviceName, role, ownership } = serviceCtx;
    const isConflict = ownership.status === "CONFLICT";
    const isUnknown = ownership.status === "UNKNOWN";

    const roleBadge =
        role === "ROOT_CAUSE_SERVICE" ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                Root-Cause Service
            </span>
        ) : role === "TRANSITIVE_PROPAGATOR" ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Transitive Propagator
            </span>
        ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Impacted Surface
            </span>
        );

    return (
        <div className="transition-colors hover:bg-white/[0.01]">
            <div
                onClick={onToggle}
                className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white font-mono">
                                {serviceName}
                            </span>
                            {roleBadge}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted mt-1">
                            <span>Repository: {ownership.repository}</span>
                            {ownership.sourcePath && (
                                <>
                                    <span>•</span>
                                    <span>Path: {ownership.sourcePath}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Owner status pill */}
                    {isConflict ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-medium">
                            <AlertTriangle size={13} />
                            <span>Ownership Conflict</span>
                        </div>
                    ) : isUnknown ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated text-muted border border-border text-xs">
                            <HelpCircle size={13} />
                            <span>Owner Unknown</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
                            <UserCheck size={13} />
                            <span>
                                {ownership.declaredOwners.length > 1
                                    ? `Multiple declared owners (${ownership.declaredOwners.join(", ")})`
                                    : ownership.declaredOwners[0] || "Declared"}
                            </span>
                        </div>
                    )}

                    <button
                        type="button"
                        aria-label="Toggle details"
                        className="p-1 rounded text-muted hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Expanded Evidence & Routing Details */}
            {isExpanded && (
                <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border/20 bg-black/10 text-xs">
                    {/* Explicit Conflict Card */}
                    {ownership.conflict && (
                        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-2">
                            <div className="flex items-center gap-2 text-amber-300 font-semibold">
                                <AlertTriangle size={14} />
                                <span>Ownership Conflict Detected</span>
                            </div>
                            <p className="text-secondary leading-relaxed text-[11px]">
                                {ownership.conflict.reason}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-amber-500/20">
                                {ownership.conflict.sources.map((src, idx) => (
                                    <div
                                        key={idx}
                                        className="p-2.5 rounded bg-black/30 border border-amber-500/20"
                                    >
                                        <div className="text-[10px] uppercase font-mono tracking-wider text-amber-400/80">
                                            Source: {src.source}
                                        </div>
                                        <div className="text-xs font-semibold text-white mt-0.5">
                                            {src.owner}
                                        </div>
                                        <div className="text-[10px] text-muted mt-1">
                                            {src.evidence}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Evidence List */}
                    <div>
                        <div className="text-[11px] font-semibold text-white mb-2 uppercase tracking-wider">
                            Ownership Evidence & Provenance
                        </div>
                        {ownership.evidence.length === 0 ? (
                            <p className="text-muted italic">No ownership sources available for this service.</p>
                        ) : (
                            <div className="space-y-2">
                                {ownership.evidence.map((ev, i) => (
                                    <div
                                        key={i}
                                        className="p-3 rounded-lg bg-surface-elevated/40 border border-border/40 flex flex-wrap items-start justify-between gap-2"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white">{ev.owner}</span>
                                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/5 border border-border text-muted">
                                                    {ev.classification}
                                                </span>
                                                <span className="text-[10px] font-mono text-secondary">
                                                    Source: {ev.source}
                                                </span>
                                            </div>
                                            <p className="text-secondary leading-relaxed">{ev.evidence}</p>
                                        </div>
                                        {ev.commitSha && (
                                            <span className="text-[10px] font-mono text-muted bg-black/40 px-2 py-0.5 rounded border border-border/40">
                                                Commit: {ev.commitSha.slice(0, 7)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Human Assertions if present */}
                    {ownership.humanAssertions.length > 0 && (
                        <div>
                            <div className="text-[11px] font-semibold text-white mb-2 uppercase tracking-wider">
                                Human Assertions
                            </div>
                            <div className="space-y-2">
                                {ownership.humanAssertions.map((h, i) => (
                                    <div
                                        key={i}
                                        className="p-2.5 rounded bg-surface border border-border text-secondary flex items-start gap-2"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                                        <div>
                                            <span className="font-medium text-white">{h.authorName}: </span>
                                            <span>"{h.statement}"</span>
                                            <span className="text-[10px] text-muted ml-2">
                                                (Proposes: {h.proposedOwner})
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ownership Audit / Changes */}
                    {ownership.historicalContext && (
                        <div className="pt-2 border-t border-border/20 flex flex-wrap items-center justify-between text-muted text-[11px] gap-2">
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} />
                                <span>
                                    Historical involvement: {ownership.historicalContext.incidentCount ?? 0} past investigations
                                </span>
                            </div>
                            {ownership.historicalContext.previousOwners && (
                                <span>
                                    Previous owners: {ownership.historicalContext.previousOwners.join(" → ")}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
