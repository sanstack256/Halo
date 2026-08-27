import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";
import type { Recommendation } from "../types/recommendation";

const MAX_RECOMMENDATIONS = 5;

const ALTERNATIVE_CONFIDENCE_GAP = 15;

export function generateRecommendations(
    hypotheses: Hypothesis[],
    context: InvestigationContext,
): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const leading = selectLeadingHypothesis(
        hypotheses,
    );

    if (!leading) {
        return [];
    }

    addMissingEvidenceRecommendations(
        recommendations,
        leading,
    );

    addCompetingHypothesisRecommendation(
        recommendations,
        hypotheses,
        leading,
    );

    if (leading.id.startsWith("cascading-failure:")) {
        recommendations.push({
            id: `fix:cascading-guard:${normalizeId(leading.id)}`,
            title: `Add HTTP status validation before response dereferencing`,
            description: `Guard client response handler against non-2xx status codes before accessing payload properties.`,
            priority: "HIGH",
            confidence: 0.96,
            evidenceIds: leading.evidenceIds,
            question: `Does the response handler check response.ok or response.status before accessing body properties?`,
        });
        recommendations.push({
            id: `investigate:upstream-server:${normalizeId(leading.id)}`,
            title: `Inspect upstream endpoint server execution logs`,
            description: `Investigate why the upstream service or API endpoint produced a non-2xx status response.`,
            priority: "HIGH",
            confidence: 0.92,
            evidenceIds: leading.evidenceIds,
            question: `What backend exception or dependency failure caused the upstream endpoint to fail?`,
        });
    } else if (leading.id.startsWith("database-failure:")) {
        recommendations.push({
            id: `fix:database-operation:${normalizeId(leading.id)}`,
            title: `Handle database constraint or connection failure`,
            description: `Review query parameters, ensure record existence, or adjust connection pool limits to remediate database error.`,
            priority: "HIGH",
            confidence: 0.95,
            evidenceIds: leading.evidenceIds,
            question: `What query parameters or pool configurations triggered the database constraint violation or timeout?`,
        });
    } else if (leading.id.startsWith("network-protocol:")) {
        recommendations.push({
            id: `fix:network-resilience:${normalizeId(leading.id)}`,
            title: `Remediate network or endpoint failure`,
            description: `Inspect route handler exceptions for 5xx errors, verify authentication headers for 401/403, or apply retry/backoff for 429/timeouts.`,
            priority: "HIGH",
            confidence: 0.92,
            evidenceIds: leading.evidenceIds,
            question: `What caused the network endpoint to return an error response?`,
        });
    } else if (leading.id.startsWith("runtime-exception:")) {
        recommendations.push({
            id: `fix:runtime-guard:${normalizeId(leading.id)}`,
            title: `Add defensive null/undefined checks or type guards`,
            description: `Verify variable initialization and use optional chaining (?.) or defensive guards before property dereference.`,
            priority: "HIGH",
            confidence: 0.9,
            evidenceIds: leading.evidenceIds,
            question: `Which code path produced the unhandled exception?`,
        });
    } else if (leading.id.startsWith("resource-saturation:")) {
        recommendations.push({
            id: `investigate:resource:${normalizeId(leading.id)}`,
            title: `Investigate ${leading.title}`,
            description: `Inspect database connection pool metrics, memory allocation, and system resource limits during the incident window.`,
            priority: "HIGH",
            confidence: 0.9,
            evidenceIds: leading.evidenceIds,
            question: `What caused ${leading.title} during this incident window?`,
        });
    } else if (leading.id.startsWith("security-incident:")) {
        recommendations.push({
            id: `investigate:security:${normalizeId(leading.id)}`,
            title: `Investigate ${leading.title}`,
            description: `Review authentication logs, IP origins, and user session activity associated with the observed security anomaly.`,
            priority: "HIGH",
            confidence: 0.9,
            evidenceIds: leading.evidenceIds,
            question: `Which client or origin initiated the security anomaly?`,
        });
    } else {
        switch (leading.title) {
            case "Deployment Regression":
                addDeploymentRecommendations(
                    recommendations,
                    leading,
                    context,
                );
                break;

            case "Shared Dependency Failure":
                addSharedDependencyRecommendations(
                    recommendations,
                    leading,
                    context,
                );
                break;

            case "Infrastructure Failure":
                addInfrastructureRecommendations(
                    recommendations,
                    leading,
                    context,
                );
                break;

            case "Cross-Service Failure":
                addCrossServiceRecommendations(
                    recommendations,
                    leading,
                    context,
                );
                break;
        }
    }

    return rankAndLimitRecommendations(
        deduplicateRecommendations(
            recommendations,
        ),
    );
}

