import { describe, it, expect } from "vitest";
import { DivergenceAnalyzer } from "../divergence-analyzer";
import { IntentEngine } from "../intent-engine";
import type { InvestigationSnapshot } from "../types";

describe("Halo Trace — First-Divergence & Intent Conflict Engine", () => {
    it("identifies first divergence upstream from crash location (Section 13)", () => {
        const analyzer = new DivergenceAnalyzer();

        const mockSnapshot: InvestigationSnapshot = {
            snapshotId: "snap-div-1",
            createdAt: new Date(),
            serviceName: "order-service",
            environment: "production",
            failure: {
                primaryFrame: {
                    filePath: "src/repository/order-repo.ts",
                    lineNumber: 45,
                    symbol: "save",
                },
                frames: [],
            },
            stackTrace: {
                frames: [
                    { file: "src/repository/order-repo.ts", line: 45, method: "save" },
                    { file: "src/services/order-service.ts", line: 88, method: "processOrder" },
                    { file: "src/factories/order-factory.ts", line: 32, method: "createOrder" },
                    { file: "src/controllers/order-controller.ts", line: 15, method: "handlePost" },
                ],
            },
        } as any;

        const result = analyzer.analyzeFirstDivergence(mockSnapshot);

        expect(result.observationFrame).toBe("src/repository/order-repo.ts:45 (save)");
        // createOrder at index 2 was identified as the upstream divergence producer
        expect(result.firstDivergenceFrame).toBe("src/factories/order-factory.ts:32 (createOrder)");
        expect(result.firstDivergenceFile).toBe("src/factories/order-factory.ts");
        expect(result.firstDivergenceLine).toBe(32);
        expect(result.framesBeforeFailure).toBe(2);
    });

    it("recursively traces value origin to external boundary (Section 14)", () => {
        const analyzer = new DivergenceAnalyzer();

        const chain = analyzer.traceValueOrigin(
            "customerId",
            "src/repository/order-repo.ts:45",
            [
                {
                    symbol: "order.customerId",
                    location: "src/repository/order-repo.ts:45",
                    producer: "order-service.ts#processOrder",
                    transformation: "received undefined customerId",
                    consumer: "order-repo.ts#save",
                    stateBefore: "undefined",
                    stateAfter: "DB constraint violation",
                },
                {
                    symbol: "payload.customerId",
                    location: "src/factories/order-factory.ts:32",
                    producer: "order-controller.ts#handlePost",
                    transformation: "dropped customerId during object destructuring",
                    consumer: "order-factory.ts#createOrder",
                    stateBefore: "cust_12345",
                    stateAfter: "undefined",
                },
                {
                    symbol: "req.body.customerId",
                    location: "src/controllers/order-controller.ts:15",
                    producer: "HTTP Ingress Gateway",
                    transformation: "parsed JSON body",
                    consumer: "order-controller.ts#handlePost",
                    stateBefore: '{"customerId": "cust_12345"}',
                    stateAfter: "cust_12345",
                },
            ],
            "EXTERNAL_INPUT",
            "api/v1/orders"
        );

        expect(chain.targetValue).toBe("customerId");
        expect(chain.steps).toHaveLength(3);
        expect(chain.originBoundary).toBe("EXTERNAL_INPUT");
        expect(chain.boundaryLocation).toBe("api/v1/orders");
    });

    it("detects and resolves IntentConflict using structural authoritativeness (Sections 9 & 10)", () => {
        const engine = new IntentEngine();

        engine.registerIntent({
            id: "intent-schema",
            statement: "Order schema requires customerId to be non-null string",
            targetSymbol: "OrderContext",
            sourceType: "SCHEMA",
            expectedBehavior: "customerId must be non-null",
        });

        engine.registerIntent({
            id: "intent-docs",
            statement: "Documentation suggests customerId is optional for guest checkouts",
            targetSymbol: "OrderContext",
            sourceType: "DOCS",
            expectedBehavior: "customerId may be omitted",
        });

        const conflicts = engine.detectConflicts();
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].conflictId).toContain("OrderContext");
        // SCHEMA is structurally more authoritative than DOCS
        expect(conflicts[0].authoritativeSource).toBe("SCHEMA");
        expect(conflicts[0].resolutionJustification).toContain("SCHEMA is structurally more authoritative");
    });
});
