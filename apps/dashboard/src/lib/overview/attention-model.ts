/**
 * Canonical Attention Model for Halo Trace.
 *
 * Implements the single authoritative attention model:
 * - Represents attention and orientation only ("What deserves my attention right now?")
 * - Strictly backed by real database records (never fabricated)
 * - References canonical entities without duplicating their internal state
 * - Routes directly to canonical owning pages (Issues, Investigate, Change Intelligence, SDK)
 */

export type AttentionType = "ISSUE" | "INVESTIGATION" | "CHANGE" | "TELEMETRY_GAP";

export type AttentionSeverity = "FATAL" | "ERROR" | "WARNING" | "INFO";

export interface EvidenceReference {
    entityId: string;
    entityType: "issue" | "investigation" | "release" | "project";
    metricValue?: string;
    explanation?: string;
}

export interface AttentionItem {
    id: string;
    type: AttentionType;
    severity: AttentionSeverity;
    title: string;
    summary: string;
    source: string;
    timestamp: Date;
    destination: string;
    evidenceReference: EvidenceReference;
    status: string;
}

export interface AttentionSummary {
    totalItems: number;
    fatalCount: number;
    errorCount: number;
    warningCount: number;
    hasGaps: boolean;
}

const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = {
    FATAL: 4,
    ERROR: 3,
    WARNING: 2,
    INFO: 1,
};

const TYPE_WEIGHT: Record<AttentionType, number> = {
    ISSUE: 4,
    CHANGE: 3,
    INVESTIGATION: 2,
    TELEMETRY_GAP: 1,
};

/**
 * Sorts attention items deterministically:
 * 1. Higher severity first (FATAL > ERROR > WARNING > INFO)
 * 2. Higher type priority (ISSUE > CHANGE > INVESTIGATION > TELEMETRY_GAP)
 * 3. Most recent timestamp first
 */
export function prioritizeAttentionItems(items: AttentionItem[]): AttentionItem[] {
    return [...items].sort((a, b) => {
        const severityDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
        if (severityDiff !== 0) return severityDiff;

        const typeDiff = TYPE_WEIGHT[b.type] - TYPE_WEIGHT[a.type];
        if (typeDiff !== 0) return typeDiff;

        return b.timestamp.getTime() - a.timestamp.getTime();
    });
}

/**
 * Summarizes the attention state.
 */
export function summarizeAttention(items: AttentionItem[]): AttentionSummary {
    let fatalCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    let hasGaps = false;

    for (const item of items) {
        if (item.severity === "FATAL") fatalCount++;
        else if (item.severity === "ERROR") errorCount++;
        else if (item.severity === "WARNING") warningCount++;

        if (item.type === "TELEMETRY_GAP") hasGaps = true;
    }

    return {
        totalItems: items.length,
        fatalCount,
        errorCount,
        warningCount,
        hasGaps,
    };
}
