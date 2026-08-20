import type { Finding } from "../types/finding";
import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";
import type { Reason } from "../types/reason";
import type { Evidence } from "../types/evidence";

const DEPLOYMENT_CONFIRMATION_WINDOW_MS =
    30 * 60 * 1000;

const RECOVERY_LOOKBACK_WINDOW_MS =
    60 * 60 * 1000;

const PRE_DEPLOYMENT_LOOKBACK_WINDOW_MS =
    60 * 60 * 1000;

/**
 * Evaluate every generated hypothesis against the complete
 * investigation context.
 *
 * This stage does NOT decide the root cause.
 *
 * Its responsibility is to answer:
 *
 * - What evidence supports this hypothesis?
 * - What evidence contradicts it?
 * - What important evidence is still missing?
 * - How much independent evidence exists?
 *
 * Ranking and validation happen later.
 */
export function evaluateHypotheses(
    hypotheses: Hypothesis[],
    context: InvestigationContext,
): Hypothesis[] {
    return hypotheses.map(
        hypothesis =>
            evaluateHypothesis(
                hypothesis,
                context.findings,
                context,
            ),
    );
}

function evaluateHypothesis(
    hypothesis: Hypothesis,
    findings: Finding[],
    context: InvestigationContext,
): Hypothesis {
    /*
     * ------------------------------------------------------------
     * FINDING-BASED REASONS
     * ------------------------------------------------------------
     *
     * A hypothesis can contain reasons generated directly during
     * hypothesis construction, while findings can contribute
     * additional reasons.
     *
     * Preserve BOTH.
     */
    const relevantFindings =
        findings.filter(
            finding =>
                hypothesis.findingIds.includes(
                    finding.id,
                ),
        );

    const findingSupportingReasons =
        collectReasons(
            relevantFindings,
            "SUPPORTING",
        );

    const findingContradictingReasons =
        collectReasons(
            relevantFindings,
            "CONTRADICTING",
        );

    /*
     * Keep reasons already attached by the hypothesis generator.
     *
     * This is particularly important for:
     *
     * - deployment temporal evidence
     * - direct causal relationships
     * - future evidence-derived hypothesis signals
     */
    const supportingReasons =
        deduplicateReasons([
            ...hypothesis.supportingReasons,
            ...findingSupportingReasons,
        ]);

    const contradictingReasons =
        deduplicateReasons([
            ...hypothesis.contradictingReasons,
            ...findingContradictingReasons,
            ...collectContextContradictions(
                hypothesis,
                context,
            ),
        ]);

    const missingReasons =
        deduplicateReasons([
            ...hypothesis.missingReasons,
            ...findMissingEvidence(
                hypothesis,
                context,
            ),
        ]);

    /*
     * ------------------------------------------------------------
     * SCORE
     * ------------------------------------------------------------
     *
     * We intentionally calculate support using independent
     * evidence IDs rather than simply summing every reason.
     *
     * Otherwise five rules observing the same error could make
     * one piece of evidence look like five independent signals.
     */
    const positive =
        uniqueReasonStrength(
            supportingReasons,
        );

    const negative =
        uniqueReasonStrength(
            contradictingReasons,
        );

    const unknown =
        uniqueReasonStrength(
            missingReasons,
        );

    return {
        ...hypothesis,

        score: {
            positive,
            negative,
            unknown,
        },

        /*
         * Confidence is intentionally calculated later by
         * rankHypotheses().
         */
        confidence: 0,

        supportingReasons,

        contradictingReasons,

        missingReasons,

        evidenceIds: Array.from(
            new Set([
                ...hypothesis.evidenceIds,
                ...supportingReasons.flatMap((r) => r.evidenceIds),
            ])
        ),
    };
}

/**
 * Collect reasons of a particular type from relevant findings.
 */
function collectReasons(
    findings: Finding[],
    type: Reason["type"],
): Reason[] {
    return deduplicateReasons(
        findings.flatMap(
            finding =>
                finding.reasons.filter(
                    reason =>
                        reason.type ===
                        type,
                ),
        ),
    );
}

/**
 * Context-level contradictions are derived from actual evidence,
 * rather than from finding membership alone.
 */