function selectLeadingHypothesis(
    hypotheses: Hypothesis[],
): Hypothesis | undefined {
    return (
        hypotheses.find(
            hypothesis =>
                hypothesis.status ===
                "VALIDATED",
        ) ??
        hypotheses.find(
            hypothesis =>
                hypothesis.status ===
                    "LEADING" ||
                hypothesis.status ===
                    "UNCERTAIN",
        ) ??
        hypotheses[0]
    );
}

function addMissingEvidenceRecommendations(
    recommendations: Recommendation[],
    hypothesis: Hypothesis,
) {
    for (const reason of hypothesis.missingReasons) {
        if (
            !reason.title ||
            !reason.description
        ) {
            continue;
        }

        recommendations.push({
            id:
                `investigate:missing:${normalizeId(
                    reason.title,
                )}`,

            title:
                reason.title,

            description:
                reason.description,

            priority: "HIGH",

            confidence: 0.95,

            evidenceIds:
                hypothesis.evidenceIds,

            question:
                buildMissingEvidenceQuestion(
                    reason.title,
                ),
        });
    }
}

function addCompetingHypothesisRecommendation(
    recommendations: Recommendation[],
    hypotheses: Hypothesis[],
    leading: Hypothesis,
) {
    const alternative =
        hypotheses
            .filter(
                hypothesis =>
                    hypothesis.id !==
                    leading.id &&
                    hypothesis.status !==
                        "REJECTED",
            )
            .sort(
                (a, b) =>
                    b.confidence -
                    a.confidence,
            )[0];

    if (!alternative) {
        return;
    }

    const gap =
        Math.abs(
            leading.confidence -
                alternative.confidence,
        );

    if (
        gap >=
        ALTERNATIVE_CONFIDENCE_GAP
    ) {
        return;
    }

    recommendations.push({
        id:
            `investigate:alternative:${normalizeId(
                leading.id,
            )}:${normalizeId(
                alternative.id,
            )}`,

        title:
            `Distinguish ${leading.title} from ${alternative.title}`,

        description:
            `The available evidence does not clearly separate ${leading.title} from ${alternative.title}. Look for evidence that supports one explanation while contradicting the other.`,

        priority: "HIGH",

        confidence:
            clamp01(
                1 -
                    gap / 100,
            ),

        evidenceIds:
            uniqueStrings([
                ...leading.evidenceIds,
                ...alternative.evidenceIds,
            ]),

        question:
            `What evidence would distinguish ${leading.title} from ${alternative.title}?`,
    });
}

