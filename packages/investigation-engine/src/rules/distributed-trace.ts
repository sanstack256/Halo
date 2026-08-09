import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function distributedTrace(
    context: InvestigationContext
): Finding[] {
    const { graph } = context;

    const findings: Finding[] = [];

    const traceEdges = graph.edges.filter(
        edge =>
            edge.relationship ===
            "SAME_TRACE"
    );

    const requestEdges = graph.edges.filter(
        edge =>
            edge.relationship ===
            "SAME_REQUEST"
    );

    const edges = [
        ...traceEdges,
        ...requestEdges,
    ];

    const seen = new Set<string>();

    for (const edge of edges) {
        const key = [
            edge.relationship,
            ...edge.evidenceIds.sort(),
        ].join(":");

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);

        findings.push({
            id: `distributed-trace:${edge.relationship}:${edge.from}:${edge.to}`,
            type: "RELATIONSHIP",
            causalRole: "CONTEXT",
            title:
                edge.relationship ===
                "SAME_TRACE"
                    ? "Evidence belongs to the same trace"
                    : "Evidence belongs to the same request",
            description:
                edge.relationship ===
                "SAME_TRACE"
                    ? "The observations share a distributed trace, connecting them within the same request path."
                    : "The observations share a request identifier, connecting them within the same request path.",
            strength: edge.confidence,
            evidenceIds:
                edge.evidenceIds,
            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "CONTEXT",
                    title:
                        edge.relationship ===
                        "SAME_TRACE"
                            ? "Shared trace connects observations"
                            : "Shared request connects observations",
                    description:
                        edge.relationship ===
                        "SAME_TRACE"
                            ? "The observations carry the same trace identifier."
                            : "The observations carry the same request identifier.",
                    evidenceIds:
                        edge.evidenceIds,
                    strength:
                        edge.confidence,
                },
            ],
        });
    }

    return findings;
}