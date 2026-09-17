/**
 * Step 31 — Hidden Evaluation Repositories
 *
 * 30 realistic, executable scenario repositories that are NEVER referenced
 * anywhere in production code.
 *
 * Contains:
 *   - Actual executable repository files
 *   - Actual reproducible failure
 *   - Actual regression tests
 *   - Zero production references to scenario IDs or file structures
 */

import type { ExecutableScenario } from "./real-patch-harness";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";

export function getHiddenEvaluationRepositories(): ExecutableScenario[] {
    const repos: ExecutableScenario[] = [];

    for (let i = 1; i <= 30; i++) {
        const id = `HIDDEN_REPO_${String(i).padStart(2, "0")}`;
        const serviceName = `service-node-${i}`;
        const moduleName = `module_${i}`;

        if (i % 6 === 1) {
            // Logic defect: null dereference on optional metadata
            repos.push({
                id,
                title: `Hidden Repo ${i}: Null dereference on optional metadata`,
                description: `Dereference on undefined metadata field in ${moduleName}`,
                initialFiles: [
                    {
                        relativePath: `src/${moduleName}.js`,
                        content: `export function processMetadata(record) {
    if (!record || typeof record !== "object") {
        throw new TypeError("Invalid record object");
    }
    return record.metadata.flags.priority;
}
`,
                    },
                    {
                        relativePath: `test/${moduleName}.test.js`,
                        content: `import assert from "node:assert";
import { processMetadata } from "../src/${moduleName}.js";

try {
    // Calling with undefined metadata will throw on unpatched code
    const res = processMetadata({ id: "rec-1" });
    console.log("PASS: metadata processed without error");
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                    },
                ],
                testCommand: `node test/${moduleName}.test.js`,
                expectedFailureSubstring: "Cannot read properties of undefined",
                expectedSuccessSubstring: "PASS: metadata processed",
                snapshotFactory: (repoDir) =>
                    buildInvestigationSnapshot({
                        incident: {
                            issueId: `incident-hidden-${i}`,
                            title: `TypeError: Cannot read properties of undefined (reading 'flags')`,
                            firstSeen: new Date("2026-09-17T14:00:00Z"),
                            lastSeen: new Date("2026-09-17T14:05:00Z"),
                            eventCount: 4,
                            environment: "production",
                            service: serviceName,
                        },
                        rawEvidence: [
                            {
                                id: `ev-hidden-${i}`,
                                type: "ERROR",
                                title: `TypeError: Cannot read properties of undefined (reading 'flags')`,
                                timestamp: "2026-09-17T14:00:00Z",
                                service: serviceName,
                                environment: "production",
                                tags: {
                                    exceptionType: "TypeError",
                                    message: "Cannot read properties of undefined (reading 'flags')",
                                    stack: `TypeError: Cannot read properties of undefined (reading 'flags')\n    at processMetadata (src/${moduleName}.js:5:27)`,
                                },
                            },
                        ],
                        source: {
                            filePath: `src/${moduleName}.js`,
                            failingLineNumber: 5,
                            containingFunction: "processMetadata",
                            failingExpression: "record.metadata.flags",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: "export function processMetadata(record) {" },
                                { lineNumber: 2, content: "    if (!record || typeof record !== \"object\") {" },
                                { lineNumber: 3, content: "        throw new TypeError(\"Invalid record object\");" },
                                { lineNumber: 4, content: "    }" },
                                { lineNumber: 5, content: "    return record.metadata.flags.priority;" },
                                { lineNumber: 6, content: "}" },
                            ],
                        },
                    }),
            });
        } else if (i % 6 === 2) {
            // Serialization defect: JSON parse error
            repos.push({
                id,
                title: `Hidden Repo ${i}: JSON parse error without schema validation`,
                description: `JSON parsing unvalidated payload in ${moduleName}`,
                initialFiles: [
                    {
                        relativePath: `src/${moduleName}.js`,
                        content: `export function parsePayload(rawInput) {
    const data = JSON.parse(rawInput);
    return data.id;
}
`,
                    },
                    {
                        relativePath: `test/${moduleName}.test.js`,
                        content: `import assert from "node:assert";
import { parsePayload } from "../src/${moduleName}.js";

try {
    const id = parsePayload("<!DOCTYPE html><html>gateway error</html>");
    console.log("PASS: parsed payload id=" + id);
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                    },
                ],
                testCommand: `node test/${moduleName}.test.js`,
                expectedFailureSubstring: "Unexpected token",
                expectedSuccessSubstring: "PASS: parsed payload",
                snapshotFactory: (repoDir) =>
                    buildInvestigationSnapshot({
                        incident: {
                            issueId: `incident-hidden-${i}`,
                            title: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
                            firstSeen: new Date("2026-09-17T14:00:00Z"),
                            lastSeen: new Date("2026-09-17T14:05:00Z"),
                            eventCount: 8,
                            environment: "production",
                            service: serviceName,
                        },
                        rawEvidence: [
                            {
                                id: `ev-hidden-${i}`,
                                type: "ERROR",
                                title: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
                                timestamp: "2026-09-17T14:00:00Z",
                                service: serviceName,
                                environment: "production",
                                tags: {
                                    exceptionType: "SyntaxError",
                                    message: 'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON',
                                    stack: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON\n    at parsePayload (src/${moduleName}.js:2:23)`,
                                },
                            },
                        ],
                        source: {
                            filePath: `src/${moduleName}.js`,
                            failingLineNumber: 2,
                            containingFunction: "parsePayload",
                            failingExpression: "JSON.parse(rawInput)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: "export function parsePayload(rawInput) {" },
                                { lineNumber: 2, content: "    const data = JSON.parse(rawInput);" },
                                { lineNumber: 3, content: "    return data.id;" },
                                { lineNumber: 4, content: "}" },
                            ],
                        },
                    }),
            });
        } else if (i % 6 === 3) {
            // Collection boundary: reduce of empty array
            repos.push({
                id,
                title: `Hidden Repo ${i}: Reduce of empty array without initial accumulator`,
                description: `Empty array reduce in ${moduleName}`,
                initialFiles: [
                    {
                        relativePath: `src/${moduleName}.js`,
                        content: `export function sumScores(items) {
    return items.map(x => x.score).reduce((acc, curr) => acc + curr);
}
`,
                    },
                    {
                        relativePath: `test/${moduleName}.test.js`,
                        content: `import assert from "node:assert";
import { sumScores } from "../src/${moduleName}.js";

try {
    const s = sumScores([]);
    console.log("PASS: sumScores calculated: " + s);
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                    },
                ],
                testCommand: `node test/${moduleName}.test.js`,
                expectedFailureSubstring: "Reduce of empty array with no initial value",
                expectedSuccessSubstring: "PASS: sumScores calculated",
                snapshotFactory: (repoDir) =>
                    buildInvestigationSnapshot({
                        incident: {
                            issueId: `incident-hidden-${i}`,
                            title: `TypeError: Reduce of empty array with no initial value`,
                            firstSeen: new Date("2026-09-17T14:00:00Z"),
                            lastSeen: new Date("2026-09-17T14:05:00Z"),
                            eventCount: 3,
                            environment: "production",
                            service: serviceName,
                        },
                        rawEvidence: [
                            {
                                id: `ev-hidden-${i}`,
                                type: "ERROR",
                                title: `TypeError: Reduce of empty array with no initial value`,
                                timestamp: "2026-09-17T14:00:00Z",
                                service: serviceName,
                                environment: "production",
                                tags: {
                                    exceptionType: "TypeError",
                                    message: "Reduce of empty array with no initial value",
                                    stack: `TypeError: Reduce of empty array with no initial value\n    at sumScores (src/${moduleName}.js:2:36)`,
                                },
                            },
                        ],
                        source: {
                            filePath: `src/${moduleName}.js`,
                            failingLineNumber: 2,
                            containingFunction: "sumScores",
                            failingExpression: "items.map(x => x.score).reduce((acc, curr) => acc + curr)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: "export function sumScores(items) {" },
                                { lineNumber: 2, content: "    return items.map(x => x.score).reduce((acc, curr) => acc + curr);" },
                                { lineNumber: 3, content: "}" },
                            ],
                        },
                    }),
            });
        } else if (i % 6 === 4) {
            // State machine: invalid transition
            repos.push({
                id,
                title: `Hidden Repo ${i}: State machine transition error`,
                description: `Illegal transition in ${moduleName}`,
                initialFiles: [
                    {
                        relativePath: `src/${moduleName}.js`,
                        content: `export class Workflow {
    constructor() {
        this.state = "INIT";
    }
    transition(newState) {
        if (this.state === "DONE") {
            throw new Error("Invalid state transition: cannot transition from DONE to " + newState);
        }
        this.state = newState;
        return this.state;
    }
}
`,
                    },
                    {
                        relativePath: `test/${moduleName}.test.js`,
                        content: `import assert from "node:assert";
import { Workflow } from "../src/${moduleName}.js";

try {
    const wf = new Workflow();
    wf.state = "DONE";
    wf.transition("RUNNING");
    console.log("PASS: workflow transitioned to " + wf.state);
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                    },
                ],
                testCommand: `node test/${moduleName}.test.js`,
                expectedFailureSubstring: "Invalid state transition",
                expectedSuccessSubstring: "PASS: workflow transitioned",
                snapshotFactory: (repoDir) =>
                    buildInvestigationSnapshot({
                        incident: {
                            issueId: `incident-hidden-${i}`,
                            title: `Error: Invalid state transition: cannot transition from DONE to RUNNING`,
                            firstSeen: new Date("2026-09-17T14:00:00Z"),
                            lastSeen: new Date("2026-09-17T14:05:00Z"),
                            eventCount: 5,
                            environment: "production",
                            service: serviceName,
                        },
                        rawEvidence: [
                            {
                                id: `ev-hidden-${i}`,
                                type: "ERROR",
                                title: `Error: Invalid state transition: cannot transition from DONE to RUNNING`,
                                timestamp: "2026-09-17T14:00:00Z",
                                service: serviceName,
                                environment: "production",
                                tags: {
                                    exceptionType: "Error",
                                    message: "Invalid state transition: cannot transition from DONE to RUNNING",
                                    stack: `Error: Invalid state transition\n    at transition (src/${moduleName}.js:7:19)`,
                                },
                            },
                        ],
                        source: {
                            filePath: `src/${moduleName}.js`,
                            failingLineNumber: 7,
                            containingFunction: "transition",
                            failingExpression: "this.transition(newState)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 5, content: "    transition(newState) {" },
                                { lineNumber: 6, content: "        if (this.state === \"DONE\") {" },
                                { lineNumber: 7, content: "            throw new Error(\"Invalid state transition: cannot transition from DONE to \" + newState);" },
                                { lineNumber: 8, content: "        }" },
                                { lineNumber: 9, content: "        this.state = newState;" },
                            ],
                        },
                    }),
            });
        } else if (i % 6 === 5) {
            // Resource lifecycle: unclosed resource
            repos.push({
                id,
                title: `Hidden Repo ${i}: Unreleased connection in exception path`,
                description: `Missing finally release in ${moduleName}`,
                initialFiles: [
                    {
                        relativePath: `src/${moduleName}.js`,
                        content: `export async function executeQuery(pool, sql) {
    const client = await pool.connect();
    return await client.query(sql);
}
`,
                    },
                    {
                        relativePath: `test/${moduleName}.test.js`,
                        content: `import assert from "node:assert";
import { executeQuery } from "../src/${moduleName}.js";

let released = false;
const mockPool = {
    connect: async () => ({
        query: async () => { throw new Error("Database timeout"); },
        release: () => { released = true; }
    })
};

try {
    await executeQuery(mockPool, "SELECT 1");
} catch (err) {
    if (!released) {
        console.error("FAIL: connection was not released on error");
        process.exit(1);
    }
    console.log("PASS: connection released in finally block");
}
`,
                    },
                ],
                testCommand: `node test/${moduleName}.test.js`,
                expectedFailureSubstring: "connection was not released on error",
                expectedSuccessSubstring: "PASS: connection released",
                snapshotFactory: (repoDir) =>
                    buildInvestigationSnapshot({
                        incident: {
                            issueId: `incident-hidden-${i}`,
                            title: `Error: Connection pool exhausted: client not released`,
                            firstSeen: new Date("2026-09-17T14:00:00Z"),
                            lastSeen: new Date("2026-09-17T14:05:00Z"),
                            eventCount: 7,
                            environment: "production",
                            service: serviceName,
                        },
                        rawEvidence: [
                            {
                                id: `ev-hidden-${i}`,
                                type: "ERROR",
                                title: `Error: Connection pool exhausted: client not released`,
                                timestamp: "2026-09-17T14:00:00Z",
                                service: serviceName,
                                environment: "production",
                                tags: {
                                    exceptionType: "Error",
                                    message: "Connection pool exhausted: client not released",
                                    stack: `Error: Connection pool exhausted\n    at executeQuery (src/${moduleName}.js:3:23)`,
                                },
                            },
                        ],
                        source: {
                            filePath: `src/${moduleName}.js`,
                            failingLineNumber: 3,
                            containingFunction: "executeQuery",
                            failingExpression: "client.query(sql)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: "export async function executeQuery(pool, sql) {" },
                                { lineNumber: 2, content: "    const client = await pool.connect();" },
                                { lineNumber: 3, content: "    return await client.query(sql);" },
                                { lineNumber: 4, content: "}" },
                            ],
                        },
                    }),
            });
        } else {
            // External timeout / resilience
            repos.push({
                id,
                title: `Hidden Repo ${i}: External timeout with transient 503`,
                description: `Network timeout in ${moduleName}`,
                initialFiles: [
                    {
                        relativePath: `src/${moduleName}.js`,
                        content: `export async function fetchRemoteConfig(endpoint, fetchFn = globalThis.fetch) {
    const res = await fetchFn(endpoint);
    if (!res.ok) {
        throw new Error(\`Network error: \${res.status} \${res.statusText}\`);
    }
    return await res.json();
}
`,
                    },
                    {
                        relativePath: `test/${moduleName}.test.js`,
                        content: `import assert from "node:assert";
import { fetchRemoteConfig } from "../src/${moduleName}.js";

let attempts = 0;
const mockFetch = async () => {
    attempts++;
    if (attempts < 2) {
        return { ok: false, status: 503, statusText: "Service Unavailable" };
    }
    return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
};

try {
    const res = await fetchRemoteConfig("http://api.internal/config", mockFetch);
    console.log("PASS: remote config fetched successfully");
} catch (err) {
    console.error("FAIL: " + err.message);
    process.exit(1);
}
`,
                    },
                ],
                testCommand: `node test/${moduleName}.test.js`,
                expectedFailureSubstring: "Network error: 503",
                expectedSuccessSubstring: "PASS: remote config fetched",
                snapshotFactory: (repoDir) =>
                    buildInvestigationSnapshot({
                        incident: {
                            issueId: `incident-hidden-${i}`,
                            title: `Error: Network error: 503 Service Unavailable`,
                            firstSeen: new Date("2026-09-17T14:00:00Z"),
                            lastSeen: new Date("2026-09-17T14:05:00Z"),
                            eventCount: 12,
                            environment: "production",
                            service: serviceName,
                        },
                        rawEvidence: [
                            {
                                id: `ev-hidden-${i}`,
                                type: "ERROR",
                                title: `Error: Network error: 503 Service Unavailable`,
                                timestamp: "2026-09-17T14:00:00Z",
                                service: serviceName,
                                environment: "production",
                                tags: {
                                    exceptionType: "Error",
                                    message: "Network error: 503 Service Unavailable",
                                    stack: `Error: Network error: 503 Service Unavailable\n    at fetchRemoteConfig (src/${moduleName}.js:4:15)`,
                                },
                            },
                        ],
                        source: {
                            filePath: `src/${moduleName}.js`,
                            failingLineNumber: 4,
                            containingFunction: "fetchRemoteConfig",
                            failingExpression: "fetchFn(endpoint)",
                            resolutionStatus: "exact_file",
                            lines: [
                                { lineNumber: 1, content: "export async function fetchRemoteConfig(endpoint, fetchFn = globalThis.fetch) {" },
                                { lineNumber: 2, content: "    const res = await fetchFn(endpoint);" },
                                { lineNumber: 3, content: "    if (!res.ok) {" },
                                { lineNumber: 4, content: "        throw new Error(`Network error: ${res.status} ${res.statusText}`);" },
                                { lineNumber: 5, content: "    }" },
                            ],
                        },
                    }),
            });
        }
    }

    return repos;
}
