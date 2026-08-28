import { describe, it, expect } from "vitest";
import {
    parseStackTrace,
    buildCallChains,
    resolveAstFromSource,
    resolveSourceContext,
    cleanFilePath,
} from "../src";
import { resolveSourceContextFromContent } from "../src/runtime/source-resolver";

describe("Phase 1 Production Quality Pass — Negative Tests & Scenario Tests", () => {
    describe("Step 40: Negative Test — No Source / Repository Not Configured", () => {
        it("gracefully reports repository_not_configured without attempting local disk reads", () => {
            const frame = {
                order: 1,
                functionName: "readMissingFile",
                rawFilePath: "/Users/developer/code/never_existed.ts",
                filePath: "code/never_existed.ts",
                lineNumber: 100,
                columnNumber: 15,
                isInternal: false,
                isApplication: true,
                classification: "Application" as const,
            };

            const sourceContext = resolveSourceContext(frame);

            expect(sourceContext).toBeDefined();
            expect(sourceContext?.resolutionStatus).toBe("repository_not_configured");
            expect(sourceContext?.lines).toEqual([]);
            expect(sourceContext?.unavailabilityReason).toContain("Connect a GitHub repository in Project Settings");
            expect(sourceContext?.unavailabilityReason).not.toContain("fake");
            expect(sourceContext?.failingExpression).toBeUndefined();
        });

        it("resolves exact AST expression when source content is supplied in-memory", () => {
            const frame = {
                order: 1,
                functionName: "loadUserProfile",
                rawFilePath: "user-service.js",
                filePath: "user-service.js",
                lineNumber: 4,
                columnNumber: 19,
                isInternal: false,
                isApplication: true,
                classification: "Application" as const,
            };

            const source = `
async function loadUserProfile(userId) {
    const profile = await fetchProfile(userId);
    return profile.settings;
}
`;

            const sourceContext = resolveSourceContextFromContent(frame, source, "abc12345", "owner/repo");

            expect(sourceContext).toBeDefined();
            expect(sourceContext?.resolutionStatus).toBe("exact_file");
            expect(sourceContext?.failingExpression).toBe("profile.settings");
            expect(sourceContext?.containingFunction).toBe("loadUserProfile");
            expect(sourceContext?.lines.length).toBeGreaterThan(0);
            expect(sourceContext?.repositoryFullName).toBe("owner/repo");
            expect(sourceContext?.revision).toBe("abc12345");
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

    describe("Path Sanitization (No Local File Paths)", () => {
        it("strips developer machine paths and protocol prefixes for GitHub compatibility", () => {
            expect(cleanFilePath("/Users/nssanjeev/Development/Halo/apps/web/index.ts")).toBe("apps/web/index.ts");
            expect(cleanFilePath("webpack:///src/app.ts")).toBe("src/app.ts");
            expect(cleanFilePath("node://internal/process.js")).toBe("internal/process.js");
        });
    });
});
