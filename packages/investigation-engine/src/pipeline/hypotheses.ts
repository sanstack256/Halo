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

    const deploymentFindings =
        findings.filter(
            finding =>
                finding.type === "TEMPORAL" ||
                finding.type === "PATTERN" ||
                finding.type === "SCOPE" ||
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

        const relatedFindings =
            deploymentFindings.filter(
                finding =>
                    finding.evidenceIds.includes(
                        deployment.id
                    )
            );

        if (relatedFindings.length === 0) {
            continue;
        }

        hypotheses.push(
            createDeploymentHypothesis(
                deployment.id,
                relatedFindings
            )
        );
    }

    const dependencyFindings =
        findings.filter(
            finding =>
                finding.type === "DEPENDENCY"
        );

    for (const finding of dependencyFindings) {
        hypotheses.push(
            createSharedDependencyHypothesis(
                finding
            )
        );
    }

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

function createDeploymentHypothesis(
    deploymentId: string,
    findings: Finding[]
): Hypothesis {
    const evidenceIds = [
        deploymentId,
        ...findings.flatMap(
            finding => finding.evidenceIds
        ),
    ];

    const uniqueEvidenceIds = [
        ...new Set(evidenceIds),
    ];

    const supportingReasons =
        findings
            .flatMap(
                finding => finding.reasons
            )
            .filter(
                reason =>
                    reason.type === "SUPPORTING"
            );

    const contradictingReasons =
        findings
            .flatMap(
                finding => finding.reasons
            )
            .filter(
                reason =>
                    reason.type === "CONTRADICTING"
            );

    return {
        id: `deployment-regression:${deploymentId}`,

        title: "Deployment Regression",

        findingIds: [
            ...new Set(
                findings.map(
                    finding => finding.id
                )
            ),
        ],

        description:
            "A deployment may have introduced or triggered the observed failure.",

        score: {
            positive:
                supportingReasons.reduce(
                    (total, reason) =>
                        total + reason.strength,
                    0
                ),

            negative:
                contradictingReasons.reduce(
                    (total, reason) =>
                        total + reason.strength,
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
                reason.type === "SUPPORTING"
        );

    const contradictingReasons =
        finding.reasons.filter(
            reason =>
                reason.type ===
                "CONTRADICTING"
        );

    return {
        id: `shared-dependency:${finding.id}`,

        title: "Shared Dependency Failure",


        description:
            finding.description,

        score: {
            positive:
                supportingReasons.reduce(
                    (total, reason) =>
                        total + reason.strength,
                    0
                ),

            negative:
                contradictingReasons.reduce(
                    (total, reason) =>
                        total + reason.strength,
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

function createInfrastructureHypothesis(
    finding: Finding,
    context: InvestigationContext
): Hypothesis {
    const infrastructureEvidence =
        context.infrastructure;

    const evidenceIds = [
        ...finding.evidenceIds,
        ...infrastructureEvidence.map(
            evidence => evidence.id
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