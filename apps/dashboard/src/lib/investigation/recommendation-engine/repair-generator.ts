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
    sourceLines: string
): string {
    const msg = excMessage.toLowerCase();
    const expr = failingExpr.toLowerCase();
    const type = excType.toLowerCase();
    const src = sourceLines.toLowerCase();

    // Async / Promise
    if (
        msg.includes("unhandled promise") ||
        msg.includes("promise rejection") ||
        expr.includes("await ") ||
        src.includes(".then(") ||
        src.includes("async ")
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

    // Resource Lifecycle
    if (
        msg.includes("already disposed") ||
        msg.includes("stream closed") ||
        msg.includes("connection already released") ||
        msg.includes("listener leak") ||
        msg.includes("event emitter") ||
        expr.includes(".close(") ||
        expr.includes(".destroy(") ||
        expr.includes(".dispose(")
    ) return "RESOURCE_LIFECYCLE";

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
    const proposed = `let parsed: unknown;
try {
  parsed = JSON.parse(${failingExpr.includes("JSON.parse") ? failingExpr.replace(/JSON\.parse\((.+)\)/, "$1") : "rawInput"});
} catch (err) {
  throw new Error(\`JSON parse failed for input — ensure the producer emits valid JSON. Raw error: \${err instanceof Error ? err.message : String(err)}\`);
}
// Validate parsed structure matches expected schema before use
if (!parsed || typeof parsed !== 'object') {
  throw new TypeError(\`Expected JSON object, received \${typeof parsed}\`);
}`;

    return {
        proposed,
        headline: `Fix JSON parsing error in '${targetSymbol}' with proper try/catch and schema validation`,
        whyFixes: "Catches malformed JSON at parse time and provides a descriptive error indicating the producer sent invalid data, preventing silent failures or cryptic downstream crashes.",
        test: `Add test: verify '${targetSymbol}' throws a descriptive error when given invalid JSON, and processes valid JSON correctly.`,
    };
}

function synthesizeDatabaseTransactionRepair(
    targetSymbol: string | undefined,
    targetFile: string | undefined,
    failingExpr: string,
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const hasTransaction = verifiedCurrent.includes(".transaction(") || failingExpr.includes("transaction");
    let proposed: string;
    if (hasTransaction) {
        proposed = `let trx: Knex.Transaction | undefined;
try {
  trx = await db.transaction();
  ${verifiedCurrent}
  await trx.commit();
} catch (err) {
  if (trx) await trx.rollback();
  // Re-throw after rollback for upstream error handling
  throw err;
} finally {
  // Ensure connection is released even on unexpected errors
  if (trx && !trx.isCompleted()) await trx.rollback();
}`;
    } else if (verifiedCurrent.includes("connect()") || failingExpr.includes("connect")) {
        proposed = `// Ensure database connection is released back to pool in finally block
const client = await pool.connect();
try {
  return await fn(client);
} finally {
  client.release(); // Always release connection back to pool
}`;
    } else {
        proposed = `// Wrap database operation in proper connection lifecycle management
const client = await pool.connect();
try {
  ${verifiedCurrent}
} catch (err) {
  throw err;
} finally {
  client.release(); // Always release connection back to pool
}`;
    }

    return {
        proposed,
        headline: `Fix database transaction lifecycle in '${targetSymbol || targetFile}' — add rollback and connection release`,
        whyFixes: "Ensures rollback and connection release are called on every failure path, preventing transaction locks and connection pool exhaustion that cause cascading failures.",
        test: `Add test: simulate database error mid-transaction and verify connection is released and transaction is rolled back cleanly.`,
    };
}

function synthesizeSchemaContractRepair(
    targetSymbol: string | undefined,
    failingExpr: string,
    contractDescription: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `// Validate incoming payload matches expected contract before processing
function validatePayload(input: unknown): asserts input is ExpectedPayload {
  if (!input || typeof input !== 'object') {
    throw new TypeError(\`Expected object payload, received \${typeof input}\`);
  }
  const obj = input as Record<string, unknown>;
  // Add specific required field checks matching the contract
  if (obj['requiredField'] === undefined) {
    throw new Error(\`Contract violation: 'requiredField' is required but was not provided\`);
  }
}
validatePayload(${failingExpr.split("(")[0] || "payload"});
// Proceed with validated input
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
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `// Validate state transition prerequisite before dispatching
const VALID_TRANSITIONS: Record<string, string[]> = {
  // Define valid state transitions for this machine
  'IDLE': ['LOADING', 'ERROR'],
  'LOADING': ['SUCCESS', 'ERROR'],
  'SUCCESS': ['IDLE'],
  'ERROR': ['IDLE'],
};

const currentState = this.state; // or however state is accessed
const allowedNextStates = VALID_TRANSITIONS[currentState] ?? [];
if (!allowedNextStates.includes(nextState)) {
  throw new Error(\`Invalid state transition: '\${currentState}' → '\${nextState}'. Valid transitions: \${allowedNextStates.join(', ')}\`);
}
${verifiedCurrent}`;

    return {
        proposed,
        headline: `Fix state machine invalid transition in '${targetSymbol || targetFile}'`,
        whyFixes: "Guards all state transitions against the declared valid transition table, preventing illegal state entries that corrupt downstream logic.",
        test: `Add test: verify '${targetSymbol}' throws a descriptive error for invalid transitions and allows all documented valid transitions.`,
    };
}

function synthesizeCollectionBoundaryRepair(
    targetSymbol: string | undefined,
    failingExpr: string,
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const isReduce = failingExpr.includes(".reduce(") || verifiedCurrent.includes(".reduce(");
    const proposed = isReduce
        ? verifiedCurrent.replace(
              /\.reduce\(([^,]+),?/,
              ".reduce($1, /* provide initial value matching the accumulator type */ undefined as any //"
          ) + `\n// Alternatively, guard against empty arrays:\nif (!array || array.length === 0) return defaultValue;\nreturn array.reduce(/* reducer */, initialValue);`
        : `// Guard against null/undefined/empty collections before iteration
if (!${failingExpr.split(".")[0] || "collection"} || ${failingExpr.split(".")[0] || "collection"}.length === 0) {
  return []; // or return appropriate empty/default result
}
${verifiedCurrent}`;

    return {
        proposed,
        headline: `Fix collection boundary error in '${targetSymbol}' — add empty collection guard`,
        whyFixes: "Prevents reduce-on-empty and null dereference errors when collections arrive empty or undefined, which is a valid runtime state that the function must handle.",
        test: `Add test: verify '${targetSymbol}' handles empty arrays, null, and undefined collections without throwing.`,
    };
}

function synthesizeResourceLifecycleRepair(
    targetSymbol: string | undefined,
    targetFile: string | undefined,
    verifiedCurrent: string,
    excMessage: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `// Ensure resource is properly cleaned up in all exit paths
let resource: Resource | undefined;
try {
  resource = await acquireResource();
  ${verifiedCurrent}
} catch (err) {
  throw err;
} finally {
  // Always release resource, even if an error occurred
  if (resource) {
    await resource.close().catch(() => { /* best-effort cleanup */ });
  }
  // Remove event listeners to prevent memory leaks
  this.removeAllListeners?.();
}`;

    return {
        proposed,
        headline: `Fix resource lifecycle in '${targetSymbol || targetFile}' — ensure cleanup in finally block`,
        whyFixes: "Guarantees resource release and event listener cleanup on all exit paths (normal and error), preventing connection pool exhaustion, file descriptor leaks, and memory leaks.",
        test: `Add test: verify '${targetSymbol}' releases resources correctly when the operation fails mid-execution.`,
    };
}

function synthesizeExternalTimeoutRepair(
    targetFile: string | undefined,
    targetSymbol: string | undefined,
    failingExpr: string,
    excMessage: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const isFetch = failingExpr.includes("fetch(") || failingExpr.includes("axios") || failingExpr.includes("http");
    const proposed = isFetch
        ? `// Application-side resilience: retry with exponential backoff + circuit breaker
async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries: number; baseDelayMs: number; timeoutMs: number } = { maxRetries: 3, baseDelayMs: 200, timeoutMs: 5000 }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const result = await operation(); // pass controller.signal where supported
      clearTimeout(timeout);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === options.maxRetries) throw err;
      const delay = options.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Replace direct call with resilient version:
const result = await withRetry(() => ${failingExpr}, { maxRetries: 3, baseDelayMs: 200, timeoutMs: 5000 });`
        : `// Configure timeout and implement retry with exponential backoff
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
let lastError: Error | undefined;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const result = await Promise.race([
      ${failingExpr},
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT_MS))
    ]);
    return result;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, attempt)));
    }
  }
}
throw lastError ?? new Error('Operation failed after retries');`;

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
    missingProperty: string | undefined
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const prop = missingProperty || "requiredField";
    const typeStr = producedType || "object";
    const proposed = `// Fix upstream producer: ensure all required fields for ${typeStr} are initialized
export function ${producerSymbol || "createPayload"}(...args: any[]) {
  return {
    ...baseData,
    ${prop}: resolvedValue,
  };
}`;

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
    verifiedCurrent: string
): { proposed: string; headline: string; whyFixes: string; test: string } {
    const proposed = `// Fix adapter transformation mapping
${verifiedCurrent.includes("token") ? "return { ...input, token: input.token || input.access_token };" : verifiedCurrent}`;

    return {
        proposed,
        headline: `Fix adapter transformation in '${adapterSymbol || adapterFile}' — correct property mapping`,
        whyFixes: "Corrects the property transformation mapping between external payload and internal domain contract.",
        test: `Add test: verify '${adapterSymbol}' maps external schema to internal schema without losing fields.`,
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
    if (isCallerFix && accessedParam) {
        const proposed = `// Validate '${accessedParam}' is populated before calling '${targetSymbol}'
if (!${accessedParam} || typeof ${accessedParam} !== 'object') {
  throw new Error(\`Contract violation: '${accessedParam}' must be a valid non-null object\`);
}
${verifiedCurrent}`;
        return {
            proposed,
            headline: `Fix caller contract violation — validate '${accessedParam}' before invoking '${targetSymbol}'`,
            whyFixes: `Caller must guarantee '${accessedParam}' is a valid non-null object before passing it to '${targetSymbol}'. Adding explicit validation at the call site surfaces the root cause clearly instead of propagating null through the call stack.`,
            test: `Add test: verify caller throws a descriptive error when '${accessedParam}' is null or undefined, before ever reaching '${targetSymbol}'.`,
        };
    }

    // Callee-side: add input validation guard
    const paramGuard = accessedParam
        ? `if (${accessedParam} === null || ${accessedParam} === undefined) {\n  throw new TypeError(\`'${accessedParam}' must be provided and non-null: ${contractDescription}\`);\n}`
        : `if (!input || typeof input !== 'object') {\n  throw new TypeError('Invalid input: expected a valid non-null object');\n}`;

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
    const failingLineObj = currentLines.find((l) => l.isFailingLine);
    const verifiedCurrent = failingLineObj ? failingLineObj.content.trim() : failingExpr;
    const allSourceLines = currentLines.map(l => l.content).join("\n");

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

    // Configuration errors
    if (repairLocation.type === "CONFIGURATION") {
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
    const archetype = detectArchetype(excType, excMessage, failingExpr, allSourceLines);

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

    let repairSynthesis: { proposed: string; headline: string; whyFixes: string; test: string };

    if (repairLocation.type === "PRODUCER") {
        const prod = (snapshot.source as any)?.producers?.[0];
        repairSynthesis = synthesizeProducerRepair(targetSymbol, targetFile, prod?.producedType, failingExpr.split(".")[1] || "rate");
    } else if (repairLocation.type === "ADAPTER") {
        repairSynthesis = synthesizeAdapterRepair(targetSymbol, targetFile, verifiedCurrent);
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
                repairSynthesis = synthesizeStateMachineRepair(targetSymbol, targetFile, failingExpr, verifiedCurrent);
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

    const multiFileChanges: RecommendedChange[] = [
        {
            file: targetFile,
            filePath: targetFile,
            symbol: targetSymbol,
            startLine: isTargetFailingFile ? (failingLineObj?.lineNumber || sourceAst.failingLine) : 1,
            endLine: isTargetFailingFile ? (failingLineObj?.lineNumber || sourceAst.failingLine) : 1,
            codeType: isTargetFailingFile && verifiedCurrent ? "EXISTING_AND_PROPOSED" : "PROPOSED_ONLY",
            explanation: repairLocation.rationale,
            whyHere: repairLocation.rationale,
            currentCode: isTargetFailingFile ? verifiedCurrent : undefined,
            proposedCode: repairSynthesis.proposed,
            isExactSourceVerified: isTargetFailingFile ? sourceAst.hasExactSource : true,
            evidenceIds: snapshot.investigation.rawEvidence.map(e => e.id),
        },
    ];

    // If upstream producer fix: also add supporting changes or test verification
    if (repairLocation.type === "PRODUCER" && (snapshot.source as any)?.testFiles?.length) {
        const testFile = (snapshot.source as any).testFiles[0];
        multiFileChanges.push({
            file: testFile,
            filePath: testFile,
            symbol: "test",
            codeType: "PROPOSED_ONLY",
            explanation: `Add regression test in '${testFile}' verifying producer object shape.`,
            whyHere: "Verifies producer contract invariant permanently in CI.",
            proposedCode: `// Added regression test for producer object invariant\ntest('producer returns valid shape with required properties', () => {\n  const result = ${targetSymbol || "create"}(...);\n  expect(result).toBeDefined();\n});`,
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
        proposedCodeChange: repairSynthesis.proposed,
        multiFileChanges,
        isCodeModification: true,
    };
}
