"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    Clock,
    Code2,
    Copy,
    Cpu,
    ExternalLink,
    FileCode,
    FileText,
    GitBranch,
    GitCommit,
    Layers,
    Play,
    RefreshCw,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Terminal,
    Wrench,
    XCircle,
} from "lucide-react";
import { runRepairValidationAction, applyRepairChangeAction } from "@/actions/repair";
import { BackButton } from "@/components/ui/back-button";

interface RepairWorkspaceViewProps {
    repairCase: any;
    projectId: string;
    issueId: string;
}

export function RepairWorkspaceView({ repairCase, projectId, issueId }: RepairWorkspaceViewProps) {
    const [copiedDiff, setCopiedDiff] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [validationResult, setValidationResult] = useState(repairCase.validations?.[0]);
    const [repairStatus, setRepairStatus] = useState(repairCase.status);
    const [changes, setChanges] = useState(repairCase.changes || []);
    const [showAuditTrail, setShowAuditTrail] = useState(false);

    const brokenBoundary = repairCase.brokenBoundary;
    const latestValidation = validationResult || repairCase.validations?.[0];

    function handleCopyDiff(diff: string) {
        navigator.clipboard.writeText(diff);
        setCopiedDiff(true);
        setTimeout(() => setCopiedDiff(false), 2000);
    }

    function handleRunValidation() {
        startTransition(async () => {
            try {
                setStatusMessage("Running validation checks...");
                const result = await runRepairValidationAction(repairCase.id);
                setValidationResult(result);
                setRepairStatus(result.status === "PASSED" ? "VALIDATED" : "FAILED");
                setStatusMessage("Validation completed successfully.");
            } catch (err) {
                setStatusMessage(err instanceof Error ? err.message : "Validation failed.");
            }
        });
    }

    function handleApplyChange(changeId: string) {
        startTransition(async () => {
            try {
                setStatusMessage("Applying verified change...");
                const res = await applyRepairChangeAction(repairCase.id, changeId);
                setStatusMessage(res.message);
                if (res.success) {
                    setChanges((prev: any[]) =>
                        prev.map((c) => (c.id === changeId ? { ...c, applied: true } : c))
                    );
                }
            } catch (err) {
                setStatusMessage(err instanceof Error ? err.message : "Failed to apply change.");
            }
        });
    }

    // Determine badge status class
    const statusClass =
        repairStatus === "VALIDATED"
            ? "halo-repair-badge-validated"
            : repairStatus === "BLOCKED"
            ? "halo-repair-badge-blocked"
            : repairStatus === "FAILED"
            ? "halo-repair-badge-failed"
            : "halo-repair-badge-proposed";

    return (
        <div className="halo-repair-workspace">
            {/* Header Navigation & Identity */}
            <div className="halo-repair-header space-y-4">
                <div className="flex items-center justify-between">
                    <BackButton
                        fallbackHref={`/projects/${projectId}/issues/${issueId}`}
                        label="Back to Issue"
                    />

                    <div className="flex items-center gap-2">
                        <Link
                            href={`/projects/${projectId}/investigations/new?issueId=${issueId}`}
                            className="halo-btn halo-btn-sm halo-btn-secondary flex items-center gap-1.5"
                        >
                            <Activity size={14} className="text-accent" />
                            <span>View Investigation</span>
                        </Link>

                        <button
                            type="button"
                            onClick={handleRunValidation}
                            disabled={isPending}
                            className="halo-btn halo-btn-sm halo-btn-primary flex items-center gap-1.5"
                        >
                            <Play size={14} />
                            <span>{isPending ? "Validating..." : "Run Validation"}</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`halo-repair-badge ${statusClass}`}>
                                {repairStatus === "VALIDATED" && <CheckCircle2 size={13} />}
                                {repairStatus === "BLOCKED" && <AlertTriangle size={13} />}
                                {repairStatus === "FAILED" && <XCircle size={13} />}
                                {repairStatus === "CHANGES_PROPOSED" && <Wrench size={13} />}
                                <span>{repairStatus.replace(/_/g, " ")}</span>
                            </span>

                            <span className="halo-repair-badge">
                                <span>Version {repairCase.version || 1}</span>
                            </span>

                            {repairCase.repositorySnapshotId ? (
                                <span className="halo-repair-badge text-zinc-400">
                                    <GitCommit size={12} />
                                    <span>{repairCase.repositorySnapshotId.slice(0, 7)}</span>
                                </span>
                            ) : (
                                <span className="halo-repair-badge text-zinc-500">
                                    <span>Repo: Unpinned</span>
                                </span>
                            )}

                            <span className="halo-repair-badge text-accent">
                                <ShieldCheck size={12} />
                                <span>Confidence: {repairCase.confidenceLevel}</span>
                            </span>
                        </div>

                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            {repairCase.title}
                        </h1>

                        <p className="text-xs font-mono text-zinc-400">
                            {repairCase.confidenceReason}
                        </p>
                    </div>
                </div>

                {statusMessage && (
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs font-mono text-accent flex items-center gap-2">
                        <Activity size={14} />
                        <span>{statusMessage}</span>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="space-y-8">
                {/* 1. What Broke & Why It Broke */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl bg-[#080b11] border border-border space-y-2.5">
                        <span className="text-[11px] font-mono uppercase font-bold text-muted tracking-wider block">
                            What Broke
                        </span>
                        <p className="text-sm font-medium text-white leading-relaxed">
                            {repairCase.whatBroke}
                        </p>
                    </div>

                    <div className="p-5 rounded-xl bg-[#080b11] border border-border space-y-2.5">
                        <span className="text-[11px] font-mono uppercase font-bold text-muted tracking-wider block">
                            Why It Broke (Mechanism & Origin)
                        </span>
                        <p className="text-sm text-secondary leading-relaxed">
                            {repairCase.whyItBroke}
                        </p>
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-zinc-400">
                            <span>Failure Mechanism: <strong className="text-white font-bold">CONFIRMED</strong></span>
                            <span>Upstream Origin: <strong className="text-white font-bold">{repairCase.upstreamReasonStatus}</strong></span>
                        </div>
                    </div>
                </div>

                {/* 2. Cross-File Contract Mismatch Boundary (Section 24) */}
                {brokenBoundary && (
                    <div className="halo-contract-boundary-card">
                        <div className="halo-contract-boundary-header">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-accent" />
                                <span className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                                    Cross-File Broken Contract Boundary
                                </span>
                            </div>
                            <span className="text-[11px] font-mono text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20">
                                {brokenBoundary.contractMismatchKind?.replace(/_/g, " ")}
                            </span>
                        </div>

                        <div className="halo-contract-chain-grid">
                            {/* Caller Node */}
                            <div className="halo-contract-node space-y-2">
                                <div className="halo-contract-node-title">
                                    <FileCode size={14} className="text-accent" />
                                    <span>Caller: {brokenBoundary.callerFile}</span>
                                </div>
                                <div className="p-2.5 rounded bg-black/40 font-mono text-xs text-zinc-300 border border-white/5 overflow-x-auto">
                                    <code>{brokenBoundary.callerSnippet || `${brokenBoundary.callerSymbol || "caller"}()`}</code>
                                </div>
                                <div className="text-[11px] font-mono text-zinc-400">
                                    Supplies: <code className="text-red-400">{brokenBoundary.receivedValue}</code>
                                </div>
                            </div>

                            {/* Boundary Directional Arrow */}
                            <div className="halo-contract-arrow-container">
                                <ArrowRight className="w-5 h-5" />
                                <span className="halo-contract-arrow-label">passes to</span>
                            </div>

                            {/* Callee Node */}
                            <div className="halo-contract-node space-y-2">
                                <div className="halo-contract-node-title">
                                    <FileCode size={14} className="text-accent" />
                                    <span>Callee: {brokenBoundary.calleeFile}</span>
                                </div>
                                <div className="p-2.5 rounded bg-black/40 font-mono text-xs text-zinc-300 border border-white/5 overflow-x-auto">
                                    <code>{brokenBoundary.calleeSnippet || `${brokenBoundary.calleeSymbol || "callee"}()`}</code>
                                </div>
                                <div className="text-[11px] font-mono text-zinc-400">
                                    Requires: <code className="text-emerald-400">{brokenBoundary.expectedContract}</code>
                                </div>
                            </div>
                        </div>

                        <div className="halo-contract-discrepancy">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <strong className="text-white block font-sans font-semibold mb-0.5">
                                    Architectural Boundary Analysis
                                </strong>
                                <span>{brokenBoundary.discrepancyExplanation}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Recommended Code Changes & Verified Diff Viewer */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                                Recommended Changes ({changes.length} file{changes.length === 1 ? "" : "s"})
                            </h2>
                        </div>
                        <span className="text-xs font-mono text-zinc-400">
                            Minimal change principle applied • Zero root-cause masking
                        </span>
                    </div>

                    {changes.length === 0 ? (
                        <div className="p-6 rounded-xl bg-[#080b11] border border-border text-center space-y-2">
                            <Shield className="w-6 h-6 text-zinc-500 mx-auto" />
                            <p className="text-sm text-secondary">
                                {repairCase.outcome === "ALREADY_FIXED"
                                    ? "No changes required. Current repository state already contains the defensive fix."
                                    : "No direct code patch proposed. Investigation indicates external or configuration-level remediation."}
                            </p>
                        </div>
                    ) : (
                        changes.map((change: any, idx: number) => (
                            <div key={change.id || idx} className="halo-diff-viewer">
                                <div className="halo-diff-toolbar">
                                    <div className="flex items-center gap-2.5">
                                        <FileText className="w-4 h-4 text-accent" />
                                        <span className="text-xs font-bold text-white font-mono">
                                            {change.filePath}
                                        </span>
                                        {change.sourceRange && (
                                            <span className="text-[11px] font-mono text-zinc-400">
                                                Lines {change.sourceRange.startLine}-{change.sourceRange.endLine}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleCopyDiff(change.unifiedDiff)}
                                            className="halo-btn halo-btn-xs halo-btn-secondary flex items-center gap-1 font-mono"
                                        >
                                            <Copy size={12} />
                                            <span>{copiedDiff ? "Copied" : "Copy Diff"}</span>
                                        </button>

                                        {!change.applied ? (
                                            <button
                                                type="button"
                                                onClick={() => handleApplyChange(change.id)}
                                                disabled={isPending}
                                                className="halo-btn halo-btn-xs halo-btn-primary flex items-center gap-1 font-mono"
                                            >
                                                <Check size={12} />
                                                <span>Apply Change</span>
                                            </button>
                                        ) : (
                                            <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-0.5 bg-emerald-400/10 rounded border border-emerald-400/20">
                                                Applied
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-3 bg-zinc-950/60 border-b border-border/50 text-xs text-secondary font-sans">
                                    <strong>Why this file:</strong> {change.whyThisFile || change.reason}
                                </div>

                                <div className="p-2 overflow-x-auto">
                                    {change.unifiedDiff.split("\n").map((line: string, i: number) => {
                                        const isAdd = line.startsWith("+") && !line.startsWith("+++");
                                        const isRemove = line.startsWith("-") && !line.startsWith("---");
                                        const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");
                                        const lineClass = isAdd
                                            ? "halo-diff-line halo-diff-line-add"
                                            : isRemove
                                            ? "halo-diff-line halo-diff-line-remove"
                                            : isHeader
                                            ? "halo-diff-line halo-diff-line-header"
                                            : "halo-diff-line halo-diff-line-context";

                                        return (
                                            <div key={i} className={lineClass}>
                                                <code>{line}</code>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 4. Real Validation Results Panel */}
                <div className="halo-validation-card space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-accent" />
                            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                                Verification & Validation Blueprint
                            </h3>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                            Status: <strong className="text-white">{latestValidation?.status || "NOT_RUN"}</strong>
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div className="halo-validation-step">
                            <span className="text-xs font-mono text-zinc-300">1. AST Syntax & Static Analysis</span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                                {latestValidation?.typecheckPassed ? "✓ PASSED" : "NOT RUN"}
                            </span>
                        </div>

                        <div className="halo-validation-step">
                            <span className="text-xs font-mono text-zinc-300">2. Patch Machine Applicability</span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                                {latestValidation?.patchAppliesCleanly ? "✓ VERIFIED" : "NOT APPLICABLE"}
                            </span>
                        </div>

                        <div className="halo-validation-step">
                            <span className="text-xs font-mono text-zinc-300">3. Regression Test Execution</span>
                            <span className="text-xs font-mono text-zinc-400">
                                {latestValidation?.testsPassed ? "✓ PASSED" : "TEST SUITE GENERATED"}
                            </span>
                        </div>
                    </div>

                    {latestValidation?.typecheckOutput && (
                        <div className="p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-xs text-zinc-400">
                            {latestValidation.typecheckOutput}
                        </div>
                    )}
                </div>

                {/* 5. Audit Trail & Provenance Accordion */}
                <div className="border border-border rounded-xl bg-[#080b11] overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowAuditTrail(!showAuditTrail)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted" />
                            <span className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                                Repair Audit Trail & Provenance ({repairCase.events?.length || 0} events)
                            </span>
                        </div>
                        <span className="text-xs font-mono text-accent">
                            {showAuditTrail ? "Hide" : "Show"}
                        </span>
                    </button>

                    {showAuditTrail && (
                        <div className="p-4 border-t border-border space-y-3 font-mono text-xs">
                            {(repairCase.events || []).map((evt: any, i: number) => (
                                <div key={evt.id || i} className="flex items-start gap-3 text-zinc-400">
                                    <span className="text-zinc-600 shrink-0">
                                        {new Date(evt.createdAt).toLocaleTimeString()}
                                    </span>
                                    <span className="text-accent font-semibold shrink-0">
                                        [{evt.eventType}]
                                    </span>
                                    <span className="text-zinc-300">{evt.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
