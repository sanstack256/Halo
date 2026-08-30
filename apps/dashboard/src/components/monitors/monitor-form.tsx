"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    ArrowLeft,
    BellRing,
    CheckCircle2,
    Clock,
    FolderKanban,
    Globe,
    HelpCircle,
    Loader2,
    Plus,
    Radio,
    Save,
    ShieldAlert,
    Smartphone,
    Sparkles,
} from "lucide-react";
import { createMonitor, updateMonitor, type OrgMonitor } from "@/actions/monitor";
import type { MonitorType, MonitorSeverity } from "@/generated/prisma/client";

interface ProjectOption {
    id: string;
    name: string;
}

interface MonitorFormProps {
    projects: ProjectOption[];
    initialData?: OrgMonitor;
    initialProjectId?: string;
    initialType?: MonitorType;
    onSuccess?: (monitor: OrgMonitor) => void;
    onCancel?: () => void;
    isModal?: boolean;
}

const MONITOR_TYPES: {
    type: MonitorType;
    label: string;
    tagline: string;
    description: string;
    triggerCondition: string;
    dataRequired: string;
    icon: any;
}[] = [
    {
        type: "ERROR",
        label: "Error Spike & Crash Monitor",
        tagline: "Track error bursts and fatal exceptions",
        description: "Monitors real-time telemetry events and triggers when error frequency exceeds a specified volume within a rolling window.",
        triggerCondition: "Error occurrences >= Threshold count within rolling window",
        dataRequired: "Application error events, exceptions, or trace logs",
        icon: BellRing,
    },
    {
        type: "METRIC",
        label: "Metric & Latency Anomaly",
        tagline: "Detect slow API responses and resource spikes",
        description: "Evaluates service performance metrics (P95/P99 latency, request rates, execution duration) against baseline thresholds.",
        triggerCondition: "Aggregated metric value > Threshold value (ms/count)",
        dataRequired: "Trace durations, span metadata, or telemetry metrics",
        icon: Activity,
    },
    {
        type: "CRON",
        label: "Cron & Scheduled Task Monitor",
        tagline: "Ensure background jobs execute on time",
        description: "Monitors periodic jobs and background workers, alerting immediately if a scheduled execution misses its expected heartbeat.",
        triggerCondition: "Job execution fails to check in within schedule + grace period",
        dataRequired: "Cron schedule expression & task check-ins",
        icon: Clock,
    },
    {
        type: "UPTIME",
        label: "Endpoint Uptime & Synthetic Probe",
        tagline: "Monitor HTTP endpoint availability worldwide",
        description: "Performs continuous HTTP/HTTPS availability checks against your public or private endpoints and validates response status codes.",
        triggerCondition: "Probe response status != 200 or timeout exceeded",
        dataRequired: "Target HTTP/HTTPS URL endpoint",
        icon: Globe,
    },
    {
        type: "MOBILE_BUILD",
        label: "Mobile Build & Crash-Free Session",
        tagline: "Track release stability and mobile regressions",
        description: "Monitors mobile application releases and alerts when crash-free session ratios fall below production stability targets.",
        triggerCondition: "Crash-free session percentage < Target stability threshold",
        dataRequired: "Mobile SDK telemetry sessions and crash reports",
        icon: Smartphone,
    },
];

