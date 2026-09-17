/**
 * Step 7 — Real Multi-File Repair Scenarios
 *
 * Implements multi-file repair combinations:
 * 1. producer + regression test
 * 2. adapter + regression test
 * 3. caller + shared contract
 * 4. configuration + source
 *
 * All scenarios are executed by RealPatchExecutionHarness against clean isolated repositories.
 */

import type { ExecutableScenario } from "./real-patch-harness";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";

export function getMultiFileScenarios(): ExecutableScenario[] {
    return [
        // 1. PRODUCER + REGRESSION TEST
        {
            id: "MULTI_FILE_01_PRODUCER_TEST",
            title: "Producer omitted required rate field + new regression test",
            description: "Producer creates pricing payload without 'rate', causing checkout calculations to fail.",
            initialFiles: [
                {
                    relativePath: "src/producer.js",
                    content: `// Producer module
export function createPricingPayload(baseAmount, currency) {
    return {
        amount: baseAmount,
        currency: currency,
        // Missing rate
    };
}
`,
                },
                {
                    relativePath: "src/checkout.js",
                    content: `// Consumer module
import { createPricingPayload } from "./producer.js";

export function calculateTotal(baseAmount, currency) {
    const payload = createPricingPayload(baseAmount, currency);
    if (typeof payload.rate !== "number") {
        throw new TypeError("Cannot calculate total: pricing rate is undefined");
    }
    return payload.amount * payload.rate;
}
`,
                },
                {
                    relativePath: "test/checkout.test.js",
                    content: `import assert from "node:assert";
import { calculateTotal } from "../src/checkout.js";

try {
    const total = calculateTotal(100, "USD");
    assert.strictEqual(total, 100);
    console.log("PASS: calculateTotal succeeded with total=" + total);
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                },
            ],
            testCommand: "node test/checkout.test.js",
            expectedFailureSubstring: "pricing rate is undefined",
            expectedSuccessSubstring: "PASS: calculateTotal succeeded",
            snapshotFactory: (repoDir) =>
                buildInvestigationSnapshot({
                    incident: {
                        issueId: "multi-01-producer-test",
                        title: "TypeError: Cannot calculate total: pricing rate is undefined",
                        firstSeen: new Date("2026-09-17T12:00:00Z"),
                        lastSeen: new Date("2026-09-17T12:05:00Z"),
                        eventCount: 3,
                        environment: "production",
                        service: "checkout-service",
                    },
                    rawEvidence: [
                        {
                            id: "ev-m1-err",
                            type: "ERROR",
                            title: "TypeError: Cannot calculate total: pricing rate is undefined",
                            timestamp: "2026-09-17T12:00:00Z",
                            service: "checkout-service",
                            environment: "production",
                            tags: {
                                exceptionType: "TypeError",
                                message: "Cannot calculate total: pricing rate is undefined",
                                stack: "TypeError: Cannot calculate total: pricing rate is undefined\n    at calculateTotal (src/checkout.js:7:15)",
                            },
                        },
                    ],
                    source: {
                        filePath: "src/checkout.js",
                        failingLineNumber: 7,
                        containingFunction: "calculateTotal",
                        failingExpression: "payload.rate",
                        resolutionStatus: "exact_file",
                        lines: [
                            { lineNumber: 5, content: "export function calculateTotal(baseAmount, currency) {" },
                            { lineNumber: 6, content: "    const payload = createPricingPayload(baseAmount, currency);" },
                            { lineNumber: 7, content: "    if (typeof payload.rate !== \"number\") {" },
                            { lineNumber: 8, content: "        throw new TypeError(\"Cannot calculate total: pricing rate is undefined\");" },
                            { lineNumber: 9, content: "    }" },
                        ],
                        producers: [
                            {
                                producerFile: "src/producer.js",
                                producerSymbol: "createPricingPayload",
                                producedType: "PricingPayload",
                                missingProperties: ["rate"],
                            },
                        ],
                        testFiles: ["test/checkout.test.js"],
                    },
                }),
        },

        // 2. ADAPTER + REGRESSION TEST
        {
            id: "MULTI_FILE_02_ADAPTER_TEST",
            title: "Adapter field loss during upstream payload translation + test",
            description: "Adapter forgets to map token property from auth provider response.",
            initialFiles: [
                {
                    relativePath: "src/adapter.js",
                    content: `// Adapter module
export function adaptAuthResponse(rawResponse) {
    return {
        userId: rawResponse.user_id,
        email: rawResponse.user_email,
        // Bug: access_token not mapped to token
    };
}
`,
                },
                {
                    relativePath: "src/session.js",
                    content: `import { adaptAuthResponse } from "./adapter.js";

export function establishSession(rawResponse) {
    const session = adaptAuthResponse(rawResponse);
    if (!session.token) {
        throw new Error("Missing required session token");
    }
    return \`Session active for \${session.userId}\`;
}
`,
                },
                {
                    relativePath: "test/session.test.js",
                    content: `import assert from "node:assert";
import { establishSession } from "../src/session.js";

try {
    const res = establishSession({ user_id: "usr_1", user_email: "a@b.com", access_token: "tok_secret" });
    assert.strictEqual(res, "Session active for usr_1");
    console.log("PASS: session established");
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                },
            ],
            testCommand: "node test/session.test.js",
            expectedFailureSubstring: "Missing required session token",
            expectedSuccessSubstring: "PASS: session established",
            snapshotFactory: (repoDir) =>
                buildInvestigationSnapshot({
                    incident: {
                        issueId: "multi-02-adapter-test",
                        title: "Error: Missing required session token",
                        firstSeen: new Date("2026-09-17T12:00:00Z"),
                        lastSeen: new Date("2026-09-17T12:05:00Z"),
                        eventCount: 5,
                        environment: "production",
                        service: "auth-service",
                    },
                    rawEvidence: [
                        {
                            id: "ev-m2-err",
                            type: "ERROR",
                            title: "Error: Missing required session token",
                            timestamp: "2026-09-17T12:00:00Z",
                            service: "auth-service",
                            environment: "production",
                            tags: {
                                exceptionType: "Error",
                                message: "Missing required session token",
                                stack: "Error: Missing required session token\n    at establishSession (src/session.js:6:15)",
                            },
                        },
                    ],
                    source: {
                        filePath: "src/adapter.js",
                        failingLineNumber: 4,
                        containingFunction: "adaptAuthResponse",
                        failingExpression: "rawResponse.access_token",
                        resolutionStatus: "exact_file",
                        lines: [
                            { lineNumber: 2, content: "export function adaptAuthResponse(rawResponse) {" },
                            { lineNumber: 3, content: "    return {" },
                            { lineNumber: 4, content: "        userId: rawResponse.user_id," },
                            { lineNumber: 5, content: "        email: rawResponse.user_email," },
                            { lineNumber: 6, content: "    };" },
                        ],
                        testFiles: ["test/session.test.js"],
                    },
                }),
        },

        // 3. CALLER + SHARED CONTRACT
        {
            id: "MULTI_FILE_03_CALLER_CONTRACT",
            title: "Caller violates required contract for options object",
            description: "Caller invokes function without required options object, violating shared contract.",
            initialFiles: [
                {
                    relativePath: "src/contract.js",
                    content: `export function validateOptions(options) {
    if (!options || typeof options !== "object") {
        throw new TypeError("Contract violation: options must be a non-null object");
    }
}
`,
                },
                {
                    relativePath: "src/service.js",
                    content: `import { validateOptions } from "./contract.js";

export function processRequest(options) {
    validateOptions(options);
    return options.mode || "standard";
}
`,
                },
                {
                    relativePath: "src/caller.js",
                    content: `import { processRequest } from "./service.js";

export function handleInvocation() {
    // Bug: caller passed undefined
    return processRequest(undefined);
}
`,
                },
                {
                    relativePath: "test/caller.test.js",
                    content: `import assert from "node:assert";
import { handleInvocation } from "../src/caller.js";

try {
    const res = handleInvocation();
    console.log("PASS: processRequest returned " + res);
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                },
            ],
            testCommand: "node test/caller.test.js",
            expectedFailureSubstring: "options must be a non-null object",
            expectedSuccessSubstring: "PASS: processRequest returned",
            snapshotFactory: (repoDir) =>
                buildInvestigationSnapshot({
                    incident: {
                        issueId: "multi-03-caller-contract",
                        title: "TypeError: Contract violation: options must be a non-null object",
                        firstSeen: new Date("2026-09-17T12:00:00Z"),
                        lastSeen: new Date("2026-09-17T12:05:00Z"),
                        eventCount: 4,
                        environment: "production",
                        service: "gateway-service",
                    },
                    rawEvidence: [
                        {
                            id: "ev-m3-err",
                            type: "ERROR",
                            title: "TypeError: Contract violation: options must be a non-null object",
                            timestamp: "2026-09-17T12:00:00Z",
                            service: "gateway-service",
                            environment: "production",
                            tags: {
                                exceptionType: "TypeError",
                                message: "Contract violation: options must be a non-null object",
                                stack: "TypeError: Contract violation: options must be a non-null object\n    at validateOptions (src/contract.js:3:15)\n    at processRequest (src/service.js:4:5)\n    at handleInvocation (src/caller.js:5:12)",
                            },
                        },
                    ],
                    stackFrames: [
                        {
                            order: 1,
                            filePath: "src/contract.js",
                            lineNumber: 3,
                            functionName: "validateOptions",
                            isApplication: true,
                            classification: "Application",
                        },
                        {
                            order: 2,
                            filePath: "src/service.js",
                            lineNumber: 4,
                            functionName: "processRequest",
                            isApplication: true,
                            classification: "Application",
                        },
                        {
                            order: 3,
                            filePath: "src/caller.js",
                            lineNumber: 5,
                            functionName: "handleInvocation",
                            isApplication: true,
                            classification: "Application",
                        },
                    ],
                    source: {
                        filePath: "src/service.js",
                        failingLineNumber: 4,
                        containingFunction: "processRequest",
                        failingExpression: "validateOptions(options)",
                        resolutionStatus: "exact_file",
                        lines: [
                            { lineNumber: 3, content: "export function processRequest(options) {" },
                            { lineNumber: 4, content: "    validateOptions(options);" },
                            { lineNumber: 5, content: "    return options.mode || \"standard\";" },
                            { lineNumber: 6, content: "}" },
                        ],
                        callers: [
                            {
                                callerFile: "src/caller.js",
                                callerSymbol: "handleInvocation",
                                argumentExpressions: ["undefined"],
                            },
                        ],
                    },
                }),
        },

        // 4. CONFIGURATION + SOURCE
        {
            id: "MULTI_FILE_04_CONFIG_SOURCE",
            title: "Configuration missing default value + source environment guard",
            description: "Application fails because API_TIMEOUT config is undefined.",
            initialFiles: [
                {
                    relativePath: "src/config.js",
                    content: `export const config = {
    // Bug: timeout not defined or defaulted
    timeoutMs: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : undefined,
};
`,
                },
                {
                    relativePath: "src/client.js",
                    content: `import { config } from "./config.js";

export function getClientTimeout() {
    if (typeof config.timeoutMs !== "number" || isNaN(config.timeoutMs)) {
        throw new Error("Configuration error: API_TIMEOUT is missing or invalid");
    }
    return config.timeoutMs;
}
`,
                },
                {
                    relativePath: "test/config.test.js",
                    content: `import assert from "node:assert";
import { getClientTimeout } from "../src/client.js";

try {
    const t = getClientTimeout();
    assert.strictEqual(typeof t, "number");
    console.log("PASS: client timeout configured: " + t);
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                },
            ],
            testCommand: "node test/config.test.js",
            expectedFailureSubstring: "API_TIMEOUT is missing or invalid",
            expectedSuccessSubstring: "PASS: client timeout configured",
            snapshotFactory: (repoDir) =>
                buildInvestigationSnapshot({
                    incident: {
                        issueId: "multi-04-config-source",
                        title: "Error: Configuration error: API_TIMEOUT is missing or invalid",
                        firstSeen: new Date("2026-09-17T12:00:00Z"),
                        lastSeen: new Date("2026-09-17T12:05:00Z"),
                        eventCount: 6,
                        environment: "production",
                        service: "api-service",
                    },
                    rawEvidence: [
                        {
                            id: "ev-m4-err",
                            type: "ERROR",
                            title: "Error: Configuration error: API_TIMEOUT is missing or invalid",
                            timestamp: "2026-09-17T12:00:00Z",
                            service: "api-service",
                            environment: "production",
                            tags: {
                                exceptionType: "Error",
                                message: "Configuration error: API_TIMEOUT is missing or invalid",
                                stack: "Error: Configuration error: API_TIMEOUT is missing or invalid\n    at getClientTimeout (src/client.js:5:15)",
                            },
                        },
                    ],
                    source: {
                        filePath: "src/config.js",
                        failingLineNumber: 3,
                        containingFunction: "config",
                        failingExpression: "process.env.API_TIMEOUT",
                        resolutionStatus: "exact_file",
                        lines: [
                            { lineNumber: 1, content: "export const config = {" },
                            { lineNumber: 2, content: "    // Bug: timeout not defined or defaulted" },
                            { lineNumber: 3, content: "    timeoutMs: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT, 10) : undefined," },
                            { lineNumber: 4, content: "};" },
                        ],
                    },
                }),
        },
    ];
}
