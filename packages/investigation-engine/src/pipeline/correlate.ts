import type { Evidence } from "../types/evidence";
import type {
    CausalClassification,
    EvidenceEdge,
    EvidenceGraph,
    RelationshipType,
    StrengthFactor,
    StructuralCodeRelationship,
    TemporalRelationship,
} from "../types/graph";
import { parseStackTrace } from "../runtime/stack-parser";

const TEMPORAL_WINDOW_MS = 5 * 60 * 1000;
const CAUSAL_WINDOW_MS = 10 * 60 * 1000;
const MAX_RELATIONSHIP_EDGES_PER_GROUP = 100;

type EdgeOptions = {
    classification?: CausalClassification;
    temporal?: TemporalRelationship;
    structural?: StructuralCodeRelationship;
    strength?: number;
    strengthFactors?: StrengthFactor[];
    explanation?: string;
    provenance?: string;
};

type AddEdge = (
    from: Evidence,
    to: Evidence,
    relationship: RelationshipType,
    confidence: number,
    options?: EdgeOptions
) => void;

export function correlateEvidence(
    evidence: Evidence[]
): EvidenceGraph {
    const nodes = evidence.map(item => ({
        id: item.id,
        evidence: item,
    }));

    if (evidence.length < 2) {
        return {
            nodes,
            edges: [],
        };
    }

    const edges: EvidenceEdge[] = [];
    const edgeKeys = new Set<string>();

    const addEdge: AddEdge = (
        from: Evidence,
        to: Evidence,
        relationship: RelationshipType,
        confidence: number,
        options?: EdgeOptions
    ) => {
        if (from.id === to.id) {
            return;
        }

        const normalizedConfidence = clamp(confidence);
        if (normalizedConfidence <= 0) {
            return;
        }

        const key = `${from.id}:${to.id}:${relationship}`;
        if (edgeKeys.has(key)) {
            return;
        }

        edgeKeys.add(key);

        const temporal = options?.temporal ?? calculateTemporalRelationship(from, to);
        const strength = options?.strength ?? normalizedConfidence;
        const classification = options?.classification ?? determineClassification(from, to, relationship, options);
        const explanation = options?.explanation ?? generateDefaultExplanation(from, to, relationship, classification, temporal);

        edges.push({
            from: from.id,
            to: to.id,
            relationship,
            confidence: normalizedConfidence,
            evidenceIds: [from.id, to.id],
            classification,
            temporal,
            structural: options?.structural,
            strength,
            strengthFactors: options?.strengthFactors,
            explanation,
            provenance: options?.provenance ?? from.source,
        });
    };

    const chronological = [...evidence].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // 1. Direct Distributed Tracing & Parent-Child Span Hierarchies (Observed)
    buildTraceHierarchyEdges(evidence, addEdge);

    // 2. Request & Correlated Context Edges (Observed / Inferred)
    buildRequestContextEdges(evidence, addEdge);

    // 3. Stack Frame & Code Location Relationships (Observed / Inferred)
    buildStructuralCodeEdges(evidence, addEdge);

    // 4. Database & Query Operations (Observed / Inferred)
    buildDatabaseQueryEdges(evidence, addEdge);

    // 5. Upstream Request Failure -> Downstream Exception Cascade (Observed / Inferred)
    buildCascadingFailureEdges(chronological, addEdge);

    // 6. Change Trigger Candidates (Deployments, Configs, Flags, Infra) (Inferred / Likely)
    buildCausalCandidates(chronological, addEdge);

    // 7. Identity & Resource Correlations (Same Service, Release, Resource, Dependency)
    buildIdentityRelationships(evidence, addEdge);

    // 8. Temporal Precedence (Supporting signal only)
    buildTemporalEdges(chronological, addEdge);

    return {
        nodes,
        edges,
    };
}

