import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";
import type { Reason } from "../types/reason";
import type { Evidence } from "../types/evidence";

const MIN_VALIDATED_CONFIDENCE = 70;

const MIN_CAUSAL_SUPPORT = 1.0;

const MAX_ALLOWED_MISSING_RATIO = 0.65;

const DEPLOYMENT_RECOVERY_WINDOW_MS =
    60 * 60 * 1000;

const MIN_INDEPENDENT_EVIDENCE = 2;

/**
 * Validate ranked hypotheses.
 *
 * Ranking answers:
 *
 *   "Which explanation currently looks strongest?"
 *
 * Validation answers:
 *
 *   "Do we actually have enough evidence to call this
 *    explanation established?"
 *
 * These are intentionally different decisions.
 */
export function validateHypotheses(
    hypotheses: Hypothesis[],
    context: InvestigationContext,
): Hypothesis[] {
    if (hypotheses.length === 0) {
        return [];
    }

    /*
     * Validation must not depend solely on array position.
     *
     * The ranking stage normally places the strongest candidate
     * first, but we calculate the leading candidate explicitly
     * from confidence and evidence quality.
     */
    const leadingId =
        selectLeadingCandidate(
            hypotheses,
        );

    return hypotheses.map(
        hypothesis =>
            validateHypothesis(
                hypothesis,
                hypothesis.id ===
                leadingId,
                context,
            ),
    );
}

