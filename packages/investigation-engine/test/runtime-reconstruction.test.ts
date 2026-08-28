import { describe, it, expect } from "vitest";
import {
    parseStackTrace,
    buildCallChain,
    buildCallChains,
    resolveAstFromSource,
    redactSensitiveData,
    redactSensitiveString,
    sanitizeHeaders,
} from "../src";

describe("Phase 1, Feature 1: Exact Runtime Failure Reconstruction", () => {
    describe("Stack Trace Parser", () => {
        it("parses standard Node.js / V8 stack traces", () => {
            const rawStack = `TypeError: Cannot read properties of undefined (reading 'plan')
    at getUserPlan (/app/src/users/getUserPlan.ts:42:19)
    at async handleCheckout (/app/src/checkout/process.ts:18:25)
    at async POST (/app/src/app/api/checkout/route.ts:12:9)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

            const frames = parseStackTrace(rawStack);

            expect(frames.length).toBe(4);

            // Frame 1: failing site
            expect(frames[0].order).toBe(1);
            expect(frames[0].functionName).toBe("getUserPlan");
            expect(frames[0].filePath).toBe("app/src/users/getUserPlan.ts");
            expect(frames[0].lineNumber).toBe(42);
            expect(frames[0].columnNumber).toBe(19);
            expect(frames[0].isApplication).toBe(true);
            expect(frames[0].isInternal).toBe(false);

            // Frame 2: async caller
            expect(frames[1].order).toBe(2);
            expect(frames[1].functionName).toBe("handleCheckout");
            expect(frames[1].filePath).toBe("app/src/checkout/process.ts");
            expect(frames[1].lineNumber).toBe(18);
            expect(frames[1].columnNumber).toBe(25);
            expect(frames[1].isApplication).toBe(true);

            // Frame 4: node internal frame
            expect(frames[3].functionName).toBe("processTicksAndRejections");
            expect(frames[3].isInternal).toBe(true);
            expect(frames[3].isApplication).toBe(false);
        });

        it("parses Gecko / WebKit browser stack traces", () => {
            const rawStack = `handlePayment@http://localhost:3000/src/checkout.ts:88:14
checkoutOnClick@http://localhost:3000/src/button.tsx:24:5
addEventListener@native code`;

            const frames = parseStackTrace(rawStack);

            expect(frames.length).toBe(3);
            expect(frames[0].functionName).toBe("handlePayment");
            expect(frames[0].filePath).toBe("src/checkout.ts");
            expect(frames[0].lineNumber).toBe(88);
            expect(frames[0].columnNumber).toBe(14);
            expect(frames[0].isApplication).toBe(true);

            expect(frames[1].functionName).toBe("checkoutOnClick");
            expect(frames[1].filePath).toBe("src/button.tsx");
            expect(frames[1].lineNumber).toBe(24);
        });

        it("parses Python traceback frames", () => {
            const rawStack = `Traceback (most recent call last):
  File "/app/services/auth.py", line 55, in authenticate_user
  File "/app/db/session.py", line 12, in get_user_session
ValueError: Invalid session token`;

            const frames = parseStackTrace(rawStack);

            expect(frames.length).toBe(2);
            expect(frames[0].functionName).toBe("authenticate_user");
            expect(frames[0].filePath).toBe("app/services/auth.py");
            expect(frames[0].lineNumber).toBe(55);

            expect(frames[1].functionName).toBe("get_user_session");
            expect(frames[1].filePath).toBe("app/db/session.py");
            expect(frames[1].lineNumber).toBe(12);
        });

        it("parses Go panic stack frames", () => {
            const rawStack = `panic: runtime error: invalid memory address or nil pointer dereference
main.processOrder(/app/services/order.go:77 +0x140)
main.main(/app/main.go:20 +0x30)`;

            const frames = parseStackTrace(rawStack);

            expect(frames.length).toBe(2);
            expect(frames[0].functionName).toBe("main.processOrder");
            expect(frames[0].filePath).toBe("app/services/order.go");
            expect(frames[0].lineNumber).toBe(77);
        });

        it("accurately identifies vendor dependencies in node_modules", () => {
            const rawStack = `Error: Query failed
    at PrismaClient.findUnique (/app/node_modules/@prisma/client/runtime/library.js:120:15)
    at getUserById (/app/src/db/users.ts:33:10)`;

            const frames = parseStackTrace(rawStack);

            expect(frames.length).toBe(2);
            expect(frames[0].isInternal).toBe(true);
            expect(frames[0].isApplication).toBe(false);
            expect(frames[0].moduleOrPackage).toBe("@prisma/client");

            expect(frames[1].isInternal).toBe(false);
            expect(frames[1].isApplication).toBe(true);
        });
    });

    describe("Call Chain Reconstruction", () => {
        it("reconstructs execution flow from entry to failing expression", () => {
            const rawStack = `TypeError: Cannot read properties of undefined (reading 'email')
    at sendEmail (/app/src/notify.ts:40:10)
    at processSignup (/app/src/signup.ts:25:5)
    at handleRoute (/app/src/api.ts:10:2)`;

            const frames = parseStackTrace(rawStack);
            const callChain = buildCallChain(frames, "user.email");

            expect(callChain.length).toBe(3);

            // Chronological order: entry point first, failing site last
            expect(callChain[0].functionName).toBe("handleRoute()");
            expect(callChain[0].isFailingSite).toBe(false);

            expect(callChain[1].functionName).toBe("processSignup()");
            expect(callChain[1].isFailingSite).toBe(false);

            expect(callChain[2].functionName).toBe("sendEmail()");
            expect(callChain[2].isFailingSite).toBe(true);
            expect(callChain[2].failingExpression).toBe("user.email");
        });

        it("filters out runtime noise from applicationCallChain while preserving fullCallChain", () => {
            const rawStack = `TypeError: Cannot read properties of null (reading 'settings')
    at readProfileSettings (/Users/dev/halo-test2/index.js:459:20)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async runScenario (/Users/dev/halo-test2/index.js:120:5)
    at async main (/Users/dev/halo-test2/index.js:10:1)`;

            const frames = parseStackTrace(rawStack);
            const { applicationCallChain, fullCallChain } = buildCallChains(frames, "profile.settings");

            // Full chain has all 4 frames
            expect(fullCallChain.length).toBe(4);

            // Application chain filters out processTicksAndRejections (runtime internal)
            expect(applicationCallChain.length).toBe(3);
            expect(applicationCallChain.map((s: { functionName: string }) => s.functionName)).toEqual([
                "main()",
                "runScenario()",
                "readProfileSettings()",
            ]);

            // The failing site has the failing expression
            const failingStep = applicationCallChain.find((s: { isFailingSite: boolean }) => s.isFailingSite);
            expect(failingStep).toBeDefined();
            expect(failingStep.functionName).toBe("readProfileSettings()");
            expect(failingStep.failingExpression).toBe("profile.settings");
        });

        it("correctly classifies frames as Application, Runtime, Framework, or Vendor", () => {
            const rawStack = `Error: Something failed
    at customHandler (/app/src/handlers/custom.ts:15:2)
    at NextServer.handleRequest (/app/node_modules/next/dist/server/next-server.js:400:10)
    at PrismaClient.findUnique (/app/node_modules/@prisma/client/runtime/library.js:50:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

            const frames = parseStackTrace(rawStack);
            expect(frames[0].classification).toBe("Application");
            expect(frames[1].classification).toBe("Framework");
            expect(frames[2].classification).toBe("Framework");
            expect(frames[3].classification).toBe("Runtime");
        });
    });

    describe("Deterministic AST Source Expression Resolution", () => {
        it("resolves simple property access expression and containing function (Scenario B)", () => {
            const source = `
function readProfileSettings(profile) {
    return profile.settings;
}
`;
            // Line 3 is '    return profile.settings;'
            const result = resolveAstFromSource(source, 3, 20, "index.js");

            expect(result.failingExpression).toBe("profile.settings");
            expect(result.containingFunction).toBe("readProfileSettings");
            expect(result.failingStatement).toBe("return profile.settings;");
            expect(result.astNodeType).toBe("PropertyAccessExpression");
        });

        it("resolves nested property chains at column offset", () => {
            const source = `
async function processPayment(payload) {
    const txId = payload.paymentDetails.transaction.id;
    return txId;
}
`;
            // Line 3: payload.paymentDetails.transaction.id
            const result = resolveAstFromSource(source, 3, 25, "payment.ts");

            expect(result.failingExpression).toBe("payload.paymentDetails.transaction.id");
            expect(result.containingFunction).toBe("processPayment");
        });

        it("resolves method call expressions (Scenario C)", () => {
            const source = `
function findActiveUser(users, id) {
    return users.find(u => u.id === id);
}
`;
            // Line 3: users.find
            const result = resolveAstFromSource(source, 3, 18, "users.ts");

            expect(result.failingExpression).toBe("users.find");
            expect(result.containingFunction).toBe("findActiveUser");
        });

        it("resolves arrow function variables as containing function", () => {
            const source = `
const getUserPlan = async (user) => {
    return user.plan;
};
`;
            // Line 3: return user.plan;
            const result = resolveAstFromSource(source, 3, 17, "plans.ts");

            expect(result.failingExpression).toBe("user.plan");
            expect(result.containingFunction).toBe("getUserPlan");
        });

        it("gracefully returns empty when line number is out of bounds", () => {
            const source = `console.log("hello");`;
            const result = resolveAstFromSource(source, 99, 1, "test.js");
            expect(result.failingExpression).toBeUndefined();
        });
    });
});

describe("Phase 1, Feature 2: Runtime Context Reconstruction", () => {
    describe("Privacy & Sensitive Data Redaction", () => {
        it("redacts bearer tokens and basic auth strings", () => {
            const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload";
            const redacted = redactSensitiveString(authHeader);
            expect(redacted).toBe("Bearer [REDACTED]");
            expect(redacted).not.toContain("secretpayload");
        });

        it("redacts sensitive fields in nested telemetry objects", () => {
            const telemetryPayload = {
                userId: "user-1234",
                username: "alice",
                password: "mySecretPassword123!",
                apiKey: "halo_sec_999888777",
                metadata: {
                    sessionToken: "sess_xyz_987",
                    publicConfig: "dark-mode-enabled",
                    auth: {
                        jwt: "xyz123",
                    },
                },
            };

            const clean = redactSensitiveData(telemetryPayload);

            expect(clean.userId).toBe("user-1234");
            expect(clean.username).toBe("alice");
            expect(clean.password).toBe("[REDACTED]");
            expect(clean.apiKey).toBe("[REDACTED]");
            expect(clean.metadata.sessionToken).toBe("[REDACTED]");
            expect(clean.metadata.publicConfig).toBe("dark-mode-enabled");
            expect(clean.metadata.auth).toBe("[REDACTED]");
        });

        it("sanitizes HTTP request headers", () => {
            const headers = {
                "content-type": "application/json",
                authorization: "Bearer secret-token-abc",
                cookie: "session=xyz123; user_id=456",
                "x-request-id": "req-999-000",
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized?.["content-type"]).toBe("application/json");
            expect(sanitized?.["x-request-id"]).toBe("req-999-000");
            expect(sanitized?.authorization).toBe("[REDACTED]");
            expect(sanitized?.cookie).toBe("[REDACTED]");
        });
    });
});
