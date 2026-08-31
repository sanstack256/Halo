import type { DependencyNode, DependencyEdge, CriticalPathItem } from "./types";

export interface LayoutedGraph {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    criticalPaths: CriticalPathItem[];
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        width: number;
        height: number;
    };
}

export function computeDynamicGraphLayout(
    rawNodes: DependencyNode[],
    rawEdges: DependencyEdge[]
): LayoutedGraph {
    if (rawNodes.length === 0) {
        return {
            nodes: [],
            edges: [],
            criticalPaths: [],
            bounds: { minX: 0, minY: 0, maxX: 800, maxY: 400, width: 800, height: 400 },
        };
    }

    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 50;
    const TIER_SPACING_X = 220;
    const NODE_SPACING_Y = 28;
    const PADDING = 60;

    // 1. Build Adjacency Map and Calculate In-Degrees & Out-Degrees
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const n of rawNodes) {
        inDegrees.set(n.name, 0);
        outDegrees.set(n.name, 0);
        adj.set(n.name, []);
    }

    for (const e of rawEdges) {
        if (inDegrees.has(e.target)) {
            inDegrees.set(e.target, (inDegrees.get(e.target) || 0) + 1);
        }
        if (outDegrees.has(e.source)) {
            outDegrees.set(e.source, (outDegrees.get(e.source) || 0) + 1);
        }
        if (adj.has(e.source)) {
            adj.get(e.source)!.push(e.target);
        }
    }

    // 2. Assign Tiers / Levels using Topological Rank & Type Heuristics
    const nodeTier = new Map<string, number>();

    for (const n of rawNodes) {
        const nameLower = n.name.toLowerCase();
        if (n.type === "DATABASE" || nameLower.includes("db") || nameLower.includes("postgres") || nameLower.includes("sql") || nameLower.includes("redis")) {
            nodeTier.set(n.name, 3); // Rightmost
        } else if (n.type === "EXTERNAL" || nameLower.includes("stripe") || nameLower.includes("external") || nameLower.includes("api.com")) {
            nodeTier.set(n.name, 3); // Rightmost
        } else if (nameLower.includes("client") || nameLower.includes("frontend") || nameLower.includes("gateway") || (inDegrees.get(n.name) === 0 && (outDegrees.get(n.name) || 0) > 0)) {
            nodeTier.set(n.name, 0); // Ingress / Leftmost
        } else {
            nodeTier.set(n.name, 1); // Intermediate service tier
        }
    }

    // Topological refinement for downstream connections
    let changed = true;
    let passes = 0;
    while (changed && passes < 4) {
        changed = false;
        passes++;
        for (const e of rawEdges) {
            const srcTier = nodeTier.get(e.source) || 0;
            const dstTier = nodeTier.get(e.target) || 1;
            // Target should be strictly to the right of source unless target is in tier 3
            if (dstTier <= srcTier && dstTier < 3) {
                nodeTier.set(e.target, Math.min(3, srcTier + 1));
                changed = true;
            }
        }
    }

    // 3. Group Nodes by Tier
    const tiers: DependencyNode[][] = [[], [], [], []];
    for (const n of rawNodes) {
        const t = Math.max(0, Math.min(3, nodeTier.get(n.name) || 0));
        tiers[t].push({ ...n, tier: t });
    }

    // Filter out empty tiers to compress horizontal space if some tiers are unused
    const activeTiers = tiers.filter((tList) => tList.length > 0);
    const maxNodesInAnyTier = Math.max(...activeTiers.map((tList) => tList.length), 1);

    const totalHeight = Math.max(
        380,
        maxNodesInAnyTier * (NODE_HEIGHT + NODE_SPACING_Y) + PADDING * 2
    );
    const totalWidth = Math.max(
        800,
        activeTiers.length * (NODE_WIDTH + TIER_SPACING_X) + PADDING * 2
    );

    // 4. Calculate Collision-Free Coordinates
    const positionedNodes: DependencyNode[] = [];

    activeTiers.forEach((tierNodes, tierIdx) => {
        const x = PADDING + tierIdx * (NODE_WIDTH + TIER_SPACING_X) + NODE_WIDTH / 2;
        const count = tierNodes.length;
        const tierContentHeight = count * NODE_HEIGHT + (count - 1) * NODE_SPACING_Y;
        const startY = (totalHeight - tierContentHeight) / 2 + NODE_HEIGHT / 2;

        tierNodes.forEach((node, nodeIdx) => {
            const y = startY + nodeIdx * (NODE_HEIGHT + NODE_SPACING_Y);
            positionedNodes.push({
                ...node,
                x,
                y,
            });
        });
    });

    // 5. Critical Path Detection
    // Identify top call paths from ingress to database/terminal nodes
    const criticalPaths: CriticalPathItem[] = [];
    const highVolumeEdges = [...rawEdges].sort((a, b) => b.callCount - a.callCount);

    if (highVolumeEdges.length > 0) {
        const topEdge = highVolumeEdges[0];
        const secondEdge = highVolumeEdges.find((e) => e.source === topEdge.target);

        if (secondEdge) {
            criticalPaths.push({
                pathId: `path-${topEdge.source}-${topEdge.target}-${secondEdge.target}`,
                nodes: [topEdge.source, topEdge.target, secondEdge.target],
                callVolume: topEdge.callCount,
                avgLatencyMs: Math.round(((topEdge.avgLatencyMs || 0) + (secondEdge.avgLatencyMs || 0)) * 10) / 10,
                totalErrors: topEdge.errorCount + secondEdge.errorCount,
                errorRate: topEdge.errorRate,
                evidenceSampleCount: topEdge.evidence.observedSampleCount,
            });
        }
    }

    // Flag critical path edges
    const criticalEdgeKeys = new Set(
        criticalPaths.flatMap((p) => [
            `${p.nodes[0]}->${p.nodes[1]}`,
            p.nodes[2] ? `${p.nodes[1]}->${p.nodes[2]}` : "",
        ])
    );

    const layoutedEdges = rawEdges.map((e) => ({
        ...e,
        isCriticalPath: criticalEdgeKeys.has(`${e.source}->${e.target}`),
    }));

    return {
        nodes: positionedNodes,
        edges: layoutedEdges,
        criticalPaths,
        bounds: {
            minX: 0,
            minY: 0,
            maxX: totalWidth,
            maxY: totalHeight,
            width: totalWidth,
            height: totalHeight,
        },
    };
}
