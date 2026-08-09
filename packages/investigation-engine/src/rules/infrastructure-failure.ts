import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

const INFRASTRUCTURE_WINDOW_MS =
    5 * 60 * 1000;

function isFailureSignal(
    text: string
): boolean {
    const normalized =
        text.toLowerCase();

    return [
        "fail",
        "failed",
        "failure",
        "error",
        "timeout",
        "timed out",
        "degraded",
        "unavailable",
        "unhealthy",
        "exhausted",
        "high",
        "spike",
        "elevated",
    ].some(term =>
        normalized.includes(term)
    );
}

export function infrastructureFailure(
    context: InvestigationContext
): Finding[] {
    if (
        context.infrastructure.length === 0 ||
        context.errors.length < 2
    ) {
        return [];
    }

    const findings: Finding[] = [];

    for (
        const infrastructure
        of context.infrastructure
    ) {
        const infrastructureText = [
            infrastructure.title,
            infrastructure.description ?? "",
            infrastructure.status?.toString() ?? "",
        ].join(" ");

        if (
            !isFailureSignal(
                infrastructureText
            )
        ) {
            continue;
        }

        const relatedErrors =
            context.errors.filter(error => {
                const timeDifference =
                    Math.abs(
                        error.timestamp.getTime() -
                        infrastructure.timestamp.getTime()
                    );

                return (
                    timeDifference <=
                    INFRASTRUCTURE_WINDOW_MS
                );
            });

        const affectedServices = [
            ...new Set(
                relatedErrors.map(
                    error =>
                        error.service
                )
            ),
        ];

        if (
            relatedErrors.length < 2 ||
            affectedServices.length < 2
        ) {
            continue;
        }

        const evidenceIds = [
            infrastructure.id,
            ...relatedErrors.map(
                error =>
                    error.id
            ),
        ];

        findings.push({
            id:
                `infrastructure-failure:${infrastructure.id}`,

            type: "DEPENDENCY",

            causalRole: "CAUSE",

            title:
                "Infrastructure degradation affects multiple services",

            description:
                `Infrastructure evidence "${infrastructure.title}" occurred near failures affecting ${affectedServices.length} services, indicating a possible infrastructure-level cause.`,

            strength: Math.min(
                0.95,
                0.65 +
                    Math.min(
                        affectedServices.length *
                            0.05,
                        0.2
                    )
            ),

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole:
                        "CAUSE",

                    title:
                        "Infrastructure degradation aligns with multi-service failures",

                    description:
                        `Infrastructure degradation occurred near failures affecting ${affectedServices.length} services.`,

                    evidenceIds,

                    strength: 0.85,
                },
            ],
        });
    }

    return findings;
}