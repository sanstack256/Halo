import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

const ERROR_WINDOW_MS = 5 * 60 * 1000;

export function multipleErrors(
    context: InvestigationContext
): Finding[] {
    const { deployments, errors } = context;

    if (errors.length < 2) {
        return [];
    }

    const findings: Finding[] = [];

    /*
     * General error clustering
     *
     * Group errors that belong to the same service,
     * operation and resource and occur within a short
     * temporal window.
     */
    const groups = new Map<string, typeof errors>();

    for (const error of errors) {
        const key = [
            error.service,
            error.operation ?? "",
            error.resource ?? "",
        ].join(":");

        const existing = groups.get(key) ?? [];

        existing.push(error);

        groups.set(key, existing);
    }

    for (const [key, group] of groups) {
        if (group.length < 2) {
            continue;
        }

        const sorted = [...group].sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime()
        );

        const clusters: typeof errors[] = [];
        let current: typeof errors = [];

        for (const error of sorted) {
            if (current.length === 0) {
                current.push(error);
                continue;
            }

            const previous =
                current[current.length - 1];

            const diff =
                error.timestamp.getTime() -
                previous.timestamp.getTime();

            if (diff <= ERROR_WINDOW_MS) {
                current.push(error);
            } else {
                if (current.length >= 2) {
                    clusters.push(current);
                }

                current = [error];
            }
        }

        if (current.length >= 2) {
            clusters.push(current);
        }

        for (const cluster of clusters) {
            const evidenceIds =
                cluster.map(error => error.id);

            const service =
                cluster[0].service;

            const operation =
                cluster[0].operation;

            const resource =
                cluster[0].resource;

            findings.push({
                id: `error-cluster:${key}:${cluster[0].id}`,

                type: "PATTERN",

                causalRole: "CONTRIBUTOR",

                title:
                    "Related errors occurred in a cluster",

                description:
                    `${cluster.length} errors occurred within five minutes in the same service and operation.`,

                strength: 0.6,

                evidenceIds,

                reasons: [
                    {
                        type: "SUPPORTING",

                        causalRole: "CONTRIBUTOR",

                        title:
                            "Errors share service and operation",

                        description:
                            `Multiple errors occurred close together in ${service}${operation ? ` during ${operation}` : ""}${resource ? ` against ${resource}` : ""}.`,

                        evidenceIds,

                        strength: 0.6,
                    },
                ],
            });
        }
    }

    /*
     * Deployment-associated error clusters
     *
     * Preserve the existing finding because the
     * deployment regression hypothesis depends on it.
     */
    for (const deployment of deployments) {
        const errorsAfterDeployment =
            errors.filter(error => {
                const diff =
                    error.timestamp.getTime() -
                    deployment.timestamp.getTime();

                return (
                    diff >= 0 &&
                    diff <= ERROR_WINDOW_MS
                );
            });

        if (errorsAfterDeployment.length < 2) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            ...errorsAfterDeployment.map(
                error => error.id
            ),
        ];

        findings.push({
            id: `error-cluster:${deployment.id}`,

            type: "PATTERN",

            causalRole: "CONTRIBUTOR",

            title:
                "Multiple errors followed deployment",

            description:
                `${errorsAfterDeployment.length} errors occurred within five minutes of the deployment.`,

            strength: 0.65,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole: "CONTRIBUTOR",

                    title:
                        "Error cluster followed the deployment",

                    description:
                        "Multiple errors appeared within a short period after the deployment, indicating a possible change-related failure pattern.",

                    evidenceIds,

                    strength: 0.65,
                },
            ],
        });
    }

    return findings;
}