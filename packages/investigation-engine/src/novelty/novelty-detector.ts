import type { Evidence } from "../types/evidence";
import type { AnomalySignal } from "../types/anomaly";
import type { StructuralTemplate } from "../types/template";
import { mineStructuralTemplates, extractTemplatePattern } from "./template-miner";

export function detectNovelPatterns(
    evidence: Evidence[],
    minEvidenceCount = 2
): {
    anomalies: AnomalySignal[];
    templates: StructuralTemplate[];
} {
    if (evidence.length < 2) {
        return { anomalies: [], templates: [] };
    }

    // Guard against duplicate-only evidence lists (e.g. 2 identical error events at same timestamp)
    const uniqueTimestamps = new Set(evidence.map((e) => e.timestamp.getTime()));
    if (uniqueTimestamps.size === 1 && evidence.length <= 2) {
        return { anomalies: [], templates: [] };
    }

    const templateMap = mineStructuralTemplates(evidence);
    const templates = Array.from(templateMap.values());
    const anomalies: AnomalySignal[] = [];

    const evidenceByTemplate = new Map<string, Evidence[]>();
    for (const item of evidence) {
        const textToMine = item.title || item.description || item.type;
        const { id } = extractTemplatePattern(textToMine);
        const list = evidenceByTemplate.get(id) ?? [];
        list.push(item);
        evidenceByTemplate.set(id, list);
    }

    const totalEvidenceCount = evidence.length;

    for (const template of templates) {
        const items = evidenceByTemplate.get(template.id) || [];
        const isErrorTemplate = items.some(
            (i) => i.type === "ERROR" || (typeof i.status === "number" && i.status >= 400)
        );

        if (isErrorTemplate && items.length >= 2) {
            const hasMultipleServices = template.services.length > 1;
            const frequencyRatio = items.length / totalEvidenceCount;

            const noveltyScore = Math.min(
                1.0,
                (hasMultipleServices ? 0.35 : 0.2) +
                (template.sampleCount >= 2 ? 0.3 : 0.15) +
                (template.wildcardCount > 0 ? 0.2 : 0.1)
            );

            anomalies.push({
                id: `novelty:${template.id}`,
                type: "NOVEL_PATTERN",
                severity: hasMultipleServices ? "HIGH" : (items.length >= 3 ? "HIGH" : "MEDIUM"),
                title: `Novel Failure Pattern: ${template.pattern}`,
                description: `Identified an anomalous structural log pattern across ${items.length} event(s) in service(s): ${template.services.join(", ")}.`,
                service: template.services[0] || "unknown",
                resource: items.find((i) => i.resource)?.resource,
                operation: items.find((i) => i.operation)?.operation,
                timestamp: template.firstSeen,
                evidenceIds: items.map((i) => i.id),
                score: noveltyScore,
                metrics: {
                    sampleCount: template.sampleCount,
                    frequencyRatio,
                    tokenCount: template.tokenCount,
                    wildcardCount: template.wildcardCount,
                    servicesCount: template.services.length,
                },
            });
        }
    }

    return { anomalies, templates };
}
