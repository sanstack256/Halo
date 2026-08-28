import { describe, it, expect } from "vitest";
import {
    parseStackTrace,
    buildCallChains,
    resolveAstFromSource,
    resolveSourceContext,
    redactSensitiveData,
} from "../src";

describe("Phase 1 Production Quality Pass — Negative Tests & Scenario Tests", () => {
    describe("Step 40: Negative Test — No Source Available", () => {
        it("gracefully reports source unavailable without inventing substitute code", () => {
            const frame = {
                order: 1,
                functionName: "readMissingFile",
                rawFilePath: "/non/existent/path/never_existed.ts",
                filePath: "non/existent/path/never_existed.ts",
                lineNumber: 100,
                columnNumber: 15,
                isInternal: false,
                isApplication: true,
                classification: "Application" as const,
            };

            const sourceContext = resolveSourceContext(frame);

            expect(sourceContext).toBeDefined();
            expect(sourceContext?.resolutionStatus).toBe("file_not_found");
            expect(sourceContext?.lines).toEqual([]);
            expect(sourceContext?.unavailabilityReason).toContain("never_existed.ts");
            expect(sourceContext?.unavailabilityReason).not.toContain("fake");
            expect(sourceContext?.failingExpression).toBeUndefined();
        });
    });

    describe("Step 41: Negative Test — Missing / Truncated Stack", () => {
        it("handles empty or malformed stack traces cleanly", () => {
            expect(parseStackTrace("")).toEqual([]);
            expect(parseStackTrace(null as any)).toEqual([]);
            expect(parseStackTrace(undefined as any)).toEqual([]);
            expect(parseStackTrace("Error: Just a message without frames")).toEqual([]);
        });
    });

    describe("Step 42 & 43: Scenario Verification (halo-test2 Scenarios)", () => {
        it("Scenario B (Invalid Profile Shape): resolves AST expression profile.settings", () => {
            const source = `
async function loadUserProfile(userId) {
    const profile = await fetchProfile(userId);
    return profile.settings;
}
`;
            const res = resolveAstFromSource(source, 4, 19, "user-service.js");
            expect(res.failingExpression).toBe("profile.settings");
            expect(res.containingFunction).toBe("loadUserProfile");
        });

        it("Scenario C (Invalid Collection): resolves AST expression results.find", () => {
            const source = `
function searchCollection(results, query) {
    const matched = results.find(item => item.id === query);
    return matched;
}
`;
            const res = resolveAstFromSource(source, 3, 28, "search.ts");
            expect(res.failingExpression).toBe("results.find");
            expect(res.containingFunction).toBe("searchCollection");
        });

        it("Scenario D (Dependency Failure): resolves nested transaction property chain", () => {
            const source = `
function handlePaymentCallback(response) {
    const data = response.data;
    const txId = data.payment.transaction.id;
    return txId;
}
`;
            const res = resolveAstFromSource(source, 4, 25, "payment-handler.js");
            expect(res.failingExpression).toBe("data.payment.transaction.id");
            expect(res.containingFunction).toBe("handlePaymentCallback");
        });
    });
});
