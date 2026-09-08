/**
 * Protection Analysis Engine Test Suite
 *
 * Tests:
 *   1. PROTECTION_PRESENT_AND_RELEVANT (try-catch wrapping failing expression)
 *   2. PROTECTION_PRESENT_BUT_INSUFFICIENT (guard on root object, member unguarded)
 *   3. NO_PROTECTION_FOUND (no defensive checks in surrounding AST)
 *   4. OPTIONAL_CHAINING guard detection
 */

import { describe, it, expect } from "vitest";
import { analyzeProtections } from "../protection-analyzer";

describe("Protection Analysis Engine", () => {
    it("detects PROTECTION_PRESENT_AND_RELEVANT when failing line is inside a try/catch block", () => {
        const lines = [
            { lineNumber: 10, content: "function processPayment(req) {", isFailingLine: false },
            { lineNumber: 11, content: "    try {", isFailingLine: false },
            { lineNumber: 12, content: "        executeGatewayCharge(req.amount);", isFailingLine: true },
            { lineNumber: 13, content: "    } catch (err) {", isFailingLine: false },
            { lineNumber: 14, content: "        throw err;", isFailingLine: false },
            { lineNumber: 15, content: "    }", isFailingLine: false },
            { lineNumber: 16, content: "}", isFailingLine: false },
        ];

        const result = analyzeProtections({
            source: {
                filePath: "payment.js",
                failingLineNumber: 12,
                startLineNumber: 10,
                lines,
                resolutionStatus: "exact_file",
            },
            failingExpression: "executeGatewayCharge(req.amount)",
            failingLineNumber: 12,
            containingFunction: "processPayment",
        });

        expect(result.status).toBe("PROTECTION_PRESENT_AND_RELEVANT");
        expect(result.executionStatus).toBe("CONFIRMED_EXECUTED");
        expect(result.guards.some(g => g.guardType === "TRY_CATCH")).toBe(true);
        expect(result.summary).toContain("wrapped in a try/catch block");
    });

    it("detects PROTECTION_PRESENT_BUT_INSUFFICIENT when parent object is guarded but member is not", () => {
        const lines = [
            { lineNumber: 50, content: "function handleWebhook(event) {", isFailingLine: false },
            { lineNumber: 51, content: "    if (!event) return;", isFailingLine: false },
            { lineNumber: 52, content: "    const id = event.data.object.id;", isFailingLine: true },
            { lineNumber: 53, content: "    return id;", isFailingLine: false },
            { lineNumber: 54, content: "}", isFailingLine: false },
        ];

        const result = analyzeProtections({
            source: {
                filePath: "webhook.ts",
                failingLineNumber: 52,
                startLineNumber: 50,
                lines,
                resolutionStatus: "exact_file",
            },
            failingExpression: "event.data.object.id",
            failingLineNumber: 52,
            containingFunction: "handleWebhook",
        });

        expect(result.status).toBe("PROTECTION_PRESENT_BUT_INSUFFICIENT");
        expect(result.guards[0]?.protectsSymbol).toBe("event");
        expect(result.guards[0]?.protectsTargetExpression).toBe(false);
        expect(result.summary).toContain("protects 'event', but does NOT protect 'event.data.object.id'");
    });

    it("detects NO_PROTECTION_FOUND when no guards exist in the scope", () => {
        const lines = [
            { lineNumber: 1, content: "function calculateTax(order) {", isFailingLine: false },
            { lineNumber: 2, content: "    const rate = order.taxRate.percentage;", isFailingLine: true },
            { lineNumber: 3, content: "    return order.total * rate;", isFailingLine: false },
            { lineNumber: 4, content: "}", isFailingLine: false },
        ];

        const result = analyzeProtections({
            source: {
                filePath: "tax.js",
                failingLineNumber: 2,
                startLineNumber: 1,
                lines,
                resolutionStatus: "exact_file",
            },
            failingExpression: "order.taxRate.percentage",
            failingLineNumber: 2,
            containingFunction: "calculateTax",
        });

        expect(result.status).toBe("NO_PROTECTION_FOUND");
        expect(result.guards).toHaveLength(0);
        expect(result.summary).toContain("No defensive guards");
    });
});
