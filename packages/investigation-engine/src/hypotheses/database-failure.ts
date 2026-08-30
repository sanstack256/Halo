import type { InvestigationContext } from "../types/context";
import type { Hypothesis, HypothesisMissingEvidence, HypothesisSupportingEvidence } from "../types/hypothesis";
import type { Reason } from "../types/reason";

const PRISMA_ERROR_PATTERNS = [
    { code: "P2002", name: "Unique constraint violation", role: "Unique key constraint failed on one or more database columns." },
    { code: "P2025", name: "Record not found", role: "An operation failed because a required parent or dependent record was not found." },
    { code: "P2003", name: "Foreign key constraint failure", role: "Foreign key constraint failed on field reference." },
    { code: "P2024", name: "Connection pool timeout", role: "Timed out waiting for a connection from the database connection pool." },
    { code: "P1001", name: "Database server unreachable", role: "Cannot reach the database server. Connection refused or port unreachable." },
    { code: "P2034", name: "Transaction deadlock", role: "Transaction failed due to a read/write deadlock or serialization failure." },
];

export function generateDatabaseHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const allEvidence = context.evidence || [];
    const deployments = context.deployments || [];

    for (const ev of allEvidence) {
        const hasRecentDeployment = deployments.some(
            (d) => d.service === ev.service && Math.abs(ev.timestamp.getTime() - d.timestamp.getTime()) <= 30 * 60 * 1000
        );
        if (hasRecentDeployment) {
            continue;
        }

        const text = [
            ev.title || "",
            ev.description || "",
            ev.operation || "",
            ev.resource || "",
            typeof ev.metadata?.error === "string" ? ev.metadata.error : "",
            typeof ev.metadata?.message === "string" ? ev.metadata.message : "",
            typeof ev.metadata?.stack === "string" ? ev.metadata.stack : "",
        ].join(" ");

        for (const pattern of PRISMA_ERROR_PATTERNS) {
            if (text.includes(pattern.code) || text.toLowerCase().includes(pattern.name.toLowerCase())) {
                const supportingReasons: Reason[] = [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: `Database Error (${pattern.code}): ${pattern.name}`,
                        description: pattern.role,
                        strength: 0.9,
                        evidenceIds: [ev.id],
                    },
                ];

                const detailedSupporting: HypothesisSupportingEvidence[] = [
                    {
                        evidenceId: ev.id,
                        reason: `Telemetry contains database error code ${pattern.code}: ${pattern.name}`,
                        role: "Primary failure mechanism",
                        strength: 0.9,
                    },
                ];

                const missingReasons: Reason[] = [];
                const detailedMissing: HypothesisMissingEvidence[] = [];

                if (!ev.resource) {
                    missingReasons.push({
                        type: "MISSING",
                        causalRole: "CONTEXT",
                        title: "Target database table or model is unspecified",
                        description: "Database error code is present, but the specific table or model involved was not captured in the event payload.",
                        evidenceIds: [ev.id],
                        strength: 0.25,
                    });
                    detailedMissing.push({
                        what: "Database model / table name",
                        why: "Identifies which data entity violated the database constraint",
                        impact: "Remediation requires manual query inspection",
                    });
                }

                const positiveScore = supportingReasons.reduce((acc, r) => acc + r.strength, 0);
                const unknownScore = missingReasons.reduce((acc, r) => acc + r.strength, 0);

                hypotheses.push({
                    id: `database-failure:${pattern.code}:${ev.id}`,
                    title: `Database ${pattern.name} (${pattern.code})`,
                    description: `An operation in ${ev.service || "database"} failed: ${pattern.role}`,
                    score: {
                        positive: positiveScore,
                        negative: 0,
                        unknown: unknownScore,
                    },
                    confidence: 0,
                    status: "CANDIDATE",
                    supportingReasons,
                    contradictingReasons: [],
                    missingReasons,
                    detailedSupportingEvidence: detailedSupporting,
                    detailedMissingEvidence: detailedMissing,
                    findingIds: [],
                    evidenceIds: [ev.id],
                    alternativeIds: [],
                    provenance: ev.source,
                    causalExplanation: `Database operation in ${ev.service || "backend"} threw ${pattern.code} (${pattern.name}). ${pattern.role}`,
                });
                break;
            }
        }

        // Generic Postgres Deadlock / Connection Failure
        if (/deadlock detected|connection pool exhausted|too many clients/i.test(text)) {
            const supportingReasons: Reason[] = [
                {
                    type: "SUPPORTING",
                    causalRole: "CAUSE",
                    title: "Database contention telemetry",
                    description: "Observed query timeout, deadlock, or pool starvation in runtime events.",
                    strength: 0.85,
                    evidenceIds: [ev.id],
                },
            ];

            hypotheses.push({
                id: `database-failure:deadlock:${ev.id}`,
                title: "Database Resource Saturation or Deadlock",
                description: "Database queries were blocked or rejected due to concurrent resource contention or connection exhaustion.",
                score: {
                    positive: 0.85,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 0,
                status: "CANDIDATE",
                supportingReasons,
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
                provenance: ev.source,
                causalExplanation: `Database contention observed in ${ev.service}. Telemetry indicates deadlock or connection pool starvation.`,
            });
        }
    }

    return hypotheses;
}
