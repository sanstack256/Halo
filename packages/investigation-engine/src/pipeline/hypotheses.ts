import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";
import type { Finding } from "../types/finding";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

const DEPLOYMENT_CAUSAL_WINDOW_MS =
    30 * 60 * 1000;

const INFRASTRUCTURE_CONTEXT_WINDOW_MS =
    5 * 60 * 1000;

const MIN_SHARED_SERVICES = 2;

export function generateHypotheses(
    context: InvestigationContext,
): Hypothesis[] {
    const hypotheses = [
        ...generateDeploymentHypotheses(
            context,
        ),
        ...generateSharedDependencyHypotheses(
            context,
        ),
        ...generateInfrastructureHypotheses(
            context,
        ),
        ...generateCrossServiceHypotheses(
            context,
        ),
    ];

    return deduplicateHypotheses(
        hypotheses,
    );
}

function generateDeploymentHypotheses(
    context: InvestigationContext,
): Hypothesis[] {
    return context.deployments
        .filter(
            deployment =>
                deployment.service.length > 0,
        )
        .map(
            deployment =>
                createDeploymentHypothesis(
                    deployment,
                    context,
                ),
        )
        .filter(
            (
                hypothesis,
            ): hypothesis is Hypothesis =>
                hypothesis !== null,
        );
}

