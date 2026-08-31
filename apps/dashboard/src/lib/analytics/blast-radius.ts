import type { DependencyNode, DependencyEdge, BlastRadiusResult } from "./types";

export function computeBlastRadius(
    selectedEntity: string,
    nodes: DependencyNode[],
    edges: DependencyEdge[]
): BlastRadiusResult {
    const direct = nodes.find((n) => n.name === selectedEntity || n.id === selectedEntity);
    const directlyAffected: BlastRadiusResult["directlyAffected"] = direct
        ? [{ id: direct.id, name: direct.name, reason: "Originating entity under inspection" }]
        : [];

    const observedPropagation: BlastRadiusResult["observedPropagation"] = [];
    const potentialExposure: BlastRadiusResult["potentialExposure"] = [];
    const visited = new Set<string>([selectedEntity]);

    // Find 1-hop downstream
    const hop1Edges = edges.filter((e) => e.source === selectedEntity);
    for (const e of hop1Edges) {
        visited.add(e.target);
        if (e.errorRate > 0) {
            observedPropagation.push({
                id: e.target,
                name: e.target,
                hops: 1,
                observedErrorRate: e.errorRate,
                evidence: `Observed ${e.errorCount} downstream error responses across ${e.callCount} calls from ${e.source}.`,
            });
        } else {
            potentialExposure.push({
                id: e.target,
                name: e.target,
                hops: 1,
                connectionType: "Direct downstream caller (1-hop)",
            });
        }
    }

    // Find 2-hop downstream
    for (const hop1 of hop1Edges) {
        const hop2Edges = edges.filter((e) => e.source === hop1.target && !visited.has(e.target));
        for (const e of hop2Edges) {
            visited.add(e.target);
            if (e.errorRate > 0) {
                observedPropagation.push({
                    id: e.target,
                    name: e.target,
                    hops: 2,
                    observedErrorRate: e.errorRate,
                    evidence: `Transitive failure propagated through ${hop1.target} (${e.errorCount} errors, ${e.errorRate}% error rate).`,
                });
            } else {
                potentialExposure.push({
                    id: e.target,
                    name: e.target,
                    hops: 2,
                    connectionType: `Transitive connection via ${hop1.target} (2-hops)`,
                });
            }
        }
    }

    const unobserved = nodes
        .filter((n) => !visited.has(n.name) && n.name !== selectedEntity)
        .map((n) => ({ id: n.id, name: n.name }));

    return {
        selectedEntity,
        directlyAffected,
        observedPropagation,
        potentialExposure,
        unobserved,
    };
}
