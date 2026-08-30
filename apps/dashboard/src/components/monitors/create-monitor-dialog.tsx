"use client";

import React, { useState } from "react";
import { Plus, BellRing, Activity, Radio, Clock, Globe, Smartphone, X, Loader2 } from "lucide-react";
import { createMonitor } from "@/actions/monitor";
import { useRouter } from "next/navigation";
import type { MonitorType, MonitorSeverity } from "@/generated/prisma/client";

interface ProjectOption {
    id: string;
    name: string;
}

interface CreateMonitorDialogProps {
    projects: ProjectOption[];
    selectedProjectId?: string;
    trigger?: React.ReactNode;
    onCreated?: () => void;
}

const MONITOR_TYPES: { type: MonitorType; label: string; description: string; icon: any }[] = [
    {
        type: "ERROR",
        label: "Error Spike & Crash Monitor",
        description: "Alerts when error frequency or fatal exceptions exceed a defined threshold within a time window.",
        icon: BellRing,
    },
    {
        type: "METRIC",
        label: "Metric & Latency Anomaly",
        description: "Monitors P95/P99 latency, request rates, or failure percentages.",
        icon: Activity,
    },
    {
        type: "CRON",
        label: "Cron & Scheduled Task Monitor",
        description: "Monitors recurring jobs and alerts if a scheduled execution misses its heartbeat.",
        icon: Clock,
    },
    {
        type: "UPTIME",
        label: "Endpoint Uptime & Synthetic Probe",
        description: "Monitors HTTP endpoint availability, HTTP status codes, and network responsiveness.",
        icon: Globe,
    },
    {
        type: "MOBILE_BUILD",
        label: "Mobile Build & Crash-Free Session",
        description: "Monitors mobile release stability and crash-free session ratios.",
        icon: Smartphone,
    },
];

