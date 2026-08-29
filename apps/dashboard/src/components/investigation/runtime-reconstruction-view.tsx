"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Code2,
    Compass,
    Copy,
    ExternalLink,
    FileCode,
    GitBranch,
    Globe,
    HelpCircle,
    Info,
    Layers,
    ListTree,
    Network,
    Terminal,
    Zap,
} from "lucide-react";
import type { FullRuntimeReconstruction, CallChainStep, FrameClassification } from "@/lib/investigation/runtime/types";

interface Props {
    reconstruction?: FullRuntimeReconstruction;
}

const CLASSIFICATION_STYLE: Record<FrameClassification, string> = {
    Application: "bg-surface-elevated border-border text-zinc-200",
    Framework: "bg-[#080b11] border-white/5 text-zinc-400",
    Runtime: "bg-[#080b11] border-white/5 text-muted",
    Vendor: "bg-[#080b11] border-white/5 text-muted",
    Native: "bg-[#080b11] border-white/5 text-muted",
    Unknown: "bg-[#080b11] border-white/5 text-muted",
};

const CORRELATION_BASIS_STYLE: Record<string, string> = {
    Anchor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    RequestId: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    TraceId: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    SessionId: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    Temporal: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    Derived: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export function RuntimeReconstructionView({ reconstruction }: Props) {
    const params = useParams();
    const projectId = (params?.id as string) || (params?.projectId as string);

    if (!reconstruction) {
        return null;
    }

    const { failure, context, runtimeOrigin, sourceResolved } = reconstruction;
    const [selectedTab, setSelectedTab] = useState<"code" | "context" | "breadcrumbs" | "trace" | "gaps">("code");
    const [showFullStack, setShowFullStack] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyRawStack = () => {
        if (failure.rawStack) {
            navigator.clipboard.writeText(failure.rawStack);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Choose which chain to show: application-only by default, full when expanded
    const activeChain: CallChainStep[] = showFullStack
        ? failure.fullCallChain
        : failure.applicationCallChain;

    const hasFullStackToggle =
        failure.fullCallChain.length > failure.applicationCallChain.length &&
        failure.fullCallChain.length > 0;

    const runtimeBadge =
        runtimeOrigin === "node"
            ? { label: "Node.js", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
            : runtimeOrigin === "browser"
            ? { label: "Browser", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" }
            : null;

    return (
        <section className="halo-card p-6 border-border space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Code2 size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                                Runtime Failure &amp; Context Reconstruction
                            </h2>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                                failure.locationProvenance === "Observed"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}>
                                {failure.locationProvenance}
                            </span>
                            {runtimeBadge && (
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${runtimeBadge.color}`}>
                                    {runtimeBadge.label}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-secondary mt-0.5">
                            Reconstructed from verified telemetry{sourceResolved ? " and actual source code" : ""}.
                        </p>
                    </div>
                </div>

                {failure.rawStack && (
                    <button
                        type="button"
                        onClick={copyRawStack}
                        className="halo-btn halo-btn-sm halo-btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
                    >
                        {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copied ? "Copied Stack" : "Copy Raw Stack"}</span>
                    </button>
                )}
            </div>

            {/* Failure Banner */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-mono font-bold">
                            {failure.exceptionClass}
                        </span>
                        <span className="text-xs font-mono text-zinc-300 font-semibold truncate max-w-xl">
                            {failure.exceptionMessage || failure.exceptionTitle}
                        </span>
                    </div>
                    {failure.primaryFailingFrame?.filePath && (
                        <span className="text-xs font-mono text-muted">
                            {failure.primaryFailingFrame.filePath}
                            {failure.primaryFailingFrame.lineNumber ? `:${failure.primaryFailingFrame.lineNumber}` : ""}
                        </span>
                    )}
                </div>

                {/* Failing Location / Function / Expression */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#080b11] border border-white/5 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-muted block">Failing Location</span>
                        <span className="text-white font-mono font-medium truncate block">
                            {failure.primaryFailingFrame
                                ? `${failure.primaryFailingFrame.filePath.split("/").pop()}:${failure.primaryFailingFrame.lineNumber || "?"}`
                                : "Unavailable"}
                        </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#080b11] border border-white/5 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-muted block">Executing Function</span>
                        <span className="text-accent font-mono font-medium truncate block">
                            {failure.sourceContext?.containingFunction
                                ? `${failure.sourceContext.containingFunction}()`
                                : failure.primaryFailingFrame?.functionName || "anonymous()"}
                        </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#080b11] border border-white/5 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-muted block">Failing Expression</span>
                        {failure.failingExpression ? (
                            <span className="text-red-400 font-mono font-semibold truncate block">
                                {failure.failingExpression}
                            </span>
                        ) : (
                            <span className="text-muted font-mono text-[11px] block italic">
                                {sourceResolved ? "Expression unavailable" : "Source not resolved"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Application Call Chain */}
            {activeChain.length > 0 && (
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-zinc-300">
                            <ListTree size={15} className="text-accent" />
                            <h3 className="text-xs font-bold uppercase tracking-wider">
                                {showFullStack ? "Full Call Stack" : "Application Call Chain"}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted">
                                {activeChain.length} {showFullStack ? "frames" : "application steps"}
                            </span>
                            {hasFullStackToggle && (
                                <button
                                    type="button"
                                    onClick={() => setShowFullStack((v) => !v)}
                                    className="flex items-center gap-1 text-[11px] text-secondary hover:text-white transition-colors px-2 py-0.5 rounded border border-border/60 bg-surface-elevated"
                                >
                                    {showFullStack ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    <span>{showFullStack ? "App frames only" : "Show all frames"}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {!showFullStack && hasFullStackToggle && (
                        <p className="text-[11px] text-muted flex items-center gap-1.5">
                            <Info size={11} />
                            Showing application frames only. Runtime/framework frames are hidden.
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                        {activeChain.map((step, idx) => (
                            <React.Fragment key={step.order}>
                                <div
                                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                                        step.isFailingSite
                                            ? "bg-red-500/10 border-red-500/30 text-red-300 font-bold shadow-sm shadow-red-500/10"
                                            : CLASSIFICATION_STYLE[step.classification] || CLASSIFICATION_STYLE.Unknown
                                    }`}
                                >
                                    <span>{step.functionName}</span>
                                    {step.lineNumber && (
                                        <span className="text-[10px] text-muted opacity-80">
                                            :{step.lineNumber}
                                        </span>
                                    )}
                                    {step.isFailingSite && step.failingExpression && (
                                        <span className="text-[10px] text-red-400 border border-red-500/20 bg-red-500/10 px-1.5 rounded font-mono">
                                            → {step.failingExpression}
                                        </span>
                                    )}
                                </div>
                                {idx < activeChain.length - 1 && (
                                    <ArrowRight size={13} className="text-muted shrink-0" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto text-xs">
                <button
                    type="button"
                    onClick={() => setSelectedTab("code")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        selectedTab === "code"
                            ? "bg-surface-elevated text-white border border-border"
                            : "text-secondary hover:text-white"
                    }`}
                >
                    <FileCode size={14} />
                    <span>Source Code</span>
                </button>

                {context.request && (
                    <button
                        type="button"
                        onClick={() => setSelectedTab("context")}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            selectedTab === "context"
                                ? "bg-surface-elevated text-white border border-border"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <Globe size={14} />
                        <span>Request Context</span>
                    </button>
                )}

                {context.breadcrumbs.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSelectedTab("breadcrumbs")}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            selectedTab === "breadcrumbs"
                                ? "bg-surface-elevated text-white border border-border"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <Compass size={14} />
                        <span>Breadcrumbs ({context.breadcrumbs.length})</span>
                    </button>
                )}

                {context.spanTree && context.spanTree.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSelectedTab("trace")}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            selectedTab === "trace"
                                ? "bg-surface-elevated text-white border border-border"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <Network size={14} />
                        <span>Trace Spans</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => setSelectedTab("gaps")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                        selectedTab === "gaps"
                            ? "bg-surface-elevated text-white border border-border"
                            : "text-secondary hover:text-white"
                    }`}
                >
                    <HelpCircle size={14} />
                    <span>Telemetry Gaps ({context.telemetryGaps.length})</span>
                </button>
            </div>

            {/* Tab 1: Source Code */}
            {selectedTab === "code" && (
                <div className="space-y-4">
                    {failure.sourceContext && failure.sourceContext.lines.length > 0 ? (
                        <div className="rounded-xl bg-[#080b11] border border-white/10 overflow-hidden font-mono text-xs">
                            <div className="px-4 py-2 bg-zinc-900/90 border-b border-white/5 flex items-center justify-between text-zinc-400">
                                <div className="flex items-center gap-2 truncate">
                                    {failure.sourceContext.repositoryFullName && (
                                        <span className="text-[11px] text-zinc-300 font-semibold">
                                            {failure.sourceContext.repositoryFullName} :
                                        </span>
                                    )}
                                    <span className="text-[11px] truncate text-zinc-300">{failure.sourceContext.filePath}</span>
                                    {failure.sourceContext.failingLineNumber && (
                                        <span className="text-[11px] text-red-400 font-bold">
                                            :{failure.sourceContext.failingLineNumber}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {failure.sourceContext.revision && (
                                        <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                            commit {failure.sourceContext.revision.slice(0, 8)}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-emerald-400 font-sans font-semibold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        GitHub verified
                                    </span>
                                </div>
                            </div>
                            <div className="p-3 overflow-x-auto divide-y divide-transparent">
                                {failure.sourceContext.lines.map((line) => (
                                    <div
                                        key={line.lineNumber}
                                        className={`flex items-start gap-4 px-2 py-0.5 rounded ${
                                            line.isFailingLine
                                                ? "bg-red-500/15 border-l-2 border-red-500 text-red-200 font-bold"
                                                : "text-zinc-400 hover:bg-white/5"
                                        }`}
                                    >
                                        <span className="w-8 text-right text-muted select-none shrink-0 opacity-60">
                                            {line.lineNumber}
                                        </span>
                                        <pre className="overflow-x-auto whitespace-pre font-mono leading-relaxed">
                                            <code>{line.content}</code>
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 rounded-xl bg-surface border border-border text-center space-y-3">
                            <FileCode size={24} className="text-muted mx-auto" />
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-white">Source Unavailable</p>
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface-elevated border border-border text-secondary">
                                    <span>Status:</span>
                                    <span className="text-white font-bold">{failure.sourceContext?.resolutionStatus || "not_resolved"}</span>
                                </div>
                            </div>
                            <p className="text-xs text-secondary max-w-lg mx-auto leading-relaxed">
                                {failure.sourceContext?.unavailabilityReason ||
                                    (failure.primaryFailingFrame?.filePath
                                        ? `The file \`${failure.primaryFailingFrame.filePath}\` could not be retrieved. Connect a GitHub repository in Project Settings to enable remote source resolution.`
                                        : "No file path was recorded in the stack frame.")}
                            </p>
                            <div className="pt-3 flex flex-col items-center gap-2 border-t border-border/40 max-w-md mx-auto">
                                <p className="text-[11px] text-muted">
                                    Link your GitHub repository to enable commit-aware source resolution and AST line inspection.
                                </p>
                                <Link
                                    href={projectId ? `/projects/${projectId}/settings` : `/settings/project`}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-semibold transition-colors shadow-sm"
                                >
                                    <GitBranch size={13} />
                                    <span>Connect your GitHub repository here</span>
                                    <ExternalLink size={12} className="opacity-70 ml-0.5" />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 2: Request Context */}
            {selectedTab === "context" && context.request && (
                <div className="p-4 rounded-xl bg-surface border border-border space-y-4 text-xs font-mono">
                    {/* Correlation badge */}
                    <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                        <span className="text-[10px] text-muted font-sans uppercase">Correlation:</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                            CORRELATION_BASIS_STYLE[context.request.correlationBasis] || CORRELATION_BASIS_STYLE.Temporal
                        }`}>
                            {context.request.correlationBasis}
                        </span>
                        <span className="text-[10px] text-muted font-sans">{context.request.correlationExplanation}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <span className="text-muted uppercase text-[10px] block">Method &amp; Route</span>
                            <span className="text-white font-bold">{context.request.method} {context.request.routePath}</span>
                        </div>
                        <div>
                            <span className="text-muted uppercase text-[10px] block">Status</span>
                            <span className={String(context.request.status || "").startsWith("5") ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                                {context.request.status || "N/A"}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted uppercase text-[10px] block">Duration</span>
                            <span className="text-white">{context.request.durationMs ? `${context.request.durationMs}ms` : "N/A"}</span>
                        </div>
                        <div>
                            <span className="text-muted uppercase text-[10px] block">Request ID</span>
                            <span className="text-accent truncate block">{context.request.requestId || "N/A"}</span>
                        </div>
                    </div>

                    {context.request.headers && Object.keys(context.request.headers).length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-border/60">
                            <span className="text-[10px] uppercase text-muted font-sans font-semibold">Safe Headers (Redacted)</span>
                            <div className="p-2.5 rounded-lg bg-[#080b11] border border-white/5 space-y-1 text-[11px]">
                                {Object.entries(context.request.headers).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between">
                                        <span className="text-zinc-400">{k}:</span>
                                        <span className="text-zinc-200">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Breadcrumbs */}
            {selectedTab === "breadcrumbs" && context.breadcrumbs.length > 0 && (
                <div className="space-y-2">
                    <div className="divide-y divide-border/60 rounded-xl bg-surface border border-border overflow-hidden">
                        {context.breadcrumbs.map((b, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="px-2 py-0.5 rounded bg-[#080b11] border border-white/5 font-mono text-[10px] text-accent uppercase font-bold shrink-0">
                                        {b.category}
                                    </span>
                                    <span className="text-zinc-200 truncate font-mono text-[11px]">
                                        {b.message}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] px-1 py-0.5 rounded border font-mono ${
                                        CORRELATION_BASIS_STYLE[b.provenance === "Observed" ? "Anchor" : "Temporal"]
                                    }`}>
                                        {b.provenance}
                                    </span>
                                    <span className="text-[10px] font-mono text-muted">{b.timeOffsetFormatted}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 4: Trace Spans */}
            {selectedTab === "trace" && context.spanTree && context.spanTree.length > 0 && (
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="divide-y divide-border/60 rounded-lg bg-[#080b11] border border-white/5 overflow-hidden">
                        {context.spanTree.map((span) => (
                            <div key={span.id} className="p-3 flex items-center justify-between gap-3 text-xs font-mono">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${span.isFailingSpan ? "bg-red-400" : "bg-emerald-400"}`} />
                                    <span className="text-white font-semibold">{span.name}</span>
                                    {span.service && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-zinc-400">
                                            {span.service}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {span.durationMs && <span className="text-zinc-400">{span.durationMs}ms</span>}
                                    {span.status && <span className="text-muted">{span.status}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 5: Telemetry Gaps */}
            {selectedTab === "gaps" && (
                <div className="space-y-3">
                    {context.telemetryGaps.length === 0 ? (
                        <div className="p-6 rounded-xl bg-surface border border-border text-center space-y-2">
                            <CheckCircle2 size={22} className="text-emerald-400 mx-auto" />
                            <p className="text-xs font-semibold text-white">No material telemetry gaps detected</p>
                            <p className="text-xs text-secondary">
                                Available evidence is sufficient for the current investigation conclusions.
                            </p>
                        </div>
                    ) : (
                        context.telemetryGaps.map((gap, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-surface border border-amber-500/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-amber-400">
                                        <AlertCircle size={14} />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                            {gap.missingSignal}
                                        </h4>
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        Material Gap
                                    </span>
                                </div>
                                <p className="text-xs text-secondary leading-relaxed">
                                    <strong>Why it matters:</strong> {gap.whyItMatters}
                                </p>
                                <p className="text-xs text-secondary leading-relaxed">
                                    <strong>Impact on conclusion:</strong> {gap.impactOnConclusion}
                                </p>
                                <div className="p-2.5 rounded-lg bg-[#080b11] border border-white/5 text-xs text-zinc-300 font-mono flex items-start gap-2">
                                    <span className="text-accent font-bold text-[10px] uppercase">Action:</span>
                                    <span>{gap.howToCollect}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </section>
    );
}
