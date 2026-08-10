import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";
import type { Finding } from "../types/finding";

const SIGNAL_WINDOW_MS = 5 * 60 * 1000;

function textOf(evidence: Evidence): string {
    return [
        evidence.title,
        evidence.description ?? "",
        evidence.status?.toString() ?? "",
    ]
        .join(" ")
        .toLowerCase();
}

function isFailureSignal(
    evidence: Evidence
): boolean {
    const text = textOf(evidence);

    return [
        "fail",
        "failed",
        "failure",
        "error",
        "timeout",
        "timed out",
        "exception",
        "degraded",
        "unavailable",
        "unhealthy",
        "refused",
        "exhausted",
        "increased",
        "spike",
        "elevated",
        "high",
    ].some(term =>
        text.includes(term)
    );
}

function isNear(
    left: Evidence,
    right: Evidence
): boolean {
    const difference = Math.abs(
        left.timestamp.getTime() -
            right.timestamp.getTime()
    );

    return difference <= SIGNAL_WINDOW_MS;
}

function relatedToError(
    evidence: Evidence,
    errors: Evidence[]
): Evidence[] {
    return errors.filter(
        error =>
            error.service ===
                evidence.service &&
            isNear(evidence, error)
    );
}

export function evidenceSignals(
    context: InvestigationContext
): Finding[] {
    const findings: Finding[] = [];

    /*
     * Metric anomaly signals
     *
     * We only treat a metric as anomalous when its
     * own description/title indicates degradation.
     * A raw numeric value is not enough without a
     * baseline.
     */
    for (const metric of context.metrics) {
        if (!isFailureSignal(metric)) {
            continue;
        }

        const relatedErrors =
            relatedToError(
                metric,
                context.errors
            );

        if (
            relatedErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            metric.id,
            ...relatedErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `metric-anomaly:${metric.id}`,

            type: "ANOMALY",

            causalRole: "CONTRIBUTOR",

            title:
                "Metric degradation accompanied the failure",

            description:
                `Metric "${metric.title}" showed a degradation signal near the observed errors.`,

            strength: 0.65,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole:
                        "CONTRIBUTOR",

                    title:
                        "Metric degradation aligns with errors",

                    description:
                        "A metric reporting degraded behavior occurred near errors affecting the same service.",

                    evidenceIds,

                    strength: 0.65,
                },
            ],
        });
    }

    /*
     * Logs provide mechanism evidence.
     *
     * A log does not become a root cause by itself.
     * It explains what was happening inside the system.
     */
    for (const log of context.logs) {
        if (!isFailureSignal(log)) {
            continue;
        }

        const relatedErrors =
            relatedToError(
                log,
                context.errors
            );

        if (
            relatedErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            log.id,
            ...relatedErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `log-mechanism:${log.id}`,

            type: "RELATIONSHIP",

            causalRole: "MECHANISM",

            title:
                "Log evidence explains the failure mechanism",

            description:
                `Log evidence near the failure indicates "${log.title}".`,

            strength: 0.7,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole:
                        "MECHANISM",

                    title:
                        "Failure mechanism observed in logs",

                    description:
                        "A failure-related log occurred near the observed errors in the same service.",

                    evidenceIds,

                    strength: 0.7,
                },
            ],
        });
    }

    /*
     * Trace evidence connects an observed error to
     * the execution path that produced it.
     */
    for (const trace of context.traces) {
        if (!trace.traceId) {
            continue;
        }

        const relatedErrors =
            context.errors.filter(
                error =>
                    error.traceId ===
                    trace.traceId
            );

        if (
            relatedErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            trace.id,
            ...relatedErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `trace-context:${trace.id}`,

            type: "RELATIONSHIP",

            causalRole: "MECHANISM",

            title:
                "Trace connects the failure to an execution path",

            description:
                "The trace shares a trace identifier with observed errors, connecting the failure to the same request execution path.",

            strength: 0.6,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole:
                        "MECHANISM",

                    title:
                        "Failure is connected by trace",

                    description:
                        "The trace and error belong to the same distributed trace.",

                    evidenceIds,

                    strength: 0.6,
                },
            ],
        });
    }

    /*
     * Third-party evidence.
     *
     * This becomes dependency evidence only when the
     * external system itself reports a failure signal
     * and application errors occur nearby.
     */
    for (const external of context.thirdParty) {
        if (!isFailureSignal(external)) {
            continue;
        }

        const relatedErrors =
            relatedToError(
                external,
                context.errors
            );

        if (
            relatedErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            external.id,
            ...relatedErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `third-party-failure:${external.id}`,

            type: "DEPENDENCY",

            causalRole: "CAUSE",

            title:
                "Third-party failure coincided with application errors",

            description:
                `External evidence "${external.title}" indicates a possible dependency failure during the incident.`,

            strength: 0.75,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole: "CAUSE",

                    title:
                        "External dependency reported failure",

                    description:
                        "A third-party failure signal occurred near application errors in the affected service.",

                    evidenceIds,

                    strength: 0.75,
                },
            ],
        });
    }

    /*
     * Configuration and feature-flag changes.
     *
     * These are treated as possible triggers, not
     * automatic causes.
     */
    const configurationChanges = [
        ...context.configs,
        ...context.featureFlags,
    ];

    for (const change of configurationChanges) {
        const relatedErrors =
            context.errors.filter(
                error =>
                    error.service ===
                        change.service &&
                    error.timestamp.getTime() >=
                        change.timestamp.getTime() &&
                    isNear(change, error)
            );

        if (
            relatedErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            change.id,
            ...relatedErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `change-impact:${change.id}`,

            type: "CHANGE_IMPACT",

            causalRole: "TRIGGER",

            title:
                "Configuration change preceded failure",

            description:
                `The ${change.type.toLowerCase().replace("_", " ")} change was followed by errors in the same service.`,

            strength: 0.65,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole: "TRIGGER",

                    title:
                        "Change preceded service errors",

                    description:
                        "The configuration or feature-flag change occurred before errors appeared in the same service.",

                    evidenceIds,

                    strength: 0.65,
                },
            ],
        });
    }

    /*
     * Infrastructure evidence.
     */
    for (const infrastructure of context.infrastructure) {
        if (!isFailureSignal(infrastructure)) {
            continue;
        }

        const relatedErrors =
            relatedToError(
                infrastructure,
                context.errors
            );

        if (
            relatedErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            infrastructure.id,
            ...relatedErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `infrastructure-signal:${infrastructure.id}`,

            type: "ANOMALY",

            causalRole: "CONTRIBUTOR",

            title:
                "Infrastructure degradation accompanied the failure",

            description:
                `Infrastructure evidence "${infrastructure.title}" indicates degradation during the incident.`,

            strength: 0.75,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole:
                        "CONTRIBUTOR",

                    title:
                        "Infrastructure failure signal observed",

                    description:
                        "Infrastructure degradation occurred near application errors in the affected service.",

                    evidenceIds,

                    strength: 0.75,
                },
            ],
        });
    }

    return findings;
}