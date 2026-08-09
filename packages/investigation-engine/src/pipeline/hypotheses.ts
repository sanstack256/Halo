import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";
import type { Hypothesis } from "../types/hypothesis";

export function generateHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    return buildHypotheses(
        context,
        context.findings
    );
}

function buildHypotheses(
    context: InvestigationContext,
    findings: Finding[]
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];

    /*
     * Cross-service failure
     */
    const crossServiceFindings =
        findings.filter(
            finding =>
                finding.id ===
                "cross-service-failure"
        );

    for (const finding of crossServiceFindings) {
        hypotheses.push(
            createCrossServiceHypothesis(
                finding
            )
        );
    }

    /*
     * Deployment regression
     */
    const deploymentFindings =
        findings.filter(
            finding =>
                finding.type === "TEMPORAL" ||
                finding.type === "PATTERN" ||
                finding.type === "SCOPE" ||
                finding.type === "RECOVERY" ||
                finding.type === "ANOMALY"
        );

    for (const deployment of context.deployments) {
        const text = [
            deployment.title,
            deployment.description ?? "",
        ]
            .join(" ")
            .toLowerCase();

        const isRollback =
            text.includes("rollback") ||
            text.includes("revert");

        if (isRollback) {
            continue;
        }

        const relatedFindings =
            deploymentFindings.filter(
                finding => {
                    if (
                        finding.evidenceIds.includes(
                            deployment.id
                        )
                    ) {
                        return true;
                    }

                    /*
                     * Recovery evidence can strongly validate
                     * the deployment even when the recovery
                     * event itself is not directly attached
                     * to the deployment by the rule.
                     *
                     * The recovery finding must still belong
                     * to the same service and occur after the
                     * deployment.
                     */
                    if (
                        finding.type !== "RECOVERY"
                    ) {
                        return false;
                    }

                    const findingEvidence =
                        context.evidence.filter(
                            evidence =>
                                finding.evidenceIds.includes(
                                    evidence.id
                                )
                        );

                    return findingEvidence.some(
                        evidence =>
                            evidence.service ===
                            deployment.service &&
                            evidence.timestamp.getTime() >=
                            deployment.timestamp.getTime()
                    );
                }
            );

        if (relatedFindings.length === 0) {
            continue;
        }

        hypotheses.push(
            createDeploymentHypothesis(
                deployment.id,
                relatedFindings,
                context
            )
        );
    }

    /*
     * Shared dependency failure
     */
    const dependencyFindings =
        findings.filter(
            finding =>
                finding.type ===
                "DEPENDENCY"
        );

    for (const finding of dependencyFindings) {
        hypotheses.push(
            createSharedDependencyHypothesis(
                finding
            )
        );
    }

    /*
     * Infrastructure failure
     */
    const infrastructureFindings =
        findings.filter(
            finding =>
                finding.type === "SCOPE" &&
                finding.title ===
                "Failure extends beyond deployed service"
        );

    if (
        infrastructureFindings.length > 0 &&
        context.infrastructure.length > 0
    ) {
        hypotheses.push(
            createInfrastructureHypothesis(
                infrastructureFindings[0],
                context
            )
        );
    }

    return hypotheses;
}

