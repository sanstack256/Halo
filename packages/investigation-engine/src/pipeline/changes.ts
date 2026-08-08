import type { Evidence } from "../types/evidence";
import type { Change } from "../types/change";

export function detectChanges(
    evidence: Evidence[]
): Change[] {

    const changes: Change[] = [];

    for (const item of evidence) {

        if (item.type === "DEPLOYMENT") {

            changes.push({

                id: item.id,

                type: "DEPLOYMENT",

                title: item.title,

                description: item.description,

                timestamp: item.timestamp,

                evidenceIds: [item.id],

            });

        }

    }

    return changes;
}