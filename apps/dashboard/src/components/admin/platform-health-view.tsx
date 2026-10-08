"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    Activity,
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    RefreshCw,
    Database,
    Zap,
    Cpu,
    GitBranch,
    Video,
    Clock,
} from "lucide-react";
import {
    getPlatformHealthAction,
    runDataIntegrityDiagnosticAction,
} from "@/actions/platform-diagnostics";
import type { PlatformHealthSummary, SubsystemName } from "@/lib/observability/platform-health";
import type { DiagnosticReport } from "@/lib/integrity/diagnostic-engine";

interface PlatformHealthViewProps {
    organizationId?: string;
    canRunIntegrityAudit?: boolean;
}

const SUBSYSTEM_ICONS: Record<SubsystemName, React.ComponentType<{ size?: number; className?: string }>> = {
    INGESTION: Zap,
    DATABASE: Database,
    ANALYSIS: Cpu,
    INTEGRATIONS: GitBranch,
    REPLAY: Video,
    BACKGROUND_JOBS: Clock,
};

export function PlatformHealthView({
    organizationId,
    canRunIntegrityAudit = true,
}: PlatformHealthViewProps) {
    const [health, setHealth] = useState<PlatformHealthSummary | null>(null);
    const [auditReport, setAuditReport] = useState<DiagnosticReport | null>(null);
    const [isLoadingHealth, setIsLoadingHealth] = useState(true);
    const [isAuditing, startAuditing] = useTransition();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const refreshHealth = async () => {
        setIsLoadingHealth(true);
        setErrorMessage(null);
        try {
            const summary = await getPlatformHealthAction();
            setHealth(summary);
        } catch (err: any) {
            setErrorMessage(err.message || "Failed to load platform health.");
        } finally {
            setIsLoadingHealth(false);
        }
    };

    useEffect(() => {
        refreshHealth();
    }, []);

    const handleRunDiagnostic = () => {
        if (!organizationId) return;
        setErrorMessage(null);
        startAuditing(async () => {
            try {
                const report = await runDataIntegrityDiagnosticAction(organizationId);
                setAuditReport(report);
            } catch (err: any) {
                setErrorMessage(err.message || "Failed to execute integrity diagnostic.");
            }
        });
    };

    return (
        <div className="space-y-6 font-mono text-xs">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1e2638] bg-[#0c1017] p-5 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <Activity className="text-blue-400" size={18} />
                        <h1 className="text-base font-semibold tracking-wide text-slate-100">
                            Platform Health & System Hardening
                        </h1>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Pillar K operational diagnostics, internal pipeline telemetry, and read-only cross-pillar database consistency checks.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={refreshHealth}
                        disabled={isLoadingHealth}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2b354d] bg-[#141b2a] px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-[#1a2337] disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={isLoadingHealth ? "animate-spin" : ""} />
                        <span>Refresh Telemetry</span>
                    </button>

                    {organizationId && canRunIntegrityAudit && (
                        <button
                            type="button"
                            onClick={handleRunDiagnostic}
                            disabled={isAuditing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                        >
                            <ShieldAlert size={13} className={isAuditing ? "animate-pulse" : ""} />
                            <span>{isAuditing ? "Auditing Database..." : "Run Read-Only Diagnostic"}</span>
                        </button>
                    )}
                </div>
            </div>

            {errorMessage && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">
                    <p className="font-semibold">Diagnostic Error:</p>
                    <p className="mt-0.5 text-[11px]">{errorMessage}</p>
                </div>
            )}

            {/* Overall Status Banner */}
            {health && (
                <div
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                        health.overallStatus === "HEALTHY"
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : health.overallStatus === "DEGRADED" || health.overallStatus === "PARTIAL"
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
                            : "border-rose-500/30 bg-rose-500/5 text-rose-300"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        {health.overallStatus === "HEALTHY" ? (
                            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                        ) : health.overallStatus === "DEGRADED" || health.overallStatus === "PARTIAL" ? (
                            <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                        ) : (
                            <XCircle size={20} className="text-rose-400 shrink-0" />
                        )}
                        <div>
                            <span className="text-sm font-semibold tracking-wide">
                                Overall Status: {health.overallStatus}
                            </span>
                            <p className="text-[11px] opacity-80">
                                Last verified: {new Date(health.checkedAt).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>

                    {health.activeWarnings.length > 0 && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            {health.activeWarnings.length} Active Warnings
                        </span>
                    )}
                </div>
            )}

            {/* Subsystem Health Cards Grid */}
            {health && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.values(health.subsystems).map((sub) => {
                        const Icon = SUBSYSTEM_ICONS[sub.subsystem] || Activity;
                        return (
                            <div
                                key={sub.subsystem}
                                className="flex flex-col justify-between rounded-xl border border-[#1e2638] bg-[#0c1017] p-4 transition-colors hover:border-[#2b354d]"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-200">
                                            <Icon size={15} className="text-blue-400" />
                                            <span className="font-semibold">{sub.subsystem}</span>
                                        </div>
                                        <span
                                            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                                                sub.status === "HEALTHY"
                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                                    : sub.status === "DEGRADED" || sub.status === "PARTIAL"
                                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                            }`}
                                        >
                                            {sub.status}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                                        {sub.details}
                                    </p>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-[#1e2638]/60 pt-2.5 text-[10px] text-slate-400">
                                    <span>p95: {sub.latencyP95Ms}ms</span>
                                    <span>err: {(sub.errorRate * 100).toFixed(1)}%</span>
                                    <span>ops: {sub.totalOperations}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Data Integrity Audit Report (Read-Only) */}
            {auditReport && (
                <div className="rounded-xl border border-[#1e2638] bg-[#0c1017] p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#1e2638]/60 pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="text-blue-400" size={16} />
                            <h2 className="text-sm font-semibold tracking-wide text-slate-200">
                                Database Integrity Diagnostic Report
                            </h2>
                        </div>
                        <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                                auditReport.isConsistent
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            }`}
                        >
                            {auditReport.isConsistent ? "CONSISTENT" : `${auditReport.totalAnomalies} ANOMALIES`}
                        </span>
                    </div>

                    <p className="mt-3 text-[11px] text-slate-300">{auditReport.summary}</p>

                    {auditReport.anomalies.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-[11px] font-medium text-slate-400">Detected Issues (Read-Only Audit):</p>
                            <div className="space-y-1.5">
                                {auditReport.anomalies.map((anom) => (
                                    <div
                                        key={anom.id}
                                        className="flex items-start justify-between rounded border border-rose-500/20 bg-rose-500/5 p-2 text-[11px] text-rose-300"
                                    >
                                        <div>
                                            <span className="font-semibold">[{anom.rule}]</span>{" "}
                                            <span>{anom.entityType}:{anom.entityId}</span> —{" "}
                                            <span className="text-slate-300">{anom.description}</span>
                                        </div>
                                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                                            {anom.severity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