function collectContextContradictions(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Reason[] {
    if (
        hypothesis.id.startsWith(
            "deployment-regression:",
        )
    ) {
        return collectDeploymentContradictions(
            hypothesis,
            context,
        );
    }

    return [];
}

/**
 * Deduplicate reasons by semantic identity AND evidence.
 *
 * Two different reasons supported by different evidence must not
 * collapse into one.
 */
function deduplicateReasons(
    reasons: Reason[],
): Reason[] {
    const seen = new Set<string>();

    return reasons.filter(
        reason => {
            const evidenceKey =
                [...reason.evidenceIds]
                    .sort()
                    .join(",");

            const key = [
                reason.type,
                reason.causalRole,
                reason.title,
                reason.description,
                evidenceKey,
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

/**
 * Calculate the strength of independent evidence.
 *
 * If several reasons point to the same evidence item, that item
 * contributes only its strongest associated signal.
 *
 * Reasons without evidence IDs are retained, but their strength
 * is counted only once per unique reason.
 */
function uniqueReasonStrength(
    reasons: Reason[],
): number {
    const evidenceStrength =
        new Map<string, number>();

    const unlinkedReasons =
        new Set<string>();

    for (const reason of reasons) {
        if (
            reason.evidenceIds.length ===
            0
        ) {
            const key = [
                reason.type,
                reason.causalRole,
                reason.title,
                reason.description,
            ].join("|");

            if (
                !unlinkedReasons.has(
                    key,
                )
            ) {
                unlinkedReasons.add(
                    key,
                );
            }

            continue;
        }

        for (const evidenceId of reason.evidenceIds) {
            const existing =
                evidenceStrength.get(
                    evidenceId,
                ) ?? 0;

            evidenceStrength.set(
                evidenceId,
                Math.max(
                    existing,
                    clampStrength(
                        reason.strength,
                    ),
                ),
            );
        }
    }

    const linkedStrength =
        [...evidenceStrength.values()]
            .reduce(
                (total, strength) =>
                    total + strength,
                0,
            );

    /*
     * Unlinked reasons are weaker because there is no concrete
     * evidence item to inspect.
     *
     * We cap their total contribution rather than allowing an
     * arbitrary number of textual reasons to create certainty.
     */
    const unlinkedStrength =
        [...unlinkedReasons].length > 0
            ? Math.min(
                0.5,
                [...unlinkedReasons]
                    .length * 0.25,
            )
            : 0;

    return (
        linkedStrength +
        unlinkedStrength
    );
}

function clampStrength(
    strength: number,
): number {
    if (
        !Number.isFinite(
            strength,
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            1,
            strength,
        ),
    );
}

/**
 * Deployment contradictions.
 *
 * The previous implementation considered ANY event before a
 * deployment a contradiction. That is too aggressive.
 *
 * A normal TRACE or MESSAGE before deployment does not prove
 * that the failure existed before deployment.
 *
 * We therefore focus on actual failure-related evidence:
 *
 * - ERROR events
 * - failure-like statuses
 * - evidence with the same resource
 * - evidence close enough to the deployment to be relevant
 */
function collectDeploymentContradictions(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Reason[] {
    if (
        !hypothesis.id.startsWith(
            "deployment-regression:",
        )
    ) {
        return [];
    }

    const deploymentId =
        hypothesis.id.replace(
            "deployment-regression:",
            "",
        );

    const deployment =
        context.deployments.find(
            evidence =>
                evidence.id ===
                deploymentId,
        );

    if (!deployment) {
        return [];
    }

    const deploymentTime =
        deployment.timestamp.getTime();

    const contradictions: Reason[] =
        [];

    /*
     * ------------------------------------------------------------
     * PRE-DEPLOYMENT FAILURE
     * ------------------------------------------------------------
     */
    const preDeploymentFailures =
        context.evidence.filter(
            evidence => {
                if (
                    evidence.id ===
                    deployment.id
                ) {
                    return false;
                }

                if (
                    evidence.type ===
                    "DEPLOYMENT"
                ) {
                    return false;
                }

                if (
                    evidence.service !==
                    deployment.service
                ) {
                    return false;
                }

                const evidenceTime =
                    evidence.timestamp.getTime();

                if (
                    evidenceTime >
                    deploymentTime
                ) {
                    return false;
                }

                if (
                    deploymentTime -
                        evidenceTime >
                    PRE_DEPLOYMENT_LOOKBACK_WINDOW_MS
                ) {
                    return false;
                }

                return isFailureEvidence(
                    evidence,
                );
            },
        );

    if (
        preDeploymentFailures.length >
        0
    ) {
        contradictions.push({
            type: "CONTRADICTING",
            causalRole: "CONTEXT",

            title:
                "Failure evidence predates deployment",

            description:
                `Failure-related evidence from ${deployment.service || "the affected service"} existed shortly before the deployment, weakening the hypothesis that this deployment introduced the incident.`,

            evidenceIds:
                preDeploymentFailures.map(
                    evidence =>
                        evidence.id,
                ),

            /*
             * This is meaningful but not absolute.
             *
             * The deployment could still have worsened
             * an existing problem.
             */
            strength: 0.75,
        });
    }

    /*
     * ------------------------------------------------------------
     * CROSS-SERVICE IMPACT
     * ------------------------------------------------------------
     *
     * Cross-service errors do NOT automatically disprove a
     * deployment regression. A deployment can cause a shared
     * dependency failure or trigger downstream failures.
     *
     * Therefore this is only a weak contradiction when the
     * deployment appears isolated from the affected services.
     */
    const crossServiceErrors =
        context.errors.filter(
            error =>
                error.service !==
                    deployment.service &&
                isFailureEvidence(
                    error,
                ) &&
                isTemporallyNear(
                    error,
                    deployment,
                    5 * 60 * 1000,
                ),
        );

    if (
        crossServiceErrors.length >
        0
    ) {
        const hasSharedResource =
            crossServiceErrors.some(
                error =>
                    Boolean(
                        error.resource,
                    ) &&
                    Boolean(
                        deployment.resource,
                    ) &&
                    error.resource ===
                        deployment.resource,
            );

        /*
         * If the cross-service errors share the same resource,
         * they may actually SUPPORT the deployment hypothesis
         * through a downstream dependency, so do not mark them
         * as contradictions here.
         */
        if (
            !hasSharedResource
        ) {
            contradictions.push({
                type: "CONTRADICTING",
                causalRole:
                    "CONTEXT",

                title:
                    "Independent cross-service impact weakens an isolated deployment explanation",

                description:
                    "Near-simultaneous failures were observed in another service without an identified shared resource, weakening the explanation that this deployment alone caused the incident.",

                evidenceIds:
                    crossServiceErrors.map(
                        error =>
                            error.id,
                    ),

                strength: 0.45,
            });
        }
    }

    return contradictions;
}

/**
 * Determine whether evidence represents an actual failure signal.
 */
function isFailureEvidence(
    evidence: Evidence,
): boolean {
    if (
        evidence.type ===
        "ERROR"
    ) {
        return true;
    }

    const status =
        evidence.status;

    if (
        typeof status ===
        "number"
    ) {
        return status >= 400;
    }

    if (
        typeof status ===
        "string"
    ) {
        const normalized =
            status.toLowerCase();

        return (
            normalized.includes(
                "error",
            ) ||
            normalized.includes(
                "fail",
            ) ||
            normalized.includes(
                "timeout",
            ) ||
            normalized ===
                "failed"
        );
    }

    return false;
}

function isTemporallyNear(
    left: Evidence,
    right: Evidence,
    windowMs: number,
): boolean {
    return (
        Math.abs(
            left.timestamp.getTime() -
                right.timestamp.getTime(),
        ) <= windowMs
    );
}

/**
 * Identify evidence that is still missing for each hypothesis
 * class.
 *
 * Missing evidence lowers certainty.
 *
 * It does NOT automatically invalidate the hypothesis.
 */
function findMissingEvidence(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Reason[] {
    if (
        hypothesis.id.startsWith(
            "deployment-regression:",
        )
    ) {
        return findDeploymentMissingEvidence(
            hypothesis,
            context,
        );
    }

    if (
        hypothesis.id.startsWith(
            "shared-dependency:",
        )
    ) {
        return findDependencyMissingEvidence(
            hypothesis,
            context,
        );
    }

    if (
        hypothesis.id ===
        "infrastructure-failure"
    ) {
        return findInfrastructureMissingEvidence(
            hypothesis,
            context,
        );
    }

    /*
     * Cross-service failure is intentionally not treated as a
     * root-cause hypothesis here, so we do not invent a generic
     * "missing evidence" requirement for it.
     */
    return [];
}

/**
 * Deployment-specific missing evidence.
 *
 * Rollback and recovery are valuable confirmation signals, but
 * neither is mandatory for a deployment hypothesis to be valid.
 */
function findDeploymentMissingEvidence(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Reason[] {
    const deploymentId =
        hypothesis.id.replace(
            "deployment-regression:",
            "",
        );

    const deployment =
        context.deployments.find(
            evidence =>
                evidence.id ===
                deploymentId,
        );

    if (!deployment) {
        return [];
    }

    const missing: Reason[] =
        [];

    const deploymentTime =
        deployment.timestamp.getTime();

    /*
     * ------------------------------------------------------------
     * ROLLBACK
     * ------------------------------------------------------------
     */
    const hasRollbackEvidence =
        context.evidence.some(
            evidence =>
                evidence.type ===
                    "DEPLOYMENT" &&
                evidence.timestamp.getTime() >=
                    deploymentTime &&
                isRollbackEvidence(
                    evidence,
                ),
        );

    if (
        !hasRollbackEvidence
    ) {
        missing.push({
            type: "MISSING",
            causalRole: "CONTEXT",

            title:
                "Rollback evidence is unavailable",

            description:
                "A rollback or revert associated with the deployment would provide stronger causal evidence if the incident recovered afterward.",

            evidenceIds: [],

            strength: 0.3,
        });
    }

    /*
     * ------------------------------------------------------------
     * RECOVERY
     * ------------------------------------------------------------
     *
     * Recovery must be connected to the incident rather than
     * merely existing somewhere in the project.
     */
    const hasRecoveryEvidence =
        hasRelatedRecoveryEvidence(
            hypothesis,
            deployment,
            context,
        );

    if (
        !hasRecoveryEvidence
    ) {
        missing.push({
            type: "MISSING",
            causalRole: "CONTEXT",

            title:
                "Recovery evidence is unavailable",

            description:
                "Evidence showing that the affected service recovered after the suspected deployment would materially strengthen the causal explanation.",

            evidenceIds: [],

            strength: 0.3,
        });
    }

    /*
     * ------------------------------------------------------------
     * DIRECT DEPLOYMENT LINK
     * ------------------------------------------------------------
     *
     * This should normally already be guaranteed by hypothesis
     * generation, but keeping the check here makes evaluation
     * defensive.
     */
    const hasPostDeploymentFailure =
        context.errors.some(
            error =>
                error.service ===
                    deployment.service &&
                error.timestamp.getTime() >
                    deploymentTime,
        );

    if (
        !hasPostDeploymentFailure
    ) {
        missing.push({
            type: "MISSING",
            causalRole: "CAUSE",

            title:
                "Post-deployment failure evidence is unavailable",

            description:
                "A deployment regression requires a failure signal after the deployment in the affected service.",

            evidenceIds: [],

            strength: 0.8,
        });
    }

    return missing;
}

function isRollbackEvidence(
    evidence: Evidence,
): boolean {
    const title =
        evidence.title.toLowerCase();

    const description =
        evidence.description?.toLowerCase() ??
        "";

    return (
        title.includes(
            "rollback",
        ) ||
        title.includes(
            "revert",
        ) ||
        title.includes(
            "rolled back",
        ) ||
        description.includes(
            "rollback",
        ) ||
        description.includes(
            "revert",
        )
    );
}

function hasRelatedRecoveryEvidence(
    hypothesis: Hypothesis,
    deployment: Evidence,
    context: InvestigationContext,
): boolean {
    const hypothesisEvidence =
        new Set(
            hypothesis.evidenceIds,
        );

    const deploymentTime =
        deployment.timestamp.getTime();

    return context.evidence.some(
        evidence => {
            if (
                hypothesisEvidence.has(
                    evidence.id,
                )
            ) {
                /*
                 * An error itself is not recovery evidence.
                 */
                if (
                    evidence.type ===
                    "ERROR"
                ) {
                    return false;
                }
            }

            if (
                evidence.service !==
                deployment.service
            ) {
                return false;
            }

            const evidenceTime =
                evidence.timestamp.getTime();

            if (
                evidenceTime <=
                deploymentTime
            ) {
                return false;
            }

            if (
                evidenceTime -
                    deploymentTime >
                RECOVERY_LOOKBACK_WINDOW_MS
            ) {
                return false;
            }

            return isRecoveryEvidence(
                evidence,
            );
        },
    );
}

function isRecoveryEvidence(
    evidence: Evidence,
): boolean {
    const title =
        evidence.title.toLowerCase();

    const description =
        evidence.description?.toLowerCase() ??
        "";

    const status =
        typeof evidence.status ===
        "string"
            ? evidence.status.toLowerCase()
            : "";

    return (
        title.includes(
            "recovery",
        ) ||
        title.includes(
            "recovered",
        ) ||
        title.includes(
            "resolved",
        ) ||
        title.includes(
            "restored",
        ) ||
        description.includes(
            "recovered",
        ) ||
        description.includes(
            "resolved",
        ) ||
        description.includes(
            "restored",
        ) ||
        status ===
            "success" ||
        status ===
            "200" ||
        status ===
            "204"
    );
}

/**
 * Shared dependency validation must inspect the hypothesis's
 * actual evidence rather than asking whether ANY event in the
 * investigation has a resource or operation.
 */
function findDependencyMissingEvidence(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Reason[] {
    const hypothesisEvidence =
        context.evidence.filter(
            evidence =>
                hypothesis.evidenceIds.includes(
                    evidence.id,
                ),
        );

    const errorEvidence =
        hypothesisEvidence.filter(
            evidence =>
                evidence.type ===
                "ERROR",
        );

    const services = new Set(
        errorEvidence
            .map(
                evidence =>
                    evidence.service,
            )
            .filter(
                (
                    service,
                ): service is string =>
                    Boolean(service),
            ),
    );

    const sharedResources =
        findSharedValues(
            errorEvidence.map(
                evidence =>
                    evidence.resource,
            ),
        );

    const sharedOperations =
        findSharedValues(
            errorEvidence.map(
                evidence =>
                    evidence.operation,
            ),
        );

    const missing: Reason[] =
        [];

    if (
        errorEvidence.length <
        2
    ) {
        missing.push({
            type: "MISSING",
            causalRole: "CAUSE",

            title:
                "Multiple failure observations are unavailable",

            description:
                "A shared dependency explanation requires failure evidence connecting multiple observations.",

            evidenceIds: [],

            strength: 0.7,
        });
    }

    if (
        services.size <
        2
    ) {
        missing.push({
            type: "MISSING",
            causalRole: "CAUSE",

            title:
                "Cross-service dependency impact is incomplete",

            description:
                "Evidence from at least two affected services would make the shared dependency explanation substantially stronger.",

            evidenceIds: [],

            strength: 0.55,
        });
    }

    if (
        sharedResources.size ===
            0 &&
        sharedOperations.size ===
            0
    ) {
        missing.push({
            type: "MISSING",
            causalRole: "CAUSE",

            title:
                "Shared dependency identifier is unavailable",

            description:
                "A common resource or operation is needed to establish the dependency relationship.",

            evidenceIds: [],

            strength: 0.8,
        });
    }

    return missing;
}

function findSharedValues(
    values: Array<
        string | undefined
    >,
): Set<string> {
    const counts =
        new Map<string, number>();

    for (const value of values) {
        if (!value) {
            continue;
        }

        counts.set(
            value,
            (counts.get(value) ??
                0) + 1,
        );
    }

    return new Set(
        [...counts.entries()]
            .filter(
                ([, count]) =>
                    count >= 2,
            )
            .map(
                ([value]) =>
                    value,
            ),
    );
}

/**
 * Infrastructure evidence must actually belong to the
 * hypothesis's causal neighborhood.
 */
function findInfrastructureMissingEvidence(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Reason[] {
    const relatedInfrastructure =
        context.infrastructure.filter(
            infrastructure =>
                hypothesis.evidenceIds.includes(
                    infrastructure.id,
                ),
        );

    if (
        relatedInfrastructure.length >
        0
    ) {
        return [];
    }

    /*
     * Some infrastructure findings may reference error evidence
     * rather than directly attaching the infrastructure ID.
     *
     * Look for temporally and topologically related infrastructure
     * evidence before declaring it missing.
     */
    const relatedErrors =
        context.errors.filter(
            error =>
                hypothesis.evidenceIds.includes(
                    error.id,
                ),
        );

    const hasRelatedInfrastructure =
        relatedErrors.some(
            error =>
                context.infrastructure.some(
                    infrastructure =>
                        (
                            infrastructure.service ===
                                error.service ||
                            (
                                infrastructure.resource &&
                                infrastructure.resource ===
                                    error.resource
                            )
                        ) &&
                        isTemporallyNear(
                            infrastructure,
                            error,
                            5 * 60 * 1000,
                        ),
                ),
        );

    if (
        hasRelatedInfrastructure
    ) {
        return [];
    }

    return [
        {
            type: "MISSING",
            causalRole: "CAUSE",

            title:
                "Direct infrastructure evidence is unavailable",

            description:
                "Infrastructure health, resource, or capacity evidence directly connected to the affected service would strengthen the infrastructure explanation.",

            evidenceIds: [],

            strength: 0.7,
        },
    ];
}