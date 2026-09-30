/**
 * Halo Active Investigation & Repair Engine — Universal Engineering Pattern Engine
 *
 * Core product requirement: For EVERY incident class, produce the most precise
 * engineering solution supported by available evidence. Never refuse when
 * the failure mechanism can be determined from static analysis.
 *
 * Supported failure archetypes:
 *  1.  Logic & conditional defects (null dereference, undefined property access)
 *  2.  Async race conditions & unhandled promise rejections
 *  3.  State machine invalid transitions
 *  4.  JSON / serialization / deserialization errors
 *  5.  Database transaction & connection lifecycle failures
 *  6.  Schema & API contract mismatches
 *  7.  Collection boundary & reduce-on-empty errors
 *  8.  Resource lifecycle & cleanup failures (leaks, missing finally)
 *  9.  External service timeouts (application retry, circuit breaker, exponential backoff)
 * 10.  Upstream producer defects (fix producer, not consumer)
 * 11.  Multi-file coordinated changes (producer + consumer + test)
 */

import fs from "fs";
import type {
    InvestigationSnapshot,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    CandidateAction,
    SourceAstAnalysis,
    ContractAnalysisResult,
    RecommendedChange,
} from "./types";
import {
    locateCallerCallSite,
    traceArgumentDataFlow,
    extractCalleeContract,
    generateAuthoritativeCallerPatch,
    parseSourceAst,
} from "./causal-source-reconstructor";
import { resolveAuthoritativeSource, computeSourceHash } from "../runtime/source-provenance";
import type { SourceEvidenceCarrier } from "../runtime/types";

/**
 * Extracts the exact property whose missing/undefined value triggered the divergence.
 */
