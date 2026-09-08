/**
 * Halo Canonical Evidence Snapshot
 *
 * Immutable, provenance-aware, single source of truth for an investigation.
 * All downstream reasoning (Investigation, Interpreter, LLM Recommendation Engine,
 * Patch Validator, and UI) MUST derive strictly from this snapshot.
 *
 * Enforces:
 *   1. Single data collection: Telemetry is queried once, snapshot is frozen.
 *   2. Strict tenant and scope boundaries (org, project, environment, interval).
 *   3. Deterministic canonical sorting for reproducible reasoning.
 *   4. Fast indexed evidence lookups for claim verification.
 */

import type {
    Evidence,
    Hypothesis,
    CausalChain,
    Finding,
    Investigation,
} from "@halo/investigation-engine";
import type {
    SourceContext,
    StackFrame,
    CallChainStep,
} from "./runtime/types";

export interface SnapshotTenant {
    organizationId?: string;
    projectId: string;
    environment?: string;
}

export interface SnapshotIncidentScope {
    anchorEventId?: string;
    anchorTimestamp?: Date;
    issueId?: string;
    monitorId?: string;
    alertId?: string;
    release?: string;
    interval?: {
        start: Date;
        end: Date;
    };
    service?: string;
}

export interface SnapshotRuntimeContext {
    anchorError?: Evidence;
    primaryFailingFrame?: StackFrame;
    callChain: CallChainStep[];
    failingExpression?: string;
    failingStatement?: string;
    containingFunction?: string;
    runtimeOrigin?: "node" | "browser" | "unknown";
}

export interface SnapshotReplayContext {
    sessionId?: string;
    url?: string | null;
    browser?: string | null;
    os?: string | null;
    viewport?: { width?: number | null; height?: number | null };
    totalDurationMs?: number | null;
    errorAt?: Date | null;
    markerCount?: number;
    markersSummary?: string[];
}

export interface SnapshotSufficiency {
    status: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
    missingEvidence: string[];
    whatHaloKnows: string[];
}

export interface EvidenceSnapshot {
    /** Unique snapshot identifier */
    readonly snapshotId: string;

    /** Schema version */
    readonly schemaVersion: "1.0.0";

    /** Timestamp when snapshot was captured */
    readonly createdAt: Date;

    /** Tenant boundary */
    readonly tenant: Readonly<SnapshotTenant>;

    /** Scope of the incident being investigated */
    readonly scope: Readonly<SnapshotIncidentScope>;

    /** All normalized evidence items in canonical deterministic order */
    readonly evidence: ReadonlyArray<Evidence>;

    /** Fast indexed lookup by evidence ID for deterministic claim verification */
    readonly evidenceMap: Readonly<Record<string, Evidence>>;

    /** Categorized counts of evidence */
    readonly counts: Readonly<{
        errors: number;
        requests: number;
        traces: number;
        logs: number;
        metrics: number;
        deployments: number;
        total: number;
    }>;

    /** Runtime execution reconstruction (stack, AST, frames) */
    readonly runtime: Readonly<SnapshotRuntimeContext>;

    /** Source code context resolved from disk / GitHub at exact commit */
    readonly source?: Readonly<SourceContext>;

    /** Correlated session replay context (if captured) */
    readonly replay?: Readonly<SnapshotReplayContext>;

    /** Deterministic investigation outputs */
    readonly investigation: Readonly<{
        status: string;
        rootCause: Hypothesis | null;
        hypotheses: Hypothesis[];
        causalChains: CausalChain[];
        findings: Finding[];
        summary?: string;
    }>;

    /** Evidence sufficiency evaluation */
    readonly sufficiency: Readonly<SnapshotSufficiency>;
}

/**
 * Deterministically sorts evidence items in canonical order:
 * 1. Primary anchor error first
 * 2. Correlated errors (chronological)
 * 3. HTTP requests & traces (chronological)
 * 4. Logs & messages (chronological)
 * 5. Metrics & DB (chronological)
 * 6. Deployments & changes (chronological)
 */
