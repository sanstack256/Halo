import type { Evidence } from "../types/evidence";

export function normalizeEvidence(
    evidence: Evidence[]
): Evidence[] {
    const seen = new Set<string>();

    return evidence
        .filter(item => {
            if (seen.has(item.id)) {
                return false;
            }

            seen.add(item.id);
            return true;
        })
        .map(item => ({
            ...item,
            source: item.source.trim(),
            service: item.service.trim(),
            title: item.title.trim(),
            description:
                item.description?.trim(),
            release:
                item.release?.trim(),
            commit:
                item.commit?.trim(),
            environment:
                item.environment?.trim(),
            traceId:
                item.traceId?.trim(),
            spanId:
                item.spanId?.trim(),
            parentSpanId:
                item.parentSpanId?.trim(),
            requestId:
                item.requestId?.trim(),
            operation:
                item.operation?.trim(),
            resource:
                item.resource?.trim(),
            tags: item.tags
                ? { ...item.tags }
                : undefined,
            metadata: {
                ...item.metadata,
            },
        }))
        .sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime()
        );
}