function createDeploymentHypothesis(
    deployment: Evidence,
    context: InvestigationContext,
): Hypothesis | null {
    const deploymentTime =
        deployment.timestamp.getTime();

    const errors =
        context.errors
            .filter(error => {
                if (
                    error.service !==
                    deployment.service
                ) {
                    return false;
                }

                const delta =
                    error.timestamp.getTime() -
                    deploymentTime;

                return (
                    delta > 0 &&
                    delta <=
                        DEPLOYMENT_CAUSAL_WINDOW_MS
                );
            })
            .sort(compareEvidence);

    if (errors.length === 0) {
        return null;
    }

    const findings =
        context.findings.filter(
            finding =>
                finding.evidenceIds.some(
                    id =>
                        id ===
                            deployment.id ||
                        errors.some(
                            error =>
                                error.id === id,
                        ),
                ),
        );

    const temporalReason =
        createDeploymentTemporalReason(
            deployment,
            errors[0],
        );

    const supportingReasons =
        deduplicateReasons([
            ...collectReasons(
                findings,
                "SUPPORTING",
            ),
            ...(temporalReason
                ? [temporalReason]
                : []),
        ]);

    const contradictingReasons =
        collectReasons(
            findings,
            "CONTRADICTING",
        );

    const evidenceIds =
        uniqueStrings([
            deployment.id,
            ...errors.map(
                error =>
                    error.id,
            ),
            ...findings.flatMap(
                finding =>
                    finding.evidenceIds,
            ),
        ]);

    return {
        id:
            `deployment-regression:${deployment.id}`,

        title:
            "Deployment Regression",

        description:
            buildDeploymentDescription(
                deployment,
                errors[0],
            ),

        score: {
            positive:
                sumReasonStrength(
                    supportingReasons,
                ),

            negative:
                sumReasonStrength(
                    contradictingReasons,
                ),

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds:
            uniqueStrings(
                findings.map(
                    finding =>
                        finding.id,
                ),
            ),

        evidenceIds,

        alternativeIds: [],
    };
}

function createDeploymentTemporalReason(
    deployment: Evidence,
    error: Evidence,
): Reason | null {
    const delta =
        error.timestamp.getTime() -
        deployment.timestamp.getTime();

    if (
        delta <= 0 ||
        delta >
            DEPLOYMENT_CAUSAL_WINDOW_MS
    ) {
        return null;
    }

    const ratio =
        delta /
        DEPLOYMENT_CAUSAL_WINDOW_MS;

    const minutes =
        Math.round(
            delta / 60_000,
        );

    const strength =
        clampStrength(
            0.9 -
                ratio * 0.35,
        );

    return {
        type: "SUPPORTING",

        causalRole: "TRIGGER",

        title:
            "Failure followed deployment",

        description:
            minutes === 0
                ? "A same-service error occurred immediately after the deployment."
                : `A same-service error occurred ${minutes} minute${
                      minutes === 1
                          ? ""
                          : "s"
                  } after the deployment.`,

        strength:

            Math.max(
                0.55,
                strength,
            ),

        evidenceIds: [
            deployment.id,
            error.id,
        ],
    };
}

function buildDeploymentDescription(
    deployment: Evidence,
    error: Evidence,
): string {
    const delta =
        Math.max(
            0,
            error.timestamp.getTime() -
                deployment.timestamp.getTime(),
        );

    const minutes =
        Math.round(
            delta / 60_000,
        );

    return `The ${deployment.service} service experienced a failure ${minutes} minute${
        minutes === 1
            ? ""
            : "s"
    } after deployment "${deployment.title}". The deployment is a causal candidate, not proof of the root cause.`;
}

function generateSharedDependencyHypotheses(
    context: InvestigationContext,
): Hypothesis[] {
    const findings =
        context.findings.filter(
            finding =>
                finding.id.startsWith(
                    "dependency:",
                ),
        );

    const groups =
        groupDependencyFindings(
            findings,
            context,
        );

    return [...groups.values()]
        .map(
            group =>
                createSharedDependencyHypothesis(
                    group,
                    context,
                ),
        )
        .filter(
            (
                hypothesis,
            ): hypothesis is Hypothesis =>
                hypothesis !== null,
        );
}

interface DependencyGroup {
    key: string;
    findings: Finding[];
    evidence: Evidence[];
    services: string[];
    resources: string[];
}

function groupDependencyFindings(
    findings: Finding[],
    context: InvestigationContext,
): Map<string, DependencyGroup> {
    const groups =
        new Map<
            string,
            DependencyGroup
        >();

    for (const finding of findings) {
        const evidence =
            getEvidenceByIds(
                finding.evidenceIds,
                context,
            );

        const resources =
            uniqueStrings(
                evidence
                    .map(
                        item =>
                            item.resource,
                    )
                    .filter(
                        (
                            resource,
                        ): resource is string =>
                            Boolean(
                                resource,
                            ),
                    ),
            );

        const services =
            uniqueStrings(
                evidence.map(
                    item =>
                        item.service,
                ),
            );

        const resourceKey =
            resources
                .map(normalizeKey)
                .sort()
                .join("|");

        const serviceKey =
            services
                .map(normalizeKey)
                .sort()
                .join("|");

        const key =
            resourceKey ||
            serviceKey ||
            normalizeKey(
                finding.id,
            );

        const existing =
            groups.get(key);

        if (!existing) {
            groups.set(key, {
                key,
                findings: [
                    finding,
                ],
                evidence,
                services,
                resources,
            });

            continue;
        }

        existing.findings.push(
            finding,
        );

        existing.evidence =
            mergeEvidence(
                existing.evidence,
                evidence,
            );

        existing.services =
            uniqueStrings([
                ...existing.services,
                ...services,
            ]);

        existing.resources =
            uniqueStrings([
                ...existing.resources,
                ...resources,
            ]);
    }

    return groups;
}

function createSharedDependencyHypothesis(
    group: DependencyGroup,
    context: InvestigationContext,
): Hypothesis | null {
    const {
        findings,
        evidence,
        services,
        resources,
    } = group;

    const hasSharedResource =
        resources.length > 0;

    const hasMultipleServices =
        services.length >=
        MIN_SHARED_SERVICES;

    if (
        !hasSharedResource &&
        !hasMultipleServices
    ) {
        return null;
    }

    const supportingReasons =
        collectReasons(
            findings,
            "SUPPORTING",
        );

    const contradictingReasons =
        collectReasons(
            findings,
            "CONTRADICTING",
        );

    const evidenceIds =
        uniqueStrings([
            ...findings.flatMap(
                finding =>
                    finding.evidenceIds,
            ),
            ...evidence.map(
                item =>
                    item.id,
            ),
        ]);

    return {
        id:
            `shared-dependency:${normalizeKey(
                group.key,
            )}`,

        title:
            "Shared Dependency Failure",

        description:
            buildSharedDependencyDescription(
                services,
                resources,
            ),

        score: {
            positive:
                sumReasonStrength(
                    supportingReasons,
                ),

            negative:
                sumReasonStrength(
                    contradictingReasons,
                ),

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds:
            uniqueStrings(
                findings.map(
                    finding =>
                        finding.id,
                ),
            ),

        evidenceIds,

        alternativeIds: [],
    };
}

function buildSharedDependencyDescription(
    services: string[],
    resources: string[],
): string {
    if (
        resources.length > 0 &&
        services.length >=
            MIN_SHARED_SERVICES
    ) {
        return `${services.length} services show failure-related evidence associated with ${resources.join(
            ", ",
        )}. A shared dependency failure is a candidate explanation for the incident.`;
    }

    if (
        resources.length > 0
    ) {
        return `Failure-related evidence is associated with ${resources.join(
            ", ",
        )}. A dependency failure is a candidate explanation for the incident.`;
    }

    return `Multiple services show dependency-related failure evidence. A shared dependency failure is a candidate explanation for the incident.`;
}

function generateInfrastructureHypotheses(
    context: InvestigationContext,
): Hypothesis[] {
    return context.findings
        .filter(
            finding =>
                finding.id.startsWith(
                    "infrastructure-failure:",
                ) ||
                finding.id ===
                    "infrastructure-failure",
        )
        .map(
            finding =>
                createInfrastructureHypothesis(
                    finding,
                    context,
                ),
        );
}

function createInfrastructureHypothesis(
    finding: Finding,
    context: InvestigationContext,
): Hypothesis {
    const findingEvidence =
        getEvidenceByIds(
            finding.evidenceIds,
            context,
        );

    const relatedInfrastructure =
        context.infrastructure.filter(
            infrastructure =>
                isInfrastructureRelated(
                    infrastructure,
                    findingEvidence,
                ),
        );

    const supportingReasons =
        collectReasons(
            [finding],
            "SUPPORTING",
        );

    const contradictingReasons =
        collectReasons(
            [finding],
            "CONTRADICTING",
        );

    return {
        id:
            "infrastructure-failure",

        title:
            "Infrastructure Failure",

        description:
            finding.description,

        score: {
            positive:
                sumReasonStrength(
                    supportingReasons,
                ),

            negative:
                sumReasonStrength(
                    contradictingReasons,
                ),

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds: [
            finding.id,
        ],

        evidenceIds:
            uniqueStrings([
                ...finding.evidenceIds,
                ...relatedInfrastructure.map(
                    item =>
                        item.id,
                ),
            ]),

        alternativeIds: [],
    };
}

function isInfrastructureRelated(
    infrastructure: Evidence,
    findingEvidence: Evidence[],
): boolean {
    if (
        findingEvidence.length === 0
    ) {
        return false;
    }

    if (
        infrastructure.resource &&
        findingEvidence.some(
            evidence =>
                evidence.resource ===
                infrastructure.resource,
        )
    ) {
        return true;
    }

    if (
        infrastructure.service &&
        findingEvidence.some(
            evidence =>
                evidence.service ===
                infrastructure.service,
        )
    ) {
        return true;
    }

    const infrastructureTime =
        infrastructure.timestamp.getTime();

    return findingEvidence.some(
        evidence =>
            Math.abs(
                evidence.timestamp.getTime() -
                    infrastructureTime,
            ) <=
            INFRASTRUCTURE_CONTEXT_WINDOW_MS,
    );
}

function generateCrossServiceHypotheses(
    context: InvestigationContext,
): Hypothesis[] {
    return context.findings
        .filter(
            finding =>
                finding.id ===
                    "cross-service-failure" ||
                finding.title ===
                    "Cross-Service Failure",
        )
        .map(
            finding =>
                createCrossServiceHypothesis(
                    finding,
                ),
        );
}

function createCrossServiceHypothesis(
    finding: Finding,
): Hypothesis {
    const supportingReasons =
        collectReasons(
            [finding],
            "SUPPORTING",
        );

    const contradictingReasons =
        collectReasons(
            [finding],
            "CONTRADICTING",
        );

    return {
        id:
            "cross-service-failure",

        title:
            "Cross-Service Failure",

        description:
            finding.description,

        score: {
            positive:
                sumReasonStrength(
                    supportingReasons,
                ),

            negative:
                sumReasonStrength(
                    contradictingReasons,
                ),

            unknown: 0,
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons: [],

        findingIds: [
            finding.id,
        ],

        evidenceIds:
            uniqueStrings(
                finding.evidenceIds,
            ),

        alternativeIds: [],
    };
}

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

function deduplicateReasons(
    reasons: Reason[],
): Reason[] {
    const seen =
        new Set<string>();

    return reasons.filter(
        reason => {
            const key = [
                reason.type,
                reason.causalRole,
                reason.title,
                reason.description,
                [...reason.evidenceIds]
                    .sort()
                    .join(","),
            ].join("|");

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);

            return true;
        },
    );
}

function sumReasonStrength(
    reasons: Reason[],
): number {
    return reasons.reduce(
        (total, reason) =>
            total +
            clampStrength(
                reason.strength,
            ),
        0,
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

function getEvidenceByIds(
    ids: string[],
    context: InvestigationContext,
): Evidence[] {
    const wanted =
        new Set(ids);

    return context.evidence.filter(
        evidence =>
            wanted.has(
                evidence.id,
            ),
    );
}

function mergeEvidence(
    left: Evidence[],
    right: Evidence[],
): Evidence[] {
    const seen =
        new Set(
            left.map(
                item =>
                    item.id,
            ),
        );

    const result = [
        ...left,
    ];

    for (const item of right) {
        if (
            seen.has(item.id)
        ) {
            continue;
        }

        seen.add(item.id);
        result.push(item);
    }

    return result;
}

function deduplicateHypotheses(
    hypotheses: Hypothesis[],
): Hypothesis[] {
    const map =
        new Map<string, Hypothesis>();

    for (const hypothesis of hypotheses) {
        const existing =
            map.get(
                hypothesis.id,
            );

        if (!existing) {
            map.set(
                hypothesis.id,
                hypothesis,
            );
            continue;
        }

        map.set(
            hypothesis.id,
            mergeHypotheses(
                existing,
                hypothesis,
            ),
        );
    }

    return [...map.values()];
}

function mergeHypotheses(
    left: Hypothesis,
    right: Hypothesis,
): Hypothesis {
    const supportingReasons =
        deduplicateReasons([
            ...left.supportingReasons,
            ...right.supportingReasons,
        ]);

    const contradictingReasons =
        deduplicateReasons([
            ...left.contradictingReasons,
            ...right.contradictingReasons,
        ]);

    const missingReasons =
        deduplicateReasons([
            ...left.missingReasons,
            ...right.missingReasons,
        ]);

    return {
        ...left,

        description:
            left.description.length >=
            right.description.length
                ? left.description
                : right.description,

        score: {
            positive:
                sumReasonStrength(
                    supportingReasons,
                ),

            negative:
                sumReasonStrength(
                    contradictingReasons,
                ),

            unknown:
                Math.max(
                    left.score.unknown,
                    right.score.unknown,
                ),
        },

        confidence: 0,

        status: "CANDIDATE",

        supportingReasons,

        contradictingReasons,

        missingReasons,

        findingIds:
            uniqueStrings([
                ...left.findingIds,
                ...right.findingIds,
            ]),

        evidenceIds:
            uniqueStrings([
                ...left.evidenceIds,
                ...right.evidenceIds,
            ]),

        alternativeIds: [],
    };
}

function compareEvidence(
    a: Evidence,
    b: Evidence,
): number {
    const timestampDifference =
        a.timestamp.getTime() -
        b.timestamp.getTime();

    if (
        timestampDifference !== 0
    ) {
        return timestampDifference;
    }

    return a.id.localeCompare(
        b.id,
    );
}

function normalizeKey(
    value: string,
): string {
    const normalized =
        value
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

    return normalized || "unknown";
}

function uniqueStrings(
    values: string[],
): string[] {
    const seen =
        new Set<string>();

    const result: string[] = [];

    for (const value of values) {
        if (
            typeof value !==
                "string" ||
            value.length === 0 ||
            seen.has(value)
        ) {
            continue;
        }

        seen.add(value);
        result.push(value);
    }

    return result;
}