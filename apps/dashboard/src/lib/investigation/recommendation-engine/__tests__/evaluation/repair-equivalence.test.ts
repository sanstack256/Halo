/**
 * Halo Recommendation Engine — Repair Equivalence Evaluation Suite
 *
 * Implements Phase 8 & Phase 49:
 * Validates that when multiple competing upstream hypotheses imply the same
 * invariant restoration and repair boundary:
 * 1. Repair proceeds on the shared invariant.
 * 2. Ownership is confirmed at the receiver boundary.
 * 3. Upstream root cause is honestly preserved as unresolved/competing.
 * 4. The pipeline does NOT get paralyzed by upstream causal ambiguity when
 *    the repair boundary is invariant-equivalent.
 */

import { describe, it, expect } from "vitest";
import { detectRepairEquivalentHypotheses } from "../../hypothesis-engine";
import { generateEngineeringRecommendation } from "../../engine";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import type { Hypothesis, DeterminedRepairLocation } from "../../types";

describe("Phase 8 & 49: Repair-Equivalent Hypotheses Evaluation", () => {
    it("detects repair equivalence when competing hypotheses share an invariant", () => {
        const hypotheses: Hypothesis[] = [
            {
                id: "hypo-producer-a",
                title: "Config Provider A passed null timeout",
                description: "Upstream config parser in client library omitted default timeout",
                status: "PLAUSIBLE",
                likelihood: "MEDIUM",
                confidence: 0.5,
                supportedEvidence: ["ev-err"],
            },
            {
                id: "hypo-producer-b",
                title: "Environment Service B stripped timeout header",
                description: "Ingress proxy stripped timeout configuration header before forwarding",
                status: "PLAUSIBLE",
                likelihood: "MEDIUM",
                confidence: 0.5,
                supportedEvidence: ["ev-err"],
            },
        ];

        const repairLocation: DeterminedRepairLocation = {
            type: "CALLEE",
            targetFile: "src/client/http.ts",
            targetSymbol: "requestWithTimeout",
            ownershipEstablished: true,
            rationale: "HTTP client must enforce positive integer timeout invariant before dispatching socket.",
        };

        const record = detectRepairEquivalentHypotheses(hypotheses, repairLocation);

        expect(record.isRepairEquivalent).toBe(true);
        expect(record.equivalentHypothesisIds).toEqual(["hypo-producer-a", "hypo-producer-b"]);
        expect(record.sharedRepairBoundary).toBe("src/client/http.ts");
        expect(record.unresolvedUpstreamCausalityReason).toContain("Upstream root cause remains under investigation");
    });

    it("does NOT mark repair equivalence when hypotheses target distinct components or repair locations", () => {
        const hypotheses: Hypothesis[] = [
            {
                id: "hypo-database",
                title: "Database connection pool exhausted",
                description: "Postgres pool maxConnections reached under high load",
                status: "PLAUSIBLE",
                likelihood: "MEDIUM",
                confidence: 0.5,
                supportedEvidence: ["ev-err"],
            },
            {
                id: "hypo-syntax",
                title: "Application code syntax error",
                description: "Missing semicolon or syntax error in route handler",
                status: "PLAUSIBLE",
                likelihood: "MEDIUM",
                confidence: 0.5,
                supportedEvidence: ["ev-err"],
            },
        ];

        const repairLocation: DeterminedRepairLocation = {
            type: "CALLEE",
            targetFile: "src/db/pool.ts",
            targetSymbol: "acquireConnection",
            ownershipEstablished: true,
            rationale: "Increase max connection pool limit.",
        };

        const record = detectRepairEquivalentHypotheses(hypotheses, repairLocation);
        expect(record).toBeNull();
    });

    it("end-to-end pipeline produces repair and attaches repairEquivalence to result and authoritativeDecision", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "halo-repair-equiv-incident",
                title: "TypeError: Cannot read properties of undefined (reading 'timeoutMs')",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 42,
                environment: "production",
                service: "api-gateway",
            },
            rawEvidence: [
                {
                    id: "ev-err",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'timeoutMs')",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "api-gateway",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'timeoutMs')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/client/http.ts",
                    rawFilePath: "src/client/http.ts",
                    lineNumber: 45,
                    functionName: "executeRequest",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/client/http.ts",
                failingLineNumber: 45,
                containingFunction: "executeRequest",
                failingExpression: "config.timeoutMs",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 44, content: "export function executeRequest(url: string, config?: RequestConfig) {", isFailingLine: false },
                    { lineNumber: 45, content: "    const timeout = config.timeoutMs;", isFailingLine: true },
                    { lineNumber: 46, content: "    return fetchWithTimeout(url, timeout);", isFailingLine: false },
                    { lineNumber: 47, content: "}", isFailingLine: false },
                ],
            },
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-caller-1",
                        title: "Caller Service passed null options",
                        description: "Upstream caller invoked executeRequest without config object",
                        status: "PLAUSIBLE",
                        likelihood: "MEDIUM",
                        confidence: 0.5,
                        supportedEvidence: ["ev-err"],
                    },
                    {
                        id: "hypo-caller-2",
                        title: "Default Config Factory returned undefined",
                        description: "Configuration loader failed to supply default object",
                        status: "PLAUSIBLE",
                        likelihood: "MEDIUM",
                        confidence: 0.5,
                        supportedEvidence: ["ev-err"],
                    },
                ],
                findings: [],
                causalChains: [],
                rootCause: null,
            },
        });

        const result = await generateEngineeringRecommendation({ snapshot });

        expect(result).toBeDefined();
        expect(result.authoritativeDecision).toBeDefined();
        expect(result.authoritativeDecision?.repairEquivalence?.isRepairEquivalent).toBe(true);
        expect(result.recommendation.repairEquivalence?.isRepairEquivalent).toBe(true);
        expect(result.authoritativeDecision?.uncertainty.some((u) => u.includes("Upstream root cause remains under investigation"))).toBe(true);
    });
});