export function calculateTemporalRelationship(
    left: Evidence,
    right: Evidence
): TemporalRelationship {
    const t1 = left.timestamp?.getTime();
    const t2 = right.timestamp?.getTime();

    if (typeof t1 !== "number" || typeof t2 !== "number" || isNaN(t1) || isNaN(t2)) {
        return "UNKNOWN";
    }

    const dur1 = typeof left.durationMs === "number" && left.durationMs > 0 ? left.durationMs : 0;
    const dur2 = typeof right.durationMs === "number" && right.durationMs > 0 ? right.durationMs : 0;

    const end1 = t1 + dur1;
    const end2 = t2 + dur2;

    if (t1 <= t2 && end1 >= end2 && dur1 > 0) {
        return "CONTAINS";
    }

    if (t1 <= t2 && end1 >= t2 && (end1 < end2 || dur1 > 0)) {
        return "OVERLAPS";
    }

    const delta = t2 - t1;
    if (delta >= 0 && delta <= 1000) {
        return "IMMEDIATELY_PRECEDES";
    }

    if (t1 === t2) {
        return "TEMPORALLY_CORRELATED";
    }

    if (delta > 0) {
        return "BEFORE";
    }

    return "AFTER";
}

function buildTraceHierarchyEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    // Parent span -> Child span mapping
    const spanMap = new Map<string, Evidence>();
    for (const item of evidence) {
        if (item.spanId) {
            spanMap.set(item.spanId, item);
        }
    }

    for (const child of evidence) {
        if (child.parentSpanId) {
            const parent = spanMap.get(child.parentSpanId);
            if (parent && parent.id !== child.id) {
                const factors: StrengthFactor[] = [
                    {
                        factor: "Direct Parent-Child Span Hierarchy",
                        contribution: 1.0,
                        explanation: `Child span ${child.spanId} explicitly references parent span ${parent.spanId}`,
                    },
                ];

                addEdge(
                    parent,
                    child,
                    "CHILD_SPAN_OF",
                    1.0,
                    {
                        classification: "Observed",
                        temporal: calculateTemporalRelationship(parent, child),
                        strength: 1.0,
                        strengthFactors: factors,
                        explanation: `Telemetry explicitly links child operation "${child.operation || child.title}" to parent "${parent.operation || parent.title}" via span hierarchy (parent: ${parent.spanId}, child: ${child.spanId}).`,
                        provenance: child.source,
                    }
                );
            }
        }
    }
}

function buildRequestContextEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (let i = 0; i < evidence.length; i++) {
        const left = evidence[i];
        for (let j = i + 1; j < evidence.length; j++) {
            const right = evidence[j];

            // Same Request ID correlation
            if (left.requestId && right.requestId && left.requestId === right.requestId) {
                const isErrorOrTrace = left.type === "ERROR" || right.type === "ERROR" || left.type === "TRACE" || right.type === "TRACE";
                if (isErrorOrTrace) {
                    const factors: StrengthFactor[] = [
                        {
                            factor: "Matching Request ID",
                            contribution: 0.95,
                            explanation: `Both telemetry items share explicit Request ID: ${left.requestId}`,
                        },
                    ];

                    addEdge(
                        left,
                        right,
                        "REQUEST_SPAN",
                        0.95,
                        {
                            classification: "Observed",
                            temporal: calculateTemporalRelationship(left, right),
                            strength: 0.95,
                            strengthFactors: factors,
                            explanation: `Correlated by exact matching Request ID "${left.requestId}".`,
                            provenance: left.source,
                        }
                    );
                }
            }

            // Request -> Correlated Log / Breadcrumb
            if (
                (left.type === "LOG" && right.type !== "LOG") ||
                (left.type !== "LOG" && right.type === "LOG")
            ) {
                const logItem = left.type === "LOG" ? left : right;
                const otherItem = left.type === "LOG" ? right : left;

                const sharesTrace = Boolean(logItem.traceId && otherItem.traceId && logItem.traceId === otherItem.traceId);
                const sharesRequest = Boolean(logItem.requestId && otherItem.requestId && logItem.requestId === otherItem.requestId);
                const sharesSession = Boolean(
                    logItem.metadata?.sessionId && otherItem.metadata?.sessionId && logItem.metadata.sessionId === otherItem.metadata.sessionId
                );

                if (sharesTrace || sharesRequest) {
                    addEdge(
                        logItem,
                        otherItem,
                        "CORRELATED_LOG",
                        0.9,
                        {
                            classification: "Observed",
                            temporal: calculateTemporalRelationship(logItem, otherItem),
                            strength: 0.9,
                            strengthFactors: [
                                {
                                    factor: sharesTrace ? "Matching Trace ID" : "Matching Request ID",
                                    contribution: 0.9,
                                    explanation: `Log event is correlated with ${otherItem.type} event via ${sharesTrace ? `trace ${logItem.traceId}` : `request ${logItem.requestId}`}`,
                                },
                            ],
                            explanation: `Log event "${logItem.title}" occurred within the execution of ${otherItem.service} (${otherItem.title}).`,
                            provenance: logItem.source,
                        }
                    );
                } else if (sharesSession && logItem.service === otherItem.service) {
                    addEdge(
                        logItem,
                        otherItem,
                        "CORRELATED_LOG",
                        0.75,
                        {
                            classification: "Inferred",
                            temporal: calculateTemporalRelationship(logItem, otherItem),
                            strength: 0.75,
                            explanation: `Log event correlated within the same user/telemetry session on service ${logItem.service}.`,
                            provenance: logItem.source,
                        }
                    );
                }
            }
        }
    }
}

function buildStructuralCodeEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (const item of evidence) {
        if (item.type === "ERROR") {
            const rawStack =
                typeof item.metadata?.stack === "string"
                    ? item.metadata.stack
                    : item.description || "";

            const frames = parseStackTrace(rawStack);
            if (frames.length > 0) {
                const primaryFrame = frames.find(f => f.isApplication && f.lineNumber) || frames[0];
                if (primaryFrame) {
                    const structural: StructuralCodeRelationship = {
                        relationType: "FRAME_LOCATION",
                        functionName: primaryFrame.functionName,
                        filePath: primaryFrame.filePath,
                        lineNumber: primaryFrame.lineNumber,
                        columnNumber: primaryFrame.columnNumber,
                        callPath: frames.slice(0, 5).map(f => `${f.functionName} (${f.filePath}:${f.lineNumber || 0})`),
                        stackFrame: `${primaryFrame.functionName} at ${primaryFrame.filePath}:${primaryFrame.lineNumber || 0}`,
                        explanation: `Exception originated at ${primaryFrame.functionName} (${primaryFrame.filePath}:${primaryFrame.lineNumber || 0})`,
                    };

                    // Search for related source/telemetry evidence sharing the same file or operation
                    for (const other of evidence) {
                        if (other.id !== item.id) {
                            const isSameOperation = other.operation && primaryFrame.functionName && other.operation.includes(primaryFrame.functionName);
                            const isSameFile = other.resource && primaryFrame.filePath && other.resource.includes(primaryFrame.filePath);

                            if (isSameOperation || isSameFile) {
                                addEdge(
                                    other,
                                    item,
                                    "STACK_FRAME_CALLS",
                                    0.85,
                                    {
                                        classification: "Observed",
                                        temporal: calculateTemporalRelationship(other, item),
                                        structural,
                                        strength: 0.85,
                                        strengthFactors: [
                                            {
                                                factor: "Stack Frame Code Match",
                                                contribution: 0.85,
                                                explanation: `Stack frame points directly to function ${primaryFrame.functionName} in ${primaryFrame.filePath}`,
                                            },
                                        ],
                                        explanation: `Stack trace in ${item.service} points to execution location in ${primaryFrame.filePath}:${primaryFrame.lineNumber || 0}.`,
                                        provenance: item.source,
                                    }
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}

function buildDatabaseQueryEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (let i = 0; i < evidence.length; i++) {
        const left = evidence[i];
        for (let j = i + 1; j < evidence.length; j++) {
            const right = evidence[j];

            const leftIsDb = isDatabaseEvidence(left);
            const rightIsDb = isDatabaseEvidence(right);

            if (leftIsDb !== rightIsDb) {
                const dbItem = leftIsDb ? left : right;
                const appItem = leftIsDb ? right : left;

                const sharesTrace = Boolean(dbItem.traceId && appItem.traceId && dbItem.traceId === appItem.traceId);
                const sharesRequest = Boolean(dbItem.requestId && appItem.requestId && dbItem.requestId === appItem.requestId);
                const sameServiceMatch = dbItem.service === appItem.service;

                if (sharesTrace || sharesRequest) {
                    const factors: StrengthFactor[] = [
                        {
                            factor: "Database Query within Trace Context",
                            contribution: 0.9,
                            explanation: `Database operation "${dbItem.operation || dbItem.title}" belongs to the same trace/request as ${appItem.service}`,
                        },
                    ];

                    addEdge(
                        dbItem,
                        appItem,
                        "EXECUTES_QUERY",
                        0.9,
                        {
                            classification: "Observed",
                            temporal: calculateTemporalRelationship(dbItem, appItem),
                            strength: 0.9,
                            strengthFactors: factors,
                            explanation: `Database query "${dbItem.resource || dbItem.operation || dbItem.title}" was executed during the operation of ${appItem.title}.`,
                            provenance: dbItem.source,
                        }
                    );
                } else if (sameServiceMatch && Math.abs(dbItem.timestamp.getTime() - appItem.timestamp.getTime()) <= 5000) {
                    addEdge(
                        dbItem,
                        appItem,
                        "EXECUTES_QUERY",
                        0.75,
                        {
                            classification: "Inferred",
                            temporal: calculateTemporalRelationship(dbItem, appItem),
                            strength: 0.75,
                            explanation: `Database query in ${dbItem.service} occurred concurrently with ${appItem.title}.`,
                            provenance: dbItem.source,
                        }
                    );
                }
            }
        }
    }
}

function buildCascadingFailureEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    const failedRequests = evidence.filter(e => {
        const statusStr = String(e.status || "");
        const text = `${e.title} ${e.description || ""} ${e.operation || ""}`;
        return statusStr.startsWith("5") || statusStr.startsWith("4") || /\b(500|502|503|504)\b/.test(text) || (typeof e.status === "number" && e.status >= 400);
    });

    const errorEvents = evidence.filter(e => e.type === "ERROR" || isFailedStatus(e.status));

    for (const req of failedRequests) {
        for (const err of errorEvents) {
            if (req.id === err.id) continue;

            const delta = err.timestamp.getTime() - req.timestamp.getTime();
            // Must happen after or concurrently within 30 seconds
            if (delta < -100 || delta > 30000) continue;

            const isSameTrace = Boolean(req.traceId && err.traceId && req.traceId === err.traceId);
            const isSameRequest = Boolean(req.requestId && err.requestId && req.requestId === err.requestId);
            const isSameSession = Boolean(
                req.metadata?.sessionId && err.metadata?.sessionId && req.metadata.sessionId === err.metadata.sessionId
            );

            let classification: CausalClassification = "Unknown";
            let strength = 0.5;
            const factors: StrengthFactor[] = [];

            if (isSameTrace || isSameRequest) {
                classification = "Observed";
                strength = 0.95;
                factors.push({
                    factor: "Direct Trace / Request Linkage",
                    contribution: 0.95,
                    explanation: `Upstream HTTP ${req.status || "500"} and downstream error share trace ID ${req.traceId || req.requestId}`,
                });
            } else if (isSameSession) {
                classification = "Inferred";
                strength = 0.85;
                factors.push({
                    factor: "Correlated Session Linkage",
                    contribution: 0.85,
                    explanation: `Upstream failure on ${req.resource || req.operation || "endpoint"} preceded error in the same user session (+${Math.round(delta)}ms)`,
                });
            } else {
                // Chronological proximity alone without trace/request/session linkage is insufficient to create a causal edge.
                continue;
            }

            addEdge(
                req,
                err,
                "DOWNSTREAM_FAILURE_OF",
                strength,
                {
                    classification,
                    temporal: calculateTemporalRelationship(req, err),
                    strength,
                    strengthFactors: factors,
                    explanation: `Upstream call "${req.resource || req.operation || req.title}" returned ${req.status || "failure"}. Downstream ${err.service} subsequently threw "${err.title}" (+${Math.round(delta)}ms).`,
                    provenance: req.source,
                }
            );
        }
    }
}

function buildCausalCandidates(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (let i = 0; i < evidence.length; i++) {
        const left = evidence[i];

        for (let j = i + 1; j < evidence.length; j++) {
            const right = evidence[j];

            const difference = right.timestamp.getTime() - left.timestamp.getTime();
            if (difference > CAUSAL_WINDOW_MS) {
                break;
            }

            if (difference < 0) {
                continue;
            }

            if (isDeployment(left) && isFailure(right) && sameService(left, right)) {
                const sameReleaseMatch = Boolean(left.release && right.release && left.release === right.release);
                const classification: CausalClassification = sameReleaseMatch ? "Observed" : "Likely";
                const strength = deploymentTriggerConfidence(left, right, difference);

                addEdge(
                    left,
                    right,
                    "TRIGGERS",
                    strength,
                    {
                        classification,
                        temporal: calculateTemporalRelationship(left, right),
                        strength,
                        strengthFactors: [
                            {
                                factor: "Deployment Scope & Temporal Precedence",
                                contribution: strength,
                                explanation: `Deployment "${left.title}" preceded failure in ${right.service} by ${Math.round(difference / 1000)}s`,
                            },
                        ],
                        explanation: `Deployment "${left.title}" in ${left.service} preceded error "${right.title}" (+${Math.round(difference / 1000)}s).`,
                        provenance: left.source,
                    }
                );
                continue;
            }

            if (isConfigChange(left) && isFailure(right) && (sameService(left, right) || sameResource(left, right))) {
                const strength = changeTriggerConfidence(left, right, difference);
                addEdge(
                    left,
                    right,
                    "MODIFIES",
                    strength,
                    {
                        classification: "Likely",
                        temporal: calculateTemporalRelationship(left, right),
                        strength,
                        strengthFactors: [
                            {
                                factor: "Configuration Change Precedence",
                                contribution: strength,
                                explanation: `Configuration change "${left.title}" preceded failure in ${right.service}`,
                            },
                        ],
                        explanation: `Configuration change "${left.title}" modified runtime environment before error in ${right.service}.`,
                        provenance: left.source,
                    }
                );
                continue;
            }

            if (isFeatureFlagChange(left) && isFailure(right) && (sameService(left, right) || sameResource(left, right))) {
                const strength = changeTriggerConfidence(left, right, difference);
                addEdge(
                    left,
                    right,
                    "MODIFIES",
                    strength,
                    {
                        classification: "Likely",
                        temporal: calculateTemporalRelationship(left, right),
                        strength,
                        strengthFactors: [
                            {
                                factor: "Feature Flag Mutation",
                                contribution: strength,
                                explanation: `Feature flag change "${left.title}" activated before failure in ${right.service}`,
                            },
                        ],
                        explanation: `Feature flag toggle "${left.title}" preceded error "${right.title}".`,
                        provenance: left.source,
                    }
                );
                continue;
            }

            if (isInfrastructureChange(left) && isFailure(right)) {
                const scopeMatch = sameService(left, right) || sameResource(left, right);
                if (scopeMatch) {
                    const strength = infrastructureConfidence(left, right, difference);
                    addEdge(
                        left,
                        right,
                        "AFFECTS",
                        strength,
                        {
                            classification: "Likely",
                            temporal: calculateTemporalRelationship(left, right),
                            strength,
                            strengthFactors: [
                                {
                                    factor: "Infrastructure Degradation",
                                    contribution: strength,
                                    explanation: `Infrastructure event "${left.title}" affected resource ${left.resource || left.service}`,
                                },
                            ],
                            explanation: `Infrastructure state change "${left.title}" preceded failure in ${right.service}.`,
                            provenance: left.source,
                        }
                    );
                }
            }
        }
    }
}

function buildIdentityRelationships(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    addGroupedRelationships(
        evidence,
        item => item.service,
        "SAME_SERVICE",
        0.55,
        "Inferred",
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.release,
        "SAME_RELEASE",
        0.8,
        "Observed",
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.traceId,
        "SAME_TRACE",
        0.95,
        "Observed",
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.requestId,
        "SAME_REQUEST",
        0.95,
        "Observed",
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.resource,
        "SAME_RESOURCE",
        0.75,
        "Inferred",
        addEdge
    );

    addResourceDependencyRelationships(
        evidence,
        addEdge
    );
}

function addGroupedRelationships(
    evidence: Evidence[],
    keySelector: (evidence: Evidence) => string | undefined,
    relationship: RelationshipType,
    baseConfidence: number,
    classification: CausalClassification,
    addEdge: AddEdge
) {
    const groups = new Map<string, Evidence[]>();

    for (const item of evidence) {
        const key = keySelector(item);
        if (!key) {
            continue;
        }

        const group = groups.get(key) ?? [];
        group.push(item);
        groups.set(key, group);
    }

    for (const group of groups.values()) {
        if (group.length < 2) {
            continue;
        }

        const limited = group.slice(0, MAX_RELATIONSHIP_EDGES_PER_GROUP);

        for (let i = 0; i < limited.length; i++) {
            for (let j = i + 1; j < limited.length; j++) {
                const left = limited[i];
                const right = limited[j];

                const temporalFactor = temporalRelationshipFactor(left, right);
                const confidence = baseConfidence * temporalFactor;

                addEdge(
                    left,
                    right,
                    relationship,
                    confidence,
                    {
                        classification,
                        temporal: calculateTemporalRelationship(left, right),
                        strength: confidence,
                        explanation: `Linked by shared ${relationship.toLowerCase().replace("same_", "")}: "${keySelector(left)}".`,
                        provenance: left.source,
                    }
                );
            }
        }
    }
}

function addResourceDependencyRelationships(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    const resourceEvidence = evidence.filter(item => Boolean(item.resource));

    for (let i = 0; i < resourceEvidence.length; i++) {
        const left = resourceEvidence[i];

        for (let j = i + 1; j < resourceEvidence.length; j++) {
            const right = resourceEvidence[j];

            if (!sameServiceOrRelease(left, right) && left.resource !== right.resource) {
                continue;
            }

            if (!sharesResourceSignal(left, right)) {
                continue;
            }

            const leftIsDependency = isDependencyEvidence(left);
            const rightIsFailure = isFailureEvidence(right);

            if (leftIsDependency && rightIsFailure && isEarlier(left, right)) {
                const confidence = dependencyConfidence(left, right);
                addEdge(
                    left,
                    right,
                    "DEPENDS_ON",
                    confidence,
                    {
                        classification: "Inferred",
                        temporal: calculateTemporalRelationship(left, right),
                        strength: confidence,
                        explanation: `Service ${right.service} depends on resource ${left.resource || left.service}.`,
                        provenance: left.source,
                    }
                );
            }

            const rightIsDependency = isDependencyEvidence(right);
            const leftIsFailure = isFailureEvidence(left);

            if (rightIsDependency && leftIsFailure && isEarlier(right, left)) {
                const confidence = dependencyConfidence(right, left);
                addEdge(
                    right,
                    left,
                    "DEPENDS_ON",
                    confidence,
                    {
                        classification: "Inferred",
                        temporal: calculateTemporalRelationship(right, left),
                        strength: confidence,
                        explanation: `Service ${left.service} depends on resource ${right.resource || right.service}.`,
                        provenance: right.source,
                    }
                );
            }
        }
    }
}

function buildTemporalEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (let i = 0; i < evidence.length; i++) {
        const current = evidence[i];
        let neighbors = 0;

        for (let j = i + 1; j < evidence.length; j++) {
            if (neighbors >= 12) {
                break;
            }

            const next = evidence[j];
            const difference = next.timestamp.getTime() - current.timestamp.getTime();

            if (difference > TEMPORAL_WINDOW_MS) {
                break;
            }

            if (difference <= 0) {
                continue;
            }

            // Only add PRECEDES if there is a real scope or correlation signal
            // (e.g. same service, same trace, or related operation).
            // Do NOT connect completely unrelated events across different services without shared context.
            const hasSharedContext =
                sameService(current, next) ||
                (current.traceId && next.traceId && current.traceId === next.traceId) ||
                (current.requestId && next.requestId && current.requestId === next.requestId) ||
                (current.resource && next.resource && current.resource === next.resource);

            if (!hasSharedContext) {
                continue;
            }

            const proximity = 1 - difference / TEMPORAL_WINDOW_MS;
            const relevance = temporalRelevance(current, next);
            const confidence = proximity * relevance * 0.5;

            addEdge(
                current,
                next,
                "PRECEDES",
                confidence,
                {
                    classification: "Likely",
                    temporal: calculateTemporalRelationship(current, next),
                    strength: confidence,
                    explanation: `Event in ${current.service} temporally preceded event in ${next.service} (+${Math.round(difference / 1000)}s).`,
                    provenance: current.source,
                }
            );

            neighbors++;
        }
    }
}

function determineClassification(
    left: Evidence,
    right: Evidence,
    relationship: RelationshipType,
    options?: EdgeOptions
): CausalClassification {
    if (options?.classification) {
        return options.classification;
    }

    if (
        relationship === "CHILD_SPAN_OF" ||
        relationship === "SAME_TRACE" ||
        relationship === "SAME_REQUEST" ||
        relationship === "SAME_RELEASE"
    ) {
        return "Observed";
    }

    if (
        relationship === "EXECUTES_QUERY" ||
        relationship === "STACK_FRAME_CALLS" ||
        relationship === "DOWNSTREAM_FAILURE_OF" ||
        relationship === "CORRELATED_LOG"
    ) {
        return left.traceId === right.traceId ? "Observed" : "Inferred";
    }

    if (
        relationship === "TRIGGERS" ||
        relationship === "MODIFIES" ||
        relationship === "AFFECTS" ||
        relationship === "DEPENDS_ON"
    ) {
        return "Likely";
    }

    return "Inferred";
}

function generateDefaultExplanation(
    left: Evidence,
    right: Evidence,
    relationship: RelationshipType,
    classification: CausalClassification,
    temporal: TemporalRelationship
): string {
    switch (relationship) {
        case "CHILD_SPAN_OF":
            return `Direct parent-child span relationship (parent: ${left.operation || left.title} -> child: ${right.operation || right.title}).`;
        case "SAME_TRACE":
            return `Both events share distributed trace ID: ${left.traceId}.`;
        case "SAME_REQUEST":
            return `Both events share request correlation ID: ${left.requestId}.`;
        case "SAME_SERVICE":
            return `Both events belong to service: ${left.service}.`;
        case "SAME_RELEASE":
            return `Both events occurred on release: ${left.release}.`;
        case "SAME_RESOURCE":
            return `Both events target resource: ${left.resource}.`;
        case "DOWNSTREAM_FAILURE_OF":
            return `Upstream failure on ${left.service} preceded failure on ${right.service}.`;
        case "TRIGGERS":
            return `Deployment "${left.title}" preceded failure in ${right.service}.`;
        case "MODIFIES":
            return `Change "${left.title}" modified runtime state before failure in ${right.service}.`;
        case "AFFECTS":
            return `Infrastructure state "${left.title}" affected ${right.service}.`;
        case "DEPENDS_ON":
            return `Service ${right.service} depends on ${left.service}.`;
        case "PRECEDES":
            return `Event in ${left.service} occurred before event in ${right.service}.`;
        default:
            return `${classification} relationship between ${left.service} and ${right.service} (${temporal.toLowerCase()}).`;
    }
}

function temporalRelevance(left: Evidence, right: Evidence): number {
    if (isFailure(right)) {
        return 1;
    }

    if (
        isDeployment(left) ||
        isConfigChange(left) ||
        isFeatureFlagChange(left) ||
        isInfrastructureChange(left)
    ) {
        return 1;
    }

    if (left.traceId && right.traceId && left.traceId === right.traceId) {
        return 1;
    }

    if (left.requestId && right.requestId && left.requestId === right.requestId) {
        return 1;
    }

    return 0.65;
}

function temporalRelationshipFactor(left: Evidence, right: Evidence): number {
    const difference = Math.abs(left.timestamp.getTime() - right.timestamp.getTime());
    if (difference === 0) {
        return 1;
    }
    if (difference > TEMPORAL_WINDOW_MS) {
        return 0.7;
    }
    return 0.75 + 0.25 * (1 - difference / TEMPORAL_WINDOW_MS);
}

function deploymentTriggerConfidence(deployment: Evidence, failure: Evidence, difference: number): number {
    let confidence = 0.55 + 0.35 * (1 - difference / CAUSAL_WINDOW_MS);
    if (deployment.release && failure.release && deployment.release === failure.release) {
        confidence += 0.1;
    }
    if (deployment.resource && failure.resource && deployment.resource === failure.resource) {
        confidence += 0.05;
    }
    return clamp(confidence);
}

function changeTriggerConfidence(change: Evidence, failure: Evidence, difference: number): number {
    let confidence = 0.5 + 0.3 * (1 - difference / CAUSAL_WINDOW_MS);
    if (sameResource(change, failure)) {
        confidence += 0.15;
    }
    return clamp(confidence);
}

function infrastructureConfidence(infrastructure: Evidence, failure: Evidence, difference: number): number {
    let confidence = 0.45 + 0.3 * (1 - difference / CAUSAL_WINDOW_MS);
    if (sameResource(infrastructure, failure)) {
        confidence += 0.2;
    }
    return clamp(confidence);
}

function dependencyConfidence(dependency: Evidence, failure: Evidence): number {
    let confidence = 0.55;
    if (sameResource(dependency, failure)) {
        confidence += 0.2;
    }
    if (sameOperation(dependency, failure)) {
        confidence += 0.15;
    }
    if (sameTrace(dependency, failure)) {
        confidence += 0.1;
    }
    return clamp(confidence);
}

function isFailure(evidence: Evidence): boolean {
    return evidence.type === "ERROR" || isFailedStatus(evidence.status);
}

function isFailureEvidence(evidence: Evidence): boolean {
    return isFailure(evidence);
}

function isDeployment(evidence: Evidence): boolean {
    return evidence.type === "DEPLOYMENT";
}

function isConfigChange(evidence: Evidence): boolean {
    return evidence.type === "CONFIG";
}

function isFeatureFlagChange(evidence: Evidence): boolean {
    return evidence.type === "FEATURE_FLAG";
}

function isInfrastructureChange(evidence: Evidence): boolean {
    return evidence.type === "INFRASTRUCTURE";
}

function isDependencyEvidence(evidence: Evidence): boolean {
    return (
        evidence.type === "THIRD_PARTY" ||
        evidence.type === "TRACE" ||
        evidence.type === "METRIC" ||
        evidence.type === "INFRASTRUCTURE"
    );
}

function isDatabaseEvidence(evidence: Evidence): boolean {
    const text = `${evidence.title} ${evidence.description || ""} ${evidence.operation || ""} ${evidence.resource || ""}`.toLowerCase();
    return (
        text.includes("select ") ||
        text.includes("insert ") ||
        text.includes("update ") ||
        text.includes("delete ") ||
        text.includes("prisma") ||
        text.includes("postgres") ||
        text.includes("database") ||
        text.includes("mysql") ||
        text.includes("mongodb") ||
        text.includes("query") ||
        (evidence.resource ? evidence.resource.includes("db") || evidence.resource.includes("table") : false)
    );
}

function isFailedStatus(status: string | number | undefined): boolean {
    if (typeof status === "number") {
        return status >= 400;
    }
    if (!status) {
        return false;
    }
    const normalized = status.trim().toLowerCase();
    return (
        normalized === "error" ||
        normalized === "failed" ||
        normalized === "failure" ||
        normalized === "timeout" ||
        normalized === "unavailable" ||
        normalized === "cancelled"
    );
}

function sameService(left: Evidence, right: Evidence): boolean {
    return Boolean(left.service) && left.service === right.service;
}

function sameServiceOrRelease(left: Evidence, right: Evidence): boolean {
    return (
        sameService(left, right) ||
        Boolean(left.release && right.release && left.release === right.release)
    );
}

function sameResource(left: Evidence, right: Evidence): boolean {
    return Boolean(left.resource) && left.resource === right.resource;
}

function sameOperation(left: Evidence, right: Evidence): boolean {
    return Boolean(left.operation) && left.operation === right.operation;
}

function sameTrace(left: Evidence, right: Evidence): boolean {
    return Boolean(left.traceId) && left.traceId === right.traceId;
}

function sharesResourceSignal(left: Evidence, right: Evidence): boolean {
    return (
        sameResource(left, right) ||
        sameOperation(left, right) ||
        sameTrace(left, right)
    );
}

function isEarlier(left: Evidence, right: Evidence): boolean {
    return left.timestamp.getTime() <= right.timestamp.getTime();
}

function clamp(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(1, value));
}