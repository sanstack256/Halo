import type { Evidence } from "../types/evidence";
import type {
    EvidenceEdge,
    EvidenceGraph,
    RelationshipType,
} from "../types/graph";

const TEMPORAL_WINDOW_MS =
    5 * 60 * 1000;

const MAX_TEMPORAL_NEIGHBORS = 12;

const CAUSAL_WINDOW_MS =
    10 * 60 * 1000;

const MAX_RELATIONSHIP_EDGES_PER_GROUP = 100;

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

    const addEdge = (
        from: Evidence,
        to: Evidence,
        relationship: RelationshipType,
        confidence: number
    ) => {
        if (from.id === to.id) {
            return;
        }

        const normalizedConfidence =
            clamp(confidence);

        if (
            normalizedConfidence <= 0
        ) {
            return;
        }

        const key = [
            from.id,
            to.id,
            relationship,
        ].join(":");

        if (edgeKeys.has(key)) {
            return;
        }

        edgeKeys.add(key);

        edges.push({
            from: from.id,
            to: to.id,
            relationship,
            confidence:
                normalizedConfidence,
            evidenceIds: [
                from.id,
                to.id,
            ],
        });
    };

    const chronological =
        [...evidence].sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime()
        );

    buildTemporalEdges(
        chronological,
        addEdge
    );

    buildIdentityRelationships(
        evidence,
        addEdge
    );

    buildCausalCandidates(
        chronological,
        addEdge
    );

    return {
        nodes,
        edges,
    };
}

