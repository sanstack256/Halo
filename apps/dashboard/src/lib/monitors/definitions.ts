import {
    Activity,
    BellRing,
    Clock,
    Globe,
    Smartphone,
} from "lucide-react";
import type { MonitorType } from "@/generated/prisma/client";

export interface MonitorTypeDefinition {
    type: MonitorType;
    /** Full canonical title used for creation cards, form headers, and detail inspector */
    title: string;
    /** Short label used for secondary nav, filters, badges, and table rows */
    shortLabel: string;
    /** Official product description */
    description: string;
    /** Short subtitle/tagline */
    tagline: string;
    /** Description of the trigger condition */
    triggerCondition: string;
    /** Required telemetry source */
    dataRequired: string;
    /** Standard Lucide icon */
    icon: any;
    /** Tailwind color badge classes */
    colorClass: string;
    /** Tailwind border class */
    borderClass: string;
    /** Secondary navigation route */
    categoryRoute: string;
}

export const MONITOR_TYPE_DEFINITIONS: Record<MonitorType, MonitorTypeDefinition> = {
    ERROR: {
        type: "ERROR",
        title: "Error & Crash Detection",
        shortLabel: "Error Activity",
        description: "Detects abnormal error and crash activity and alerts when configured conditions are exceeded.",
        tagline: "Track error bursts and fatal exceptions",
        triggerCondition: "Error occurrences >= Threshold count within rolling window",
        dataRequired: "Application error events, exceptions, or trace logs",
        icon: BellRing,
        colorClass: "text-red-400 bg-red-500/10",
        borderClass: "border-red-500/20",
        categoryRoute: "/monitors/type/ERROR",
    },
    METRIC: {
        type: "METRIC",
        title: "Performance Anomaly",
        shortLabel: "Performance",
        description: "Detects abnormal latency, throughput, request-rate, and other performance behavior against configured conditions.",
        tagline: "Detect slow API responses and resource spikes",
        triggerCondition: "Aggregated metric value > Threshold value (ms/count)",
        dataRequired: "Trace durations, span metadata, or telemetry metrics",
        icon: Activity,
        colorClass: "text-amber-400 bg-amber-500/10",
        borderClass: "border-amber-500/20",
        categoryRoute: "/monitors/type/METRIC",
    },
    CRON: {
        type: "CRON",
        title: "Scheduled Job Health",
        shortLabel: "Scheduled Jobs",
        description: "Monitors scheduled jobs and background tasks and detects missed, failed, or unhealthy executions.",
        tagline: "Ensure background jobs execute on time",
        triggerCondition: "Job execution fails to check in within schedule + grace period",
        dataRequired: "Cron schedule expression & task check-ins",
        icon: Clock,
        colorClass: "text-sky-400 bg-sky-500/10",
        borderClass: "border-sky-500/20",
        categoryRoute: "/monitors/type/CRON",
    },
    UPTIME: {
        type: "UPTIME",
        title: "Service Availability",
        shortLabel: "Availability",
        description: "Continuously checks configured services and endpoints for availability, response failures, and unhealthy behavior.",
        tagline: "Monitor HTTP endpoint availability worldwide",
        triggerCondition: "Probe response status != 200 or timeout exceeded",
        dataRequired: "Target HTTP/HTTPS URL endpoint",
        icon: Globe,
        colorClass: "text-emerald-400 bg-emerald-500/10",
        borderClass: "border-emerald-500/20",
        categoryRoute: "/monitors/type/UPTIME",
    },
    MOBILE_BUILD: {
        type: "MOBILE_BUILD",
        title: "Release Health",
        shortLabel: "Release Health",
        description: "Monitors application release health and detects degradation in crash-free sessions and release stability.",
        tagline: "Track release stability and mobile regressions",
        triggerCondition: "Crash-free session percentage < Target stability threshold",
        dataRequired: "Mobile SDK telemetry sessions and crash reports",
        icon: Smartphone,
        colorClass: "text-purple-400 bg-purple-500/10",
        borderClass: "border-purple-500/20",
        categoryRoute: "/monitors/type/MOBILE_BUILD",
    },
};

export const MONITOR_TYPES_LIST: MonitorTypeDefinition[] = [
    MONITOR_TYPE_DEFINITIONS.ERROR,
    MONITOR_TYPE_DEFINITIONS.METRIC,
    MONITOR_TYPE_DEFINITIONS.CRON,
    MONITOR_TYPE_DEFINITIONS.UPTIME,
    MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD,
];

export function getMonitorTypeDefinition(type?: MonitorType | string | null): MonitorTypeDefinition {
    if (!type) return MONITOR_TYPE_DEFINITIONS.ERROR;
    const normalized = type.toUpperCase() as MonitorType;
    return MONITOR_TYPE_DEFINITIONS[normalized] || MONITOR_TYPE_DEFINITIONS.ERROR;
}
