/**
 * Halo Repair Intelligence Engine — Blast Radius & Side Effect Analyzer
 *
 * Implements Section 34 & Section 35:
 *   - Static blast radius: Inspects callers of the failing function in the source.
 *   - Runtime blast radius: Aggregates real endpoint usage from EvidenceSnapshot traces.
 *     NEVER invents percentages or sample counts.
 *   - Side effect analysis: Surfaces potential behavioral shifts, performance impacts,
 *     and API contract breaks.
 */

import ts from "typescript";
import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { SourceContext } from "../runtime/types";
import type { BlastRadius, RuntimeUsageItem, SideEffectAnalysis } from "./types";

interface AnalyzeBlastRadiusOptions {
    snapshot: EvidenceSnapshot;
    source?: SourceContext;
    containingFunction?: string;
    failingExpression?: string;
}

/**
 * Analyzes static and runtime blast radius.
 */
export function analyzeBlastRadius(opts: AnalyzeBlastRadiusOptions): {
    blastRadius: BlastRadius;
    sideEffects: SideEffectAnalysis;
} {
    const { snapshot, source, containingFunction, failingExpression } = opts;

    // 1. Static Blast Radius: Find callers/usages in the source file
    const staticCallers: string[] = [];
    if (source?.lines && containingFunction) {
        const sourceText = source.lines.map(l => l.content).join("\n");
        const sourceFile = ts.createSourceFile(
            source.filePath || "source.ts",
            sourceText,
            ts.ScriptTarget.Latest,
            true
        );

        function findReferences(node: ts.Node) {
            if (ts.isCallExpression(node)) {
                const exprText = node.expression.getText(sourceFile);
                if (exprText === containingFunction) {
                    // Find the enclosing function
                    let parent: ts.Node | undefined = node.parent;
                    while (parent) {
                        if (ts.isFunctionDeclaration(parent) && parent.name) {
                            staticCallers.push(parent.name.text);
                            break;
                        } else if (ts.isMethodDeclaration(parent) && parent.name) {
                            staticCallers.push(parent.name.getText(sourceFile));
                            break;
                        }
                        parent = parent.parent;
                    }
                }
            }
            ts.forEachChild(node, findReferences);
        }

        findReferences(sourceFile);
    }

    if (staticCallers.length === 0 && containingFunction) {
        staticCallers.push(`Direct invocations of '${containingFunction}'`);
    }

    // 2. Runtime Blast Radius: Extract observed endpoints from actual telemetry traces
    // NEVER invent numbers. Only compute from real evidence items in the snapshot.
    const runtimeUsage: RuntimeUsageItem[] = [];
    const endpointCounts: Record<string, number> = {};
    let totalSamples = 0;

    for (const ev of snapshot.evidence) {
        if (ev.type === "TRACE" || (ev.type as string) === "REQUEST") {
            const evObj = ev as unknown as { payload?: Record<string, unknown>; metadata?: Record<string, unknown>; data?: Record<string, unknown> };
            const data = evObj.payload || evObj.metadata || evObj.data;
            const endpoint = (data?.path || data?.url || data?.route || ev.title) as string | undefined;
            if (endpoint) {
                endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
                totalSamples++;
            }
        }
    }

    if (totalSamples > 0) {
        for (const [endpoint, count] of Object.entries(endpointCounts)) {
            const percentage = Math.round((count / totalSamples) * 100);
            runtimeUsage.push({
                endpoint,
                percentage,
                sampleCount: count,
            });
        }
        // Sort descending by percentage
        runtimeUsage.sort((a, b) => b.percentage - a.percentage);
    }

    // 3. Behavioral Impact & Side Effects
    const behavioralImpact: string[] = [];
    const behavioralSideEffects: string[] = [];
    const performanceSideEffects: string[] = [];
    const contractBreaks: string[] = [];

    if (failingExpression) {
        behavioralImpact.push(`Execution flow around '${failingExpression}' in '${containingFunction || "function"}'`);

        if (failingExpression.includes("await ") || failingExpression.includes(".then(")) {
            behavioralSideEffects.push("Async promise resolution or rejection behavior at this call site.");
            performanceSideEffects.push("Zero additional network or I/O overhead.");
        } else {
            behavioralSideEffects.push("Local branch evaluation and variable dereferencing.");
            performanceSideEffects.push("Negligible CPU overhead for defensive guards.");
        }

        contractBreaks.push("If invalid input is guarded with early return, callers expecting a concrete return value or exception may receive undefined.");
    } else {
        behavioralImpact.push("Function execution flow in the failing frame.");
        behavioralSideEffects.push("Error boundary and propagation behavior.");
        contractBreaks.push("Potential signature or return value divergence depending on repair approach.");
    }

    return {
        blastRadius: {
            staticCallers: Array.from(new Set(staticCallers)),
            runtimeUsage,
            behavioralImpact,
        },
        sideEffects: {
            behavioralSideEffects,
            performanceSideEffects,
            contractBreaks,
        },
    };
}
