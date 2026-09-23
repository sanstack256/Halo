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
import { CanonicalEvidenceStore, getCanonicalEvidenceId } from "./canonical-evidence-store";

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

    // Initialize CanonicalEvidenceStore (Collect Once, Store Once, Reference Everywhere)
    const evidenceStore = new CanonicalEvidenceStore(incident.issueId, incident.issueId, snapshotId);

    // 1. Register all raw telemetry events with stable identities
    for (const ev of rawEvidence) {
        const isAnchor = ev.id === anchorError?.id;
        const kind = ev.type === "ERROR" || isAnchor ? "ERROR_OCCURRENCE" : "RUNTIME_EVENT";
        evidenceStore.register({
            id: getCanonicalEvidenceId(kind, ev.id),
            kind,
            source: ev.source || "telemetry",
            collectedAt: new Date(),
            observedAt: ev.timestamp ? new Date(ev.timestamp) : undefined,
            provenance: {
                method: "INGEST",
                origin: ev.service || incident.service || "service",
                redacted: true,
            },
            content: ev,
        });
    }

    // 2. Register stack frames with stable identities & link to anchor error
    if (anchorError) {
        const anchorRecordId = getCanonicalEvidenceId("ERROR_OCCURRENCE", anchorError.id);
        for (const frame of stackFrames) {
            if (frame.filePath) {
                const frameKey = `${frame.filePath}:${frame.lineNumber || 1}:${frame.columnNumber || 0}`;
                const frameRecordId = getCanonicalEvidenceId("STACK_FRAME", frameKey);
                evidenceStore.register({
                    id: frameRecordId,
                    kind: "STACK_FRAME",
                    source: "stack_parser",
                    collectedAt: new Date(),
                    provenance: {
                        method: "STATIC_ANALYSIS",
                        origin: frame.filePath,
                        redacted: false,
                    },
                    content: frame,
                });
                evidenceStore.addRelationship({
                    fromId: anchorRecordId,
                    relation: "executed",
                    toId: frameRecordId,
                    confidence: "CONFIRMED",
                });
            }
        }
    }

    // 3. Register source snapshot with stable identity
    if (source && source.filePath) {
        const sourceKey = `${incident.release || "head"}:${source.filePath}`;
        const sourceRecordId = getCanonicalEvidenceId("SOURCE_SNAPSHOT", sourceKey);
        evidenceStore.register({
            id: sourceRecordId,
            kind: "SOURCE_SNAPSHOT",
            source: "repository",
            collectedAt: new Date(),
            provenance: {
                method: "STATIC_ANALYSIS",
                origin: source.filePath,
                redacted: false,
            },
            content: {
                filePath: source.filePath,
                containingFunction: source.containingFunction,
                failingLineNumber: source.failingLineNumber,
                lineCount: source.lines?.length || 0,
            },
        });

        // Link primary stack frame to source snapshot
        if (primaryFrame && primaryFrame.filePath) {
            const frameKey = `${primaryFrame.filePath}:${primaryFrame.lineNumber || 1}:${primaryFrame.columnNumber || 0}`;
            const frameRecordId = getCanonicalEvidenceId("STACK_FRAME", frameKey);
            evidenceStore.addRelationship({
                fromId: frameRecordId,
                relation: "locatedAt",
                toId: sourceRecordId,
                confidence: "CONFIRMED",
            });
        }
    }

    // 4. Register git regression candidates
    for (const cand of releaseContext.candidates) {
        const commitSha = cand.commitSha || (cand as any).sha || "unknown";
        const commitRecordId = getCanonicalEvidenceId("GIT_COMMIT", commitSha);
        evidenceStore.register({
            id: commitRecordId,
            kind: "GIT_COMMIT",
            source: "git_repository",
            collectedAt: new Date(),
            observedAt: cand.commitDate,
            provenance: {
                method: "GIT_API",
                origin: cand.commitSha,
                redacted: false,
            },
            content: cand,
        });

        if (source && source.filePath && cand.changedFiles?.includes(source.filePath)) {
            const sourceKey = `${incident.release || "head"}:${source.filePath}`;
            const sourceRecordId = getCanonicalEvidenceId("SOURCE_SNAPSHOT", sourceKey);
            evidenceStore.addRelationship({
                fromId: commitRecordId,
                relation: "modified",
                toId: sourceRecordId,
                confidence: "CONFIRMED",
            });
        }
    }

    // 5. Register release deployment
    if (incident.release) {
        const releaseRecordId = getCanonicalEvidenceId("RELEASE_DEPLOYMENT", incident.release);
        evidenceStore.register({
            id: releaseRecordId,
            kind: "RELEASE_DEPLOYMENT",
            source: "deployment_system",
            collectedAt: new Date(),
            provenance: {
                method: "INGEST",
                origin: incident.release,
                redacted: false,
            },
            content: {
                release: incident.release,
                candidatesCount: releaseContext.candidates.length,
            },
        });
    }

    // 6. Register replay session if available
    if (replay?.sessionId) {
        const replayRecordId = getCanonicalEvidenceId("REPLAY_SESSION", replay.sessionId);
        evidenceStore.register({
            id: replayRecordId,
            kind: "REPLAY_SESSION",
            source: "session_replay",
            collectedAt: new Date(),
            provenance: {
                method: "INGEST",
                origin: replay.sessionId,
                redacted: true,
            },
            content: replay,
        });
    }

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
        evidenceStore,
    });
}
