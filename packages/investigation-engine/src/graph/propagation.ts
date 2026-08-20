import type { Evidence } from "../types/evidence";
import type { EvidenceGraph } from "../types/graph";

export interface CausalChainStep {
    evidenceId: string;
    service: string;
    title: string;
    role: "ROOT_CAUSE" | "PROPAGATION" | "SYMPTOM";
    delayMs: number;
}

export interface CausalChain {
    rootEvidenceId: string;
    steps: CausalChainStep[];
    pathSummary: string[];
}

export function tracePropagationChains(
    evidence: Evidence[],
    graph: EvidenceGraph
): CausalChain[] {
    const chains: CausalChain[] = [];
    if (!evidence || evidence.length === 0 || !graph || !graph.edges) {
        return chains;
    }

    const evidenceMap = new Map<string, Evidence>(evidence.map((e) => [e.id, e]));

    // Causal relationship edge types
    const causalRelationships = new Set([
        "TRIGGERS",
        "AFFECTS",
        "MODIFIES",
        "CAUSES",
        "DEPENDS_ON",
        "AMPLIFIES",
    ]);

    const causalEdges = graph.edges.filter((e) =>
        causalRelationships.has(e.relationship)
    );

    if (causalEdges.length === 0) {
        return chains;
    }

    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const edge of causalEdges) {
        const dests = adj.get(edge.from) || [];
        dests.push(edge.to);
        adj.set(edge.from, dests);

        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
        if (!inDegree.has(edge.from)) {
            inDegree.set(edge.from, 0);
        }
    }

    // Roots are nodes with out-edges and in-degree 0 (or all out-nodes if circular)
    const rootCandidates = Array.from(inDegree.entries())
        .filter(([id, degree]) => degree === 0 && adj.has(id))
        .map(([id]) => id);

    const rootsToTraverse = rootCandidates.length > 0
        ? rootCandidates
        : Array.from(adj.keys());

    for (const rootId of rootsToTraverse) {
        const root = evidenceMap.get(rootId);
        if (!root) continue;

        const visited = new Set<string>([rootId]);
        const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
        const steps: CausalChainStep[] = [
            {
                evidenceId: root.id,
                service: root.service,
                title: root.title,
                role: "ROOT_CAUSE",
                delayMs: 0,
            },
        ];
        const pathSummary: string[] = [`${root.service}: ${root.title}`];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const nextNodes = adj.get(current.id) || [];

            for (const nextId of nextNodes) {
                if (visited.has(nextId)) continue;
                visited.add(nextId);

                const nextEvidence = evidenceMap.get(nextId);
                if (!nextEvidence) continue;

                const delay = Math.max(0, nextEvidence.timestamp.getTime() - root.timestamp.getTime());
                const isDownstream = (nextEvidence.type === "ERROR" || (typeof nextEvidence.status === "number" && nextEvidence.status >= 500));

                steps.push({
                    evidenceId: nextEvidence.id,
                    service: nextEvidence.service,
                    title: nextEvidence.title,
                    role: isDownstream && current.depth >= 1 ? "SYMPTOM" : "PROPAGATION",
                    delayMs: delay,
                });

                pathSummary.push(
                    `${nextEvidence.service}: ${nextEvidence.title} (+${Math.round(delay / 1000)}s)`
                );

                queue.push({ id: nextId, depth: current.depth + 1 });
            }
        }

        if (steps.length > 1) {
            chains.push({
                rootEvidenceId: root.id,
                steps,
                pathSummary,
            });
        }
    }

    return chains;
}
