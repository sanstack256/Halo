/**
 * Halo Recommendation Engine — Immutable Investigation Snapshot
 *
 * Implements Phase C (Section 4):
 * Constructs a frozen, comprehensive snapshot of the investigation at generation time.
 * Includes incident identity, failure details, execution frames, telemetry context,
 * source context, release history, and evaluated regression candidates.
 */

import crypto from "crypto";
import type { Evidence, Investigation, Hypothesis, Finding, CausalChain } from "@halo/investigation-engine";
import type { StackFrame, SourceContext } from "../runtime/types";
import type { InvestigationSnapshot, ReleaseRegressionContext } from "./types";

export interface BuildInvestigationSnapshotOptions {
    incident: {
        issueId: string;
        title: string;
        fingerprint?: string;
        firstSeen: Date;
        lastSeen: Date;
        eventCount?: number;
        environment?: string;
        service?: string;
        release?: string;
    };
    rawEvidence: Evidence[];
    investigation?: Partial<Investigation> | {
        status?: string;
        hypotheses?: any[];
        findings?: any[];
        causalChains?: any[];
        rootCause?: any;
        summary?: string;
        [key: string]: any;
    };
    stackFrames?: StackFrame[];
    source?: SourceContext & {
        sourceFileCounterpart?: string;
        sourceMapAvailable?: boolean;
    };
    release?: ReleaseRegressionContext;
    replay?: {
        isAvailable: boolean;
        sessionId?: string;
        eventsSummary: string[];
    };
    tests?: {
        hasRelevantTests: boolean;
        testFiles: string[];
        reproductionPossibleInDev: boolean;
    };
    sourceDistMapping?: {
        isGeneratedOrDist: boolean;
        sourceFileCounterpart?: string;
        sourceMapAvailable: boolean;
    };
}

export function buildInvestigationSnapshot(
    opts: BuildInvestigationSnapshotOptions
): InvestigationSnapshot {
    const { incident = { issueId: "issue-unknown", title: "Incident", firstSeen: new Date(), lastSeen: new Date() }, rawEvidence = [], investigation, stackFrames = [], source, release, replay } = opts;

    // Identify primary anchor error
    const anchorError =
        rawEvidence.find((e) => e.type === "ERROR") ||
        rawEvidence[0];

    const stack =
        anchorError?.tags?.stack ||
        (anchorError?.metadata?.stack as string) ||
        "";

    let exceptionType = (anchorError?.metadata?.class as string) || (anchorError?.tags?.exceptionType as string) || (anchorError?.tags?.errorType as string);
    let exceptionMessage = (anchorError?.metadata?.message as string) || (anchorError?.tags?.message as string) || (anchorError?.tags?.errorMessage as string);

    if (stack) {
        const firstLine = stack.split("\n")[0]?.trim() || "";
        const colonIdx = firstLine.indexOf(":");
        if (colonIdx > 0) {
            if (!exceptionType) {
                exceptionType = firstLine.slice(0, colonIdx).trim();
            }
            if (!exceptionMessage) {
                exceptionMessage = firstLine.slice(colonIdx + 1).trim();
            }
        }
    }

    if (!exceptionType) {
        exceptionType = anchorError?.title?.split(":")[0]?.trim() || "Error";
    }
    if (!exceptionMessage) {
        exceptionMessage = anchorError?.description || anchorError?.title || "Unknown error";
    }

    // Primary application frame
    const primaryFrame =
        stackFrames.find((f) => f.isApplication && f.lineNumber) ||
        stackFrames[0];

    // Correlated context from telemetry
    const requestId =
        (anchorError?.metadata?.requestId as string) ||
        anchorError?.tags?.requestId;

    const traceId =
        (anchorError?.metadata?.traceId as string) ||
        anchorError?.tags?.traceId;

    const httpMethod =
        (anchorError?.metadata?.httpMethod as string) ||
        anchorError?.tags?.httpMethod;

    const route =
        (anchorError?.metadata?.route as string) ||
        anchorError?.tags?.route ||
        (anchorError?.metadata?.path as string);

    const status =
        (anchorError?.metadata?.status as string) ||
        anchorError?.tags?.status;

    // Fast indexed evidence map
    const evidenceMap: Record<string, Evidence> = {};
    for (const ev of rawEvidence) {
        evidenceMap[ev.id] = ev;
    }

    // Deterministic snapshot ID
    const snapshotContent = `${incident.issueId}:${incident.title}:${source?.filePath || ""}:${rawEvidence.map((e) => e.id).sort().join(",")}`;
    const snapshotId = `snap-${crypto.createHash("sha256").update(snapshotContent).digest("hex").slice(0, 16)}`;

    // Build default release regression context if not provided
    const releaseContext: ReleaseRegressionContext = release || {
        deployedRelease: incident.release,
        candidates: [],
    };

    return Object.freeze({
        snapshotId,
        createdAt: new Date(),
        incident: Object.freeze({
            issueId: incident.issueId,
            title: incident.title,
            fingerprint: incident.fingerprint,
            firstSeen: incident.firstSeen,
            lastSeen: incident.lastSeen,
            eventCount: incident.eventCount ?? rawEvidence.length,
            environment: incident.environment || anchorError?.environment || "production",
            service: incident.service || anchorError?.service || "unknown-service",
            release: incident.release || anchorError?.release,
        }),
        failure: Object.freeze({
            exceptionType,
            exceptionMessage,
            stack,
            frames: Object.freeze([...stackFrames]),
            primaryFrame,
            sourceLocation: primaryFrame?.filePath
                ? { file: primaryFrame.filePath, line: primaryFrame.lineNumber }
                : source?.filePath
                ? { file: source.filePath, line: source.failingLineNumber }
                : undefined,
            executingFunction: source?.containingFunction || primaryFrame?.functionName,
        }),
        runtimeContext: Object.freeze({
            anchorErrorId: anchorError?.id,
            requestId,
            traceId,
            httpMethod,
            route,
            status,
            breadcrumbs: Array.isArray(anchorError?.metadata?.breadcrumbs)
                ? anchorError.metadata.breadcrumbs
                : [],
            precedingEvents: rawEvidence.filter((e) => e.id !== anchorError?.id),
            runtimeOrigin: (anchorError?.source as any) || "node",
        }),
        replay: replay ? Object.freeze(replay) : undefined,
        investigation: Object.freeze({
            hypotheses: Object.freeze([...(investigation?.hypotheses || [])]),
            findings: Object.freeze([...(investigation?.findings || [])]),
            causalChains: Object.freeze([...(investigation?.causalChains || [])]),
            rootCause: investigation?.rootCause || null,
            rawEvidence: Object.freeze([...rawEvidence]),
            evidenceMap: Object.freeze(evidenceMap),
        }),
        source: source
            ? Object.freeze({
                  ...source,
                  resolutionStatus: source.resolutionStatus || (source.lines && source.lines.length > 0 ? "exact_file" : "missing"),
              })
            : undefined,
        release: Object.freeze(releaseContext),
        tests: opts.tests ? Object.freeze(opts.tests) : undefined,
        sourceDistMapping: opts.sourceDistMapping ? Object.freeze(opts.sourceDistMapping) : undefined,
    });
}