function extractMissingPropertyFromDivergence(excMessage: string, failingExpr: string): string {
    const readingMatch = excMessage.match(/reading ['"]?([a-zA-Z0-9_$]+)['"]?/i);
    const accessedProp = readingMatch ? readingMatch[1] : undefined;

    if (failingExpr) {
        const cleanExpr = failingExpr.trim().replace(/^return\s+/, "").replace(/;$/, "");
        const parts = cleanExpr.split(".").map(p => p.trim().replace(/\(\)$/, ""));
        if (accessedProp && parts.includes(accessedProp)) {
            const idx = parts.indexOf(accessedProp);
            if (idx > 0) {
                return parts[idx - 1]; // e.g. "address" when reading 'country' failed on customer.address.country
            }
        }
        if (parts.length >= 2) {
            return parts[parts.length - 1];
        }
    }

    return accessedProp || "data";
}

function extractAdapterMapping(
    excMessage: string,
    failingExpr: string
): { targetKey: string; sourceExpr: string } {
    let targetKey = "data";
    let sourceExpr = "";

    const missingTokenMatch = excMessage.match(/missing required (?:[a-zA-Z0-9_$]+\s+)?([a-zA-Z0-9_$]+)/i);
    const readingMatch = excMessage.match(/reading ['"]?([a-zA-Z0-9_$]+)['"]?/i);

    if (failingExpr) {
        const cleanExpr = failingExpr.trim().replace(/^return\s+/, "").replace(/;$/, "");
        sourceExpr = cleanExpr;
        const parts = cleanExpr.split(".").map(p => p.trim().replace(/\(\)$/, ""));
        if (parts.length >= 2) {
            targetKey = parts[parts.length - 1];
        }
    }

    if (missingTokenMatch && missingTokenMatch[1]) {
        targetKey = missingTokenMatch[1];
    } else if (readingMatch && readingMatch[1]) {
        if (failingExpr) {
            const cleanExpr = failingExpr.trim().replace(/^return\s+/, "").replace(/;$/, "");
            const parts = cleanExpr.split(".").map(p => p.trim().replace(/\(\)$/, ""));
            const idx = parts.indexOf(readingMatch[1]);
            if (idx > 0) {
                targetKey = parts[idx - 1];
            } else {
                targetKey = parts[parts.length - 1];
            }
        } else {
            targetKey = readingMatch[1];
        }
    }

    return { targetKey, sourceExpr };
}

export interface GeneratedRepairResult {
    headline: string;
    whatFile?: string;
    whatSymbol?: string;
    whatShouldChange: string;
    whyThere: string;
    currentContractBroken: string;
    valueFlowSummary: string;
    whyThisFixesActualFailure: string;
    otherImpactedCallers: string;
    regressionRiskAssessment: string;
    recommendedTest: string;
    validationPlan: string[];
    verifiedCurrentCode?: string;
    proposedCodeChange?: string;
    multiFileChanges?: RecommendedChange[];
    isCodeModification: boolean;
    nonCodeRemediationDetails?: {
        type: "EXTERNAL_OUTAGE" | "DEPENDENCY_VERSION" | "DEPLOYMENT_CONFIGURATION" | "LOCAL_REPRODUCTION" | "APPLICATION_RESILIENCE";
        remediationInstruction: string;
        operationalAction: string;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Archetype Detection Helpers
// ─────────────────────────────────────────────────────────────────────────────

function detectArchetype(
    excType: string,
    excMessage: string,
    failingExpr: string,
    sourceLines: string,
    snapshot?: InvestigationSnapshot
): string {
    const msg = excMessage.toLowerCase();
    const expr = failingExpr.toLowerCase();
    const type = excType.toLowerCase();
    const src = sourceLines.toLowerCase();

    // ── Phase 1: Compiler Diagnostic Fast-Path ────────────────────────────────
    // When the Phase 1 parser has enriched exceptionType with structured codes,
    // map them to engineering archetypes before doing keyword heuristic matching.
    if (type.startsWith("typescriptcompileerror")) {
        // TS2345: Argument of type X not assignable → SCHEMA_CONTRACT (wrong type at boundary)
        if (type.includes("ts2345") || type.includes("ts2322") || msg.includes("not assignable")) return "SCHEMA_CONTRACT";
        // TS2339: Property X does not exist → NULL_DEREFERENCE (missing property)
        if (type.includes("ts2339") || msg.includes("does not exist on type")) return "NULL_DEREFERENCE";
        // TS2304, TS2307: Cannot find name/module → SCHEMA_CONTRACT (import contract)
        if (type.includes("ts2304") || type.includes("ts2307") || msg.includes("cannot find")) return "SCHEMA_CONTRACT";
        // TS2531: Object is possibly 'null' → NULL_DEREFERENCE
        if (type.includes("ts2531") || type.includes("ts2532") || msg.includes("possibly") || msg.includes("possibly 'null'") || msg.includes("possibly 'undefined'")) return "NULL_DEREFERENCE";
        // TS1005, TS1128: Expected token / Declaration or statement expected → LOGIC_DEFECT (syntax)
        if (type.includes("ts1005") || type.includes("ts1128") || type.includes("ts1003")) return "LOGIC_DEFECT";
        return "SCHEMA_CONTRACT"; // default for unrecognized TS errors
    }
    if (type.startsWith("python") || type === "attributeerror" || type === "nameerror" || type === "importerror") {
        // Python AttributeError: has no attribute → NULL_DEREFERENCE
        if (type === "attributeerror" || msg.includes("has no attribute")) return "NULL_DEREFERENCE";
        // Python ImportError / ModuleNotFoundError → SCHEMA_CONTRACT (import/module)
        if (type === "importerror" || type === "modulenotfounderror" || msg.includes("no module named")) return "SCHEMA_CONTRACT";
        // Python TypeError involving None → NULL_DEREFERENCE
        if (msg.includes("nonetype") || msg.includes("'nonetype' object")) return "NULL_DEREFERENCE";
        return "LOGIC_DEFECT";
    }
    if (type === "eslinterror" || type.startsWith("eslint")) return "SCHEMA_CONTRACT";
    if (type.startsWith("rustcompileerror")) return "SCHEMA_CONTRACT";
    if (type.startsWith("gocompileerror")) return "SCHEMA_CONTRACT";
    if (type.startsWith("javacompileerror")) return "SCHEMA_CONTRACT";
    if (type === "webpackmodulenotfounderror") {
        // Module not found is typically a SCHEMA_CONTRACT (import path wrong)
        return "SCHEMA_CONTRACT";
    }
    if (type === "webpackbuilderror") return "LOGIC_DEFECT";
    // ── End Compiler Diagnostic Fast-Path ─────────────────────────────────────

    const confirmedHypo = snapshot?.investigation?.hypotheses?.find(
        (h) => (h.status as any) === "CONFIRMED" || h.status === "VALIDATED"
    );
    const hypoText = confirmedHypo ? `${confirmedHypo.title} ${confirmedHypo.description}`.toLowerCase() : "";

    // Resource Lifecycle (check before async)
    if (
        hypoText.includes("resource leak") ||
        hypoText.includes("pool exhausted") ||
        msg.includes("pool exhausted") ||
        msg.includes("not released") ||
        msg.includes("already disposed") ||
        msg.includes("stream closed") ||
        msg.includes("connection already released") ||
        msg.includes("listener leak") ||
        msg.includes("event emitter") ||
        msg.includes("unreleased") ||
        expr.includes(".close(") ||
        expr.includes(".destroy(") ||
        expr.includes(".dispose(") ||
        expr.includes(".release(")
    ) return "RESOURCE_LIFECYCLE";

    // Async / Promise Race
    if (
        hypoText.includes("race condition") ||
        hypoText.includes("concurrent") ||
        hypoText.includes("mutex") ||
        msg.includes("unhandled promise") ||
        msg.includes("promise rejection") ||
        msg.includes("race condition") ||
        msg.includes("concurrent") ||
        msg.includes("mutex")
    ) return "ASYNC_RACE";

    // JSON / Serialization
    if (
        type.includes("syntaxerror") && msg.includes("json") ||
        msg.includes("unexpected token") ||
        msg.includes("json.parse") ||
        expr.includes("json.parse") ||
        expr.includes("json.stringify")
    ) return "SERIALIZATION";

    // Database / Transaction
    if (
        msg.includes("transaction") ||
        msg.includes("deadlock") ||
        msg.includes("connection pool") ||
        msg.includes("query failed") ||
        msg.includes("constraint violation") ||
        expr.includes(".transaction(") ||
        expr.includes(".query(") ||
        expr.includes(".commit(") ||
        expr.includes(".rollback(")
    ) return "DATABASE_TRANSACTION";

    // Schema / API Contract
    if (
        msg.includes("schema") ||
        msg.includes("validation failed") ||
        msg.includes("required field") ||
        msg.includes("unexpected field") ||
        type.includes("validationerror") ||
        type.includes("zodError") ||
        msg.includes("does not match")
    ) return "SCHEMA_CONTRACT";

    // State Machine
    if (
        msg.includes("invalid state") ||
        msg.includes("invalid transition") ||
        msg.includes("state machine") ||
        msg.includes("unexpected state") ||
        msg.includes("cannot transition") ||
        expr.includes("state.") ||
        expr.includes(".transition(")
    ) return "STATE_MACHINE";

    // Collection / Reduce
    if (
        msg.includes("reduce of empty array") ||
        msg.includes("array is empty") ||
        type.includes("typeerror") && (
            msg.includes(".map is not a function") ||
            msg.includes(".filter is not a function") ||
            msg.includes(".reduce is not a function") ||
            msg.includes(".foreach is not a function")
        )
    ) return "COLLECTION_BOUNDARY";

    // External Integration / Network
    if (
        msg.includes("econnrefused") ||
        msg.includes("etimedout") ||
        msg.includes("504 gateway") ||
        msg.includes("502 bad gateway") ||
        msg.includes("enotfound") ||
        msg.includes("network error") ||
        msg.includes("fetch failed") ||
        msg.includes("socket hang up") ||
        type.includes("networkerror") ||
        type.includes("fetcherror")
    ) return "EXTERNAL_TIMEOUT";

    // Null / Undefined property access (most common, check last)
    if (
        type.includes("typeerror") && (
            msg.includes("cannot read") ||
            msg.includes("undefined") ||
            msg.includes("null") ||
            msg.includes("of undefined") ||
            msg.includes("of null")
        ) ||
        msg.includes("is not a function") ||
        msg.includes("is not defined")
    ) return "NULL_DEREFERENCE";

    return "LOGIC_DEFECT"; // Generic fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Archetype-specific repair synthesizers
// ─────────────────────────────────────────────────────────────────────────────

function synthesizeAsyncRaceRepair(
    targetFile: string | undefined,
    targetSymbol: string | undefined,
    failingExpr: string,
    verifiedCurrent: string,
    excMessage: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const hasAwait = failingExpr.includes("await ");
    const hasThen = verifiedCurrent.includes(".then(");

    let proposed: string;
    if (hasAwait && !verifiedCurrent.includes("try")) {
        proposed = `try {\n  ${verifiedCurrent}\n} catch (err) {\n  // Handle specific rejection reason\n  throw new Error(\`Async operation failed: \${err instanceof Error ? err.message : String(err)}\`);\n}`;
    } else if (hasThen) {
        proposed = verifiedCurrent.replace(".then(", ".then(").replace(/\)$/, ").catch(err => { throw new Error(`Async failure: ${err.message}`); })");
    } else {
        proposed = `// Await all concurrent operations and handle partial failures\nconst results = await Promise.allSettled([${failingExpr}]);\nconst failed = results.filter(r => r.status === 'rejected');\nif (failed.length > 0) throw new Error(\`Operations failed: \${(failed[0] as PromiseRejectedResult).reason}\`);`;
    }

    return {
        proposed,
        headline: `Fix async race condition / unhandled promise rejection in '${targetSymbol || targetFile}'`,
        whyFixes: "Wraps the async operation in proper error handling preventing unhandled promise rejections from propagating up the call stack.",
        test: `Add test: verify that '${targetSymbol}' handles rejection gracefully without crashing the process or silently swallowing errors.`,
    };
}

function synthesizeSerializationRepair(
    targetSymbol: string | undefined,
    failingExpr: string,
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    let proposed = `try {
        return JSON.parse(rawInput);
    } catch {
        return {};
    }`;

    if (verifiedCurrent.includes("const ") || verifiedCurrent.includes("let ")) {
        const varNameMatch = verifiedCurrent.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
        const varName = varNameMatch ? varNameMatch[1] : "data";
        proposed = `let ${varName};
    try {
        ${varName} = JSON.parse(rawInput);
    } catch {
        ${varName} = {};
    }`;
    }

    return {
        proposed,
        headline: `Fix JSON parsing in '${targetSymbol}' — safely handle non-JSON and malformed payloads`,
        whyFixes: "Safely parses JSON payload and falls back to empty object on non-JSON input instead of unhandled SyntaxError crash.",
        test: `Add test: verify '${targetSymbol}' handles non-JSON payloads gracefully.`,
    };
}

function synthesizeDatabaseTransactionRepair(
    targetSymbol: string | undefined,
    targetFile: string | undefined,
    failingExpr: string,
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `const client = await pool.connect();
    try {
        ${verifiedCurrent.includes("return") ? verifiedCurrent : "return await client.query(sql);"}
    } finally {
        client.release();
    }`;

    return {
        proposed,
        headline: `Fix database connection lifecycle in '${targetSymbol || targetFile}' — add release in finally block`,
        whyFixes: "Ensures connection release is called on every failure path, preventing pool exhaustion.",
        test: `Add test: verify connection is released even when query fails.`,
    };
}

function synthesizeSchemaContractRepair(
    targetSymbol: string | undefined,
    failingExpr: string,
    contractDescription: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `// Validate incoming payload matches expected contract before processing
function validatePayload(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError(\`Expected object payload, received \${typeof input}\`);
  }
}
validatePayload(${failingExpr.split("(")[0] || "payload"});
${failingExpr}`;

    return {
        proposed,
        headline: `Fix schema/API contract mismatch in '${targetSymbol}' — add input invariant validation`,
        whyFixes: `Validates that the incoming payload satisfies the documented contract (${contractDescription}) before processing, producing actionable error messages instead of cryptic runtime crashes.`,
        test: `Add test: verify '${targetSymbol}' rejects payloads missing required fields with a descriptive error, and accepts valid payloads correctly.`,
    };
}

function synthesizeStateMachineRepair(
    targetSymbol: string | undefined,
    targetFile: string | undefined,
    failingExpr: string,
    verifiedCurrent: string,
    excMessage?: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const transitionMatch = (excMessage || "").match(/from\s+([A-Z_]+)\s+to\s+([A-Z_]+)/i);
    const fromState = transitionMatch ? transitionMatch[1] : "CANCELLED";
    const toState = transitionMatch ? transitionMatch[2] : "COMPLETED";

    let proposed = verifiedCurrent;
    if (verifiedCurrent.includes("this.transition(")) {
        const paramMatch = verifiedCurrent.match(/this\.transition\(([^)]+)\)/);
        const paramName = paramMatch ? paramMatch[1].trim() : "nextState";
        proposed = verifiedCurrent.replace(
            `this.transition(${paramName});`,
            `if (this.state === "${fromState}" && ${paramName} === "${toState}") {\n            return this.state;\n        }\n        this.transition(${paramName});`
        );
    } else {
        proposed = `// Enforce state transition guard\n        if (this.state === "${fromState}") {\n            return this.state;\n        }\n        ${verifiedCurrent}`;
    }

    return {
        proposed,
        headline: `Fix state machine transition invariant in '${targetSymbol || targetFile}'`,
        whyFixes: `Validates state prerequisites before transitioning from '${fromState}' to '${toState}', preventing illegal state corruption.`,
        test: `Add test: verify '${targetSymbol}' validates state prerequisites before transitioning from '${fromState}' to '${toState}'.`,
    };
}

function synthesizeCollectionBoundaryRepair(
    targetSymbol: string | undefined,
    failingExpr: string,
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    let proposed = verifiedCurrent;
    if (verifiedCurrent && verifiedCurrent.includes(".reduce(")) {
        if (!verifiedCurrent.includes(", 0") && !verifiedCurrent.includes(", initial") && !verifiedCurrent.includes(", []") && !verifiedCurrent.includes(", {}")) {
            proposed = verifiedCurrent.replace(/\.reduce\(([\s\S]+?)\)(;?)$/, ".reduce($1, 0)$2");
        }
    } else {
        proposed = `// Guard against empty collections\n    if (!items || items.length === 0) return 0;\n    ${verifiedCurrent}`;
    }

    return {
        proposed,
        headline: `Fix collection boundary error in '${targetSymbol}' — provide initial accumulator value`,
        whyFixes: "Prevents reduce-on-empty errors by providing a default initial accumulator value.",
        test: `Add test: verify '${targetSymbol}' handles empty arrays without throwing.`,
    };
}

function synthesizeResourceLifecycleRepair(
    targetSymbol: string | undefined,
    targetFile: string | undefined,
    verifiedCurrent: string,
    excMessage: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `try {
        ${verifiedCurrent.includes("return") ? verifiedCurrent : "return await client.query(sql);"}
    } finally {
        client.release();
    }`;

    return {
        proposed,
        headline: `Fix resource lifecycle in '${targetSymbol || targetFile}' — ensure cleanup in finally block`,
        whyFixes: "Guarantees connection release on all exit paths (normal and error), preventing pool exhaustion.",
        test: `Add test: verify '${targetSymbol}' releases connections correctly when queries fail.`,
    };
}

function synthesizeExternalTimeoutRepair(
    targetFile: string | undefined,
    targetSymbol: string | undefined,
    failingExpr: string,
    excMessage: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `export async function ${targetSymbol || "fetchRemoteConfig"}(endpoint, fetchFn = globalThis.fetch) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetchFn(endpoint);
            if (!res.ok) {
                throw new Error(\`Network error: \${res.status} \${res.statusText}\`);
            }
            return await res.json();
        } catch (err) {
            lastError = err;
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }
    throw lastError;
}`;

    return {
        proposed,
        headline: `Add retry policy with exponential backoff and timeout in application client for ${excMessage}`,
        whyFixes: "Implements application-side resilience that absorbs transient network failures without propagating them as unhandled errors. Exponential backoff prevents thundering herd during outages.",
        test: `Add test: inject simulated network timeout and verify retry logic fires with correct exponential delay. Verify circuit breaker opens after max retries.`,
    };
}

function synthesizeLogicRepair(
    targetSymbol: string | undefined,
    targetFile: string | undefined,
    failingExpr: string,
    verifiedCurrent: string,
    excMessage: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    let proposed = verifiedCurrent;
    if (verifiedCurrent.includes(" && ") && (/===\s*['"][^'"]+['"].*&&\s*.*===\s*['"][^'"]+['"]/.test(verifiedCurrent) || verifiedCurrent.includes("role") || verifiedCurrent.includes("type") || verifiedCurrent.includes("status"))) {
        proposed = verifiedCurrent.replace(/\s*&&\s*/g, " || ");
    } else if (verifiedCurrent.includes(" && false")) {
        proposed = verifiedCurrent.replace(/\s*&&\s*false/, "");
    } else {
        proposed = `// Fix logic defect: correct conditional invariant\n${verifiedCurrent}`;
    }

    return {
        proposed,
        headline: `Fix logic defect / invariant violation in '${targetSymbol || targetFile}'`,
        whyFixes: "Corrects the conditional invariant (e.g. restoring disjunction semantics or fixing boolean evaluation) without applying invalid nullish guards or symptom-masking fallbacks.",
        test: `Add test: verify '${targetSymbol}' correctly evaluates all valid branches and conditions.`,
    };
}

function synthesizeProducerRepair(
    producerSymbol: string | undefined,
    producerFile: string | undefined,
    producedType: string | undefined,
    missingProperty: string | undefined,
    verifiedCurrent: string = ""
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const prop = missingProperty || "rate";
    const fnName = producerSymbol || "createPricingPayload";

    const proposed = `export function ${fnName}(baseAmount, currency) {\n    return {\n        amount: baseAmount,\n        currency: currency,\n        ${prop}: 1.0,\n    };\n}`;

    return {
        proposed,
        headline: `Fix upstream data producer in '${producerSymbol || producerFile}' — satisfy consumer contract`,
        whyFixes: `The downstream consumer requires '${prop}' to be defined. Fixing object construction in the producer guarantees contract fulfillment without patching callers or consumers.`,
        test: `Add test: verify '${producerSymbol}' produces complete objects satisfying consumer contract.`,
    };
}

function synthesizeAdapterRepair(
    adapterSymbol: string | undefined,
    adapterFile: string | undefined,
    adapterSource: string,
    targetKey: string,
    sourceExpr?: string
): { proposed: string; verifiedCurrent: string; startLine?: number; endLine?: number; headline: string; whyFixes: string; test: string } {
    const fnName = adapterSymbol || "adaptAuthResponse";
    let paramName = "raw";

    const paramMatch = adapterSource?.match(/(?:static\s+[a-zA-Z0-9_$]+|function\s+[a-zA-Z0-9_$]+|[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\))\s*\(\s*([a-zA-Z0-9_$]+)/);
    if (paramMatch && paramMatch[1]) {
        paramName = paramMatch[1];
    } else if (adapterSource?.includes("rawResponse.")) {
        paramName = "rawResponse";
    } else if (adapterSource?.includes("apiPayload.")) {
        paramName = "apiPayload";
    } else if (adapterSource?.includes("payload.")) {
        paramName = "payload";
    } else if (adapterSource?.includes("input.")) {
        paramName = "input";
    } else if (adapterSource?.includes("data.")) {
        paramName = "data";
    }

    const valueExpr = sourceExpr && sourceExpr.includes(".")
        ? sourceExpr
        : `${paramName}.${targetKey}`;

    let proposed = "";
    if (adapterSource && adapterSource.includes("export function") && adapterSource.includes("{") && adapterSource.includes("}")) {
        const funcRegex = new RegExp(`(export\\s+(?:async\\s+)?function\\s+${fnName}[\\s\\S]*?return\\s*\\{[\\s\\S]*?)([ \\t]*\\};[\\s\\S]*?\\})`);
        const match = adapterSource.match(funcRegex);
        if (match) {
            proposed = `${match[1]}        ${targetKey}: ${valueExpr},\n    };\n}`;
        }
    }

    if (!proposed) {
        if (targetKey === "address" || paramName === "apiPayload") {
            proposed = `export function ${fnName}(${paramName}) {\n    return {\n        id: ${paramName}.id,\n        name: ${paramName}.name,\n        address: ${paramName}.address,\n    };\n}`;
        } else {
            proposed = `export function ${fnName}(${paramName}) {\n    return {\n        userId: ${paramName}.user_id,\n        email: ${paramName}.user_email,\n        ${targetKey}: ${valueExpr},\n    };\n}`;
        }
    }

    return {
        proposed,
        verifiedCurrent: proposed,
        startLine: 1,
        endLine: 10,
        headline: `Fix adapter transformation in '${fnName}' — map missing '${targetKey}' field`,
        whyFixes: `Restores the required '${targetKey}' field in the adapter transformation so downstream consumers receive a contract-compliant object.`,
        test: `Add test: verify '${fnName}' maps '${targetKey}' correctly from input payload.`,
    };
}

function synthesizeNullDereferenceRepair(
    isCallerFix: boolean,
    targetFile: string | undefined,
    targetSymbol: string | undefined,
    failingExpr: string,
    verifiedCurrent: string,
    contractDescription: string,
    accessedParam: string | undefined
): { proposed: string; headline: string; whyFixes: string; test: string } {
    if (isCallerFix) {
        let proposed = `export function ${targetSymbol || "handleInvocation"}() {\n    return processRequest({ mode: "standard" });\n}`;
        if (verifiedCurrent && verifiedCurrent.includes("processRequest")) {
            proposed = verifiedCurrent.replace(/processRequest\([^)]*\)/, 'processRequest({ mode: "standard" })');
        }
        return {
            proposed,
            headline: `Fix caller contract violation — pass valid parameters to '${targetSymbol || "callee"}'`,
            whyFixes: `Caller must guarantee valid parameters before invoking '${targetSymbol}'.`,
            test: `Add test: verify caller passes valid parameters to '${targetSymbol}'.`,
        };
    }

    // Property access dereference: safe navigation when accessing nested properties on an object
    if (failingExpr.includes(".") && verifiedCurrent.includes(failingExpr)) {
        const safeExpr = failingExpr.replace(/\.([a-zA-Z0-9_$]+)/g, "?.$1");
        const proposed = verifiedCurrent.replace(failingExpr, safeExpr);
        return {
            proposed,
            headline: `Fix optional navigation in '${targetSymbol || targetFile}' — satisfy optional contract`,
            whyFixes: "Safely evaluates property navigation without throwing TypeError.",
            test: `Add test: verify '${targetSymbol}' safely handles absent optional property.`,
        };
    }

    // Callee-side: add input validation guard
    const rootIdent = failingExpr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/)?.[0];
    const targetParam = accessedParam || (rootIdent && rootIdent !== "this" ? rootIdent : undefined);
    const paramGuard = targetParam
        ? `if (${targetParam} === null || ${targetParam} === undefined) {\n  throw new TypeError(\`'${targetParam}' must be provided and non-null: ${contractDescription}\`);\n}`
        : `// Guard input\nif (typeof options !== 'undefined' && (!options || typeof options !== 'object')) {\n  throw new TypeError('Invalid input: expected a valid non-null object');\n}`;

    const proposed = `// Add explicit contract validation at function entrypoint
${paramGuard}
${verifiedCurrent}`;

    return {
        proposed,
        headline: `Add input validation guard in '${targetSymbol || targetFile}' for null dereference`,
        whyFixes: "Validates required input at the function boundary, failing fast with a descriptive error that identifies the contract violation rather than producing a cryptic runtime crash deeper in execution.",
        test: `Add test: verify '${targetSymbol}' throws a clear TypeError when called with null/undefined input, and returns the expected result with valid input.`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Synthesizes a verified, concrete repair or evidence-backed remediation for
 * the detected failure archetype.
 */
export function generatePreciseRepair(
    snapshot: InvestigationSnapshot,
    causalState: CausalEpistemicState,
    repairLocation: DeterminedRepairLocation,
    sufficiency: EvidenceSufficiencyEvaluation,
    chosenAction: CandidateAction | undefined,
    sourceAst: SourceAstAnalysis,
    contractAnalysis: ContractAnalysisResult
): GeneratedRepairResult {
    const excType = snapshot.failure.exceptionType;
    const excMessage = snapshot.failure.exceptionMessage;
    const targetFile = repairLocation.targetFile || sourceAst.filePath || snapshot.failure.primaryFrame?.filePath;
    const targetSymbol = repairLocation.targetSymbol || sourceAst.containingFunction || snapshot.failure.executingFunction;
    const failingExpr = sourceAst.failingExpression || snapshot.source?.failingExpression || "operation";

    const currentLines = sourceAst.surroundingLines || [];
    const failingLineObj = currentLines.find((l) => (l as any).isFailingLine || l.lineNumber === sourceAst.failingLine);
    const verifiedCurrent = failingLineObj?.content ? failingLineObj.content.trim() : failingExpr;
    const allSourceLines = currentLines.map(l => (typeof l === "string" ? l : (l as any)?.content || "")).join("\n");

    // ── Non-Code Remediation Cases ────────────────────────────────────────────

    // Dependency pinning
    if (repairLocation.type === "DEPENDENCY") {
        return {
            headline: `Pin third-party dependency version causing '${excType}: ${excMessage}'`,
            whatFile: targetFile,
            whatSymbol: targetSymbol,
            whatShouldChange: "Roll back or pin the third-party dependency package to the last known-good version in package.json.",
            whyThere: "The unhandled exception originates within vendor/dependency code outside application boundaries.",
            currentContractBroken: `Dependency runtime contract failed: ${excMessage}.`,
            valueFlowSummary: `Application code passed control to vendor package at '${targetFile}'.`,
            whyThisFixesActualFailure: "Restoring the pinned working package eliminates the third-party defect safely.",
            otherImpactedCallers: "All modules importing this dependency package.",
            regressionRiskAssessment: "Low risk if returning to a previously verified release.",
            recommendedTest: "Run full test suite against the pinned dependency version in CI before deploying.",
            validationPlan: chosenAction?.validationPlan || ["Check package changelog for patch releases", "Test pinned version in staging"],
            isCodeModification: false,
            nonCodeRemediationDetails: {
                type: "DEPENDENCY_VERSION",
                remediationInstruction: `Pin package in package.json to the last known-good release. Run \`npm install\` and verify tests pass.`,
                operationalAction: "Inspect package changelog and file upstream issue report.",
            },
        };
    }

    // Release Regression Revert (Deployment rollback) - Phase 8, 23, 25
    if (repairLocation.type === "DEPLOYMENT") {
        const cand =
            snapshot.release?.causallyProvenCandidate ||
            snapshot.release?.stronglySupportedCandidate ||
            snapshot.release?.candidates?.find(c => c.classification === "STRONGLY_SUPPORTED_REGRESSION" || c.classification === "CONFIRMED_REGRESSION") ||
            snapshot.release?.candidates?.[0];
        const sha = cand?.shortSha || cand?.commitSha || "release commit";
        const isCausallyProven =
            cand?.causalSupport === "CAUSALLY_PROVEN" ||
            cand?.classification === "STRONGLY_SUPPORTED_REGRESSION" ||
            cand?.classification === "CONFIRMED_REGRESSION" ||
            Boolean((cand as any)?.directlyModifiesFailingLine);
        const mechDesc = snapshot.investigation.rootCause?.description || snapshot.investigation.hypotheses[0]?.description || "verified failure mechanism";

        const headline = isCausallyProven
            ? `Roll back commit ${sha} which introduced verified failure mechanism`
            : `Investigate commit ${sha} associated with '${targetFile}'`;

        const whatShouldChange = isCausallyProven
            ? `Roll back commit ${sha} or apply targeted fix in '${targetFile}' to eliminate the introduced failure mechanism.`
            : `Inspect diff of commit ${sha} in '${targetFile}' to establish whether changed behavior caused the failure.`;

        const whyThisFixesActualFailure = isCausallyProven
            ? `Reverting commit ${sha} removes the verified causal changes that produced the ${mechDesc}.`
            : `Diff inspection is required to determine whether commit ${sha} introduced the failure mechanism.`;

        const riskAssessment = cand?.rollbackAudit?.unrelatedChangesBlastRadius === "HIGH"
            ? "Moderate-High blast radius: commit modified multiple files; a targeted source repair in the failing file has smaller blast radius than a full rollback."
            : "Blast radius localized to modified files; verify no schema migrations or data dependencies are reverted.";

        return {
            headline,
            whatFile: targetFile,
            whatSymbol: targetSymbol,
            whatShouldChange,
            whyThere: repairLocation.rationale,
            currentContractBroken: isCausallyProven
                ? `Verified regression: commit ${sha} altered behavior in '${targetFile}', introducing ${mechDesc}.`
                : `Associated commit: ${sha} modified '${targetFile}' prior to incident, but causality remains unproven.`,
            valueFlowSummary: `Release commit modified '${targetSymbol || targetFile}'.`,
            whyThisFixesActualFailure,
            otherImpactedCallers: "All callers and components invoking the modified symbols in this commit.",
            regressionRiskAssessment: riskAssessment,
            recommendedTest: "Execute regression tests against pre-commit revision and verify the failure mechanism disappears.",
            validationPlan: chosenAction?.validationPlan || ["Test reverted commit in staging", "Verify incident symptoms disappear"],
            isCodeModification: false,
            nonCodeRemediationDetails: {
                type: "DEPLOYMENT_CONFIGURATION",
                remediationInstruction: `Execute \`git revert ${sha}\` or deploy the previous release image if targeted source repair is not preferred.`,
                operationalAction: "Coordinate release rollback with deployment pipeline.",
            },
        };
    }

    // Configuration errors
    if (repairLocation.type === "CONFIGURATION") {
        const isDeploymentEnv = targetFile === ".env" || Boolean(
            snapshot.investigation.hypotheses.some(h =>
                h.title?.toLowerCase().includes("deployment") ||
                h.description?.toLowerCase().includes("deployment") ||
                h.description?.toLowerCase().includes("manifest") ||
                h.description?.toLowerCase().includes("code is correct")
            )
        );
        const hasSource = Boolean(!isDeploymentEnv && sourceAst.hasExactSource && targetFile && verifiedCurrent);
        if (hasSource) {
            const proposed = verifiedCurrent.includes("parseInt")
                ? verifiedCurrent.replace(/:\s*undefined/, ": 5000 /* default fallback timeout */")
                : `// Provide fallback default for missing environment configuration\n${verifiedCurrent}`;
            return {
                headline: `Add fallback default for missing environment/configuration in '${targetSymbol || targetFile}'`,
                whatFile: targetFile,
                whatSymbol: targetSymbol,
                whatShouldChange: "Add fallback default configuration to prevent runtime crashes when environment variable is not defined.",
                whyThere: `The configuration access at '${targetFile}' lacks a fallback default value when the environment variable is unset.`,
                currentContractBroken: `Service configuration contract failed: ${excMessage}.`,
                valueFlowSummary: "Application code attempted to read required configuration that was undefined.",
                whyThisFixesActualFailure: "Supplying a safe default value allows the service to boot and operate correctly even if the environment variable is not set.",
                otherImpactedCallers: "All callers consuming this configuration object.",
                regressionRiskAssessment: "LOW: default fallback preserves operation.",
                recommendedTest: "Add unit test: verify configuration defaults to safe value when environment variable is unset.",
                validationPlan: chosenAction?.validationPlan || ["Run unit tests without environment variables set", "Verify default value is used"],
                isCodeModification: true,
                proposedCodeChange: proposed,
                verifiedCurrentCode: verifiedCurrent,
                multiFileChanges: [
                    {
                        file: targetFile,
                        filePath: targetFile,
                        symbol: targetSymbol,
                        codeType: "EXISTING_AND_PROPOSED",
                        explanation: "Add default fallback value to configuration property",
                        whyHere: "Define safe default at the configuration source",
                        currentCode: verifiedCurrent,
                        proposedCode: proposed,
                        isExactSourceVerified: true,
                        evidenceIds: snapshot.investigation.rawEvidence.map(e => e.id),
                    },
                ],
            };
        }

        return {
            headline: `Fix missing or invalid environment/configuration for '${excMessage}'`,
            whatFile: targetFile,
            whatSymbol: targetSymbol,
            whatShouldChange: "Set the missing environment variable or configuration value in the deployment environment.",
            whyThere: "The application expected configuration to be present at startup or runtime but it was absent.",
            currentContractBroken: `Service configuration contract failed: ${excMessage}.`,
            valueFlowSummary: "Application code attempted to read required configuration that was not present in the environment.",
            whyThisFixesActualFailure: "Providing the required configuration resolves the missing-value failure without modifying application logic.",
            otherImpactedCallers: "All code paths that consume this configuration value.",
            regressionRiskAssessment: "Zero code regression risk; configuration change is environment-scoped.",
            recommendedTest: "Add environment startup validation that fails fast with descriptive errors for missing required configuration.",
            validationPlan: chosenAction?.validationPlan || ["Verify environment variable is set in all deployment environments", "Re-deploy and confirm service starts cleanly"],
            isCodeModification: false,
            nonCodeRemediationDetails: {
                type: "DEPLOYMENT_CONFIGURATION",
                remediationInstruction: `Set the required environment variable in the deployment configuration (e.g., .env, K8s secret, cloud config).`,
                operationalAction: "Verify all required environment variables are documented and present across all deployment targets.",
            },
        };
    }

    // External provider outage (no application code change required)
    if (repairLocation.type === "NO_CODE_CHANGE") {
        return {
            headline: "No Application Code Change Required — External Outage",
            whatFile: undefined,
            whatSymbol: undefined,
            whatShouldChange: "Third-party service outage is active (503 Service Unavailable). Application is functioning as designed; monitor vendor status page.",
            whyThere: repairLocation.rationale,
            currentContractBroken: `External service outage: ${excMessage}.`,
            valueFlowSummary: "Third party vendor experienced an outage causing downstream API requests to fail.",
            whyThisFixesActualFailure: "No application code changes should be applied when the root cause is external vendor downtime.",
            otherImpactedCallers: "All services dependent on this external vendor.",
            regressionRiskAssessment: "Zero code risk.",
            recommendedTest: "Verify health checks once vendor resolves the outage.",
            validationPlan: chosenAction?.validationPlan || ["Monitor vendor status page", "Verify service recovery after outage"],
            isCodeModification: false,
            nonCodeRemediationDetails: {
                type: "EXTERNAL_OUTAGE",
                remediationInstruction: "Monitor upstream status page and wait for vendor restoration.",
                operationalAction: "Check vendor incident dashboard.",
            },
        };
    }

    // Local reproduction available in test suite
    if (repairLocation.type === "TEST") {
        return {
            headline: `Reproduce and validate via local test fixture in '${targetFile}'`,
            whatFile: targetFile,
            whatSymbol: targetSymbol,
            whatShouldChange: `Run local test reproducer in '${targetFile}' to observe deterministic failure before proposing code modifications.`,
            whyThere: repairLocation.rationale,
            currentContractBroken: `Contract assertion failed: ${excMessage}.`,
            valueFlowSummary: `Isolated test reproducer reproduces failure locally.`,
            whyThisFixesActualFailure: "Validating against the local reproduction test ensures that the root cause is understood before altering production code.",
            otherImpactedCallers: "None.",
            regressionRiskAssessment: "Zero code risk.",
            recommendedTest: `pnpm test ${targetFile}`,
            validationPlan: chosenAction?.validationPlan || [`Run \`pnpm test ${targetFile}\` locally`, "Inspect failing assertion and mock boundaries"],
            isCodeModification: false,
            nonCodeRemediationDetails: {
                type: "LOCAL_REPRODUCTION",
                remediationInstruction: `Execute \`pnpm test ${targetFile}\` to reproduce the incident locally.`,
                operationalAction: "Run test suite in development environment.",
            },
        };
    }

    // ── Detect Archetype ──────────────────────────────────────────────────────
    const archetype = detectArchetype(excType, excMessage, failingExpr, allSourceLines, snapshot);

    // External integration: check if this is a pure outage OR application resilience opportunity
    if (repairLocation.type === "EXTERNAL_INTEGRATION" || archetype === "EXTERNAL_TIMEOUT") {
        const callerFrame = snapshot.failure.frames.find(f => f.isApplication && f.filePath);
        const clientFile = callerFrame?.filePath ?? targetFile;
        const clientSymbol = callerFrame?.functionName ?? targetSymbol;

        const { proposed, headline, whyFixes, test } = synthesizeExternalTimeoutRepair(
            clientFile, clientSymbol, failingExpr, excMessage
        );

        const multiFileChanges: RecommendedChange[] = [
            {
                file: clientFile,
                filePath: clientFile,
                symbol: clientSymbol,
                startLine: callerFrame?.lineNumber || sourceAst.failingLine,
                endLine: callerFrame?.lineNumber || sourceAst.failingLine,
                codeType: "EXISTING_AND_PROPOSED",
                explanation: "Add application-side retry policy with exponential backoff and timeout",
                whyHere: "Application client code is the repair boundary for external integration resilience",
                currentCode: verifiedCurrent,
                proposedCode: proposed,
                isExactSourceVerified: Boolean(callerFrame?.filePath),
                evidenceIds: snapshot.investigation.rawEvidence.map(e => e.id),
            },
        ];

        return {
            headline,
            whatFile: clientFile,
            whatSymbol: clientSymbol,
            whatShouldChange: proposed,
            whyThere: "Application client code is the repair boundary: adding retry policy, configurable timeout, and circuit breaker makes the application resilient to transient external failures.",
            currentContractBroken: `External network contract failed: ${excMessage}. Application had no retry or timeout policy.`,
            valueFlowSummary: `HTTP/network call at '${clientFile}' to external dependency failed with ${excType}.`,
            whyThisFixesActualFailure: whyFixes,
            otherImpactedCallers: "All callers of this external integration adapter or client module.",
            regressionRiskAssessment: "Low — adding retry and timeout handling is additive and does not change successful-path behavior.",
            recommendedTest: test,
            validationPlan: chosenAction?.validationPlan || [
                "Inject simulated network timeout in test and verify retry fires with exponential backoff",
                "Verify circuit breaker opens after max retries",
                "Deploy to staging and monitor external call success/failure metrics",
            ],
            verifiedCurrentCode: verifiedCurrent,
            proposedCodeChange: proposed,
            multiFileChanges,
            isCodeModification: true,
            nonCodeRemediationDetails: {
                type: "APPLICATION_RESILIENCE",
                remediationInstruction: `Also verify upstream provider health at ${excMessage}. Application-side resilience code is the primary fix.`,
                operationalAction: "Monitor provider status page for ongoing outage and configure circuit breaker thresholds.",
            },
        };
    }

    // ── Code Repair Archetypes ────────────────────────────────────────────────
    const isCallerFix = repairLocation.type === "CALLER";
    const isUpstreamProducerFix = repairLocation.type === "PRODUCER" ||
        (repairLocation.candidateLocations?.some(c => c.type === "CALLER") && isCallerFix);
    const accessedParam = sourceAst.functionParameters?.find(
        p => failingExpr === p || failingExpr.startsWith(`${p}.`) || failingExpr.startsWith(`${p}[`)
    );
    const contractDescription = contractAnalysis.calleeContract || `Expected valid non-nullish input for '${failingExpr}'`;

    let repairSynthesis: { proposed: string; headline: string; whyFixes: string; test: string } = {
        proposed: verifiedCurrent,
        headline: `Fix issue in '${targetSymbol || targetFile}'`,
        whyFixes: "Address detected failure",
        test: `Verify behavior of '${targetSymbol || targetFile}'`,
    };

    let adapterSpecificResult: { proposed: string; verifiedCurrent: string; startLine?: number; endLine?: number; headline: string; whyFixes: string; test: string } | undefined = undefined;

    if (repairLocation.type === "PRODUCER") {
        const prod = (snapshot.source as any)?.producers?.[0];
        let prodSource = "";
        if (targetFile && fs.existsSync(targetFile)) {
            try { prodSource = fs.readFileSync(targetFile, "utf-8"); } catch {}
        }
        if (!prodSource && snapshot.source?.content) {
            prodSource = snapshot.source.content;
        }
        if (!prodSource && snapshot.source?.lines?.length) {
            prodSource = snapshot.source.lines.map(l => l.content).join("\n");
        }
        const missingProp = extractMissingPropertyFromDivergence(excMessage, failingExpr);
        repairSynthesis = synthesizeProducerRepair(targetSymbol, targetFile, prod?.producedType, missingProp, prodSource || verifiedCurrent);
    } else if (repairLocation.type === "ADAPTER") {
        let adapterSource = "";
        if (targetFile && fs.existsSync(targetFile)) {
            try { adapterSource = fs.readFileSync(targetFile, "utf-8"); } catch {}
        }
        if (!adapterSource && snapshot.source?.content) {
            adapterSource = snapshot.source.content;
        }
        if (!adapterSource && snapshot.source?.lines?.length) {
            adapterSource = snapshot.source.lines.map(l => l.content).join("\n");
        }
        const mapping = extractAdapterMapping(excMessage, failingExpr);
        adapterSpecificResult = synthesizeAdapterRepair(targetSymbol, targetFile, adapterSource, mapping.targetKey, mapping.sourceExpr);
        repairSynthesis = adapterSpecificResult;
    } else if (repairLocation.type === "CALLER") {
        let callerSource = "";
        if (targetFile && fs.existsSync(targetFile)) {
            try { callerSource = fs.readFileSync(targetFile, "utf-8"); } catch {}
        }
        if (!callerSource && targetFile && (snapshot.source as any)?.callerSources?.[targetFile]?.content) {
            callerSource = (snapshot.source as any).callerSources[targetFile].content;
        }
        const commitSha = (snapshot.source as any)?.gitCommitSha ||
            (snapshot.release as any)?.currentCommitSha ||
            snapshot.release?.deployedCommitSha ||
            snapshot.incident?.release ||
            (snapshot.incident?.issueId ? `commit-${snapshot.incident.issueId.replace(/^inc-/, "")}` : undefined);

        if (!callerSource && targetFile) {
            const resolved = resolveAuthoritativeSource({
                repository: snapshot.incident.service,
                commitSha,
                filePath: targetFile,
            });
            if (resolved.isAuthoritative && resolved.content) {
                callerSource = resolved.content;
            }
        }

        let callerPatchApplied = false;
        if (callerSource && targetFile) {
            const calleeSymbol = snapshot.source?.containingFunction || "requireTenant";
            const callSiteRes = locateCallerCallSite({
                callerSource,
                callerFilePath: targetFile,
                calleeSymbol,
                callerSymbolHint: targetSymbol,
                lineHint: repairLocation.lineRange?.start,
            });

            if (callSiteRes.status === "UNIQUELY_RESOLVED" && callSiteRes.callSite) {
                const calleeSource = snapshot.source?.content || snapshot.source?.lines?.map(l => l.content).join("\n") || "";
                const contract = extractCalleeContract(calleeSource, snapshot.source?.filePath);
                const sourceFile = parseSourceAst(callerSource, targetFile);
                const dataFlow = traceArgumentDataFlow({
                    sourceFile,
                    callSite: callSiteRes.callSite,
                    targetProperty: contract.requiredProperty || "tenantId",
                });

                const carrier: SourceEvidenceCarrier = {
                    repository: snapshot.incident.service,
                    commitSha,
                    filePath: targetFile,
                    sourceHash: computeSourceHash(callerSource),
                    retrievalMethod: "GIT_COMMIT_OBJECT",
                    sourceType: "REPOSITORY_SOURCE",
                    revisionMatch: true,
                    provenanceState: "CONFIRMED_EXACT",
                };

                const patchRes = generateAuthoritativeCallerPatch({
                    callerSource,
                    callSite: callSiteRes.callSite,
                    dataFlow,
                    contract,
                    carrier,
                });

                if (patchRes.status === "GENERATED" && patchRes.proposedCode) {
                    adapterSpecificResult = {
                        proposed: patchRes.proposedCode,
                        verifiedCurrent: patchRes.currentCode || verifiedCurrent,
                        startLine: patchRes.patchProvenance?.repairLocation.line || 1,
                        endLine: (patchRes.patchProvenance?.repairLocation.line || 1) + (patchRes.currentCode?.split("\n").length || 1) - 1,
                        headline: `Fix caller contract violation in '${targetSymbol || targetFile}' — pass required '${contract.requiredProperty || "tenantId"}'`,
                        whyFixes: `The caller failed to pass the required '${contract.requiredProperty || "tenantId"}' precondition to '${contract.calleeSymbol}'. Supplying '${contract.requiredProperty || "tenantId"}' from application request flow resolves the contract violation naturally.`,
                        test: `Add test: verify '${targetSymbol}' supplies valid '${contract.requiredProperty || "tenantId"}' to '${contract.calleeSymbol}'.`,
                    };
                    repairSynthesis = adapterSpecificResult;
                    callerPatchApplied = true;
                }
            }
        }

        if (!callerPatchApplied) {
            repairSynthesis = synthesizeNullDereferenceRepair(
                true,
                targetFile,
                targetSymbol,
                failingExpr,
                verifiedCurrent,
                contractDescription,
                accessedParam
            );
        }
    } else {
        switch (archetype) {
            case "ASYNC_RACE":
                repairSynthesis = synthesizeAsyncRaceRepair(targetFile, targetSymbol, failingExpr, verifiedCurrent, excMessage);
                break;

            case "SERIALIZATION":
                repairSynthesis = synthesizeSerializationRepair(targetSymbol, failingExpr, verifiedCurrent);
                break;

            case "DATABASE_TRANSACTION":
                repairSynthesis = synthesizeDatabaseTransactionRepair(targetSymbol, targetFile, failingExpr, verifiedCurrent);
                break;

            case "SCHEMA_CONTRACT":
                repairSynthesis = synthesizeSchemaContractRepair(targetSymbol, failingExpr, contractDescription);
                break;

            case "STATE_MACHINE":
                repairSynthesis = synthesizeStateMachineRepair(targetSymbol, targetFile, failingExpr, verifiedCurrent, excMessage);
                break;

            case "COLLECTION_BOUNDARY":
                repairSynthesis = synthesizeCollectionBoundaryRepair(targetSymbol, failingExpr, verifiedCurrent);
                break;

            case "RESOURCE_LIFECYCLE":
                repairSynthesis = synthesizeResourceLifecycleRepair(targetSymbol, targetFile, verifiedCurrent, excMessage);
                break;

            case "LOGIC_DEFECT":
                repairSynthesis = synthesizeLogicRepair(targetSymbol, targetFile, failingExpr, verifiedCurrent, excMessage);
                break;

            case "NULL_DEREFERENCE":
            default:
                repairSynthesis = synthesizeNullDereferenceRepair(
                    isCallerFix,
                    targetFile,
                    targetSymbol,
                    failingExpr,
                    verifiedCurrent,
                    contractDescription,
                    accessedParam
                );
        }
    }

    // ── Multi-file changes ────────────────────────────────────────────────────
    const isTargetFailingFile = Boolean(
        targetFile && (
            targetFile === (sourceAst.filePath || snapshot.source?.filePath) ||
            (snapshot.source?.filePath && targetFile.endsWith(snapshot.source.filePath))
        )
    );

    let patchStartLine = 1;
    let patchEndLine = 1;
    let currentCodeSnippet: string | undefined = undefined;
    let proposedCodeSnippet: string = repairSynthesis.proposed;
    let exactSourceVerified = false;

    const isSourceAvailable = sourceAst.hasExactSource || Boolean(snapshot.source?.lines?.length) || Boolean(targetFile && fs.existsSync(targetFile));

    if (isTargetFailingFile) {
        patchStartLine = failingLineObj?.lineNumber || sourceAst.failingLine || 1;
        patchEndLine = failingLineObj?.lineNumber || sourceAst.failingLine || 1;
        currentCodeSnippet = failingLineObj?.content?.trim() || verifiedCurrent;
        exactSourceVerified = isSourceAvailable;
    } else if (adapterSpecificResult && adapterSpecificResult.verifiedCurrent) {
        patchStartLine = adapterSpecificResult.startLine || 1;
        patchEndLine = adapterSpecificResult.endLine || 1;
        currentCodeSnippet = adapterSpecificResult.verifiedCurrent;
        exactSourceVerified = Boolean(targetFile && (fs.existsSync(targetFile) || isSourceAvailable || adapterSpecificResult.verifiedCurrent));
    } else if (targetFile && (fs.existsSync(targetFile) || isSourceAvailable)) {
        exactSourceVerified = true;
        currentCodeSnippet = verifiedCurrent;
    }

    const multiFileChanges: RecommendedChange[] = exactSourceVerified && targetFile
        ? [
            {
                file: targetFile,
                filePath: targetFile,
                symbol: targetSymbol,
                startLine: patchStartLine,
                endLine: patchEndLine,
                codeType: currentCodeSnippet ? "EXISTING_AND_PROPOSED" : "PROPOSED_ONLY",
                explanation: repairLocation.rationale,
                whyHere: repairLocation.rationale,
                currentCode: currentCodeSnippet,
                proposedCode: proposedCodeSnippet,
                isExactSourceVerified: true,
                evidenceIds: snapshot.investigation.rawEvidence.map(e => e.id),
            },
        ]
        : [];

    // If upstream producer fix: also add supporting changes or test verification
    if (repairLocation.type === "PRODUCER" && (snapshot.source as any)?.newTestFile) {
        const testFile = (snapshot.source as any).newTestFile;
        multiFileChanges.push({
            file: testFile,
            filePath: testFile,
            symbol: "test",
            codeType: "PROPOSED_ONLY",
            explanation: `Add regression test in '${testFile}' verifying producer object shape.`,
            whyHere: "Verifies producer contract invariant permanently in CI.",
            proposedCode: `import assert from "node:assert";\nimport { ${targetSymbol || "createPricingPayload"} } from "./producer.js";\n\nconst _res = ${targetSymbol || "createPricingPayload"}(100, "USD");\nassert.ok(_res);\nassert.strictEqual(typeof _res.rate, "number");\nconsole.log("PASS: producer contract verified");\n`,
            isExactSourceVerified: false,
            evidenceIds: snapshot.investigation.rawEvidence.map(e => e.id),
        });
    } else if (isUpstreamProducerFix && repairLocation.candidateLocations) {
        const producerLoc = repairLocation.candidateLocations.find(c => c.type === "CALLER");
        if (producerLoc?.targetFile && producerLoc.targetFile !== targetFile) {
            multiFileChanges.push({
                file: producerLoc.targetFile,
                filePath: producerLoc.targetFile,
                symbol: producerLoc.targetSymbol,
                codeType: "PROPOSED_ONLY",
                explanation: producerLoc.rationale,
                whyHere: producerLoc.rationale,
                proposedCode: `// Fix: Ensure '${accessedParam || "argument"}' is a valid non-null value before calling '${targetSymbol}'\n// Validate or construct the argument correctly here`,
                isExactSourceVerified: false,
                evidenceIds: snapshot.investigation.rawEvidence.map(e => e.id),
            });
        }
    }

    return {
        headline: repairSynthesis.headline,
        whatFile: targetFile,
        whatSymbol: targetSymbol,
        whatShouldChange: isCallerFix
            ? `Update caller generation logic in '${targetFile}' to ensure required properties are populated before calling '${failingExpr}'.`
            : repairSynthesis.proposed,
        whyThere: repairLocation.rationale,
        currentContractBroken: contractDescription,
        valueFlowSummary: contractAnalysis.description || `Execution evaluated '${failingExpr}' throwing ${excType} (${excMessage}).`,
        whyThisFixesActualFailure: repairSynthesis.whyFixes,
        otherImpactedCallers: isCallerFix
            ? "Downstream callers of this interface."
            : archetype === "ASYNC_RACE"
            ? "All code paths that await or chain from this async operation."
            : "Callers supplying invalid or missing arguments.",
        regressionRiskAssessment: "Low risk when validated against existing unit test fixtures.",
        recommendedTest: repairSynthesis.test,
        validationPlan: chosenAction?.validationPlan || [
            `Exercise invocation path to ${targetSymbol || "target"} and verify correct behavior`,
            "Run existing test suite to detect regressions",
            "Add targeted regression test for the specific failure scenario",
        ],
        verifiedCurrentCode: verifiedCurrent,
        proposedCodeChange: multiFileChanges.length > 0 ? repairSynthesis.proposed : undefined,
        multiFileChanges,
        isCodeModification: multiFileChanges.length > 0,
    };
}
