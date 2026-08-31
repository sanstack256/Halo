import { calculateMetricComparison, parseTimeRange } from "../time";
import { computeBlastRadius } from "../blast-radius";
import { computeDynamicGraphLayout } from "../graph-layout";
import type { DependencyNode, DependencyEdge } from "../types";

console.log("==================================================");
console.log("STARTING CANONICAL ANALYTICS AUDIT & VERIFICATION");
console.log("==================================================");

// 1. Time & Comparison Math
console.log("--- TEST 1: Metric Comparison & Percentage Points ---");
const rateComparison = calculateMetricComparison(6.0, 4.0, true, true);
if (
    rateComparison.absoluteDiff === 2.0 &&
    rateComparison.relativeDiffPct === 50.0 &&
    rateComparison.percentagePointsDiff === 2.0 &&
    rateComparison.isImprovement === false
) {
    console.log("✓ Correctly distinguished relative % (+50%) from percentage points (+2.0pp).");
} else {
    throw new Error(`Metric comparison failed: ${JSON.stringify(rateComparison)}`);
}

// 2. Division by zero safety
console.log("--- TEST 2: Division by Zero Safety ---");
const zeroComp = calculateMetricComparison(10, 0, false, false);
// When previous === 0, relativeDiffPct must be null (no finite ratio from zero base).
// absoluteDiff should still capture the raw change.
if (zeroComp.relativeDiffPct === null && zeroComp.absoluteDiff === 10) {
    console.log("✓ Zero baseline handled safely: relativeDiffPct=null (no finite ratio), absoluteDiff=10.");
} else {
    throw new Error(`Zero comparison failed: ${JSON.stringify(zeroComp)}`);
}

// 3. Dynamic Graph Collision-Free Layout
console.log("--- TEST 3: Dynamic Collision-Free Graph Layout ---");
const rawNodes: DependencyNode[] = [
    {
        id: "web-client",
        name: "web-client",
        type: "SERVICE",
        projectId: "p1",
        projectName: "Demo",
        health: "Healthy",
        errorRate: 0,
        totalCalls: 100,
        avgLatencyMs: 30,
        recentIssueCount: 0,
        recentReleaseCount: 0,
    },
    {
        id: "api-service",
        name: "api-service",
        type: "SERVICE",
        projectId: "p1",
        projectName: "Demo",
        health: "Healthy",
        errorRate: 2,
        totalCalls: 100,
        avgLatencyMs: 40,
        recentIssueCount: 0,
        recentReleaseCount: 0,
    },
    {
        id: "postgres-db",
        name: "postgres-db",
        type: "DATABASE",
        projectId: "p1",
        projectName: "Demo",
        health: "Healthy",
        errorRate: 0,
        totalCalls: 90,
        avgLatencyMs: 15,
        recentIssueCount: 0,
        recentReleaseCount: 0,
    },
];

const rawEdges: DependencyEdge[] = [
    {
        id: "web-client->api-service",
        source: "web-client",
        target: "api-service",
        callCount: 100,
        errorCount: 2,
        errorRate: 2.0,
        avgLatencyMs: 40,
        p95LatencyMs: 80,
        lastObservedAt: new Date().toISOString(),
        evidence: { type: "TRACE_SPAN", observedSampleCount: 100, description: "Trace linkage" },
    },
    {
        id: "api-service->postgres-db",
        source: "api-service",
        target: "postgres-db",
        callCount: 90,
        errorCount: 0,
        errorRate: 0.0,
        avgLatencyMs: 15,
        p95LatencyMs: 30,
        lastObservedAt: new Date().toISOString(),
        evidence: { type: "TRACE_SPAN", observedSampleCount: 90, description: "Trace linkage" },
    },
];

const layout = computeDynamicGraphLayout(rawNodes, rawEdges);
const webNode = layout.nodes.find((n) => n.name === "web-client")!;
const apiNode = layout.nodes.find((n) => n.name === "api-service")!;
const dbNode = layout.nodes.find((n) => n.name === "postgres-db")!;

if (webNode.x! < apiNode.x! && apiNode.x! < dbNode.x!) {
    console.log("✓ Dynamic graph layout computed non-overlapping hierarchical coordinates.");
} else {
    throw new Error(`Graph layout overlap detected: web=${webNode.x}, api=${apiNode.x}, db=${dbNode.x}`);
}

// 4. Blast Radius distinction
console.log("--- TEST 4: Blast Radius Distinction ---");
const blastResult = computeBlastRadius("web-client", rawNodes, rawEdges);
if (blastResult.observedPropagation.length === 1 && blastResult.potentialExposure.length === 1) {
    console.log("✓ Blast radius correctly categorized observed propagation (api-service with error rate 2.0%) and transitive potential exposure (postgres-db).");
} else {
    throw new Error(`Blast radius failure: ${JSON.stringify(blastResult)}`);
}

console.log("==================================================");
console.log("ALL CANONICAL ANALYTICS TESTS PASSED WITH 0 ERRORS!");
console.log("==================================================");
