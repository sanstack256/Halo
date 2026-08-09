import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";
import type { Evidence } from "../types/evidence";

function getSharedKey(
    evidence: Evidence
): string | null {
    if (evidence.resource) {
        return `resource:${evidence.resource}`;
    }

    if (evidence.operation) {
        return `operation:${evidence.operation}`;
    }

    return null;
}

export function sharedDependency(
    context: InvestigationContext
): Finding[] {
    const { errors, evidence } = context;

    if (errors.length < 2) {
        return [];
    }

    const groups = new Map<
        string,
        Evidence[]
    >();

    for (const item of evidence) {
        if (item.type !== "ERROR") {
            continue;
        }

        const key = getSharedKey(item);

        if (!key) {
            continue;
        }

        const group =
            groups.get(key) ?? [];

        group.push(item);

        groups.set(key, group);
    }

    const findings: Finding[] = [];

    for (const [key, items] of groups) {
        const affectedServices = [
            ...new Set(
                items
                    .filter(
                        item =>
                            item.type ===
                            "ERROR"
                    )
                    .map(
                        item =>
                            item.service
                    )
            ),
        ];

        if (affectedServices.length < 2) {
            continue;
        }

        const errorEvidence =
            items.filter(
                item =>
                    item.type === "ERROR"
            );

        if (errorEvidence.length < 2) {
            continue;
        }

        const sharedResource =
            key.startsWith("resource:")
                ? key.replace("resource:", "")
                : null;

        const infrastructureExplainsFailure =
            sharedResource !== null &&
            context.infrastructure.some(
                infrastructure => {
                    if (
                        infrastructure.resource !==
                        sharedResource
                    ) {
                        return false;
                    }

                    const infrastructureTime =
                        infrastructure.timestamp.getTime();

                    return errorEvidence.some(
                        error => {
                            const difference =
                                Math.abs(
                                    error.timestamp.getTime() -
                                    infrastructureTime
                                );

                            return (
                                difference <=
                                5 * 60 * 1000
                            );
                        }
                    );
                }
            );

        if (infrastructureExplainsFailure) {
            continue;
        }

        const evidenceIds = [
            ...new Set(
                items.map(
                    item => item.id
                )
            ),
        ];

        const resourceName =
            key.replace(
                "resource:",
                ""
            ).replace(
                "operation:",
                ""
            );

        const strength = Math.min(
            0.95,
            0.55 +
            affectedServices.length *
            0.1 +
            Math.min(
                errorEvidence.length *
                0.05,
                0.2
            )
        );

        findings.push({
            id: `dependency:${key}`,
            type: "DEPENDENCY",
            causalRole: "CAUSE",
            title:
                "Multiple services share a failing dependency",
            description:
                `${affectedServices.length} services produced errors associated with "${resourceName}". This shared resource may explain the cross-service failure.`,
            strength,
            evidenceIds,
            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "CAUSE",
                    title:
                        "Shared dependency connects affected services",
                    description:
                        `The same ${key.startsWith("resource:") ? "resource" : "operation"} appears across errors from ${affectedServices.length} different services.`,
                    evidenceIds,
                    strength,
                },
            ],
        });
    }

    return findings;
}