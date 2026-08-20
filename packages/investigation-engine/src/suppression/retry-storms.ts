import type { Evidence } from "../types/evidence";

export function identifyRetryStorms(evidence: Evidence[]): {
    primaryEvidence: Evidence[];
    suppressedRetries: Map<string, Evidence[]>;
} {
    const suppressedRetries = new Map<string, Evidence[]>();
    const primaryEvidence: Evidence[] = [];

    // Group by service + resource/operation + close temporal window (< 2 seconds)
    const seenRecent = new Map<string, { evidence: Evidence; lastTime: number }>();

    for (const item of evidence) {
        const isRetry =
            /\bretry|attempt\s*\d+/i.test(`${item.title} ${item.description || ""}`) ||
            item.tags?.retry === "true";

        const groupKey = `${item.service}:${item.resource || item.operation || item.title}`;
        const prev = seenRecent.get(groupKey);

        if (
            prev &&
            item.timestamp.getTime() - prev.lastTime <= 2000 &&
            (isRetry || (item.type === "ERROR" && prev.evidence.type === "ERROR"))
        ) {
            // Treat as rapid retry symptom of the initial failure
            const list = suppressedRetries.get(prev.evidence.id) || [];
            list.push(item);
            suppressedRetries.set(prev.evidence.id, list);
            prev.lastTime = item.timestamp.getTime();
        } else {
            seenRecent.set(groupKey, { evidence: item, lastTime: item.timestamp.getTime() });
            primaryEvidence.push(item);
        }
    }

    return { primaryEvidence, suppressedRetries };
}