export function CreateMonitorDialog({
    projects,
    selectedProjectId,
    trigger,
    onCreated,
}: CreateMonitorDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [projectId, setProjectId] = useState(selectedProjectId || projects[0]?.id || "");
    const [type, setType] = useState<MonitorType>("ERROR");
    const [severity, setSeverity] = useState<MonitorSeverity>("ERROR");

    // Dynamic type-specific fields
    const [thresholdValue, setThresholdValue] = useState("5");
    const [thresholdWindow, setThresholdWindow] = useState("10");
    const [query, setQuery] = useState("");
    const [cronSchedule, setCronSchedule] = useState("*/15 * * * *");
    const [endpointUrl, setEndpointUrl] = useState("https://");

    const resetForm = () => {
        setName("");
        setDescription("");
        setType("ERROR");
        setSeverity("ERROR");
        setThresholdValue("5");
        setThresholdWindow("10");
        setQuery("");
        setCronSchedule("*/15 * * * *");
        setEndpointUrl("https://");
        setError(null);
    };

    const handleOpen = () => {
        resetForm();
        if (selectedProjectId) {
            setProjectId(selectedProjectId);
        } else if (projects.length > 0 && !projectId) {
            setProjectId(projects[0].id);
        }
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        resetForm();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError("Monitor name is required.");
            return;
        }
        if (!projectId) {
            setError("Please select a project.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await createMonitor({
                name: name.trim(),
                description: description.trim() || undefined,
                projectId,
                type,
                severity,
                thresholdValue: thresholdValue ? parseFloat(thresholdValue) : undefined,
                thresholdWindow: thresholdWindow ? parseInt(thresholdWindow, 10) : undefined,
                query: query.trim() || undefined,
                cronSchedule: type === "CRON" ? cronSchedule.trim() : undefined,
                endpointUrl: type === "UPTIME" ? endpointUrl.trim() : undefined,
            });

            handleClose();
            router.refresh();
            if (onCreated) onCreated();
        } catch (err: any) {
            setError(err.message || "Failed to create monitor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {trigger ? (
                <div onClick={handleOpen} className="cursor-pointer inline-flex">
                    {trigger}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleOpen}
                    className="halo-btn halo-btn-primary halo-btn-sm"
                >
                    <Plus size={14} />
                    <span>Create Monitor</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div
                        className="relative w-full max-w-xl rounded-2xl bg-[#080b11] border border-white/15 p-6 shadow-2xl space-y-6 text-xs font-mono max-h-[90vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                                    <BellRing size={16} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                        Configure New Monitor
                                    </h2>
                                    <p className="text-[11px] text-zinc-400 font-sans">
                                        Continuous alert evaluation against real telemetry and thresholds.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="text-zinc-500 hover:text-white p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Project & Severity Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                        Project *
                                    </label>
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="halo-select w-full"
                                        required
                                    >
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                        Alert Severity
                                    </label>
                                    <select
                                        value={severity}
                                        onChange={(e) => setSeverity(e.target.value as MonitorSeverity)}
                                        className="halo-select w-full"
                                    >
                                        <option value="FATAL">FATAL (Urgent)</option>
                                        <option value="ERROR">ERROR</option>
                                        <option value="WARNING">WARNING</option>
                                        <option value="INFO">INFO</option>
                                    </select>
                                </div>
                            </div>

                            {/* Monitor Type Selector */}
                            <div>
                                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">
                                    Monitor Type
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {MONITOR_TYPES.map((t) => {
                                        const Icon = t.icon;
                                        const isSelected = type === t.type;

                                        return (
                                            <button
                                                key={t.type}
                                                type="button"
                                                onClick={() => setType(t.type)}
                                                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "bg-accent/10 border-accent text-white"
                                                        : "bg-[#0b1018] border-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
                                                }`}
                                            >
                                                <div
                                                    className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                                        isSelected
                                                            ? "bg-accent text-white"
                                                            : "bg-white/5 text-zinc-400"
                                                    }`}
                                                >
                                                    <Icon size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-xs text-white">
                                                        {t.label}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-400 font-sans leading-tight mt-0.5">
                                                        {t.description}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Name & Description */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                        Monitor Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., Checkout Payment Failure Spike"
                                        className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-zinc-400 uppercase tracking-wider font-semibold mb-1">
                                        Description (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Brief note about the incident criteria and team notification."
                                        className="w-full h-8.5 px-3 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent"
                                    />
                                </div>
                            </div>

                            {/* Dynamic Parameters according to Type */}
                            {type === "ERROR" && (
                                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-3">
                                    <p className="text-[11px] font-bold text-zinc-300 font-sans">
                                        Error Threshold Criteria
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-zinc-400 mb-1">
                                                Trigger Count (&gt;= events)
                                            </label>
                                            <input
                                                type="number"
                                                value={thresholdValue}
                                                onChange={(e) => setThresholdValue(e.target.value)}
                                                className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-zinc-400 mb-1">
                                                Rolling Window (Minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={thresholdWindow}
                                                onChange={(e) => setThresholdWindow(e.target.value)}
                                                className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-zinc-400 mb-1">
                                            Event Filter / Tag Query (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="e.g. service:checkout OR type:ERROR"
                                            className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white placeholder:text-zinc-600"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === "METRIC" && (
                                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-3">
                                    <p className="text-[11px] font-bold text-zinc-300 font-sans">
                                        Metric Anomaly Rules
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-zinc-400 mb-1">
                                                Latency Threshold (ms)
                                            </label>
                                            <input
                                                type="number"
                                                value={thresholdValue}
                                                onChange={(e) => setThresholdValue(e.target.value)}
                                                placeholder="500"
                                                className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-zinc-400 mb-1">
                                                Window (Minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={thresholdWindow}
                                                onChange={(e) => setThresholdWindow(e.target.value)}
                                                placeholder="15"
                                                className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {type === "CRON" && (
                                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-3">
                                    <p className="text-[11px] font-bold text-zinc-300 font-sans">
                                        Cron Job Schedule
                                    </p>
                                    <div>
                                        <label className="block text-[10px] text-zinc-400 mb-1">
                                            Cron Schedule Expression
                                        </label>
                                        <input
                                            type="text"
                                            value={cronSchedule}
                                            onChange={(e) => setCronSchedule(e.target.value)}
                                            placeholder="*/15 * * * *"
                                            className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === "UPTIME" && (
                                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-3">
                                    <p className="text-[11px] font-bold text-zinc-300 font-sans">
                                        Target Endpoint
                                    </p>
                                    <div>
                                        <label className="block text-[10px] text-zinc-400 mb-1">
                                            Probe URL
                                        </label>
                                        <input
                                            type="url"
                                            value={endpointUrl}
                                            onChange={(e) => setEndpointUrl(e.target.value)}
                                            placeholder="https://api.myproject.com/health"
                                            className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white font-mono"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {type === "MOBILE_BUILD" && (
                                <div className="p-3.5 rounded-xl bg-white/3 border border-white/5 space-y-3">
                                    <p className="text-[11px] font-bold text-zinc-300 font-sans">
                                        Mobile Release Target
                                    </p>
                                    <div>
                                        <label className="block text-[10px] text-zinc-400 mb-1">
                                            Minimum Crash-Free Sessions (%)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={thresholdValue}
                                            onChange={(e) => setThresholdValue(e.target.value)}
                                            placeholder="99.5"
                                            className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-[#0b1018] text-xs text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-4">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="halo-btn halo-btn-secondary halo-btn-sm"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="halo-btn halo-btn-primary halo-btn-sm"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={13} className="animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={13} />
                                            <span>Save & Enable Monitor</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