function buildTemporalEdges(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (
        let i = 0;
        i < evidence.length;
        i++
    ) {
        const current = evidence[i];

        let neighbors = 0;

        for (
            let j = i + 1;
            j < evidence.length;
            j++
        ) {
            if (
                neighbors >=
                MAX_TEMPORAL_NEIGHBORS
            ) {
                break;
            }

            const next = evidence[j];

            const difference =
                next.timestamp.getTime() -
                current.timestamp.getTime();

            if (
                difference >
                TEMPORAL_WINDOW_MS
            ) {
                break;
            }

            if (difference <= 0) {
                continue;
            }

            const proximity =
                1 -
                difference /
                    TEMPORAL_WINDOW_MS;

            const relevance =
                temporalRelevance(
                    current,
                    next
                );

            addEdge(
                current,
                next,
                "PRECEDES",
                proximity * relevance
            );

            neighbors++;
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
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.release,
        "SAME_RELEASE",
        0.8,
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.traceId,
        "SAME_TRACE",
        1,
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.requestId,
        "SAME_REQUEST",
        1,
        addEdge
    );

    addGroupedRelationships(
        evidence,
        item => item.resource,
        "SAME_RESOURCE",
        0.75,
        addEdge
    );

    addResourceDependencyRelationships(
        evidence,
        addEdge
    );
}

function addGroupedRelationships(
    evidence: Evidence[],
    keySelector: (
        evidence: Evidence
    ) => string | undefined,
    relationship: RelationshipType,
    baseConfidence: number,
    addEdge: AddEdge
) {
    const groups = new Map<
        string,
        Evidence[]
    >();

    for (const item of evidence) {
        const key = keySelector(item);

        if (!key) {
            continue;
        }

        const group =
            groups.get(key) ?? [];

        group.push(item);
        groups.set(key, group);
    }

    for (const group of groups.values()) {
        if (group.length < 2) {
            continue;
        }

        const limited =
            group.slice(
                0,
                MAX_RELATIONSHIP_EDGES_PER_GROUP
            );

        for (
            let i = 0;
            i < limited.length;
            i++
        ) {
            for (
                let j = i + 1;
                j < limited.length;
                j++
            ) {
                const left = limited[i];
                const right = limited[j];

                const temporalFactor =
                    temporalRelationshipFactor(
                        left,
                        right
                    );

                addEdge(
                    left,
                    right,
                    relationship,
                    baseConfidence *
                        temporalFactor
                );
            }
        }
    }
}

function addResourceDependencyRelationships(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    const resourceEvidence =
        evidence.filter(
            item =>
                Boolean(item.resource)
        );

    for (
        let i = 0;
        i < resourceEvidence.length;
        i++
    ) {
        const left =
            resourceEvidence[i];

        for (
            let j = i + 1;
            j < resourceEvidence.length;
            j++
        ) {
            const right =
                resourceEvidence[j];

            if (
                !sameServiceOrRelease(
                    left,
                    right
                )
            ) {
                continue;
            }

            if (
                !sharesResourceSignal(
                    left,
                    right
                )
            ) {
                continue;
            }

            const leftIsDependency =
                isDependencyEvidence(
                    left
                );

            const rightIsFailure =
                isFailureEvidence(
                    right
                );

            if (
                leftIsDependency &&
                rightIsFailure &&
                isEarlier(left, right)
            ) {
                addEdge(
                    left,
                    right,
                    "DEPENDS_ON",
                    dependencyConfidence(
                        left,
                        right
                    )
                );
            }

            const rightIsDependency =
                isDependencyEvidence(
                    right
                );

            const leftIsFailure =
                isFailureEvidence(
                    left
                );

            if (
                rightIsDependency &&
                leftIsFailure &&
                isEarlier(right, left)
            ) {
                addEdge(
                    right,
                    left,
                    "DEPENDS_ON",
                    dependencyConfidence(
                        right,
                        left
                    )
                );
            }
        }
    }
}

function buildCausalCandidates(
    evidence: Evidence[],
    addEdge: AddEdge
) {
    for (
        let i = 0;
        i < evidence.length;
        i++
    ) {
        const left = evidence[i];

        for (
            let j = i + 1;
            j < evidence.length;
            j++
        ) {
            const right = evidence[j];

            const difference =
                right.timestamp.getTime() -
                left.timestamp.getTime();

            if (
                difference >
                CAUSAL_WINDOW_MS
            ) {
                break;
            }

            if (difference <= 0) {
                continue;
            }

            if (
                isDeployment(left) &&
                isFailure(right) &&
                sameService(left, right)
            ) {
                addEdge(
                    left,
                    right,
                    "TRIGGERS",
                    deploymentTriggerConfidence(
                        left,
                        right,
                        difference
                    )
                );

                continue;
            }

            if (
                isConfigChange(left) &&
                isFailure(right) &&
                sameService(left, right)
            ) {
                addEdge(
                    left,
                    right,
                    "MODIFIES",
                    changeTriggerConfidence(
                        left,
                        right,
                        difference
                    )
                );

                continue;
            }

            if (
                isFeatureFlagChange(left) &&
                isFailure(right) &&
                sameService(left, right)
            ) {
                addEdge(
                    left,
                    right,
                    "MODIFIES",
                    changeTriggerConfidence(
                        left,
                        right,
                        difference
                    )
                );

                continue;
            }

            if (
                isInfrastructureChange(left) &&
                isFailure(right)
            ) {
                const scopeMatch =
                    sameService(
                        left,
                        right
                    ) ||
                    sameResource(
                        left,
                        right
                    );

                if (scopeMatch) {
                    addEdge(
                        left,
                        right,
                        "AFFECTS",
                        infrastructureConfidence(
                            left,
                            right,
                            difference
                        )
                    );
                }
            }
        }
    }
}

function temporalRelevance(
    left: Evidence,
    right: Evidence
): number {
    if (
        isFailure(right)
    ) {
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

    if (
        left.traceId &&
        right.traceId &&
        left.traceId === right.traceId
    ) {
        return 1;
    }

    if (
        left.requestId &&
        right.requestId &&
        left.requestId ===
            right.requestId
    ) {
        return 1;
    }

    return 0.65;
}

function temporalRelationshipFactor(
    left: Evidence,
    right: Evidence
): number {
    const difference =
        Math.abs(
            left.timestamp.getTime() -
                right.timestamp.getTime()
        );

    if (
        difference === 0
    ) {
        return 1;
    }

    if (
        difference >
        TEMPORAL_WINDOW_MS
    ) {
        return 0.7;
    }

    return (
        0.75 +
        0.25 *
            (1 -
                difference /
                    TEMPORAL_WINDOW_MS)
    );
}

function deploymentTriggerConfidence(
    deployment: Evidence,
    failure: Evidence,
    difference: number
): number {
    let confidence =
        0.55 +
        0.35 *
            (1 -
                difference /
                    CAUSAL_WINDOW_MS);

    if (
        deployment.release &&
        failure.release &&
        deployment.release ===
            failure.release
    ) {
        confidence += 0.1;
    }

    if (
        deployment.resource &&
        failure.resource &&
        deployment.resource ===
            failure.resource
    ) {
        confidence += 0.05;
    }

    return clamp(confidence);
}

function changeTriggerConfidence(
    change: Evidence,
    failure: Evidence,
    difference: number
): number {
    let confidence =
        0.5 +
        0.3 *
            (1 -
                difference /
                    CAUSAL_WINDOW_MS);

    if (
        sameResource(
            change,
            failure
        )
    ) {
        confidence += 0.15;
    }

    return clamp(confidence);
}

function infrastructureConfidence(
    infrastructure: Evidence,
    failure: Evidence,
    difference: number
): number {
    let confidence =
        0.45 +
        0.3 *
            (1 -
                difference /
                    CAUSAL_WINDOW_MS);

    if (
        sameResource(
            infrastructure,
            failure
        )
    ) {
        confidence += 0.2;
    }

    return clamp(confidence);
}

function dependencyConfidence(
    dependency: Evidence,
    failure: Evidence
): number {
    let confidence = 0.55;

    if (
        sameResource(
            dependency,
            failure
        )
    ) {
        confidence += 0.2;
    }

    if (
        sameOperation(
            dependency,
            failure
        )
    ) {
        confidence += 0.15;
    }

    if (
        sameTrace(
            dependency,
            failure
        )
    ) {
        confidence += 0.1;
    }

    return clamp(confidence);
}

function isFailure(
    evidence: Evidence
): boolean {
    return (
        evidence.type === "ERROR" ||
        isFailedStatus(evidence.status)
    );
}

function isFailureEvidence(
    evidence: Evidence
): boolean {
    return isFailure(evidence);
}

function isDeployment(
    evidence: Evidence
): boolean {
    return evidence.type === "DEPLOYMENT";
}

function isConfigChange(
    evidence: Evidence
): boolean {
    return evidence.type === "CONFIG";
}

function isFeatureFlagChange(
    evidence: Evidence
): boolean {
    return evidence.type ===
        "FEATURE_FLAG";
}

function isInfrastructureChange(
    evidence: Evidence
): boolean {
    return evidence.type ===
        "INFRASTRUCTURE";
}

function isDependencyEvidence(
    evidence: Evidence
): boolean {
    return (
        evidence.type ===
            "THIRD_PARTY" ||
        evidence.type === "TRACE" ||
        evidence.type === "METRIC" ||
        evidence.type ===
            "INFRASTRUCTURE"
    );
}

function isFailedStatus(
    status: string | number | undefined
): boolean {
    if (
        typeof status === "number"
    ) {
        return status >= 400;
    }

    if (!status) {
        return false;
    }

    const normalized =
        status
            .trim()
            .toLowerCase();

    return (
        normalized === "error" ||
        normalized === "failed" ||
        normalized === "failure" ||
        normalized === "timeout" ||
        normalized === "unavailable" ||
        normalized === "cancelled"
    );
}

function sameService(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        Boolean(left.service) &&
        left.service === right.service
    );
}

function sameServiceOrRelease(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        sameService(left, right) ||
        Boolean(
            left.release &&
                right.release &&
                left.release ===
                    right.release
        )
    );
}

function sameResource(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        Boolean(left.resource) &&
        left.resource === right.resource
    );
}

function sameOperation(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        Boolean(left.operation) &&
        left.operation ===
            right.operation
    );
}

function sameTrace(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        Boolean(left.traceId) &&
        left.traceId === right.traceId
    );
}

function sharesResourceSignal(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        sameResource(left, right) ||
        sameOperation(left, right)
    );
}

function isEarlier(
    left: Evidence,
    right: Evidence
): boolean {
    return (
        left.timestamp.getTime() <
        right.timestamp.getTime()
    );
}

function clamp(
    value: number
): number {
    return Math.max(
        0,
        Math.min(1, value)
    );
}

type AddEdge = (
    from: Evidence,
    to: Evidence,
    relationship: RelationshipType,
    confidence: number
) => void;