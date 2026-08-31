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

    const downstreamImpact: BlastRadiusResult["downstreamImpact"] = [];
    const potentiallyExposed: BlastRadiusResult["potentiallyExposed"] = [];
    const visited = new Set<string>([selectedEntity]);

    // Find 1-hop downstream
    const hop1Edges = edges.filter((e) => e.source === selectedEntity);
    for (const e of hop1Edges) {
        visited.add(e.target);
        if (e.errorRate > 0) {
            downstreamImpact.push({
                id: e.target,
                name: e.target,
                hops: 1,
                observedErrorRate: e.errorRate,
            });
        } else {
            potentiallyExposed.push({
                id: e.target,
                name: e.target,
                connectionType: "Direct downstream caller",
            });
        }
    }

    // Find 2-hop downstream
    for (const hop1 of hop1Edges) {
        const hop2Edges = edges.filter((e) => e.source === hop1.target && !visited.has(e.target));
        for (const e of hop2Edges) {
            visited.add(e.target);
            if (e.errorRate > 0) {
                downstreamImpact.push({
                    id: e.target,
                    name: e.target,
                    hops: 2,
                    observedErrorRate: e.errorRate,
                });
            } else {
                potentiallyExposed.push({
                    id: e.target,
                    name: e.target,
                    connectionType: "Transitive downstream connection (+2 hops)",
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
        downstreamImpact,
        potentiallyExposed,
        unobserved,
    };
}