function addDeploymentRecommendations(
    recommendations: Recommendation[],
    hypothesis: Hypothesis,
    context: InvestigationContext,
) {
    const deployment =
        context.deployments.find(
            evidence =>
                hypothesis.evidenceIds.includes(
                    evidence.id,
                ),
        );

    if (!deployment) {
        recommendations.push({
            id:
                "investigate:deployment:missing",

            title:
                "Inspect the suspected deployment",

            description:
                "Identify the deployment associated with the failure and review the changes introduced by it.",

            priority: "HIGH",

            confidence:
                clamp01(
                    hypothesis.confidence /
                        100,
                ),

            evidenceIds:
                hypothesis.evidenceIds,

            question:
                "What changed in the suspected deployment immediately before the failure?",
        });

        return;
    }

    recommendations.push({
        id:
            `investigate:deployment:${deployment.id}`,

        title:
            "Inspect the suspected deployment",

        description:
            `Review the changes introduced by deployment "${deployment.title}" and determine whether they can explain the observed failure.`,

        priority: "HIGH",

        confidence:
            clamp01(
                hypothesis.confidence /
                    100,
            ),

        evidenceIds:
            hypothesis.evidenceIds,

        question:
            "What changed in the suspected deployment immediately before the failure?",
    });

    const hasRollback =
        hasRollbackEvidence(
            context,
        );

    if (!hasRollback) {
        recommendations.push({
            id:
                `investigate:deployment:recovery:${deployment.id}`,

            title:
                "Verify recovery after rollback",

            description:
                "Determine whether reverting the suspected deployment caused the affected service to recover. Recovery after rollback would materially strengthen the deployment regression explanation.",

            priority: "HIGH",

            confidence: 0.85,

            evidenceIds:
                hypothesis.evidenceIds,

            question:
                "Did the service recover after the suspected deployment was rolled back?",
        });
    }
}

function addSharedDependencyRecommendations(
    recommendations: Recommendation[],
    hypothesis: Hypothesis,
    context: InvestigationContext,
) {
    const affectedServices =
        uniqueStrings(
            context.errors
                .filter(
                    error =>
                        hypothesis.evidenceIds.includes(
                            error.id,
                        ),
                )
                .map(
                    error =>
                        error.service,
                ),
        );

    const resources =
        uniqueStrings(
            context.evidence
                .filter(
                    evidence =>
                        hypothesis.evidenceIds.includes(
                            evidence.id,
                        ),
                )
                .map(
                    evidence =>
                        evidence.resource,
                )
                .filter(
                    (
                        resource,
                    ): resource is string =>
                        Boolean(resource),
                ),
        );

    if (
        affectedServices.length > 1
    ) {
        recommendations.push({
            id:
                "investigate:dependency:health",

            title:
                "Inspect the shared dependency",

            description:
                resources.length > 0
                    ? `Inspect ${resources.join(
                          ", ",
                      )} during the incident window and determine whether it experienced failures, saturation, connection problems, or elevated latency.`
                    : `Identify the dependency shared by ${affectedServices.length} affected services and inspect its health during the incident window.`,

            priority: "HIGH",

            confidence: 0.85,

            evidenceIds:
                hypothesis.evidenceIds,

            question:
                "Which shared dependency was unhealthy when the affected services began failing?",
        });
    } else {
        recommendations.push({
            id:
                "investigate:dependency:identify",

            title:
                "Identify the failing dependency",

            description:
                "Determine which shared resource or dependency was involved when the failure began, then inspect its health during the incident window.",

            priority: "HIGH",

            confidence: 0.8,

            evidenceIds:
                hypothesis.evidenceIds,

            question:
                "Which dependency was failing when the incident began?",
        });
    }
}

function addInfrastructureRecommendations(
    recommendations: Recommendation[],
    hypothesis: Hypothesis,
    context: InvestigationContext,
) {
    const infrastructure =
        context.infrastructure.filter(
            evidence =>
                hypothesis.evidenceIds.includes(
                    evidence.id,
                ),
        );

    const resources =
        uniqueStrings(
            infrastructure
                .map(
                    evidence =>
                        evidence.resource,
                )
                .filter(
                    (
                        resource,
                    ): resource is string =>
                        Boolean(resource),
                ),
        );

    recommendations.push({
        id:
            "investigate:infrastructure:health",

        title:
            "Inspect infrastructure health",

        description:
            resources.length > 0
                ? `Inspect ${resources.join(
                      ", ",
                  )} during the incident window for resource exhaustion, availability failures, saturation, or other infrastructure anomalies.`
                : "Inspect infrastructure health during the incident window for resource exhaustion, availability failures, saturation, or other anomalies.",

        priority: "HIGH",

        confidence: 0.8,

        evidenceIds:
            hypothesis.evidenceIds,

        question:
            "What infrastructure condition changed when the incident began?",
    });
}

