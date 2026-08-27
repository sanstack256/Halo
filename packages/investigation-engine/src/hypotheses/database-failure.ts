import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
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
            typeof ev.metadata?.error === "string" ? ev.metadata.error : "",
            typeof ev.metadata?.message === "string" ? ev.metadata.message : "",
            typeof ev.metadata?.stack === "string" ? ev.metadata.stack : "",
        ].join(" ");

        for (const pattern of PRISMA_ERROR_PATTERNS) {
            if (text.includes(pattern.code) || text.includes(pattern.name)) {
                const supportingReasons: Reason[] = [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: `Database Error (${pattern.code}): ${pattern.name}`,
                        description: pattern.role,
                        strength: 0.95,
                        evidenceIds: [ev.id],
                    },
                ];

                hypotheses.push({
                    id: `database-failure:${pattern.code}:${ev.id}`,
                    title: `Database ${pattern.name} (${pattern.code})`,
                    description: `An operation in ${ev.service || "database"} failed: ${pattern.role}`,
                    score: {
                        positive: 2.8,
                        negative: 0,
                        unknown: 0,
                    },
                    confidence: 95,
                    status: "CANDIDATE",
                    supportingReasons,
                    contradictingReasons: [],
                    missingReasons: [],
                    findingIds: [],
                    evidenceIds: [ev.id],
                    alternativeIds: [],
                });
                break;
            }
        }

        // Generic Postgres Deadlock / Connection Failure
        if (/deadlock detected|connection pool exhausted|too many clients/i.test(text)) {
            hypotheses.push({
                id: `database-failure:deadlock:${ev.id}`,
                title: "Database Resource Saturation or Deadlock",
                description: "Database queries were blocked or rejected due to concurrent resource contention or connection exhaustion.",
                score: {
                    positive: 2.5,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 90,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "Database contention telemetry",
                        description: "Observed query timeout, deadlock, or pool starvation.",
                        strength: 0.9,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        }
    }

    return hypotheses;
}
