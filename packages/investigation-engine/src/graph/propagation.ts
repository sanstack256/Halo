import type { Evidence } from "../types/evidence";
import type { CausalChain, CausalChainStep, CausalClassification, EvidenceEdge, EvidenceGraph } from "../types/graph";

const CAUSAL_RELATIONSHIPS = new Set([
    "TRIGGERS",
    "AFFECTS",
    "MODIFIES",
    "CAUSES",
    "DEPENDS_ON",
    "AMPLIFIES",
    "CHILD_SPAN_OF",
    "REQUEST_SPAN",
    "CALLS_SERVICE",
    "STACK_FRAME_CALLS",
    "EXECUTES_QUERY",
    "DOWNSTREAM_FAILURE_OF",
]);

export function tracePropagationChains(
    evidence: Evidence[],
    graph: EvidenceGraph
): CausalChain[] {
    const chains: CausalChain[] = [];
    if (!evidence || evidence.length === 0 || !graph || !graph.edges) {
        return chains;
    }

    const evidenceMap = new Map<string, Evidence>(evidence.map(e => [e.id, e]));

    const causalEdges = graph.edges.filter(e => CAUSAL_RELATIONSHIPS.has(e.relationship));
    if (causalEdges.length === 0) {
        return chains;
    }

    const adj = new Map<string, EvidenceEdge[]>();
    const inDegree = new Map<string, number>();

    for (const edge of causalEdges) {
        const dests = adj.get(edge.from) || [];
        dests.push(edge);
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

    const rootsToTraverse = rootCandidates.length > 0 ? rootCandidates : Array.from(adj.keys());

    let chainIndex = 1;

    for (const rootId of rootsToTraverse) {
        const root = evidenceMap.get(rootId);
        if (!root) continue;

        const visited = new Set<string>([rootId]);
        const chainEdges: EvidenceEdge[] = [];

        let rootRole: CausalChainStep["role"] = "CANDIDATE_CAUSE";
        if (root.type === "DEPLOYMENT" || root.type === "CONFIG" || root.type === "FEATURE_FLAG") {
            rootRole = "TRIGGER";
        } else if (
            root.title.toLowerCase().includes("database") ||
            root.title.toLowerCase().includes("orders.list") ||
            (root.type === "TRACE" && (!root.status || (typeof root.status === "number" && root.status < 400)))
        ) {
            rootRole = "STRUCTURAL_CONTEXT";
        } else if (root.type === "ERROR" || (typeof root.status === "number" && root.status >= 400) || root.status === 500) {
            rootRole = "ROOT_CAUSE";
        } else {
            rootRole = "CONTEXT";
        }

        const steps: CausalChainStep[] = [
            {
                evidenceId: root.id,
                service: root.service,
                title: root.title,
                role: rootRole,
                delayMs: 0,
                provenance: root.source,
                classification: "Observed",
            },
        ];

        const pathSummary: string[] = [`${root.service}: ${root.title}`];

        const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const nextEdges = adj.get(current.id) || [];

            for (const edge of nextEdges) {
                const nextId = edge.to;
                if (visited.has(nextId)) continue;
                visited.add(nextId);

                const nextEvidence = evidenceMap.get(nextId);
                if (!nextEvidence) continue;

                chainEdges.push(edge);

                const delay = Math.max(0, nextEvidence.timestamp.getTime() - root.timestamp.getTime());
                const isDownstream =
                    nextEvidence.type === "ERROR" ||
                    (typeof nextEvidence.status === "number" && nextEvidence.status >= 400);

                const hasOutgoingCausal = adj.has(nextId) && (adj.get(nextId) || []).length > 0;
                const stepRole =
                    !hasOutgoingCausal && (nextEvidence.type === "ERROR" || isDownstream)
                        ? "SYMPTOM"
                        : "PROPAGATION";

                steps.push({
                    evidenceId: nextEvidence.id,
                    service: nextEvidence.service,
                    title: nextEvidence.title,
                    role: stepRole,
                    delayMs: delay,
                    edgeFromPrevious: edge,
                    provenance: nextEvidence.source,
                    classification: edge.classification ?? "Inferred",
                });

                pathSummary.push(
                    `${nextEvidence.service}: ${nextEvidence.title} (+${Math.round(delay / 1000)}s)`
                );

                queue.push({ id: nextId, depth: current.depth + 1 });
            }
        }

        if (steps.length > 1) {
            const classifications = chainEdges.map(e => e.classification ?? "Inferred");
            const overallClassification = deriveChainClassification(classifications);
            const overallConfidence = deriveChainConfidence(chainEdges);

            const explanation = generateChainExplanation(steps, chainEdges, overallClassification);

            chains.push({
                id: `causal-chain-${chainIndex++}:${root.id}`,
                rootEvidenceId: root.id,
                terminalEvidenceId: steps[steps.length - 1].evidenceId,
                steps,
                edges: chainEdges,
                pathSummary,
                overallConfidence,
                overallClassification,
                explanation,
            });
        }
    }

    return chains;
}

function deriveChainClassification(classifications: CausalClassification[]): CausalClassification {
    if (classifications.includes("Unknown")) {
        return "Unknown";
    }
    if (classifications.includes("Likely")) {
        return "Likely";
    }
    if (classifications.includes("Inferred")) {
        return "Inferred";
    }
    return "Observed";
}

function deriveChainConfidence(edges: EvidenceEdge[]): number {
    if (edges.length === 0) return 0;
    // Chain confidence is bounded by its weakest edge with slight compound factor
    const strengths = edges.map(e => e.strength ?? e.confidence ?? 0.5);
    const minStrength = Math.min(...strengths);
    const avgStrength = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    return Math.round((minStrength * 0.7 + avgStrength * 0.3) * 100) / 100;
}

function generateChainExplanation(
    steps: CausalChainStep[],
    edges: EvidenceEdge[],
    overallClassification: CausalClassification
): string {
    const root = steps[0];
    const terminal = steps[steps.length - 1];

    if (steps.length === 2) {
        const edge = edges[0];
        return `Reconstructed ${overallClassification.toLowerCase()} sequence: "${root.title}" in ${root.service} -> "${terminal.title}" in ${terminal.service} (${edge?.explanation || edge?.relationship || "linked"}).`;
    }

    return `Reconstructed ${overallClassification.toLowerCase()} ${steps.length}-step causal cascade originating at ${root.service} ("${root.title}") and terminating at ${terminal.service} ("${terminal.title}").`;
}
