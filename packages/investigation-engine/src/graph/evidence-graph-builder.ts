import type { Evidence } from "../types/evidence";
import type {
    ComprehensiveEvidenceGraph,
    InvestigationEntityEdge,
    InvestigationEntityNode,
    EntityNodeType,
    EntityRelationshipType,
    CausalClassification,
} from "../types/graph";

export interface EvidenceGraphBuildOptions {
    evidence: Evidence[];
    incidentAnchorId?: string;
    sessionId?: string | null;
    traceId?: string | null;
    requestId?: string | null;
    releaseVersion?: string | null;
    commitSha?: string | null;
    failingLocation?: {
        filePath?: string;
        lineNumber?: number;
        functionName?: string;
    };
    replaySessionId?: string | null;
    parsedStackFrames?: Array<{
        functionName?: string;
        filePath?: string;
        lineNumber?: number;
        isApplication?: boolean;
    }>;
}

/**
 * Builds a strict occurrence-specific comprehensive evidence graph connecting all
 * observed telemetry entities and evidence-backed relationships.
 */
export function buildComprehensiveEvidenceGraph(
    opts: EvidenceGraphBuildOptions
): ComprehensiveEvidenceGraph {
    const {
        evidence,
        incidentAnchorId,
        sessionId,
        traceId,
        requestId,
        releaseVersion,
        commitSha,
        failingLocation,
        replaySessionId,
        parsedStackFrames = [],
    } = opts;

    const nodes: InvestigationEntityNode[] = [];
    const edges: InvestigationEntityEdge[] = [];
    const nodeMap = new Set<string>();

    const addNode = (node: InvestigationEntityNode) => {
        if (!nodeMap.has(node.id)) {
            nodeMap.add(node.id);
            nodes.push(node);
        }
    };

    const addEdge = (edge: InvestigationEntityEdge) => {
        if (!edges.some((e) => e.from === edge.from && e.to === edge.to && e.relationship === edge.relationship)) {
            edges.push(edge);
        }
    };

    // 1. Identify primary anchor exception
    const allErrors = evidence.filter((e) => e.type === "ERROR");
    const anchorError =
        (incidentAnchorId ? evidence.find((e) => e.id === incidentAnchorId) : undefined) ??
        allErrors[allErrors.length - 1] ??
        allErrors[0] ??
        evidence[0];

    const anchorNodeId = anchorError ? `exception-${anchorError.id}` : undefined;

    if (anchorError) {
        addNode({
            id: `exception-${anchorError.id}`,
            type: "EXCEPTION",
            label: anchorError.title,
            subtitle: anchorError.service ? `Service: ${anchorError.service}` : "Application Exception",
            service: anchorError.service,
            timestamp: anchorError.timestamp,
            location: failingLocation ? `${failingLocation.filePath}:${failingLocation.lineNumber}` : undefined,
            telemetryId: anchorError.id,
            provenance: (anchorError as any).provenance || "sdk",
            status: anchorError.status,
            isAnchor: true,
            isRootCauseCandidate: true,
            metadata: {
                ...anchorError.metadata,
                traceId: anchorError.traceId || traceId,
                requestId: anchorError.requestId || requestId,
                sessionId: anchorError.sessionId || sessionId,
            },
        });

        // 2. Service Entity Node
        if (anchorError.service) {
            const serviceNodeId = `service-${anchorError.service}`;
            addNode({
                id: serviceNodeId,
                type: "SERVICE",
                label: anchorError.service,
                subtitle: "Application Service Runtime",
                service: anchorError.service,
                provenance: "sdk",
            });

            addEdge({
                id: `edge-${serviceNodeId}-${anchorNodeId}`,
                from: serviceNodeId,
                to: anchorNodeId!,
                relationship: "CORRELATED_WITH",
                label: "Host Runtime",
                classification: "Observed",
                strength: 1.0,
                explanation: `Service "${anchorError.service}" is the execution runtime where this exception was captured.`,
                supportingEvidence: [anchorError.id],
                correlationKeys: ["service"],
                provenance: "sdk",
            });
        }
    }

    // 3. Stack Frame, Function & Source File Nodes
    if (anchorNodeId && parsedStackFrames.length > 0) {
        let prevFrameNodeId = anchorNodeId;
        const appFrames = parsedStackFrames.filter((f) => f.isApplication && f.filePath).slice(0, 4);

        for (let i = 0; i < appFrames.length; i++) {
            const frame = appFrames[i];
            const frameId = `frame-${i}-${frame.filePath?.split("/").pop()}:${frame.lineNumber}`;

            addNode({
                id: frameId,
                type: "STACK_FRAME",
                label: `${frame.functionName || "anonymous"}()`,
                subtitle: `${frame.filePath}:${frame.lineNumber}`,
                location: `${frame.filePath}:${frame.lineNumber}`,
                provenance: "stack_trace",
                metadata: {
                    filePath: frame.filePath,
                    lineNumber: frame.lineNumber,
                    functionName: frame.functionName,
                },
            });

            addEdge({
                id: `edge-${prevFrameNodeId}-${frameId}`,
                from: prevFrameNodeId,
                to: frameId,
                relationship: "CALLED",
                label: i === 0 ? "Failing Frame" : "Caller Frame",
                classification: "Observed",
                strength: 0.95 - i * 0.05,
                explanation: `Call stack trace explicitly links execution to ${frame.filePath}:${frame.lineNumber}.`,
                supportingEvidence: anchorError ? [anchorError.id] : [],
                correlationKeys: ["stack"],
                provenance: "stack_trace",
            });

            // Source File Node
            if (frame.filePath) {
                const fileNodeId = `file-${frame.filePath}`;
                addNode({
                    id: fileNodeId,
                    type: "SOURCE_FILE",
                    label: frame.filePath.split("/").pop() || frame.filePath,
                    subtitle: frame.filePath,
                    location: frame.filePath,
                    provenance: "ast_resolver",
                });

                addEdge({
                    id: `edge-${frameId}-${fileNodeId}`,
                    from: frameId,
                    to: fileNodeId,
                    relationship: "DEPENDS_ON",
                    label: "Defined In",
                    classification: "Observed",
                    strength: 1.0,
                    explanation: `Execution frame is located inside source file "${frame.filePath}".`,
                    supportingEvidence: anchorError ? [anchorError.id] : [],
                    correlationKeys: ["filePath"],
                    provenance: "stack_trace",
                });
            }

            // Function Node
            if (frame.functionName && frame.functionName !== "anonymous") {
                const fnNodeId = `fn-${frame.functionName}`;
                addNode({
                    id: fnNodeId,
                    type: "FUNCTION",
                    label: `${frame.functionName}()`,
                    subtitle: `Function in ${frame.filePath?.split("/").pop() || "source"}`,
                    location: `${frame.filePath}:${frame.lineNumber}`,
                    provenance: "ast_resolver",
                });

                addEdge({
                    id: `edge-${frameId}-${fnNodeId}`,
                    from: frameId,
                    to: fnNodeId,
                    relationship: "CALLED",
                    label: "Executing Function",
                    classification: "Observed",
                    strength: 1.0,
                    explanation: `Frame executed within body of function "${frame.functionName}()".`,
                    supportingEvidence: anchorError ? [anchorError.id] : [],
                    correlationKeys: ["functionName"],
                    provenance: "ast_resolver",
                });
            }

            prevFrameNodeId = frameId;
        }
    }

    // 4. HTTP Request & Upstream Failure Nodes
    const requestEvidence = evidence.filter(
        (e) => (e.type as string) === "REQUEST" || (e.type as string) === "SPAN" || Boolean(e.operation && e.resource)
    );

    for (const req of requestEvidence) {
        const reqNodeId = `request-${req.id}`;
        const isFailed = (typeof req.status === "number" && req.status >= 400) || (typeof req.status === "string" && req.status.startsWith("5"));

        addNode({
            id: reqNodeId,
            type: "REQUEST",
            label: req.operation && req.resource ? `${req.operation} ${req.resource}` : req.title,
            subtitle: req.status ? `HTTP ${req.status}` : "Network Request",
            service: req.service,
            timestamp: req.timestamp,
            telemetryId: req.id,
            status: req.status,
            provenance: (req as any).provenance || "sdk",
            metadata: {
                operation: req.operation,
                resource: req.resource,
                durationMs: req.durationMs,
                traceId: req.traceId,
                requestId: req.requestId,
            },
        });

        if (anchorNodeId) {
            const hasSharedTrace = req.traceId && (req.traceId === anchorError?.traceId || req.traceId === traceId);
            const hasSharedRequest = req.requestId && (req.requestId === anchorError?.requestId || req.requestId === requestId);
            const isObserved = Boolean(hasSharedTrace || hasSharedRequest);
            const isCausal = isFailed && isObserved;

            addEdge({
                id: `edge-${reqNodeId}-${anchorNodeId}`,
                from: reqNodeId,
                to: anchorNodeId,
                relationship: isCausal ? "CAUSED" : isFailed ? "PRECEDED" : "PRECEDED",
                label: isCausal ? "Upstream Trigger" : isFailed ? "Preceding Failure" : "Preceding Request",
                classification: isObserved ? "Observed" : "Inferred",
                strength: isCausal ? 0.95 : isObserved ? 0.8 : 0.6,
                explanation: isCausal
                    ? `Request "${req.title}" failed with status ${req.status} and directly shares correlation identifiers (${req.traceId || req.requestId}) with the downstream exception.`
                    : isObserved
                    ? `Request "${req.title}" completed within the shared trace context (${req.traceId || req.requestId}).`
                    : `Request "${req.title}" was recorded in proximity to the exception, but direct correlation IDs were not present.`,
                supportingEvidence: [req.id, anchorError!.id],
                correlationKeys: [
                    ...(req.traceId ? [`traceId:${req.traceId}`] : []),
                    ...(req.requestId ? [`requestId:${req.requestId}`] : []),
                ],
                timestamps: {
                    from: req.timestamp,
                    to: anchorError?.timestamp,
                    deltaMs: anchorError ? Math.abs(anchorError.timestamp.getTime() - req.timestamp.getTime()) : undefined,
                },
                provenance: (req as any).provenance || "sdk",
            });
        }
    }

    // 5. Distributed Trace & Span Nodes
    const activeTraceId = traceId || anchorError?.traceId;
    if (activeTraceId) {
        const traceNodeId = `trace-${activeTraceId}`;
        addNode({
            id: traceNodeId,
            type: "TRACE",
            label: `Trace ${activeTraceId.slice(0, 10)}…`,
            subtitle: "Distributed Trace Context",
            telemetryId: activeTraceId,
            provenance: "open_telemetry",
            metadata: { traceId: activeTraceId },
        });

        if (anchorNodeId) {
            addEdge({
                id: `edge-${anchorNodeId}-${traceNodeId}`,
                from: anchorNodeId,
                to: traceNodeId,
                relationship: "CORRELATED_WITH",
                label: "Trace Context",
                classification: "Observed",
                strength: 1.0,
                explanation: `Exception was recorded under distributed trace ID "${activeTraceId}".`,
                supportingEvidence: anchorError ? [anchorError.id] : [],
                correlationKeys: [`traceId:${activeTraceId}`],
                provenance: "open_telemetry",
            });
        }
    }

    // 6. User Session & Replay Nodes
    const activeSessionId = sessionId || anchorError?.sessionId;
    if (activeSessionId) {
        const sessionNodeId = `session-${activeSessionId}`;
        addNode({
            id: sessionNodeId,
            type: "USER_SESSION",
            label: `Session ${activeSessionId.slice(0, 10)}…`,
            subtitle: replaySessionId ? "Reconstructed Session Replay" : "Client User Session",
            telemetryId: activeSessionId,
            provenance: replaySessionId ? "session_replay" : "sdk",
            metadata: { sessionId: activeSessionId, replaySessionId },
        });

        if (anchorNodeId) {
            addEdge({
                id: `edge-${sessionNodeId}-${anchorNodeId}`,
                from: sessionNodeId,
                to: anchorNodeId,
                relationship: replaySessionId ? "REPRODUCED_BY" : "CORRELATED_WITH",
                label: replaySessionId ? "Reproduced in Replay" : "Session Context",
                classification: "Observed",
                strength: 1.0,
                explanation: replaySessionId
                    ? `Session replay directly recorded DOM interactions leading to this exception.`
                    : `Exception occurred in user session "${activeSessionId}".`,
                supportingEvidence: anchorError ? [anchorError.id] : [],
                correlationKeys: [`sessionId:${activeSessionId}`],
                provenance: replaySessionId ? "session_replay" : "sdk",
            });
        }
    }

    // 7. Deployment, Release & Commit Nodes
    const activeRelease = releaseVersion || anchorError?.release;
    if (activeRelease) {
        const releaseNodeId = `release-${activeRelease}`;
        addNode({
            id: releaseNodeId,
            type: "RELEASE",
            label: `Release ${activeRelease}`,
            subtitle: "Deployed Software Version",
            provenance: "git",
            metadata: { release: activeRelease },
        });

        if (anchorNodeId) {
            addEdge({
                id: `edge-${releaseNodeId}-${anchorNodeId}`,
                from: releaseNodeId,
                to: anchorNodeId,
                relationship: "DEPLOYED_WITH",
                label: "Software Release",
                classification: "Observed",
                strength: 1.0,
                explanation: `Exception was captured while running release version "${activeRelease}".`,
                supportingEvidence: anchorError ? [anchorError.id] : [],
                correlationKeys: [`release:${activeRelease}`],
                provenance: "git",
            });
        }

        // Commit Node
        const activeCommit = commitSha || (anchorError?.metadata as any)?.commitSha;
        if (activeCommit) {
            const shortSha = activeCommit.slice(0, 7);
            const commitNodeId = `commit-${shortSha}`;
            addNode({
                id: commitNodeId,
                type: "COMMIT",
                label: `Commit ${shortSha}`,
                subtitle: `Git revision for ${activeRelease}`,
                telemetryId: activeCommit,
                provenance: "github",
                metadata: { commitSha: activeCommit },
            });

            addEdge({
                id: `edge-${commitNodeId}-${releaseNodeId}`,
                from: commitNodeId,
                to: releaseNodeId,
                relationship: "DEPLOYED_WITH",
                label: "Built From Commit",
                classification: "Observed",
                strength: 1.0,
                explanation: `Release "${activeRelease}" was packaged from commit ${shortSha}.`,
                supportingEvidence: [],
                correlationKeys: [`commit:${shortSha}`],
                provenance: "git",
            });

            // If source file exists in graph, link commit to source file
            if (failingLocation?.filePath) {
                const fileNodeId = `file-${failingLocation.filePath}`;
                if (nodeMap.has(fileNodeId)) {
                    addEdge({
                        id: `edge-${commitNodeId}-${fileNodeId}`,
                        from: commitNodeId,
                        to: fileNodeId,
                        relationship: "CHANGED_BY",
                        label: "Source Track",
                        classification: "Inferred",
                        strength: 0.85,
                        explanation: `Commit ${shortSha} modified code in "${failingLocation.filePath}".`,
                        supportingEvidence: [],
                        correlationKeys: [`commit:${shortSha}`, `filePath:${failingLocation.filePath}`],
                        provenance: "github",
                    });
                }
            }
        }
    }

    // 8. Log and Database Operations
    const logAndDbEvidence = evidence.filter((e) => e.type === "LOG" || (e.type as string) === "DATABASE_OPERATION");
    for (const item of logAndDbEvidence.slice(0, 5)) {
        const isDb = (item.type as string) === "DATABASE_OPERATION" || item.title.toLowerCase().includes("query");
        const entityType: EntityNodeType = isDb ? "DATABASE_OPERATION" : "LOG";
        const itemId = `${entityType.toLowerCase()}-${item.id}`;

        addNode({
            id: itemId,
            type: entityType,
            label: item.title,
            subtitle: item.service ? `Service: ${item.service}` : "Telemetry Record",
            service: item.service,
            timestamp: item.timestamp,
            telemetryId: item.id,
            provenance: (item as any).provenance || "sdk",
            metadata: item.metadata,
        });

        if (anchorNodeId) {
            addEdge({
                id: `edge-${itemId}-${anchorNodeId}`,
                from: itemId,
                to: anchorNodeId,
                relationship: "PRECEDED",
                label: isDb ? "Database Query" : "Correlated Log",
                classification: "Observed",
                strength: 0.8,
                explanation: `${isDb ? "Database operation" : "Log message"} preceded the exception.`,
                supportingEvidence: [item.id, anchorError!.id],
                correlationKeys: [],
                timestamps: {
                    from: item.timestamp,
                    to: anchorError?.timestamp,
                    deltaMs: anchorError ? Math.abs(anchorError.timestamp.getTime() - item.timestamp.getTime()) : undefined,
                },
                provenance: (item as any).provenance || "sdk",
            });
        }
    }

    // Compute summary
    const observedCount = edges.filter((e) => e.classification === "Observed").length;
    const inferredCount = edges.filter((e) => e.classification === "Inferred").length;
    const correlatedCount = edges.filter((e) => e.relationship === "CORRELATED_WITH" || e.relationship === "PRECEDED").length;

    return {
        nodes,
        edges,
        anchorNodeId,
        summary: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            observedCount,
            inferredCount,
            correlatedCount,
        },
    };
}