function validateHypothesis(
    hypothesis: Hypothesis,
    isLeading: boolean,
    context: InvestigationContext,
): Hypothesis {
    /*
     * Cross-service failure represents incident blast radius.
     *
     * It should remain visible as a useful candidate/contextual
     * explanation but must never become Halo's root cause.
     */
    if (
        hypothesis.title ===
        "Cross-Service Failure"
    ) {
        return invalidate(
            hypothesis,
            Math.min(
                hypothesis.confidence,
                69,
            ),
        );
    }

    /*
     * A hypothesis must point to actual evidence.
     */
    const relevantEvidence =
        context.evidence.filter(
            evidence =>
                hypothesis.evidenceIds.includes(
                    evidence.id,
                ),
        );

    if (
        relevantEvidence.length === 0
    ) {
        return invalidate(
            hypothesis,
            0,
        );
    }

    /*
     * ------------------------------------------------------------
     * EVIDENCE STRENGTH
     * ------------------------------------------------------------
     */
    const supportStrength =
        uniqueReasonStrength(
            hypothesis.supportingReasons,
        );

    const contradictionStrength =
        uniqueReasonStrength(
            hypothesis.contradictingReasons,
        );

    const missingStrength =
        uniqueReasonStrength(
            hypothesis.missingReasons,
        );

    /*
     * ------------------------------------------------------------
     * HARD CONTRADICTION
     * ------------------------------------------------------------
     *
     * If contradiction is at least as strong as causal support,
     * the hypothesis cannot be validated.
     */
    if (
        contradictionStrength >=
        supportStrength
    ) {
        return invalidate(
            hypothesis,
            Math.min(
                hypothesis.confidence,
                69,
            ),
        );
    }

    /*
     * ------------------------------------------------------------
     * CAUSAL EVIDENCE
     * ------------------------------------------------------------
     *
     * Not every supporting reason is causal.
     *
     * For example:
     *
     *   SAME_SERVICE
     *   SAME_RELEASE
     *   PRECEDES
     *
     * are useful context, but they do not by themselves prove
     * causality.
     */
    const causalSupport =
        getCausalSupport(
            hypothesis,
        );

    const causalStrength =
        uniqueReasonStrength(
            causalSupport,
        );

    /*
     * A hypothesis with no causal evidence should never be
     * validated merely because several contextual signals exist.
     */
    if (
        causalStrength <
        MIN_CAUSAL_SUPPORT
    ) {
        return invalidate(
            hypothesis,
            Math.min(
                hypothesis.confidence,
                69,
            ),
        );
    }

    /*
     * ------------------------------------------------------------
     * INDEPENDENT EVIDENCE
     * ------------------------------------------------------------
     *
     * A single event can strongly suggest a cause, but the MVP
     * should be conservative about claiming an established root
     * cause from one observation.
     *
     * Certain direct infrastructure/dependency signals can
     * qualify with fewer observations when the rule itself has
     * established a strong causal relationship.
     */
    const independentEvidenceCount =
        countIndependentEvidence(
            causalSupport,
        );

    const canValidateWithSingleEvidence =
        allowsSingleEvidenceValidation(
            hypothesis,
            causalSupport,
        );

    if (
        independentEvidenceCount <
        MIN_INDEPENDENT_EVIDENCE &&
        !canValidateWithSingleEvidence
    ) {
        return invalidate(
            hypothesis,
            Math.min(
                hypothesis.confidence,
                69,
            ),
        );
    }
    if (
        independentEvidenceCount <
        MIN_INDEPENDENT_EVIDENCE &&
        !allowsSingleEvidenceValidation
    ) {
        return invalidate(
            hypothesis,
            Math.min(
                hypothesis.confidence,
                69,
            ),
        );
    }

    /*
     * ------------------------------------------------------------
     * HYPOTHESIS-SPECIFIC VALIDATION
     * ------------------------------------------------------------
     */
    if (
        hypothesis.title ===
        "Deployment Regression"
    ) {
        const deploymentValidation =
            validateDeploymentRegression(
                hypothesis,
                context,
            );

        if (
            !deploymentValidation.valid
        ) {
            return invalidate(
                hypothesis,
                Math.min(
                    hypothesis.confidence,
                    69,
                ),
            );
        }
    }

    if (
        hypothesis.title ===
        "Shared Dependency Failure"
    ) {
        const dependencyValidation =
            validateSharedDependency(
                hypothesis,
                context,
            );

        if (
            !dependencyValidation.valid
        ) {
            return invalidate(
                hypothesis,
                Math.min(
                    hypothesis.confidence,
                    69,
                ),
            );
        }
    }

    if (
        hypothesis.title ===
        "Infrastructure Failure"
    ) {
        const infrastructureValidation =
            validateInfrastructure(
                hypothesis,
                context,
            );

        if (
            !infrastructureValidation.valid
        ) {
            return invalidate(
                hypothesis,
                Math.min(
                    hypothesis.confidence,
                    69,
                ),
            );
        }
    }

    /*
     * ------------------------------------------------------------
     * MISSING EVIDENCE
     * ------------------------------------------------------------
     *
     * Missing evidence reduces confidence.
     *
     * It does not automatically invalidate a strong hypothesis.
     *
     * But if missing evidence is nearly as large as positive
     * evidence, we should not claim the cause is established.
     */
    const missingRatio =
        missingStrength /
        Math.max(
            supportStrength +
            missingStrength,
            1,
        );

    if (
        missingRatio >
        MAX_ALLOWED_MISSING_RATIO
    ) {
        return invalidate(
            hypothesis,
            Math.min(
                hypothesis.confidence,
                69,
            ),
        );
    }

    /*
     * ------------------------------------------------------------
     * CONFIDENCE GATE
     * ------------------------------------------------------------
     */
    if (
        hypothesis.confidence <
        MIN_VALIDATED_CONFIDENCE
    ) {
        return invalidate(
            hypothesis,
            hypothesis.confidence,
        );
    }

    /*
     * ------------------------------------------------------------
     * FINAL VALIDATION
     * ------------------------------------------------------------
     */
    return {
        ...hypothesis,

        status:
            isLeading
                ? "VALIDATED"
                : "CANDIDATE",

        validation: {
            validated:
                isLeading,

            confidence:
                isLeading
                    ? hypothesis.confidence
                    : Math.min(
                        hypothesis.confidence,
                        69,
                    ),

            evidenceIds:
                hypothesis.evidenceIds,
        },
    };
}

/**
 * Select the strongest currently viable candidate.
 *
 * Validation should not blindly trust array position.
 */
function selectLeadingCandidate(
    hypotheses: Hypothesis[],
): string | undefined {
    const viable =
        hypotheses.filter(
            hypothesis =>
                hypothesis.status !==
                "REJECTED" &&
                hypothesis.confidence >=
                MIN_VALIDATED_CONFIDENCE,
        );

    if (
        viable.length === 0
    ) {
        return undefined;
    }

    return [...viable]
        .sort(
            (a, b) => {
                if (
                    b.confidence !==
                    a.confidence
                ) {
                    return (
                        b.confidence -
                        a.confidence
                    );
                }

                const bNet =
                    netEvidence(b);

                const aNet =
                    netEvidence(a);

                if (
                    bNet !==
                    aNet
                ) {
                    return (
                        bNet -
                        aNet
                    );
                }

                return a.id.localeCompare(
                    b.id,
                );
            },
        )[0]?.id;
}