export function sortEvidenceCanonically(
    evidence: Evidence[],
    anchorEventId?: string
): Evidence[] {
    const typePriority: Record<string, number> = {
        ERROR: 1,
        TRACE: 2,
        REQUEST: 3,
        LOG: 4,
        MESSAGE: 5,
        METRIC: 6,
        DATABASE: 7,
        DEPLOYMENT: 8,
        CHANGE: 9,
        INFRASTRUCTURE: 10,
        THIRD_PARTY: 11,
    };

    return [...evidence].sort((a, b) => {
        // Anchor event always comes first
        if (anchorEventId) {
            if (a.id === anchorEventId) return -1;
            if (b.id === anchorEventId) return 1;
        }

        const prioA = typePriority[a.type] ?? 99;
        const prioB = typePriority[b.type] ?? 99;

        if (prioA !== prioB) {
            return prioA - prioB;
        }

        // Secondary sort: timestamp ascending
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (timeA !== timeB) {
            return timeA - timeB;
        }

        // Deterministic tie-breaker: ID string comparison
        return a.id.localeCompare(b.id);
    });
}

export interface BuildSnapshotOptions {
    tenant: SnapshotTenant;
    scope: SnapshotIncidentScope;
    rawEvidence: Evidence[];
    investigation: Investigation;
    runtime: SnapshotRuntimeContext;
    source?: SourceContext;
    replay?: SnapshotReplayContext;
}

/**
 * Builds the canonical immutable EvidenceSnapshot.
 */
export function buildCanonicalEvidenceSnapshot(
    opts: BuildSnapshotOptions
): EvidenceSnapshot {
    const {
        tenant,
        scope,
        rawEvidence,
        investigation,
        runtime,
        source,
        replay,
    } = opts;

    // Deterministically sort evidence
    const canonicalEvidence = sortEvidenceCanonically(
        rawEvidence,
        scope.anchorEventId
    );

    // Build fast lookup map
    const evidenceMap: Record<string, Evidence> = {};
    let errors = 0;
    let requests = 0;
    let traces = 0;
    let logs = 0;
    let metrics = 0;
    let deployments = 0;

    for (const item of canonicalEvidence) {
        evidenceMap[item.id] = item;
        const typeStr = item.type as string;
        switch (typeStr) {
            case "ERROR":
                errors++;
                break;
            case "TRACE":
                traces++;
                break;
            case "REQUEST":
                requests++;
                break;
            case "LOG":
            case "MESSAGE":
                logs++;
                break;
            case "METRIC":
            case "DATABASE":
                metrics++;
                break;
            case "DEPLOYMENT":
            case "COMMIT":
            case "CONFIG":
            case "FEATURE_FLAG":
            case "CHANGE":
                deployments++;
                break;
        }
    }

    // Assess sufficiency
    const missingEvidence: string[] = [];
    const whatHaloKnows: string[] = [];

    if (runtime.anchorError) {
        whatHaloKnows.push(
            `Observed error "${runtime.anchorError.title}" (${runtime.anchorError.id})`
        );
    } else {
        missingEvidence.push("No anchor error identified.");
    }

    if (source && source.resolutionStatus === "exact_file") {
        whatHaloKnows.push(
            `Source resolved from ${source.filePath} at line ${source.failingLineNumber}`
        );
    } else {
        missingEvidence.push(
            source?.unavailabilityReason ??
                "Source code could not be resolved for the affected release."
        );
    }

    if (traces > 0 || requests > 0) {
        whatHaloKnows.push(`Correlated ${traces} trace(s) and ${requests} request(s).`);
    } else {
        missingEvidence.push("No correlated HTTP requests or distributed traces found.");
    }

    const sufficiencyStatus: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT" =
        errors > 0 && source?.resolutionStatus === "exact_file" && (traces > 0 || requests > 0)
            ? "SUFFICIENT"
            : errors > 0
            ? "PARTIAL"
            : "INSUFFICIENT";

    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return Object.freeze({
        snapshotId,
        schemaVersion: "1.0.0" as const,
        createdAt: new Date(),
        tenant: Object.freeze({ ...tenant }),
        scope: Object.freeze({ ...scope }),
        evidence: Object.freeze(canonicalEvidence),
        evidenceMap: Object.freeze(evidenceMap),
        counts: Object.freeze({
            errors,
            requests,
            traces,
            logs,
            metrics,
            deployments,
            total: canonicalEvidence.length,
        }),
        runtime: Object.freeze({ ...runtime }),
        source: source ? Object.freeze({ ...source }) : undefined,
        replay: replay ? Object.freeze({ ...replay }) : undefined,
        investigation: Object.freeze({
            status: investigation.status,
            rootCause: investigation.rootCause ?? null,
            hypotheses: investigation.hypotheses ?? [],
            causalChains: investigation.causalChains ?? [],
            findings: investigation.findings ?? [],
            summary: investigation.report?.summary,
        }),
        sufficiency: Object.freeze({
            status: sufficiencyStatus,
            missingEvidence,
            whatHaloKnows,
        }),
    });
}