function createCrossServiceHypothesis(
    finding: Finding
): Hypothesis {
    const supportingReasons =
        finding.reasons.filter(
            reason =>
                reason.type ===
                "SUPPORTING"
        );

    const contradictingReasons =
        finding.reasons.filter(
            reason =>
                reason.type ===
                "CONTRADICTING"
        );

    return {
        id: "cross-service-failure",

        title: "Cross-Service Failure",

        description:
            finding.description,

        score: {
            positive:
                supportingReasons.reduce(
                    (total, reason) =>
                        total +
                        reason.strength,
                    0
                ),

            negative:
                contradictingReasons.reduce(
                    (total, reason) =>
                        total +
                        reason.strength,
                    0
                ),

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds: [finding.id],

        evidenceIds: [
            ...new Set(
                finding.evidenceIds
            ),
        ],

        alternativeIds: [],
    };
}

function createDeploymentHypothesis(
    deploymentId: string,
    findings: Finding[],
    context?: InvestigationContext
): Hypothesis {
    const evidenceIds = [
        deploymentId,
        ...findings.flatMap(
            finding =>
                finding.evidenceIds
        ),
    ];

    /*
     * Relevant metric anomalies can strengthen
     * an existing deployment hypothesis.
     *
     * A metric must belong to the same service as
     * evidence already associated with the deployment.
     *
     * When operation/resource information exists,
     * prefer metrics that match those dimensions too.
     */
    const relatedEvidence = context
        ? context.evidence.filter(
            evidence =>
                evidence.type === "METRIC" &&
                evidence.id !== deploymentId
        )
        : [];

    const existingEvidence =
        context
            ? context.evidence.filter(
                evidence =>
                    evidenceIds.includes(
                        evidence.id
                    )
            )
            : [];

    const services = new Set(
        existingEvidence
            .map(
                evidence =>
                    evidence.service
            )
            .filter(Boolean)
    );

    const operations = new Set(
        existingEvidence
            .map(
                evidence =>
                    evidence.operation
            )
            .filter(
                (
                    operation
                ): operation is string =>
                    Boolean(operation)
            )
    );

    const resources = new Set(
        existingEvidence
            .map(
                evidence =>
                    evidence.resource
            )
            .filter(
                (
                    resource
                ): resource is string =>
                    Boolean(resource)
            )
    );

    const relevantMetricIds =
        relatedEvidence
            .filter(metric => {
                if (
                    !services.has(
                        metric.service
                    )
                ) {
                    return false;
                }

                const operationMatches =
                    !metric.operation ||
                    operations.size === 0 ||
                    operations.has(
                        metric.operation
                    );

                const resourceMatches =
                    !metric.resource ||
                    resources.size === 0 ||
                    resources.has(
                        metric.resource
                    );

                return (
                    operationMatches &&
                    resourceMatches
                );
            })
            .map(
                metric =>
                    metric.id
            );

    const evidenceSignalFindings =
        context
            ? context.findings.filter(
                finding =>
                    finding.type ===
                    "ANOMALY" ||
                    finding.type ===
                    "CHANGE_IMPACT" ||
                    finding.type ===
                    "RELATIONSHIP"
            )
            : [];

    const deployment =
        context?.evidence.find(
            evidence =>
                evidence.id ===
                deploymentId
        );

    const relatedSignalFindings =
        deployment
            ? evidenceSignalFindings.filter(
                finding => {
                    const hasSupportingReason =
                        finding.reasons.some(
                            reason =>
                                reason.type ===
                                "SUPPORTING"
                        );

                    if (!hasSupportingReason) {
                        return false;
                    }

                    const findingEvidence =
                        context!.evidence.filter(
                            evidence =>
                                finding.evidenceIds.includes(
                                    evidence.id
                                )
                        );

                    return findingEvidence.some(
                        evidence =>
                            evidence.service ===
                            deployment.service &&
                            evidence.timestamp.getTime() >=
                            deployment.timestamp.getTime()
                    );
                }
            )
            : [];

    const signalEvidenceIds =
        relatedSignalFindings.flatMap(
            finding =>
                finding.evidenceIds
        );

    const uniqueEvidenceIds = [
        ...new Set([
            ...evidenceIds,
            ...relevantMetricIds,
            ...signalEvidenceIds,
        ]),
    ];

    const supportingReasons = [
        ...findings
            .flatMap(
                finding =>
                    finding.reasons
            )
            .filter(
                reason =>
                    reason.type ===
                    "SUPPORTING"
            ),

        ...relatedSignalFindings.flatMap(
            finding =>
                finding.reasons
                    .filter(
                        reason =>
                            reason.type ===
                            "SUPPORTING"
                    )
        ),
    ];

    

    const contradictingReasons =
        findings
            .flatMap(
                finding =>
                    finding.reasons
            )
            .filter(
                reason =>
                    reason.type ===
                    "CONTRADICTING"
            );

    return {
        id:
            `deployment-regression:${deploymentId}`,

        title: "Deployment Regression",

        findingIds: [
            ...new Set([
                ...findings.map(
                    finding =>
                        finding.id
                ),
                ...relatedSignalFindings.map(
                    finding =>
                        finding.id
                ),
            ]),
        ],

        description:
            "A deployment may have introduced or triggered the observed failure.",

        score: {
            positive:
                supportingReasons.reduce(
                    (total, reason) =>
                        total +
                        reason.strength,
                    0
                ),

            negative:
                contradictingReasons.reduce(
                    (total, reason) =>
                        total +
                        reason.strength,
                    0
                ),

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        evidenceIds:
            uniqueEvidenceIds,

        alternativeIds: [],
    };
}

function createSharedDependencyHypothesis(
    finding: Finding
): Hypothesis {
    const supportingReasons =
        finding.reasons.filter(
            reason =>
                reason.type ===
                "SUPPORTING"
        );

    const contradictingReasons =
        finding.reasons.filter(
            reason =>
                reason.type ===
                "CONTRADICTING"
        );

    return {
        id:
            `shared-dependency:${finding.id}`,

        title: "Shared Dependency Failure",

        description:
            finding.description,

        score: {
            positive:
                supportingReasons.reduce(
                    (total, reason) =>
                        total +
                        reason.strength,
                    0
                ),

            negative:
                contradictingReasons.reduce(
                    (total, reason) =>
                        total +
                        reason.strength,
                    0
                ),

            unknown: finding.strength,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds: [finding.id],

        evidenceIds: [
            ...new Set(
                finding.evidenceIds
            ),
        ],

        alternativeIds: [],
    };
}

function createInfrastructureHypothesis(
    finding: Finding,
    context: InvestigationContext
): Hypothesis {
    const infrastructureEvidence =
        context.infrastructure;

    const evidenceIds = [
        ...finding.evidenceIds,
        ...infrastructureEvidence.map(
            evidence =>
                evidence.id
        ),
    ];

    const uniqueEvidenceIds = [
        ...new Set(evidenceIds),
    ];

    return {
        id: "infrastructure-failure",

        title: "Infrastructure Failure",

        description:
            "An infrastructure-level failure may be responsible for the observed incident.",

        score: {
            positive: 0.4,

            negative: 0,

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons: [
            {
                type: "SUPPORTING",

                causalRole: "CONTEXT",

                title:
                    "Infrastructure evidence is present",

                description:
                    "Infrastructure events were observed while the incident affected multiple services.",

                evidenceIds:
                    uniqueEvidenceIds,

                strength: 0.4,
            },
        ],

        contradictingReasons: [],

        missingReasons: [],

        findingIds: [finding.id],

        evidenceIds:
            uniqueEvidenceIds,

        alternativeIds: [],
    };
}