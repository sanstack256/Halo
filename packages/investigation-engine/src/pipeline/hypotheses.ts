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
                finding.type === "RECOVERY"
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

        const deploymentTime =
            deployment.timestamp.getTime();

        /*
         * Find errors associated with this deployment.
         *
         * An error is relevant only when:
         * 1. it happened after the deployment
         * 2. it belongs to the same service
         */
        const relatedErrors =
            context.errors.filter(
                error =>
                    error.service ===
                    deployment.service &&
                    error.timestamp.getTime() >
                    deploymentTime
            );

        const hasAnyFailure =
            context.errors.length > 0;

        if (
            relatedErrors.length === 0 &&
            !hasAnyFailure
        ) {
            continue;
        }


        const relatedFindings =
            deploymentFindings.filter(
                finding =>
                    finding.evidenceIds.includes(
                        deployment.id
                    ) &&
                    (
                        finding.type !==
                        "TEMPORAL" ||
                        relatedErrors.some(
                            error =>
                                finding.evidenceIds.includes(
                                    error.id
                                )
                        )
                    )
            );


        const hypothesis =
            createDeploymentHypothesis(
                deployment.id,
                relatedFindings,
                context
            );


        hypotheses.push(hypothesis);
    }

    /*
     * Shared dependency failure
     */
    const dependencyFindings =
        findings.filter(
            finding =>
                finding.type === "DEPENDENCY" &&
                finding.id.startsWith(
                    "dependency:"
                )
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
                finding.id.startsWith(
                    "infrastructure-failure:"
                )
        );

    for (
        const finding
        of infrastructureFindings
    ) {
        hypotheses.push(
            createInfrastructureHypothesis(
                finding,
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

    const commitAttributionFindings =
        context
            ? evidenceSignalFindings.filter(
                finding =>
                    finding.id.startsWith(
                        "commit-attribution:"
                    ) &&
                    finding.evidenceIds.includes(
                        deploymentId
                    )
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

    const relatedCommitFindings =
        commitAttributionFindings;

    const signalEvidenceIds =
        relatedSignalFindings.flatMap(
            finding =>
                finding.evidenceIds
        );

    const commitEvidenceIds =
        relatedCommitFindings.flatMap(
            finding =>
                finding.evidenceIds
        );

    const uniqueEvidenceIds = [
        ...new Set([
            ...evidenceIds,
            ...relevantMetricIds,
            ...signalEvidenceIds,
            ...commitEvidenceIds,
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
                finding.reasons.filter(
                    reason =>
                        reason.type ===
                        "SUPPORTING"
                )
        ),

        ...relatedCommitFindings.flatMap(
            finding =>
                finding.reasons.filter(
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

    const positive =
        supportingReasons.reduce(
            (total, reason) =>
                total + reason.strength,
            0
        );

    const negative =
        contradictingReasons.reduce(
            (total, reason) =>
                total + reason.strength,
            0
        );

    return {
        id:
            "infrastructure-failure",

        title:
            "Infrastructure Failure",

        description:
            finding.description,

        score: {
            positive,

            negative,

            unknown: 0,
        },

        confidence: 0,

        status:
            "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds: [
            finding.id,
        ],

        evidenceIds:
            uniqueEvidenceIds,

        alternativeIds: [],
    };
}