/**
 * Extract reasons that actually carry causal meaning.
 *
 * Contextual relationships are intentionally excluded from the
 * primary causal validation calculation.
 */
function getCausalSupport(
    hypothesis: Hypothesis,
): Reason[] {
    return hypothesis.supportingReasons.filter(
        reason =>
            reason.causalRole ===
            "CAUSE" ||
            reason.causalRole ===
            "TRIGGER",
    );
}

/**
 * Some direct causal relationships can be sufficiently strong
 * with one observation.
 *
 * Shared dependency and infrastructure rules can qualify when
 * their evidence itself establishes a concrete relationship.
 *
 * Deployment regression remains more conservative.
 */
function allowsSingleEvidenceValidation(
    hypothesis: Hypothesis,
    causalReasons: Reason[],
): boolean {
    if (
        causalReasons.length === 0
    ) {
        return false;
    }

    if (
        hypothesis.title ===
        "Deployment Regression"
    ) {
        return false;
    }

    if (
        hypothesis.title ===
        "Shared Dependency Failure"
    ) {
        return causalReasons.some(
            reason =>
                reason.strength >=
                0.85 &&
                reason.evidenceIds.length >=
                2,
        );
    }

    if (
        hypothesis.title ===
        "Infrastructure Failure"
    ) {
        return causalReasons.some(
            reason =>
                reason.strength >=
                0.9,
        );
    }

    return false;
}

/**
 * Count unique evidence observations participating in causal
 * reasons.
 */
function countIndependentEvidence(
    reasons: Reason[],
): number {
    const ids =
        new Set<string>();

    for (const reason of reasons) {
        for (const evidenceId of
            reason.evidenceIds) {
            ids.add(
                evidenceId,
            );
        }
    }

    return ids.size;
}

/**
 * Deployment regression requires a stronger causal chain than
 * "deployment happened before error".
 *
 * Preferred chain:
 *
 * deployment
 *     ↓
 * same-service failure
 *     ↓
 * recovery / rollback / corroborating signal
 *
 * Rollback + recovery is powerful confirmation, but not required
 * if there is other sufficiently strong causal evidence.
 */
function validateDeploymentRegression(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): {
    valid: boolean;
} {
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
        return {
            valid: false,
        };
    }

    const deploymentTime =
        deployment.timestamp.getTime();

    /*
     * Same-service post-deployment failure.
     */
    const postDeploymentErrors =
        context.errors.filter(
            error =>
                error.service ===
                deployment.service &&
                error.timestamp.getTime() >
                deploymentTime,
        );

    if (
        postDeploymentErrors.length ===
        0
    ) {
        return {
            valid: false,
        };
    }

    /*
     * Rollback is confirmation, not the sole proof.
     */
    const rollback =
        context.evidence.find(
            evidence =>
                evidence.type ===
                "DEPLOYMENT" &&
                evidence.timestamp.getTime() >=
                deploymentTime &&
                isRollbackEvidence(
                    evidence,
                ),
        );

    /*
     * Recovery must occur after the deployment and be associated
     * with the same affected service.
     */
    const recovery =
        context.evidence.find(
            evidence => {
                if (
                    evidence.service !==
                    deployment.service
                ) {
                    return false;
                }

                const time =
                    evidence.timestamp.getTime();

                if (
                    time <=
                    deploymentTime
                ) {
                    return false;
                }

                if (
                    time -
                    deploymentTime >
                    DEPLOYMENT_RECOVERY_WINDOW_MS
                ) {
                    return false;
                }

                return isRecoveryEvidence(
                    evidence,
                );
            },
        );

    /*
     * Strong confirmation:
     *
     * rollback + recovery
     */
    if (
        rollback &&
        recovery
    ) {
        return {
            valid: true,
        };
    }

    /*
     * Alternative strong path:
     *
     * deployment
     * + multiple same-service errors
     * + causal evidence
     *
     * This allows Halo to conclude without requiring an actual
     * rollback event to have occurred.
     */
    if (
        postDeploymentErrors.length >=
        2 &&
        hasStrongDeploymentCausalReason(
            hypothesis,
        )
    ) {
        return {
            valid: true,
        };
    }

    /*
     * A single temporal correlation is not enough.
     */
    return {
        valid: false,
    };
}