export function MonitorForm({
    projects,
    initialData,
    initialProjectId,
    initialType,
    onSuccess,
    onCancel,
    isModal = false,
}: MonitorFormProps) {
    const router = useRouter();
    const isEdit = Boolean(initialData);

    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Form fields
    const [projectId, setProjectId] = useState<string>(
        initialData?.projectId || initialProjectId || projects[0]?.id || ""
    );
    const [name, setName] = useState<string>(initialData?.name || "");
    const [description, setDescription] = useState<string>(initialData?.description || "");
    const [type, setType] = useState<MonitorType>(initialData?.type || initialType || "ERROR");
    const [severity, setSeverity] = useState<MonitorSeverity>(initialData?.severity || "ERROR");

    // Dynamic criteria fields
    const [thresholdValue, setThresholdValue] = useState<string>(
        initialData?.thresholdValue !== null && initialData?.thresholdValue !== undefined
            ? String(initialData.thresholdValue)
            : "5"
    );
    const [thresholdWindow, setThresholdWindow] = useState<string>(
        initialData?.thresholdWindow !== null && initialData?.thresholdWindow !== undefined
            ? String(initialData.thresholdWindow)
            : "10"
    );
    const [query, setQuery] = useState<string>(initialData?.query || "");
    const [cronSchedule, setCronSchedule] = useState<string>(
        initialData?.cronSchedule || "*/15 * * * *"
    );
    const [endpointUrl, setEndpointUrl] = useState<string>(
        initialData?.endpointUrl || "https://"
    );

    // Alert routing fields
    const [webhookUrl, setWebhookUrl] = useState<string>(
        initialData?.alertConfig?.webhookUrl || ""
    );
    const [notifyEmail, setNotifyEmail] = useState<boolean>(
        initialData?.alertConfig?.notifyEmail ?? true
    );

    // Inline validation errors
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const selectedTypeConfig = MONITOR_TYPES.find((t) => t.type === type) || MONITOR_TYPES[0];
    const selectedProjectObj = projects.find((p) => p.id === projectId);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!name.trim()) {
            errors.name = "Monitor name is required.";
        } else if (name.trim().length < 3) {
            errors.name = "Monitor name must be at least 3 characters.";
        }

        if (!projectId) {
            errors.projectId = "Please select a project.";
        }

        if (type === "ERROR" || type === "METRIC" || type === "MOBILE_BUILD") {
            const val = parseFloat(thresholdValue);
            if (isNaN(val) || val <= 0) {
                errors.thresholdValue = "Threshold value must be a positive number.";
            }
        }

        if (type === "ERROR" || type === "METRIC") {
            const win = parseInt(thresholdWindow, 10);
            if (isNaN(win) || win < 1 || win > 1440) {
                errors.thresholdWindow = "Window must be between 1 and 1440 minutes.";
            }
        }

        if (type === "UPTIME") {
            if (!endpointUrl.trim() || endpointUrl.trim() === "https://" || endpointUrl.trim() === "http://") {
                errors.endpointUrl = "A valid HTTP/HTTPS endpoint URL is required.";
            } else {
                try {
                    new URL(endpointUrl.trim());
                } catch {
                    errors.endpointUrl = "Please enter a valid URL (e.g. https://api.myproject.com/health).";
                }
            }
        }

        if (type === "CRON") {
            if (!cronSchedule.trim()) {
                errors.cronSchedule = "Cron schedule expression is required.";
            } else {
                const parts = cronSchedule.trim().split(/\s+/);
                if (parts.length < 5) {
                    errors.cronSchedule = "Invalid cron format (expected 5 fields, e.g. '*/15 * * * *').";
                }
            }
        }

        if (webhookUrl.trim()) {
            try {
                new URL(webhookUrl.trim());
            } catch {
                errors.webhookUrl = "Webhook must be a valid URL starting with http:// or https://.";
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        const alertConfig = {
            notifyEmail,
            webhookUrl: webhookUrl.trim() || undefined,
        };

        const payload = {
            name: name.trim(),
            description: description.trim() || undefined,
            type,
            severity,
            projectId,
            thresholdValue: thresholdValue ? parseFloat(thresholdValue) : undefined,
            thresholdWindow: thresholdWindow ? parseInt(thresholdWindow, 10) : undefined,
            query: query.trim() || undefined,
            cronSchedule: type === "CRON" ? cronSchedule.trim() : undefined,
            endpointUrl: type === "UPTIME" ? endpointUrl.trim() : undefined,
            alertConfig,
        };

        try {
            let result: OrgMonitor;
            if (isEdit && initialData) {
                result = await updateMonitor(initialData.id, payload);
            } else {
                result = await createMonitor(payload);
            }

            if (onSuccess) {
                onSuccess(result);
            } else {
                router.push(`/monitors/${result.id}`);
                router.refresh();
            }
        } catch (err: any) {
            setServerError(err.message || "Failed to save monitor.");
            setLoading(false);
        }
    };

    if (projects.length === 0) {
        return (
            <div className="p-12 text-center rounded-2xl bg-surface border border-border space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto">
                    <FolderKanban size={24} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                        No projects available
                    </h3>
                    <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto mt-1">
                        You need at least one project before configuring monitors. Create a project first to get started.
                    </p>
                </div>
                <div>
                    <Link href="/projects" className="halo-btn halo-btn-primary halo-btn-sm">
                        <Plus size={14} />
                        <span>Create Project</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 font-mono text-xs max-w-4xl">
            {/* Page Header if standalone */}
            {!isModal && (
                <div>
                    <Link
                        href="/monitors"
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4 transition-colors font-mono"
                    >
                        <ArrowLeft size={13} />
                        <span>Back to All Monitors</span>
                    </Link>

                    <div className="halo-page-header border-b border-border pb-6">
                        <h1 className="halo-page-title">
                            {isEdit ? "Edit Monitor Configuration" : "Configure New Monitor"}
                        </h1>
                        <p className="halo-page-description mt-1">
                            Set up automated anomaly detection, threshold limits, and notification alerts.
                        </p>
                    </div>
                </div>
            )}

            {serverError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <ShieldAlert size={16} className="shrink-0" />
                    <span>{serverError}</span>
                </div>
            )}

            {/* STEP 1: Monitor Type Selection */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                            1. Select Monitor Type
                        </h3>
                        <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                            Choose the kind of observability telemetry or synthetic check to evaluate.
                        </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold">
                        {selectedTypeConfig.label}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MONITOR_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isSelected = type === t.type;

                        return (
                            <button
                                key={t.type}
                                type="button"
                                onClick={() => {
                                    setType(t.type);
                                    setFieldErrors({});
                                }}
                                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                                    isSelected
                                        ? "bg-accent/10 border-accent text-white shadow-lg shadow-accent/5"
                                        : "bg-[#080b11] border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                                }`}
                            >
                                <div
                                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                        isSelected ? "bg-accent text-white" : "bg-white/5 text-zinc-400"
                                    }`}
                                >
                                    <Icon size={16} />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <div className="font-semibold text-xs text-white flex items-center gap-2">
                                        <span>{t.label}</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 font-sans leading-tight">
                                        {t.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* STEP 2: General Identification & Project Association */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans border-b border-border pb-3">
                    2. Monitor Identity & Target Scope
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Project Selection */}
                    <div>
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                            Associated Project *
                        </label>
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            className="halo-select w-full"
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.projectId && (
                            <p className="text-red-400 text-[11px] mt-1">{fieldErrors.projectId}</p>
                        )}
                    </div>

                    {/* Alert Severity */}
                    <div>
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                            Incident Severity Tier
                        </label>
                        <select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as MonitorSeverity)}
                            className="halo-select w-full"
                        >
                            <option value="FATAL">FATAL (Urgent / P0 page)</option>
                            <option value="ERROR">ERROR (Production Error / P1)</option>
                            <option value="WARNING">WARNING (Degraded Performance / P2)</option>
                            <option value="INFO">INFO (Informational Tracking / P3)</option>
                        </select>
                    </div>

                    {/* Name */}
                    <div className="sm:col-span-2">
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                            Monitor Display Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (fieldErrors.name) {
                                    setFieldErrors((prev) => ({ ...prev, name: "" }));
                                }
                            }}
                            placeholder="e.g., Payment Gateway Exception Burst"
                            className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent"
                        />
                        {fieldErrors.name && (
                            <p className="text-red-400 text-[11px] mt-1">{fieldErrors.name}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="sm:col-span-2">
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                            Context & Runbook Notes (Optional)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief context on expected failure modes and remediation steps."
                            className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent"
                        />
                    </div>
                </div>
            </div>

            {/* STEP 3: Type-Specific Evaluation Rules */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                <div className="border-b border-border pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
                        3. Trigger Conditions & Thresholds
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                        {selectedTypeConfig.triggerCondition}
                    </p>
                </div>

                {type === "ERROR" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                    Trigger when error count exceeds (&gt;=)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={thresholdValue}
                                        onChange={(e) => setThresholdValue(e.target.value)}
                                        className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white focus:outline-none focus:border-accent"
                                    />
                                    <span className="text-zinc-400 shrink-0">events</span>
                                </div>
                                {fieldErrors.thresholdValue && (
                                    <p className="text-red-400 text-[11px] mt-1">{fieldErrors.thresholdValue}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                    Within rolling time window
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={thresholdWindow}
                                        onChange={(e) => setThresholdWindow(e.target.value)}
                                        className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white focus:outline-none focus:border-accent"
                                    />
                                    <span className="text-zinc-400 shrink-0">minutes</span>
                                </div>
                                {fieldErrors.thresholdWindow && (
                                    <p className="text-red-400 text-[11px] mt-1">{fieldErrors.thresholdWindow}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Filter Query Expression (Optional)
                            </label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g., service:payment OR fingerprint:5b9f91a"
                                className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono"
                            />
                            <span className="text-[10px] text-zinc-500 mt-1 block">
                                Leave blank to monitor all incoming error events in the project.
                            </span>
                        </div>
                    </div>
                )}

                {type === "METRIC" && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                    Latency / Metric Threshold Limit (&gt;)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={thresholdValue}
                                        onChange={(e) => setThresholdValue(e.target.value)}
                                        placeholder="500"
                                        className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white focus:outline-none focus:border-accent"
                                    />
                                    <span className="text-zinc-400 shrink-0">ms</span>
                                </div>
                                {fieldErrors.thresholdValue && (
                                    <p className="text-red-400 text-[11px] mt-1">{fieldErrors.thresholdValue}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                    Evaluation Window
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={thresholdWindow}
                                        onChange={(e) => setThresholdWindow(e.target.value)}
                                        placeholder="15"
                                        className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white focus:outline-none focus:border-accent"
                                    />
                                    <span className="text-zinc-400 shrink-0">minutes</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Metric Target / Service Scope (Optional)
                            </label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g., http.request.duration OR service:api"
                                className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono"
                            />
                        </div>
                    </div>
                )}

                {type === "CRON" && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Cron Schedule Expression *
                            </label>
                            <input
                                type="text"
                                value={cronSchedule}
                                onChange={(e) => {
                                    setCronSchedule(e.target.value);
                                    if (fieldErrors.cronSchedule) {
                                        setFieldErrors((prev) => ({ ...prev, cronSchedule: "" }));
                                    }
                                }}
                                placeholder="*/15 * * * *"
                                className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono text-sky-400"
                            />
                            {fieldErrors.cronSchedule && (
                                <p className="text-red-400 text-[11px] mt-1">{fieldErrors.cronSchedule}</p>
                            )}
                            <span className="text-[10px] text-zinc-500 mt-1 block">
                                Standard 5-field cron format: minute hour day month day-of-week.
                            </span>
                        </div>

                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Grace Period (Minutes before alert)
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={thresholdWindow}
                                onChange={(e) => setThresholdWindow(e.target.value)}
                                className="w-full sm:w-48 h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white"
                            />
                        </div>
                    </div>
                )}

                {type === "UPTIME" && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Synthetic Probe URL Endpoint *
                            </label>
                            <input
                                type="url"
                                value={endpointUrl}
                                onChange={(e) => {
                                    setEndpointUrl(e.target.value);
                                    if (fieldErrors.endpointUrl) {
                                        setFieldErrors((prev) => ({ ...prev, endpointUrl: "" }));
                                    }
                                }}
                                placeholder="https://api.myproject.com/health"
                                className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono text-emerald-400"
                            />
                            {fieldErrors.endpointUrl && (
                                <p className="text-red-400 text-[11px] mt-1">{fieldErrors.endpointUrl}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Check Interval Frequency
                            </label>
                            <select
                                value={thresholdWindow}
                                onChange={(e) => setThresholdWindow(e.target.value)}
                                className="halo-select w-full sm:w-48"
                            >
                                <option value="1">Every 1 minute</option>
                                <option value="5">Every 5 minutes</option>
                                <option value="15">Every 15 minutes</option>
                                <option value="60">Every 1 hour</option>
                            </select>
                        </div>
                    </div>
                )}

                {type === "MOBILE_BUILD" && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Minimum Crash-Free Session Target (%)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.1"
                                    min="80"
                                    max="100"
                                    value={thresholdValue}
                                    onChange={(e) => setThresholdValue(e.target.value)}
                                    placeholder="99.5"
                                    className="w-full sm:w-48 h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white focus:outline-none focus:border-accent"
                                />
                                <span className="text-zinc-400">%</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                Version Filter / Release Tag (Optional)
                            </label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g., release:v2.4.0 OR platform:ios"
                                className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* STEP 4: Alert Routing Channels */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans border-b border-border pb-3">
                    4. Incident Alert Routing & Webhooks
                </h3>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#080b11] border border-white/10">
                        <div>
                            <p className="font-semibold text-xs text-white">Email Notifications</p>
                            <p className="text-[11px] text-zinc-400 font-sans">
                                Send immediate incident alerts to organization admins and monitor owner.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={notifyEmail}
                            onChange={(e) => setNotifyEmail(e.target.checked)}
                            className="w-4 h-4 rounded accent-accent cursor-pointer"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                            Custom Webhook Endpoint URL (Optional)
                        </label>
                        <input
                            type="url"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://hooks.slack.com/services/... or https://pagerduty.com/..."
                            className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#080b11] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono"
                        />
                        {fieldErrors.webhookUrl && (
                            <p className="text-red-400 text-[11px] mt-1">{fieldErrors.webhookUrl}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* STEP 5: Live Configuration Summary Preview */}
            <div className="p-6 rounded-2xl bg-accent/5 border border-accent/20 space-y-4">
                <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase font-sans">
                    <Sparkles size={14} />
                    <span>Configuration Summary Preview</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Target Project</span>
                        <span className="text-white font-semibold truncate block">
                            {selectedProjectObj?.name || "None selected"}
                        </span>
                    </div>

                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Monitor Type</span>
                        <span className="text-accent font-semibold block">{selectedTypeConfig.label}</span>
                    </div>

                    <div>
                        <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Severity</span>
                        <span className={`halo-severity halo-severity-${severity.toLowerCase()}`}>
                            {severity}
                        </span>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-accent/10">
                        <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Evaluation Rule</span>
                        <span className="text-zinc-200">
                            {type === "ERROR" &&
                                `Trigger FIRING alert when error count >= ${thresholdValue || 5} events within ${thresholdWindow || 10} minutes${query ? ` matching '${query}'` : ""}.`}
                            {type === "METRIC" &&
                                `Trigger FIRING alert when latency exceeds ${thresholdValue || 500}ms over ${thresholdWindow || 15} minutes.`}
                            {type === "CRON" &&
                                `Trigger FIRING alert if scheduled task '${cronSchedule}' misses execution heartbeat by > ${thresholdWindow || 5} minutes.`}
                            {type === "UPTIME" &&
                                `Probe '${endpointUrl}' every ${thresholdWindow || 5}m; alert if status != 200 or unreachable.`}
                            {type === "MOBILE_BUILD" &&
                                `Trigger FIRING alert when crash-free session ratio falls below ${thresholdValue || 99.5}%.`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
                {onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="halo-btn halo-btn-secondary halo-btn-sm"
                    >
                        Cancel
                    </button>
                ) : (
                    <Link href="/monitors" className="halo-btn halo-btn-secondary halo-btn-sm">
                        Cancel
                    </Link>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="halo-btn halo-btn-primary halo-btn-sm"
                >
                    {loading ? (
                        <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Saving Monitor...</span>
                        </>
                    ) : (
                        <>
                            <Save size={13} />
                            <span>{isEdit ? "Update Monitor" : "Save & Enable Monitor"}</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
