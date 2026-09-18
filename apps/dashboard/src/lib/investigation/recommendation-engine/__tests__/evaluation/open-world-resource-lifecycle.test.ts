import { describe, it, expect } from "vitest";
import { analyzeOpenWorldResourceLifecycles } from "../../resource-flow-analyzer";

describe("Directive 6 & 28 — Open-World Resource Lifecycle Discovery", () => {
    it("discovers arbitrary lifecycle methods (obtainLease / returnLease) without conventional vocabulary", () => {
        const sourceCode = `
            class CustomBatchWorker {
                async processQueue() {
                    const lease = await sessionManager.obtainLease();
                    try {
                        await doWork(lease);
                    } finally {
                        await sessionManager.returnLease(lease);
                    }
                }
            }
        `;

        const lifecycles = analyzeOpenWorldResourceLifecycles(sourceCode, "src/worker.ts");

        expect(lifecycles.length).toBeGreaterThan(0);
        const lc = lifecycles[0];
        expect(lc.resourceVariable).toBe("lease");
        expect(lc.discoveredDisposalOperations.length).toBe(1);
        expect(lc.discoveredDisposalOperations[0].isInFinallyBlock).toBe(true);
        expect(lc.discoveredDisposalOperations[0].empiricalDiscoveryEvidence).toContain("CONSISTENT_FINALLY_PLACEMENT");
        expect(lc.hasResourceLeakRisk).toBe(false);
    });

    it("continues to discover lifecycle after arbitrary renaming (customAllocA / customTermB) with ZERO production code changes", () => {
        // Arbitrary method names completely divorced from lifecycle vocabulary
        const sourceCode = `
            class ProtocolAdapter {
                async handleEvent() {
                    const tokenHandle = await provider.customAllocA();
                    try {
                        await executePayload(tokenHandle);
                    } finally {
                        await provider.customTermB(tokenHandle);
                    }
                }
            }
        `;

        const lifecycles = analyzeOpenWorldResourceLifecycles(sourceCode, "src/adapter.ts");

        expect(lifecycles.length).toBeGreaterThan(0);
        const lc = lifecycles[0];
        expect(lc.resourceVariable).toBe("tokenHandle");
        expect(lc.discoveredDisposalOperations.length).toBe(1);
        expect(lc.discoveredDisposalOperations[0].isInFinallyBlock).toBe(true);
        expect(lc.hasResourceLeakRisk).toBe(false);
    });

    it("detects unreleased exception exit path when cleanup is missing on throw", () => {
        const sourceCode = `
            async function handleRequest() {
                const session = await factory.initiate();
                if (someCondition) {
                    throw new Error("Early failure");
                }
                await session.terminate();
            }
        `;

        const lifecycles = analyzeOpenWorldResourceLifecycles(sourceCode, "src/handler.ts");

        expect(lifecycles.length).toBeGreaterThan(0);
        const lc = lifecycles[0];
        expect(lc.hasResourceLeakRisk).toBe(true);
        expect(lc.unreleasedExitPaths.length).toBeGreaterThan(0);
        expect(lc.unreleasedExitPaths[0].exitType).toBe("EXCEPTION_PATH");
    });

    it("detects long-held resource risk when resource is held across unrelated external async I/O", () => {
        const sourceCode = `
            async function exportOrders() {
                const conn = await db.checkout();
                try {
                    // Unrelated external HTTP call while holding connection
                    await fetch("https://third-party-api.com/slow-endpoint");
                    await sleep(3000);
                    await conn.query("SELECT 1");
                } finally {
                    await conn.return();
                }
            }
        `;

        const lifecycles = analyzeOpenWorldResourceLifecycles(sourceCode, "src/export.ts");

        expect(lifecycles.length).toBeGreaterThan(0);
        const lc = lifecycles[0];
        expect(lc.hasLongHeldResourceRisk).toBe(true);
        expect(lc.holdingScopeAnalysis.containsUnrelatedAsyncIo).toBe(true);
        expect(lc.holdingScopeAnalysis.unrelatedIoCalls.length).toBeGreaterThan(0);
    });
});