function hasStrongDeploymentCausalReason(
    hypothesis: Hypothesis,
): boolean {
    return hypothesis.supportingReasons.some(
        reason =>
            reason.causalRole ===
            "CAUSE" &&
            reason.strength >=
            0.7 &&
            reason.evidenceIds.length >=
            2,
    );
}

/**
 * Shared dependency validation.
 *
 * Required causal structure:
 *
 * service A ─┐
 *            ├── shared resource/operation
 * service B ─┘
 *
 * The evidence must actually show the relationship.
 */
function validateSharedDependency(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): {
    valid: boolean;
} {
    const evidence =
        context.evidence.filter(
            item =>
                hypothesis.evidenceIds.includes(
                    item.id,
                ),
        );

    const errors =
        evidence.filter(
            item =>
                item.type ===
                "ERROR",
        );

    if (
        errors.length <
        2
    ) {
        return {
            valid: false,
        };
    }

    const services =
        new Set(
            errors
                .map(
                    error =>
                        error.service,
                )
                .filter(
                    (
                        service,
                    ): service is string =>
                        Boolean(service),
                ),
        );

    if (
        services.size <
        2
    ) {
        return {
            valid: false,
        };
    }

    const resources =
        findSharedValues(
            errors.map(
                error =>
                    error.resource,
            ),
        );

    const operations =
        findSharedValues(
            errors.map(
                error =>
                    error.operation,
            ),
        );

    return {
        valid:
            resources.size >
            0 ||
            operations.size >
            0,
    };
}

/**
 * Infrastructure validation requires actual infrastructure
 * evidence connected to the incident.
 */
function validateInfrastructure(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): {
    valid: boolean;
} {
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
        return {
            valid: true,
        };
    }

    /*
     * Allow an infrastructure finding to reference an error
     * while the infrastructure event itself sits nearby in time.
     */
    const relatedErrors =
        context.errors.filter(
            error =>
                hypothesis.evidenceIds.includes(
                    error.id,
                ),
        );

    const correlatedInfrastructure =
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

    return {
        valid:
            correlatedInfrastructure,
    };
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
 * Calculate the same net evidence concept used by ranking.
 */
function netEvidence(
    hypothesis: Hypothesis,
): number {
    return (
        hypothesis.score.positive -
        hypothesis.score.negative *
        1.15 -
        hypothesis.score.unknown *
        0.65
    );
}

/**
 * Calculate unique evidence strength so repeated rules cannot
 * inflate validation.
 */
function uniqueReasonStrength(
    reasons: Reason[],
): number {
    const evidenceStrength =
        new Map<string, number>();

    const unlinked =
        new Set<string>();

    for (const reason of reasons) {
        if (
            reason.evidenceIds.length ===
            0
        ) {
            unlinked.add(
                [
                    reason.type,
                    reason.causalRole,
                    reason.title,
                ].join("|"),
            );

            continue;
        }

        for (const evidenceId of
            reason.evidenceIds) {
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

    const linked =
        [...evidenceStrength.values()]
            .reduce(
                (total, strength) =>
                    total + strength,
                0,
            );

    const unlinkedStrength =
        Math.min(
            0.5,
            unlinked.size *
            0.25,
        );

    return (
        linked +
        unlinkedStrength
    );
}

function clampStrength(
    value: number,
): number {
    if (
        !Number.isFinite(
            value,
        )
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

/**
 * Return an explicit non-validated result.
 *
 * We retain the candidate and all evidence so the UI can explain
 * why Halo did not establish a root cause.
 */
function invalidate(
    hypothesis: Hypothesis,
    confidence: number,
): Hypothesis {
    return {
        ...hypothesis,

        status:
            hypothesis.status ===
                "REJECTED"
                ? "REJECTED"
                : "UNCERTAIN",

        validation: {
            validated: false,

            confidence:
                Math.min(
                    confidence,
                    69,
                ),

            evidenceIds:
                hypothesis.evidenceIds,
        },
    };
}