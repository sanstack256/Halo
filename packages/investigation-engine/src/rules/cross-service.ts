import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function crossService(
    context: InvestigationContext
): Finding[] {
    const { errors } = context;

    if (errors.length < 2) {
        return [];
    }

    const services = [
        ...new Set(
            errors.map(error => error.service)
        ),
    ];

    if (services.length < 2) {
        return [];
    }

    const evidenceIds = errors.map(
        error => error.id
    );

    const strength = Math.min(
        0.75,
        0.45 +
            services.length * 0.1
    );

    return [
        {
            id: "cross-service-failure",
            type: "SCOPE",
            causalRole: "CONTEXT",

            title:
                "Failure spans multiple services",

            description:
                `${errors.length} errors were observed across ${services.length} services, but no shared dependency has been established.`,

            strength,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "CONTEXT",

                    title:
                        "Multiple services are affected",

                    description:
                        `Errors were observed across ${services.length} different services.`,

                    evidenceIds,

                    strength,
                },
            ],
        },
    ];
}