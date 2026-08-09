import type { Finding } from "../types/finding";
import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";
import type { Reason } from "../types/reason";

export function evaluateHypotheses(
    hypotheses: Hypothesis[],
    context: InvestigationContext
): Hypothesis[] {
    return hypotheses.map(hypothesis =>
        evaluateHypothesis(
            hypothesis,
            context.findings,
            context
        )
    );
}

function evaluateHypothesis(
    hypothesis: Hypothesis,
    findings: Finding[],
    context: InvestigationContext
): Hypothesis {
    const relevantFindings = findings.filter(
        finding =>
            hypothesis.findingIds.includes(
                finding.id
            )
    );

    const supportingReasons =
        collectReasons(
            relevantFindings,
            "SUPPORTING"
        );

    const contradictingReasons = [
        ...collectReasons(
            relevantFindings,
            "CONTRADICTING"
        ),
        ...collectDeploymentContradictions(
            hypothesis,
            context
        ),
    ];

    const missingReasons =
        findMissingEvidence(
            hypothesis,
            context
        );

    const positive =
        uniqueReasonStrength(
            supportingReasons
        );

    const negative =
        uniqueReasonStrength(
            contradictingReasons
        );

    const unknown =
        uniqueReasonStrength(
            missingReasons
        );

    return {
        ...hypothesis,

        score: {
            positive,
            negative,
            unknown,
        },

        confidence: 0,

        supportingReasons,

        contradictingReasons,

        missingReasons,
    };
}

function collectReasons(
    findings: Finding[],
    type: Reason["type"]
): Reason[] {
    const reasons = findings.flatMap(
        finding =>
            finding.reasons.filter(
                reason =>
                    reason.type === type
            )
    );

    return deduplicateReasons(reasons);
}

function deduplicateReasons(
    reasons: Reason[]
): Reason[] {
    const seen = new Set<string>();

    return reasons.filter(reason => {
        const key = [
            reason.type,
            reason.title,
            [...reason.evidenceIds]
                .sort()
                .join(","),
        ].join(":");

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
}

function uniqueReasonStrength(
    reasons: Reason[]
): number {
    const evidenceStrength =
        new Map<string, number>();

    let unlinkedStrength = 0;

    for (const reason of reasons) {
        if (
            reason.evidenceIds.length === 0
        ) {
            unlinkedStrength +=
                reason.strength;

            continue;
        }

        for (const evidenceId of reason.evidenceIds) {
            const existing =
                evidenceStrength.get(
                    evidenceId
                ) ?? 0;

            evidenceStrength.set(
                evidenceId,
                Math.max(
                    existing,
                    reason.strength
                )
            );
        }
    }

    return (
        [...evidenceStrength.values()]
            .reduce(
                (total, strength) =>
                    total + strength,
                0
            ) +
        unlinkedStrength
    );
}

function collectDeploymentContradictions(
    hypothesis: Hypothesis,
    context: InvestigationContext
): Reason[] {
    if (
        !hypothesis.id.startsWith(
            "deployment-regression:"
        )
    ) {
        return [];
    }

    const deploymentId =
        hypothesis.id.replace(
            "deployment-regression:",
            ""
        );

    const deployment =
        context.deployments.find(
            evidence =>
                evidence.id === deploymentId
        );

    if (!deployment) {
        return [];
    }

    const firstError =
        context.firstError;

    if (!firstError) {
        return [];
    }

    const earlierEvidence =
    context.evidence.filter(
        evidence =>
            evidence.id !== deployment.id &&
            evidence.type !== "DEPLOYMENT" &&
            evidence.timestamp <
                deployment.timestamp
    );

    const relevantEvidence =
        earlierEvidence.filter(
            evidence =>
                evidence.service ===
                deployment.service
        );

    if (relevantEvidence.length === 0) {
        return [];
    }

    return [
        {
            type: "CONTRADICTING",
            causalRole: "CONTEXT",
            title:
                "Failure-related evidence existed before the deployment",
            description:
                "Relevant evidence from the same service existed before the deployment, weakening the case that the deployment introduced the failure.",
            evidenceIds:
                relevantEvidence.map(
                    evidence =>
                        evidence.id
                ),
            strength: 0.9,
        },
    ];
}

function findMissingEvidence(
    hypothesis: Hypothesis,
    context: InvestigationContext
): Reason[] {
    const missing: Reason[] = [];

    if (
        hypothesis.id.startsWith(
            "deployment-regression:"
        )
    ) {
        const hasRollbackEvidence =
            context.evidence.some(
                evidence =>
                    evidence.type ===
                    "DEPLOYMENT" &&
                    (
                        evidence.title
                            .toLowerCase()
                            .includes("rollback") ||
                        evidence.title
                            .toLowerCase()
                            .includes("revert")
                    )
            );

        const hasRecoveryEvidence =
            context.findings.some(
                finding =>
                    finding.type ===
                    "RECOVERY" &&
                    finding.evidenceIds.some(
                        evidenceId =>
                            hypothesis.evidenceIds.includes(
                                evidenceId
                            )
                    )
            );

        if (
            !hasRollbackEvidence ||
            !hasRecoveryEvidence
        ) {
            missing.push({
                type: "MISSING",
                causalRole: "CONTEXT",

                title:
                    "Rollback and recovery evidence is incomplete",

                description:
                    "Evidence showing that the failure recovered after reverting the deployment would materially strengthen the deployment regression hypothesis.",

                evidenceIds: [],

                strength: 0.5,
            });
        }
    }

    if (
        hypothesis.id.startsWith(
            "shared-dependency:"
        )
    ) {
        const hasDependencyEvidence =
            context.evidence.some(
                evidence =>
                    Boolean(
                        evidence.resource
                    ) ||
                    Boolean(
                        evidence.operation
                    )
            );

        if (!hasDependencyEvidence) {
            missing.push({
                type: "MISSING",

                causalRole: "CONTEXT",

                title:
                    "Dependency relationship is unclear",

                description:
                    "Evidence identifying a shared resource or operation is needed to validate the shared dependency explanation.",

                evidenceIds: [],

                strength: 0.8,
            });
        }
    }

    if (
        hypothesis.id ===
        "infrastructure-failure"
    ) {
        if (
            context.infrastructure.length ===
            0
        ) {
            missing.push({
                type: "MISSING",
                causalRole: "CONTEXT",
                title:
                    "Infrastructure evidence is unavailable",
                description:
                    "Infrastructure health or resource evidence is needed to validate an infrastructure-level explanation.",
                evidenceIds: [],
                strength: 0.9,
            });
        }
    }

    return missing;
}