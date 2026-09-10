import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Production Source Hardcode Audit (RULE 5 & PART XXXII)", () => {
    const targetFiles = [
        "apps/dashboard/src/actions/overview.ts",
        "apps/dashboard/src/lib/overview/attention-model.ts",
        "apps/dashboard/src/lib/overview/overview-service.ts",
        "apps/dashboard/src/app/(dashboard)/overview/page.tsx",
    ];

    const forbiddenPhrases = [
        "Checkout initialization failed",
        "Episode 2 Payment Failure",
        "acme-checkout",
        "fake-incident",
        "mock-issue",
        "synthetic-discovery",
    ];

    it("verifies production Overview files contain no prohibited test strings or fake entities", () => {
        const rootDir = path.resolve(__dirname, "../../../../../../");

        for (const relPath of targetFiles) {
            const fullPath = path.join(rootDir, relPath);
            if (!fs.existsSync(fullPath)) {
                throw new Error(`Expected production file to exist: ${relPath}`);
            }

            const content = fs.readFileSync(fullPath, "utf-8");

            for (const phrase of forbiddenPhrases) {
                const containsPhrase = content.toLowerCase().includes(phrase.toLowerCase());
                expect(
                    containsPhrase,
                    `File ${relPath} must not contain hardcoded literal "${phrase}"`
                ).toBe(false);
            }
        }
    });

    it("verifies Overview Home page does not import or fabricate fake HaloDiscoveries", () => {
        const rootDir = path.resolve(__dirname, "../../../../../../");
        const pageContent = fs.readFileSync(
            path.join(rootDir, "apps/dashboard/src/app/(dashboard)/overview/page.tsx"),
            "utf-8"
        );

        expect(pageContent).not.toContain("HaloDiscovery");
        expect(pageContent).not.toContain("Halo Discoveries");
        expect(pageContent).not.toContain("#discoveries");
    });
});
