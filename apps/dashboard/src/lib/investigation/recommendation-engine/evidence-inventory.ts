/**
 * Halo Recommendation Engine — Evidence Inventory & Provenance Tracking
 *
 * Implements Phase C (Section 5):
 * Extracts every factual claim with explicit provenance and confidence level.
 * Answers deterministically: "Where did this claim come from?"
 */

import type { InvestigationSnapshot, EvidenceFact } from "./types";

export interface EvidenceInventory {
    facts: EvidenceFact[];
    factsById: Record<string, EvidenceFact>;
    factsByType: Record<string, EvidenceFact[]>;
    factsBySource: Record<string, EvidenceFact[]>;
}

export function buildEvidenceInventory(snapshot: InvestigationSnapshot): EvidenceInventory {
    const facts: EvidenceFact[] = [];

    // 1. Primary Exception Fact
    if (snapshot.failure.exceptionType && snapshot.runtimeContext.anchorErrorId) {
        facts.push({
            id: `fact-exc-${snapshot.runtimeContext.anchorErrorId}`,
            type: "EXCEPTION",
            value: `${snapshot.failure.exceptionType}: ${snapshot.failure.exceptionMessage}`,
            source: "telemetry",
            sourceRef: snapshot.runtimeContext.anchorErrorId,
            confidenceLevel: "OBSERVED",
            temporalContext: {
                timestamp: snapshot.incident.lastSeen,
                relativeToIncident: "Anchor occurrence failure event",
            },
            provenance: `Observed in verified telemetry error event '${snapshot.runtimeContext.anchorErrorId}'`,
        });
    }

    // 2. Stack Frame Facts
    snapshot.failure.frames.forEach((frame, idx) => {
        if (frame.filePath) {
            facts.push({
                id: `fact-frame-${idx}`,
                type: "STACK_FRAME",
                value: `${frame.functionName || "anonymous"} at ${frame.filePath}:${frame.lineNumber || "?"}`,
                source: "stack_trace",
                sourceRef: snapshot.runtimeContext.anchorErrorId,
                confidenceLevel: "OBSERVED",
                provenance: `Captured in stack trace frame #${idx} of anchor error '${snapshot.runtimeContext.anchorErrorId || "anchor"}'`,
            });
        }
    });

    // 3. Correlated HTTP Request & Trace Facts
    if (snapshot.runtimeContext.requestId) {
        facts.push({
            id: `fact-req-${snapshot.runtimeContext.requestId}`,
            type: "REQUEST",
            value: `${snapshot.runtimeContext.httpMethod || "REQUEST"} ${snapshot.runtimeContext.route || "path"} (Status: ${snapshot.runtimeContext.status || "unrecorded"})`,
            source: "telemetry",
            sourceRef: snapshot.runtimeContext.requestId,
            confidenceLevel: "OBSERVED",
            provenance: `Matched by correlation requestId '${snapshot.runtimeContext.requestId}'`,
        });
    }

    if (snapshot.runtimeContext.traceId) {
        facts.push({
            id: `fact-trace-${snapshot.runtimeContext.traceId}`,
            type: "SPAN",
            value: `Correlated trace ${snapshot.runtimeContext.traceId}`,
            source: "telemetry",
            sourceRef: snapshot.runtimeContext.traceId,
            confidenceLevel: "OBSERVED",
            provenance: `Matched by correlation traceId '${snapshot.runtimeContext.traceId}'`,
        });
    }

    // 4. Source Code Facts
    if (snapshot.source && snapshot.source.resolutionStatus === "exact_file") {
        facts.push({
            id: `fact-src-${snapshot.source.filePath}`,
            type: "SOURCE_LINE",
            value: `Verified repository source for ${snapshot.source.filePath} at line ${snapshot.source.failingLineNumber}`,
            source: "source_repository",
            sourceRef: snapshot.source.filePath,
            confidenceLevel: "STATICALLY_VERIFIED",
            provenance: `Verified repository source from file '${snapshot.source.filePath}' (revision: ${snapshot.source.revision || "HEAD"})`,
        });

        if (snapshot.source.containingFunction) {
            facts.push({
                id: `fact-ast-fn-${snapshot.source.containingFunction}`,
                type: "AST_NODE",
                value: `Executing function ${snapshot.source.containingFunction}`,
                source: "static_ast",
                sourceRef: snapshot.source.filePath,
                confidenceLevel: "STATICALLY_VERIFIED",
                provenance: `AST analysis of function declaration '${snapshot.source.containingFunction}' in '${snapshot.source.filePath}'`,
            });
        }

        if (snapshot.source.failingExpression) {
            facts.push({
                id: `fact-ast-expr-${snapshot.source.failingLineNumber}`,
                type: "AST_NODE",
                value: `Failing expression '${snapshot.source.failingExpression}' at line ${snapshot.source.failingLineNumber}`,
                source: "static_ast",
                sourceRef: `${snapshot.source.filePath}:${snapshot.source.failingLineNumber}`,
                confidenceLevel: "STATICALLY_VERIFIED",
                provenance: `AST expression at line ${snapshot.source.failingLineNumber} of '${snapshot.source.filePath}'`,
            });
        }
    }

    // 5. Release & Regression Facts
    if (snapshot.release.deployedCommitSha) {
        facts.push({
            id: `fact-rel-commit-${snapshot.release.deployedCommitSha.slice(0, 7)}`,
            type: "COMMIT",
            value: `Deployment commit ${snapshot.release.deployedCommitSha.slice(0, 7)} on release ${snapshot.release.deployedRelease || "current"}`,
            source: "git_history",
            sourceRef: snapshot.release.deployedCommitSha,
            confidenceLevel: "OBSERVED",
            provenance: `Bound to release '${snapshot.release.deployedRelease || "current"}' deployment record`,
        });
    }

    for (const cand of snapshot.release.candidates) {
        facts.push({
            id: `fact-cand-commit-${cand.shortSha}`,
            type: "COMMIT",
            value: `Commit ${cand.shortSha}: "${cand.message}" by ${cand.author} (${cand.classification})`,
            source: "git_history",
            sourceRef: cand.commitSha,
            confidenceLevel: cand.modifiesFailingFile ? "STATICALLY_VERIFIED" : "INFERRED",
            temporalContext: {
                timestamp: cand.commitDate,
                relativeToIncident: cand.classificationReason,
            },
            provenance: `GitHub commit history for commit '${cand.shortSha}' (${cand.classificationReason})`,
        });
    }

    // 6. Preceding & Correlated Events
    for (const ev of snapshot.investigation.rawEvidence) {
        if (ev.id !== snapshot.runtimeContext.anchorErrorId) {
            facts.push({
                id: `fact-ev-${ev.id}`,
                type: ev.type as any,
                value: `${ev.type}: ${ev.title || ev.description || "Telemetry event"}`,
                source: "telemetry",
                sourceRef: ev.id,
                confidenceLevel: "OBSERVED",
                temporalContext: {
                    timestamp: new Date(ev.timestamp),
                },
                provenance: `Captured telemetry event '${ev.id}' in service '${ev.service || "unknown"}'`,
            });
        }
    }

    // Indexing
    const factsById: Record<string, EvidenceFact> = {};
    const factsByType: Record<string, EvidenceFact[]> = {};
    const factsBySource: Record<string, EvidenceFact[]> = {};

    for (const fact of facts) {
        factsById[fact.id] = fact;
        if (!factsByType[fact.type]) factsByType[fact.type] = [];
        factsByType[fact.type]!.push(fact);
        if (!factsBySource[fact.source]) factsBySource[fact.source] = [];
        factsBySource[fact.source]!.push(fact);
    }

    return {
        facts,
        factsById,
        factsByType,
        factsBySource,
    };
}