function addCrossServiceRecommendations(
    recommendations: Recommendation[],
    hypothesis: Hypothesis,
    context: InvestigationContext,
) {
    const services =
        uniqueStrings(
            context.errors
                .filter(
                    error =>
                        hypothesis.evidenceIds.includes(
                            error.id,
                        ),
                )
                .map(
                    error =>
                        error.service,
                ),
        );

    if (
        services.length < 2
    ) {
        recommendations.push({
            id:
                "investigate:scope:expand",

            title:
                "Determine the incident scope",

            description:
                "Identify all affected services and determine whether they share a dependency, deployment, resource, or infrastructure boundary.",

            priority: "MEDIUM",

            confidence: 0.75,

            evidenceIds:
                hypothesis.evidenceIds,

            question:
                "What common dependency or change connects the affected services?",
        });

        return;
    }

    recommendations.push({
        id:
            "investigate:scope:common-cause",

        title:
            "Find the common cause",

        description:
            `${services.length} services show related failures. Look for a dependency, infrastructure component, deployment, configuration change, or other shared factor that could explain the common impact.`,

        priority: "HIGH",

        confidence: 0.8,

        evidenceIds:
            hypothesis.evidenceIds,

        question:
            "What common dependency or change explains the failures across these services?",
    });
}

function hasRollbackEvidence(
    context: InvestigationContext,
): boolean {
    return context.evidence.some(
        evidence => {
            if (
                evidence.type !==
                "DEPLOYMENT"
            ) {
                return false;
            }

            const title =
                evidence.title
                    .trim()
                    .toLowerCase();

            return (
                title.includes(
                    "rollback",
                ) ||
                title.includes(
                    "revert",
                )
            );
        },
    );
}

function buildMissingEvidenceQuestion(
    title: string,
): string {
    const normalized =
        title
            .trim()
            .toLowerCase();

    if (
        normalized.includes(
            "rollback",
        ) ||
        normalized.includes(
            "recovery",
        )
    ) {
        return "Did the service recover after the suspected deployment was rolled back?";
    }

    if (
        normalized.includes(
            "dependency",
        )
    ) {
        return "Which dependency was unhealthy when the failure began?";
    }

    if (
        normalized.includes(
            "infrastructure",
        )
    ) {
        return "What infrastructure condition changed when the incident began?";
    }

    return `What evidence can verify or contradict "${title}"?`;
}

function rankAndLimitRecommendations(
    recommendations: Recommendation[],
): Recommendation[] {
    const priorityWeight: Record<
        Recommendation["priority"],
        number
    > = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
    };

    return [...recommendations]
        .sort((a, b) => {
            const priorityDifference =
                priorityWeight[
                    b.priority
                ] -
                priorityWeight[
                    a.priority
                ];

            if (
                priorityDifference !==
                0
            ) {
                return priorityDifference;
            }

            return (
                b.confidence -
                a.confidence
            );
        })
        .slice(
            0,
            MAX_RECOMMENDATIONS,
        );
}

function deduplicateRecommendations(
    recommendations: Recommendation[],
): Recommendation[] {
    const seen =
        new Set<string>();

    return recommendations.filter(
        recommendation => {
            const key = [
                recommendation.title
                    .trim()
                    .toLowerCase(),
                recommendation.question
                    ?.trim()
                    .toLowerCase() ??
                    "",
            ].join("|");

            if (
                seen.has(key)
            ) {
                return false;
            }

            seen.add(key);

            return true;
        },
    );
}

function uniqueStrings(
    values: string[],
): string[] {
    return [
        ...new Set(
            values.filter(
                value =>
                    Boolean(
                        value,
                    ),
            ),
        ),
    ];
}

function normalizeId(
    value: string,
): string {
    return value
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            "-",
        )
        .replace(
            /^-+|-+$/g,
            "",
        );
}

function clamp01(
    value: number,
): number {
    if (
        !Number.isFinite(value)
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            1,
            value,
        ),
    );
}