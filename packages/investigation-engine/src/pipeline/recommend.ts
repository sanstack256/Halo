import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";
import type {
    Recommendation,
    RecommendationPriority,
    RecommendationKind,
    RecommendationEvidenceLink,
    RecommendationVerification,
    RecommendationPrevention,
    RecommendationCodePatch,
} from "../types/recommendation";

const MAX_RECOMMENDATIONS = 5;

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export function generateRecommendations(
    hypotheses: Hypothesis[],
    context: InvestigationContext,
): Recommendation[] {
    const leading = selectLeadingHypothesis(hypotheses);

    if (!leading) {
        return [buildInsufficientEvidenceRecommendation(context, [])];
    }

    const recs: Recommendation[] = [];

    // Primary recommendation derived from the leading hypothesis + evidence
    const primary = buildPrimaryRecommendation(leading, context, hypotheses);
    if (primary) {
        recs.push(primary);
    }

    // Secondary recommendations for contributing factors
    const secondaries = buildSecondaryRecommendations(leading, hypotheses, context);
    recs.push(...secondaries);

    // If primary is missing, emit insufficient-evidence
    if (recs.length === 0) {
        recs.push(buildInsufficientEvidenceRecommendation(context, leading.evidenceIds));
    }

    return rankAndLimit(deduplicate(recs));
}

/* -------------------------------------------------------------------------- */
/* Leading hypothesis selection                                                */
/* -------------------------------------------------------------------------- */

function selectLeadingHypothesis(hypotheses: Hypothesis[]): Hypothesis | undefined {
    return (
        hypotheses.find(h => h.status === "VALIDATED") ??
        hypotheses.find(h => h.status === "LEADING") ??
        hypotheses.find(h => h.status === "UNCERTAIN") ??
        hypotheses[0]
    );
}

/* -------------------------------------------------------------------------- */
/* Primary recommendation builder                                             */
/* -------------------------------------------------------------------------- */

function buildPrimaryRecommendation(
    leading: Hypothesis,
    context: InvestigationContext,
    allHypotheses: Hypothesis[],
): Recommendation | null {
    const id = leading.id;

    if (id.startsWith("cascading-failure:")) {
        return buildCascadingFailureRecommendation(leading, context);
    }
    if (id.startsWith("database-failure:")) {
        return buildDatabaseFailureRecommendation(leading, context);
    }
    if (id.startsWith("runtime-exception:")) {
        return buildRuntimeExceptionRecommendation(leading, context);
    }
    if (id.startsWith("network-protocol:")) {
        return buildNetworkProtocolRecommendation(leading, context);
    }
    if (id.startsWith("deployment:") || leading.title === "Deployment Regression") {
        return buildDeploymentRegressionRecommendation(leading, context);
    }
    if (id.startsWith("shared-dependency:") || leading.title === "Shared Dependency Failure") {
        return buildSharedDependencyRecommendation(leading, context);
    }
    if (id.startsWith("infrastructure:") || leading.title === "Infrastructure Failure") {
        return buildInfrastructureRecommendation(leading, context);
    }
    if (id.startsWith("security-incident:")) {
        return buildSecurityRecommendation(leading, context);
    }
    if (id.startsWith("resource-saturation:")) {
        return buildResourceSaturationRecommendation(leading, context);
    }
    if (id.startsWith("cross-service:") || leading.title === "Cross-Service Failure") {
        return buildCrossServiceRecommendation(leading, context);
    }

    // Generic fallback: derive from error evidence
    return buildGenericRecommendation(leading, context);
}

/* -------------------------------------------------------------------------- */
/* Cascading failure (upstream HTTP failure → client exception)               */
/* -------------------------------------------------------------------------- */

function buildCascadingFailureRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    // Find the upstream failed request in evidence
    const upstreamRequest = findFailedRequest(context, hypothesis.evidenceIds);
    const clientError = findAnchorError(context, hypothesis.evidenceIds);

    const endpoint = upstreamRequest?.resource ?? upstreamRequest?.operation?.split(" ").slice(1).join(" ") ?? null;
    const method = upstreamRequest?.operation?.split(" ")[0] ?? null;
    const status = upstreamRequest?.status ?? clientError?.status ?? null;
    const reqLabel = method && endpoint ? `${method} ${endpoint}` : endpoint ?? "the upstream endpoint";

    // Parse the property access from the client error
    const propMatch = /reading\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(clientError?.title ?? "");
    const prop = propMatch?.[1] ?? null;

    // Parse stack frame for code patch location
    const stackPatch = extractCodePatchFromStack(clientError);

    const evidenceChain: RecommendationEvidenceLink[] = [];
    if (upstreamRequest) {
        evidenceChain.push({
            evidenceId: upstreamRequest.id,
            evidenceType: upstreamRequest.type,
            role: "upstream-failure",
            excerpt: `${reqLabel} → HTTP ${status ?? "error"}`,
        });
    }
    if (clientError) {
        evidenceChain.push({
            evidenceId: clientError.id,
            evidenceType: clientError.type,
            role: "error-event",
            excerpt: clientError.title.slice(0, 120),
        });
    }
    if (stackPatch?.filePath) {
        evidenceChain.push({
            evidenceId: clientError?.id ?? hypothesis.evidenceIds[0] ?? "unknown",
            evidenceType: "ERROR",
            role: "stack-frame",
            excerpt: `${stackPatch.filePath}${stackPatch.lineRange ? `:${stackPatch.lineRange}` : ""}`,
        });
    }

    // Determine whether this is fix-able at client or requires server investigation
    const hasStackEvidence = Boolean(stackPatch?.filePath && prop);
    const canPatchClient = hasStackEvidence;

    // Build the code patch only from real stack evidence
    let codePatch: RecommendationCodePatch | undefined;
    if (canPatchClient && stackPatch && prop) {
        codePatch = {
            filePath: stackPatch.filePath,
            functionOrComponent: stackPatch.functionOrComponent,
            lineRange: stackPatch.lineRange,
            before: stackPatch.before || `// Response handler accesses \`${prop}\` without status check`,
            after: [
                `if (!response.ok) {`,
                `  // Handle error — do NOT access \`${prop}\` here`,
                `  throw new Error(\`Request failed with status \${response.status}\`);`,
                `}`,
                `const data = await response.json();`,
                `// \`${prop}\` is now safe to access`,
            ].join("\n"),
            explanation:
                `The response handler accessed \`${prop}\` without first verifying that the HTTP response ` +
                `succeeded (status 2xx). When \`${reqLabel}\` returned HTTP ${status ?? "non-2xx"}, the response body ` +
                `did not contain \`${prop}\`, producing the observed exception. Adding a status guard before ` +
                `accessing the response body prevents this dereference on error responses.`,
            sideEffects: `Callers of this handler must handle the thrown error or the function must propagate it up.`,
        };
    }

    const immediate = endpoint
        ? `Guard the response handler for \`${reqLabel}\` against non-2xx HTTP responses before accessing response properties.`
        : `Add HTTP status validation before accessing response body properties in the failing response handler.`;

    const rootCauseTechnical = endpoint && status != null
        ? `\`${reqLabel}\` returned HTTP ${status}. The response handler then accessed \`${prop ?? "response properties"}\` ` +
          `without checking \`response.ok\` first. When the upstream endpoint fails, the response body does not contain ` +
          `the expected payload, causing the property access to throw.`
        : `An upstream HTTP request failed and the response handler accessed properties on the failed response body ` +
          `without validating the HTTP status first.`;

    const verification: RecommendationVerification = {
        steps: [
            endpoint
                ? `Call \`${reqLabel}\` under conditions that reproduce the ${status ?? "error"} response.`
                : `Reproduce the failing HTTP request.`,
            `Verify the response handler catches the non-2xx status and does not proceed to access response properties.`,
            prop
                ? `Confirm the \`Cannot read properties of undefined (reading '${prop}')\` exception no longer occurs.`
                : `Confirm the client-side exception no longer occurs.`,
        ],
        expectedOutcome: `The application handles the upstream failure gracefully without throwing a client-side exception.`,
        regressionTest: endpoint
            ? `Add a unit test that mocks \`${reqLabel}\` to return HTTP ${status ?? "500"} and asserts the handler does not throw.`
            : undefined,
    };

    const prevention: RecommendationPrevention = {
        items: [
            endpoint
                ? `Add an integration test asserting correct error handling when \`${endpoint}\` returns a non-2xx status.`
                : `Add tests for non-2xx response handling in all HTTP response handlers.`,
            `Enforce \`response.ok\` checks via a shared fetch wrapper or linting rule.`,
            prop ? `Enable TypeScript \`strictNullChecks\` to surface unchecked property access at compile time.` : `Enable TypeScript strict mode.`,
        ],
        monitoring: endpoint
            ? `Configure an alert for \`${endpoint}\` error rate exceeding threshold (recommended: > 1% over 5 minutes).`
            : undefined,
    };

    return {
        id: `fix:cascading:${normalizeId(hypothesis.id)}`,
        title: `Guard response handler against HTTP ${status ?? "error"} from ${reqLabel}`,
        description: rootCauseTechnical,
        priority: "HIGH",
        confidence: hypothesis.confidence,
        evidenceIds: hypothesis.evidenceIds,
        kind: canPatchClient ? "exact-code-fix" : "investigation-required",
        immediateAction: immediate,
        rootCauseTechnical,
        codePatch,
        evidenceChain,
        verification,
        prevention,
        ...(!canPatchClient && {
            unknowns: {
                whatHaloKnows: [
                    endpoint ? `\`${reqLabel}\` returned HTTP ${status ?? "non-2xx"} immediately before the client exception.` : `An upstream HTTP request failed.`,
                    clientError ? `Client exception: \`${clientError.title.slice(0, 80)}\`` : `A client-side exception was captured.`,
                ],
                whatIsMissing: [
                    `Server-side execution trace for \`${reqLabel ?? "the upstream endpoint"}\` explaining the HTTP ${status ?? "error"} response.`,
                ],
                requiredEvidence: `Server-side error logs or stack trace from the backend handler that processed the failing request.`,
                why: `Without server-side telemetry, Halo cannot determine the backend root cause (dependency failure, validation error, configuration, runtime exception).`,
            },
        }),
    };
}

/* -------------------------------------------------------------------------- */
/* Database failure                                                            */
/* -------------------------------------------------------------------------- */

function buildDatabaseFailureRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const dbErrors = context.errors.filter(e =>
        hypothesis.evidenceIds.includes(e.id) &&
        isPrismaOrDatabaseError(e),
    );
    const primaryDbError = dbErrors[0] ?? context.errors.find(e => hypothesis.evidenceIds.includes(e.id));

    const fullText = [primaryDbError?.title ?? "", primaryDbError?.description ?? ""].join(" ");
    const prismaCode = extractPrismaCode(fullText);
    const model = extractPrismaModel(fullText);

    const evidenceChain: RecommendationEvidenceLink[] = [];
    if (primaryDbError) {
        evidenceChain.push({
            evidenceId: primaryDbError.id,
            evidenceType: primaryDbError.type,
            role: "error-event",
            excerpt: primaryDbError.title.slice(0, 120),
        });
    }

    // P2002 — Unique constraint violation
    if (prismaCode === "P2002") {
        const field = /unique constraint.*field.*`([a-zA-Z0-9_]+)`/i.exec(fullText)?.[1] ??
                      /on fields.*`([a-zA-Z0-9_]+)`/i.exec(fullText)?.[1] ?? null;

        return rec({
            id: `fix:db:unique-constraint:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "exact-code-fix",
            immediate: model && field
                ? `Add a duplicate check for \`${model}.${field}\` before attempting the insert, or use an upsert operation.`
                : `Add a duplicate record check before the failing insert, or use an upsert.`,
            technical: `Prisma error P2002: a unique constraint violation occurred${model ? ` on \`${model}\`` : ""}` +
                       `${field ? ` field \`${field}\`` : ""}. The operation attempted to insert or update a record ` +
                       `with a value that already exists in the database for a unique-constrained column.`,
            operationalSteps: [
                model && field
                    ? `Before inserting, query \`prisma.${model.toLowerCase()}.findUnique({ where: { ${field}: value } })\` and handle the duplicate case.`
                    : `Check for an existing record before the failing insert.`,
                `Alternatively, use \`prisma.${model?.toLowerCase() ?? "model"}.upsert()\` to atomically handle the duplicate.`,
                `If duplicates are expected and acceptable, add a try/catch for Prisma error P2002 specifically.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Attempt the same operation with a duplicate value — the application should now return a meaningful error, not a 500.`,
                    `Attempt with a unique value — the operation should succeed.`,
                ],
                expectedOutcome: `Duplicate attempts are handled gracefully. The Prisma P2002 error no longer propagates unhandled.`,
                regressionTest: `Write a test that submits a duplicate record and asserts the error is caught and the appropriate user-facing response is returned.`,
            },
            prevention: {
                items: [
                    `Add a global Prisma error middleware that converts P2002 into a structured API error response.`,
                    `Document unique constraints in your API contract so callers know which fields must be unique.`,
                ],
            },
        });
    }

    // P2024 — Connection pool timeout
    if (prismaCode === "P2024") {
        return rec({
            id: `fix:db:pool-timeout:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "config-fix",
            immediate: `Increase the Prisma connection pool size or reduce concurrent database workload to resolve connection pool timeout.`,
            technical: `Prisma error P2024: the connection pool is exhausted. All connections are occupied and new requests ` +
                       `are timing out waiting for an available connection. This typically occurs under high concurrency ` +
                       `or when connections are not being released promptly (e.g., from missing \`await\` or uncaught exceptions).`,
            operationalSteps: [
                `In your \`DATABASE_URL\`, increase the pool size: append \`?connection_limit=20\` (or higher based on your database plan).`,
                `In your Prisma client initialization, set \`connectionTimeout\` and \`pool\` limits explicitly.`,
                `Audit all Prisma query sites for missing \`await\` — unawaited queries hold connections open.`,
                `Add \`finally { await prisma.$disconnect() }\` only in scripts; for long-running servers, use a singleton client.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Monitor active database connections after the change — they should not approach the new limit under normal load.`,
                    `Confirm Prisma P2024 errors no longer appear in production logs.`,
                ],
                expectedOutcome: `Connection pool no longer exhausts under current workload. P2024 errors disappear.`,
            },
            prevention: {
                items: [
                    `Add a Prisma connection pool metric alert when active connections exceed 80% of the pool limit.`,
                    `Use a global singleton PrismaClient in serverless environments to avoid per-invocation pool creation.`,
                ],
                monitoring: `Alert when database connection pool utilization exceeds 80%.`,
            },
        });
    }

    // P2025 — Record not found
    if (prismaCode === "P2025") {
        return rec({
            id: `fix:db:not-found:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "exact-code-fix",
            immediate: model
                ? `Replace \`prisma.${model.toLowerCase()}.update()\` or \`delete()\` with a \`findUnique\` check first, or use \`updateMany\` and handle the zero-count case.`
                : `Check that the record exists before updating or deleting it.`,
            technical: `Prisma error P2025: an operation (update, delete, or a nested connect) failed because the ` +
                       `target record does not exist. The code assumes the record exists without first verifying.`,
            operationalSteps: [
                `Use \`prisma.${model?.toLowerCase() ?? "model"}.findUnique({ where: { id } })\` first and return 404 if null.`,
                `Or use \`prisma.${model?.toLowerCase() ?? "model"}.updateMany()\` and check \`count === 0\` to detect the missing record.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Attempt the operation with a non-existent ID — the API should now return 404, not 500.`,
                    `Attempt with a valid ID — the operation should succeed.`,
                ],
                expectedOutcome: `P2025 is caught and the API returns a structured 404 error.`,
            },
            prevention: {
                items: [
                    `Add a global Prisma error handler that converts P2025 into a 404 API response.`,
                    `Validate IDs at the API boundary before reaching database operations.`,
                ],
            },
        });
    }

    // P2003 — Foreign key constraint
    if (prismaCode === "P2003") {
        return rec({
            id: `fix:db:fk-constraint:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "exact-code-fix",
            immediate: `Ensure the referenced record exists before inserting the record with a foreign key reference.`,
            technical: `Prisma error P2003: a foreign key constraint violation. The insert or update references a ` +
                       `record (via a relation field) that does not exist in the parent table.`,
            operationalSteps: [
                `Validate that the referenced parent record exists before the operation.`,
                `Return a 422 or 400 error to the client when the referenced record does not exist, rather than allowing the constraint to fail at the database level.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Submit a request with a non-existent foreign key ID — should return 400/422, not 500.`,
                    `Submit with a valid foreign key ID — should succeed.`,
                ],
                expectedOutcome: `Foreign key constraint errors are caught before reaching the database.`,
            },
            prevention: {
                items: [
                    `Validate relational IDs at the API layer before reaching Prisma operations.`,
                    `Add input schemas (e.g., zod) that validate foreign key fields against the database when necessary.`,
                ],
            },
        });
    }

    // Generic database failure
    const resource = primaryDbError?.resource ?? primaryDbError?.operation ?? null;
    return rec({
        id: `fix:db:generic:${normalizeId(hypothesis.id)}`,
        hypothesis,
        kind: "investigation-required",
        immediate: resource
            ? `Investigate the database operation on \`${resource}\` during the incident window for constraint violations, connection errors, or query failures.`
            : `Investigate the database operation that failed during the incident window.`,
        technical: primaryDbError
            ? `A database error was captured: "${primaryDbError.title}". The exact fix depends on the specific Prisma error code and query context.`
            : `Database failure detected from the investigation context. Exact Prisma error code not captured in available evidence.`,
        evidenceChain,
        verification: {
            steps: [
                `Reproduce the database operation and verify it succeeds.`,
                `Check database logs for the exact query and error at the incident timestamp.`,
            ],
            expectedOutcome: `The database operation completes without error.`,
        },
        prevention: {
            items: [
                `Add Prisma error code handling (P2002, P2024, P2025, P2003) to your global error handler.`,
                `Instrument database query durations and error rates with monitoring.`,
            ],
        },
        unknowns: {
            whatHaloKnows: primaryDbError ? [`Database error: "${primaryDbError.title.slice(0, 80)}"`] : [`A database failure was detected.`],
            whatIsMissing: [`Specific Prisma error code and query context from the failing database operation.`],
            requiredEvidence: `Full Prisma error object including \`code\`, \`meta\`, and the failing query.`,
            why: `Without the Prisma error code, Halo cannot prescribe the exact fix (different codes require different remediation).`,
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Runtime exception (TypeError, ReferenceError, null access, etc.)          */
/* -------------------------------------------------------------------------- */

function buildRuntimeExceptionRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const anchorError = findAnchorError(context, hypothesis.evidenceIds);
    const fullText = [anchorError?.title ?? "", anchorError?.description ?? ""].join(" ");

    const stack = typeof anchorError?.metadata?.stack === "string" ? anchorError.metadata.stack : "";
    const stackPatch = extractCodePatchFromStack(anchorError);

    const propMatch = /reading\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(fullText);
    const prop = propMatch?.[1] ?? null;

    const isTypeError = /TypeError|Cannot read properties|is not a function|undefined is not/i.test(fullText);
    const isRefError = /ReferenceError|is not defined/i.test(fullText);

    const evidenceChain: RecommendationEvidenceLink[] = [];
    if (anchorError) {
        evidenceChain.push({
            evidenceId: anchorError.id,
            evidenceType: anchorError.type,
            role: "error-event",
            excerpt: anchorError.title.slice(0, 120),
        });
    }
    if (stackPatch?.filePath) {
        evidenceChain.push({
            evidenceId: anchorError?.id ?? hypothesis.evidenceIds[0] ?? "unknown",
            evidenceType: "ERROR",
            role: "stack-frame",
            excerpt: `${stackPatch.filePath}${stackPatch.lineRange ? `:${stackPatch.lineRange}` : ""}${stackPatch.functionOrComponent ? ` in ${stackPatch.functionOrComponent}()` : ""}`,
        });
    }

    const hasLocation = Boolean(stackPatch?.filePath);

    let codePatch: RecommendationCodePatch | undefined;
    if (hasLocation && stackPatch && prop) {
        codePatch = {
            filePath: stackPatch.filePath,
            functionOrComponent: stackPatch.functionOrComponent,
            lineRange: stackPatch.lineRange,
            before: `// Unguarded access to \`${prop}\` — can be undefined when the parent object is absent`,
            after: prop
                ? `// Option A: Optional chaining\nconst value = obj?.${prop};\n\n// Option B: Explicit guard\nif (!obj) {\n  // handle missing object\n  return;\n}\nconst value = obj.${prop};`
                : `// Add a null/undefined check before property access`,
            explanation:
                `The stack frame shows the exception originates from accessing \`${prop}\` on a potentially undefined ` +
                `object at \`${stackPatch.filePath}${stackPatch.lineRange ? `:${stackPatch.lineRange}` : ""}\`. ` +
                `Adding optional chaining (\`?.\`) or an explicit guard prevents the dereference when the object is absent.`,
            sideEffects: `The guard may silently swallow legitimate programming errors. Prefer throwing an explicit error in the guard block to expose unexpected nulls during development.`,
        };
    }

    const kind: RecommendationKind = hasLocation ? "exact-code-fix" : "investigation-required";
    const typeLabel = isTypeError ? "TypeError" : isRefError ? "ReferenceError" : "runtime exception";

    return {
        id: `fix:runtime:${normalizeId(hypothesis.id)}`,
        title: stackPatch?.filePath
            ? `Add null guard for \`${prop ?? "undefined property"}\` access in \`${stackPatch.filePath}\``
            : `Add defensive null/undefined guard for the failing property access`,
        description: `${typeLabel} caused by unguarded property access on a potentially undefined value.`,
        priority: "HIGH",
        confidence: hypothesis.confidence,
        evidenceIds: hypothesis.evidenceIds,
        kind,
        immediateAction: stackPatch?.filePath && prop
            ? `In \`${stackPatch.filePath}${stackPatch.lineRange ? `:${stackPatch.lineRange}` : ""}\`, add a null check or optional chaining (\`?.\`) before accessing \`${prop}\`.`
            : prop
            ? `Add a null/undefined guard before accessing \`${prop}\` in the failing code path.`
            : `Add defensive null/undefined checks at the site of the failing property access.`,
        rootCauseTechnical: anchorError
            ? `\`${anchorError.title}\`. ` +
              (stackPatch?.filePath ? `Stack trace points to \`${stackPatch.filePath}${stackPatch.lineRange ? `:${stackPatch.lineRange}` : ""}\`${stackPatch.functionOrComponent ? ` (${stackPatch.functionOrComponent})` : ""}. ` : "") +
              (prop ? `The property \`${prop}\` is accessed on an object that can be undefined at this point in execution.` : "")
            : `A ${typeLabel} was captured. The exact code location requires stack frame analysis.`,
        codePatch,
        evidenceChain,
        verification: {
            steps: [
                stackPatch?.filePath
                    ? `Reproduce the code path that reaches \`${stackPatch.filePath}${stackPatch.lineRange ? `:${stackPatch.lineRange}` : ""}\` with the conditions that produce the undefined value.`
                    : `Reproduce the conditions that trigger the ${typeLabel}.`,
                `Verify the exception no longer occurs.`,
                prop ? `Verify the null/undefined case is handled with the expected application behavior (not silently swallowed).` : `Verify the guard handles the edge case correctly.`,
            ],
            expectedOutcome: `The ${typeLabel} no longer occurs. The null/undefined case is handled with appropriate fallback behavior.`,
            regressionTest: prop && stackPatch?.filePath
                ? `Add a unit test that calls the affected function with a null/undefined input and asserts no exception is thrown.`
                : undefined,
        },
        prevention: {
            items: [
                `Enable TypeScript \`strictNullChecks\` to catch unguarded null access at compile time.`,
                `Use the \`no-unsafe-member-access\` ESLint rule to flag dynamic property access without type guards.`,
                prop ? `Validate that the object containing \`${prop}\` is non-null at its initialization point, not at the access point.` : `Validate object existence at the boundary where it enters the system.`,
            ],
        },
        ...(!hasLocation && {
            unknowns: {
                whatHaloKnows: anchorError ? [`Exception: "${anchorError.title.slice(0, 80)}"`] : [`A runtime exception was captured.`],
                whatIsMissing: [`Full source-mapped stack trace with file path and line number.`],
                requiredEvidence: `Source-mapped stack trace from the error event (file path + line number, not minified).`,
                why: `Without the source location, Halo cannot identify the exact property access site or generate a code patch.`,
            },
        }),
    };
}

/* -------------------------------------------------------------------------- */
/* Network / HTTP protocol failure                                            */
/* -------------------------------------------------------------------------- */

function buildNetworkProtocolRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const failedReq = findFailedRequest(context, hypothesis.evidenceIds);
    const anchorError = findAnchorError(context, hypothesis.evidenceIds);

    const status = Number(failedReq?.status ?? anchorError?.status ?? 0);
    const endpoint = failedReq?.resource ?? failedReq?.operation?.split(" ").slice(1).join(" ") ?? null;
    const method = failedReq?.operation?.split(" ")[0] ?? null;
    const reqLabel = method && endpoint ? `${method} ${endpoint}` : endpoint ?? "the endpoint";
    const duration = failedReq?.durationMs ?? null;

    const evidenceChain: RecommendationEvidenceLink[] = [];
    if (failedReq) {
        evidenceChain.push({
            evidenceId: failedReq.id,
            evidenceType: failedReq.type,
            role: "upstream-failure",
            excerpt: `${reqLabel} → HTTP ${status || "error"}${duration != null ? ` (${duration}ms)` : ""}`,
        });
    }

    // 401 Unauthorized
    if (status === 401) {
        return rec({
            id: `fix:http:401:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "investigation-required",
            immediate: endpoint
                ? `Inspect the authentication token/session being sent with requests to \`${endpoint}\` — the server is rejecting the credential.`
                : `Inspect the authentication credential being sent with the failing request.`,
            technical: `HTTP 401 Unauthorized from \`${reqLabel}\`. The server rejected the authentication credential. ` +
                `Common causes: expired JWT/session token, missing Authorization header, invalid token signature, or clock skew between client and server.`,
            operationalSteps: [
                `Verify the Authorization header is present and correctly formatted in the failing request.`,
                `Check token expiry — if using JWT, decode the \`exp\` claim and confirm it has not passed.`,
                `If using session cookies, verify the session store (Redis/database) still has the session record.`,
                `Check server logs for the specific authentication rejection reason.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Reproduce the request with a fresh, valid authentication token.`,
                    `Confirm the response is HTTP 200 (or expected success status).`,
                ],
                expectedOutcome: `\`${reqLabel}\` returns HTTP 2xx with a valid credential.`,
            },
            prevention: {
                items: [
                    `Implement token refresh logic before expiry (proactive refresh at 80% of token lifetime).`,
                    `Add monitoring for 401 error rates on authenticated endpoints.`,
                ],
            },
        });
    }

    // 403 Forbidden
    if (status === 403) {
        return rec({
            id: `fix:http:403:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "investigation-required",
            immediate: endpoint
                ? `Verify the authenticated user has the required permissions for \`${endpoint}\`.`
                : `Verify the user has the required authorization for the failing operation.`,
            technical: `HTTP 403 Forbidden from \`${reqLabel}\`. The credential is valid but the user lacks permission for this resource or operation.`,
            operationalSteps: [
                `Identify the required role or permission for this endpoint.`,
                `Check the user's current roles/permissions in the database.`,
                `Review the authorization middleware or guard for this route.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Reproduce the request with a user that has the required permissions.`,
                    `Confirm HTTP 2xx response.`,
                ],
                expectedOutcome: `Authorized users can access \`${endpoint ?? "the resource"}\` without HTTP 403.`,
            },
            prevention: {
                items: [
                    `Add permission requirement documentation to your API contract.`,
                    `Write integration tests for authorization boundary cases.`,
                ],
            },
        });
    }

    // 429 Rate Limited
    if (status === 429) {
        return rec({
            id: `fix:http:429:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "operational-fix",
            immediate: endpoint
                ? `Implement exponential backoff and retry for requests to \`${endpoint}\` — the endpoint is rate limiting this client.`
                : `Add retry-with-backoff for the rate-limited request.`,
            technical: `HTTP 429 Too Many Requests from \`${reqLabel}\`. The server is rate limiting requests from this client.`,
            operationalSteps: [
                `Check the \`Retry-After\` response header for the recommended wait time.`,
                `Implement exponential backoff: initial delay 1s, max delay 30s, jitter to avoid thundering herd.`,
                `If you control the server, review the rate limit configuration for this endpoint.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Verify retry logic respects the \`Retry-After\` header.`,
                    `Confirm eventual success after backoff.`,
                ],
                expectedOutcome: `Requests to \`${endpoint ?? "the endpoint"}\` succeed after appropriate backoff.`,
            },
            prevention: {
                items: [
                    `Cache responses where possible to reduce request frequency.`,
                    `Add a request queue that enforces the rate limit proactively.`,
                ],
            },
        });
    }

    // 404 Not Found
    if (status === 404) {
        return rec({
            id: `fix:http:404:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "investigation-required",
            immediate: endpoint
                ? `Verify the resource requested at \`${endpoint}\` exists and the URL path is correct.`
                : `Verify the requested resource exists and the request URL is correct.`,
            technical: `HTTP 404 Not Found from \`${reqLabel}\`. The server could not find the requested resource. ` +
                `Common causes: wrong URL, deleted resource, incorrect dynamic route parameter, or route not registered.`,
            operationalSteps: [
                `Confirm the exact URL being requested matches the registered route pattern.`,
                `Verify the resource (record ID, slug, etc.) exists in the database.`,
                `Check if a recent deployment changed the route definition.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Request the correct URL with a valid resource ID.`,
                    `Confirm HTTP 2xx response.`,
                ],
                expectedOutcome: `The resource is found and the API returns the expected payload.`,
            },
            prevention: {
                items: [
                    `Add route testing to your CI pipeline.`,
                    `Validate dynamic route parameters before fetching.`,
                ],
            },
        });
    }

    // 504 / Timeout
    if (status === 504 || duration != null && duration > 30000 || /timeout|ETIMEDOUT/i.test(anchorError?.title ?? "")) {
        return rec({
            id: `fix:http:timeout:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "investigation-required",
            immediate: endpoint
                ? `Identify what \`${endpoint}\` is waiting on during the ${duration != null ? `${duration}ms ` : ""}timeout — database query, downstream service, or I/O operation.`
                : `Identify the slow operation causing the request timeout.`,
            technical: `${status === 504 ? "HTTP 504 Gateway Timeout" : "Request timeout"} for \`${reqLabel}\`${duration != null ? ` after ${duration}ms` : ""}. ` +
                `The server did not respond within the allowed time window. ` +
                `Common causes: slow database query, blocked downstream dependency, or insufficient server resources.`,
            operationalSteps: [
                `Check database slow query logs during the incident window.`,
                `Check downstream service latency during the incident window.`,
                `Review server CPU and memory metrics during the incident window.`,
                `Add a request timeout on the client with a fallback response.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Reproduce the slow operation and measure its duration after the fix.`,
                    `Confirm \`${reqLabel}\` responds within the expected time budget.`,
                ],
                expectedOutcome: `\`${reqLabel}\` responds within the expected SLO window.`,
            },
            prevention: {
                items: [
                    `Add p99 latency monitoring for \`${endpoint ?? "this endpoint"}\`.`,
                    `Set explicit database query timeouts.`,
                    `Add a circuit breaker for downstream dependency calls.`,
                ],
                monitoring: endpoint ? `Alert when p95 latency for \`${endpoint}\` exceeds threshold.` : undefined,
            },
        });
    }

    // 500 / 502 / 503 — Server error
    if (status >= 500 || status === 0) {
        const statusLabel = status >= 500 ? `HTTP ${status}` : "server error";
        return rec({
            id: `fix:http:5xx:${normalizeId(hypothesis.id)}`,
            hypothesis,
            kind: "investigation-required",
            immediate: endpoint
                ? `Inspect the server-side handler for \`${endpoint}\` for an unhandled exception, failed dependency, or misconfiguration causing the ${statusLabel}.`
                : `Inspect the server-side handler for an unhandled exception or failed dependency.`,
            technical: `${statusLabel} from \`${reqLabel}\`${duration != null ? ` after ${duration}ms` : ""}. ` +
                `The server handler threw an unhandled error or a dependency (database, cache, external API) failed during request processing.`,
            operationalSteps: [
                `Check server error logs for stack traces during the incident window.`,
                `Identify unhandled promise rejections or thrown exceptions in the handler.`,
                `Check downstream dependency health (database, Redis, external APIs) during the incident window.`,
                `Verify environment configuration (connection strings, secrets) is correct in production.`,
            ],
            evidenceChain,
            verification: {
                steps: [
                    `Reproduce the failing request after the fix.`,
                    `Confirm \`${reqLabel}\` returns HTTP 2xx.`,
                    `Confirm the server error no longer appears in production logs.`,
                ],
                expectedOutcome: `\`${reqLabel}\` returns HTTP 2xx with the expected payload.`,
            },
            prevention: {
                items: [
                    `Add a global error handler that returns structured error responses and logs the full exception.`,
                    `Add health checks for all downstream dependencies.`,
                    endpoint ? `Configure an alert for \`${endpoint}\` 5xx error rate exceeding 1%.` : `Configure 5xx error rate monitoring.`,
                ],
                monitoring: endpoint ? `Alert when \`${endpoint}\` 5xx rate exceeds 1% over 5 minutes.` : undefined,
            },
            unknowns: {
                whatHaloKnows: [
                    `\`${reqLabel}\` returned ${statusLabel}${duration != null ? ` after ${duration}ms` : ""}.`,
                    anchorError ? `Client-side exception: "${anchorError.title.slice(0, 80)}"` : `A client-side error was also captured.`,
                ],
                whatIsMissing: [`Server-side stack trace or error log from the handler processing \`${reqLabel}\`.`],
                requiredEvidence: `Server-side error event with stack trace from the handler that returned ${statusLabel}.`,
                why: `Without server-side telemetry, Halo cannot identify whether the cause is a dependency failure, runtime exception, or configuration error.`,
            },
        });
    }

    // Generic network failure
    return buildInsufficientEvidenceRecommendation(context, hypothesis.evidenceIds);
}

/* -------------------------------------------------------------------------- */
/* Deployment regression                                                      */
/* -------------------------------------------------------------------------- */

function buildDeploymentRegressionRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const deployment = context.deployments.find(d => hypothesis.evidenceIds.includes(d.id));
    const errors = context.errors.filter(e => hypothesis.evidenceIds.includes(e.id));
    const firstError = errors[0];

    const evidenceChain: RecommendationEvidenceLink[] = [];
    if (deployment) {
        evidenceChain.push({
            evidenceId: deployment.id,
            evidenceType: deployment.type,
            role: "deployment",
            excerpt: `${deployment.title}${deployment.release ? ` (${deployment.release})` : ""}`,
        });
    }
    if (firstError) {
        evidenceChain.push({
            evidenceId: firstError.id,
            evidenceType: firstError.type,
            role: "error-event",
            excerpt: firstError.title.slice(0, 120),
        });
    }

    const deployLabel = deployment?.title ?? "the suspected deployment";
    const releaseLabel = deployment?.release ?? null;
    const serviceLabel = deployment?.service ?? firstError?.service ?? "the service";

    const deployTime = deployment?.timestamp ? new Date(deployment.timestamp) : null;
    const errorTime = firstError?.timestamp ? new Date(firstError.timestamp) : null;
    const offsetMinutes = deployTime && errorTime
        ? Math.round((errorTime.getTime() - deployTime.getTime()) / 60000)
        : null;

    return {
        id: `fix:deployment:regression:${normalizeId(hypothesis.id)}`,
        title: releaseLabel
            ? `Roll back release \`${releaseLabel}\` of \`${serviceLabel}\` or revert the specific change`
            : `Roll back ${deployLabel} or revert the specific change that caused the regression`,
        description: `Errors in ${serviceLabel} began ${offsetMinutes != null ? `${offsetMinutes} minutes` : "shortly"} after ${deployLabel}. Roll back to restore service immediately.`,
        priority: "HIGH",
        confidence: hypothesis.confidence,
        evidenceIds: hypothesis.evidenceIds,
        kind: "rollback",
        immediateAction: releaseLabel
            ? `Roll back \`${serviceLabel}\` to the release before \`${releaseLabel}\` to restore service immediately.`
            : `Roll back ${deployLabel} to restore the service to its pre-incident state.`,
        rootCauseTechnical:
            `Errors in \`${serviceLabel}\` began ${offsetMinutes != null ? `${offsetMinutes} minutes` : "shortly"} after ${deployLabel}` +
            (releaseLabel ? ` (release: \`${releaseLabel}\`)` : "") +
            `. The timing correlation indicates this deployment introduced or exposed the failure. ` +
            (firstError ? `First observed error: "${firstError.title.slice(0, 100)}".` : ""),
        operationalSteps: [
            `Immediately roll back ${serviceLabel} to the prior stable release.`,
            ...(releaseLabel ? [`Revert release \`${releaseLabel}\` via your deployment platform.`] : []),
            `Monitor error rate after rollback — errors should stop within 1–2 minutes.`,
            `Inspect the diff introduced in ${deployLabel} for the change that caused the regression.`,
            `Fix the specific change in a new release and deploy with monitoring.`,
        ],
        evidenceChain,
        verification: {
            steps: [
                `Monitor error rate for \`${serviceLabel}\` after rollback.`,
                `Confirm errors stop within 2 minutes of the rollback completing.`,
                `Confirm ${firstError ? `"${firstError.title.slice(0, 60)}"` : "the observed error"} no longer appears in production logs.`,
            ],
            expectedOutcome: `Error rate for \`${serviceLabel}\` returns to pre-deployment baseline within 2 minutes of rollback.`,
        },
        prevention: {
            items: [
                `Add automated rollback criteria: if error rate increases by more than X% within Y minutes of a deployment, trigger automatic rollback.`,
                `Add canary or blue/green deployment to limit blast radius of future regressions.`,
                `Add regression tests covering the failing code path introduced in this deployment.`,
            ],
            monitoring: `Alert when error rate increases more than 50% within 5 minutes of a deployment.`,
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Shared dependency failure                                                  */
/* -------------------------------------------------------------------------- */

function buildSharedDependencyRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const affectedServices = uniqueStrings(
        context.errors
            .filter(e => hypothesis.evidenceIds.includes(e.id))
            .map(e => e.service),
    );
    const resources = uniqueStrings(
        context.evidence
            .filter(e => hypothesis.evidenceIds.includes(e.id))
            .map(e => e.resource)
            .filter((r): r is string => Boolean(r)),
    );
    const resource = resources[0] ?? null;

    const evidenceChain: RecommendationEvidenceLink[] = hypothesis.evidenceIds.slice(0, 3).flatMap(id => {
        const ev = context.evidence.find(e => e.id === id);
        return ev ? [{
            evidenceId: ev.id,
            evidenceType: ev.type,
            role: "upstream-failure" as const,
            excerpt: `${ev.service}: ${ev.title.slice(0, 80)}`,
        }] : [];
    });

    return rec({
        id: `fix:shared-dep:${normalizeId(hypothesis.id)}`,
        hypothesis,
        kind: "investigation-required",
        immediate: resource
            ? `Inspect \`${resource}\` health during the incident window — ${affectedServices.length} services failed simultaneously.`
            : `Identify and inspect the shared dependency that caused simultaneous failures across ${affectedServices.length} services.`,
        technical: resource
            ? `${affectedServices.length} services (${affectedServices.slice(0, 3).join(", ")}) failed simultaneously. ` +
              `The shared resource \`${resource}\` is the most likely common cause. ` +
              `Simultaneous multi-service failure without a deployment change typically indicates a shared dependency (database, cache, message queue, external API) entered a degraded or unavailable state.`
            : `Multiple services failed simultaneously, indicating a shared dependency failure. ` +
              `Inspect the health of shared infrastructure (database, Redis, message queue, external API) during the incident window.`,
        operationalSteps: [
            resource ? `Check \`${resource}\` health metrics and error logs during the incident window.` : `Identify the dependency shared by all affected services.`,
            `Verify connectivity between each affected service and the shared dependency.`,
            `Check the dependency's own error logs for the incident window.`,
            `Implement a circuit breaker for the shared dependency to prevent cascading failures in future incidents.`,
        ],
        evidenceChain,
        verification: {
            steps: [
                `Confirm all ${affectedServices.length} affected services recover once the shared dependency is restored.`,
                `Verify no new errors appear in the affected services after the dependency stabilizes.`,
            ],
            expectedOutcome: `All affected services return to normal operation after the shared dependency is restored.`,
        },
        prevention: {
            items: [
                resource ? `Add a health check and circuit breaker for \`${resource}\`.` : `Implement circuit breakers for all shared dependencies.`,
                `Set up dependency health monitoring with alerts for degradation before complete failure.`,
                `Document the blast radius of each shared dependency.`,
            ],
            monitoring: resource ? `Alert when \`${resource}\` error rate or latency exceeds threshold.` : undefined,
        },
        unknowns: {
            whatHaloKnows: [
                `${affectedServices.length} services failed simultaneously: ${affectedServices.slice(0, 3).join(", ")}`,
                resource ? `Shared resource identified: \`${resource}\`` : `No specific shared resource identified from available evidence.`,
            ],
            whatIsMissing: [`Health metrics and error logs for the shared dependency during the incident window.`],
            requiredEvidence: `Health metrics, error logs, or connection traces from the shared dependency (database, cache, external API) during the incident window.`,
            why: `Without dependency telemetry, Halo cannot confirm whether the shared dependency actually failed or whether another common cause explains the simultaneous failures.`,
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Infrastructure failure                                                      */
/* -------------------------------------------------------------------------- */

function buildInfrastructureRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const infraEvidence = context.infrastructure.filter(e => hypothesis.evidenceIds.includes(e.id));
    const resources = uniqueStrings(infraEvidence.map(e => e.resource).filter((r): r is string => Boolean(r)));

    const evidenceChain: RecommendationEvidenceLink[] = infraEvidence.slice(0, 3).map(e => ({
        evidenceId: e.id,
        evidenceType: e.type,
        role: "upstream-failure" as const,
        excerpt: `${e.resource ?? e.service}: ${e.title.slice(0, 80)}`,
    }));

    return rec({
        id: `fix:infra:${normalizeId(hypothesis.id)}`,
        hypothesis,
        kind: "investigation-required",
        immediate: resources.length > 0
            ? `Inspect \`${resources.join(", ")}\` for resource exhaustion, availability failures, or saturation during the incident window.`
            : `Inspect infrastructure health for resource exhaustion or availability failures during the incident window.`,
        technical: `Infrastructure evidence was captured during the incident. ` +
            (resources.length > 0 ? `Affected resources: ${resources.join(", ")}. ` : "") +
            `Common infrastructure failure modes: CPU/memory saturation, disk exhaustion, network partition, zone/region outage.`,
        operationalSteps: [
            `Review CPU, memory, and disk utilization for affected infrastructure during the incident window.`,
            `Check network connectivity and DNS resolution for affected services.`,
            `Review infrastructure provider status pages for reported incidents.`,
            `Scale up or restart affected infrastructure if saturation is confirmed.`,
        ],
        evidenceChain,
        verification: {
            steps: [
                `Confirm infrastructure resource metrics return to normal levels.`,
                `Confirm affected services stop producing errors after infrastructure stabilizes.`,
            ],
            expectedOutcome: `Infrastructure resources are within normal operating ranges and affected services recover.`,
        },
        prevention: {
            items: [
                `Add infrastructure capacity alerts (CPU > 80%, memory > 85%, disk > 90%).`,
                `Implement auto-scaling for compute resources.`,
                `Add multi-zone or multi-region redundancy for critical services.`,
            ],
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Security incident                                                           */
/* -------------------------------------------------------------------------- */

function buildSecurityRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const secErrors = context.errors.filter(e => hypothesis.evidenceIds.includes(e.id));
    const firstError = secErrors[0];
    const fullText = [firstError?.title ?? "", firstError?.description ?? ""].join(" ");

    const isJwt = /JWT|token|signature/i.test(fullText);
    const isCSRF = /CSRF/i.test(fullText);
    const is401 = /401|Unauthorized/i.test(fullText);
    const is403 = /403|Forbidden/i.test(fullText);

    const evidenceChain: RecommendationEvidenceLink[] = secErrors.slice(0, 2).map(e => ({
        evidenceId: e.id,
        evidenceType: e.type,
        role: "error-event" as const,
        excerpt: e.title.slice(0, 120),
    }));

    return rec({
        id: `fix:security:${normalizeId(hypothesis.id)}`,
        hypothesis,
        kind: "investigation-required",
        immediate: isJwt
            ? `Inspect token generation and validation logic — a JWT signature or expiry issue was detected.`
            : isCSRF
            ? `Verify CSRF token generation and validation are functioning correctly.`
            : is401
            ? `Investigate the authentication failure — review session/token state for affected users.`
            : is403
            ? `Review authorization rules for the affected operation.`
            : `Review authentication and authorization logs for anomalous patterns during the incident window.`,
        technical: firstError
            ? `Security-related failure captured: "${firstError.title.slice(0, 100)}". ` +
              (isJwt ? `JWT token validation failed — check token expiry, signature algorithm, or signing key rotation.` : "") +
              (isCSRF ? `CSRF validation failed — check token generation, cookie settings, and Same-Site policy.` : "") +
              (is401 ? `Authentication rejected — check session store availability and token validity.` : "")
            : `A security anomaly was detected in the incident evidence.`,
        operationalSteps: [
            isJwt ? `Verify JWT secret/key has not changed unexpectedly (check for recent secret rotation).` : `Audit authentication configuration.`,
            isJwt ? `Confirm token expiry (\`exp\` claim) is appropriate and token refresh is working.` : ``,
            `Review authentication logs for the incident window for the specific rejection reason.`,
            `If tokens were compromised, rotate secrets and invalidate active sessions.`,
        ].filter(Boolean),
        evidenceChain,
        verification: {
            steps: [
                `Attempt authentication with a fresh, valid credential.`,
                `Confirm the security-related error no longer occurs.`,
            ],
            expectedOutcome: `Valid credentials authenticate successfully. Security errors no longer appear in logs.`,
        },
        prevention: {
            items: [
                `Add monitoring for elevated authentication failure rates.`,
                `Implement token rotation alerts.`,
                isCSRF ? `Audit Same-Site cookie and CSRF protection settings across all forms and API endpoints.` : ``,
            ].filter(Boolean),
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Resource saturation                                                         */
/* -------------------------------------------------------------------------- */

function buildResourceSaturationRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const satErrors = context.errors.filter(e => hypothesis.evidenceIds.includes(e.id));
    const firstError = satErrors[0];

    const evidenceChain: RecommendationEvidenceLink[] = satErrors.slice(0, 2).map(e => ({
        evidenceId: e.id,
        evidenceType: e.type,
        role: "error-event" as const,
        excerpt: e.title.slice(0, 120),
    }));

    return rec({
        id: `fix:saturation:${normalizeId(hypothesis.id)}`,
        hypothesis,
        kind: "investigation-required",
        immediate: `Inspect database connection pool metrics, memory allocation, and system resource limits during the incident window to identify the saturated resource.`,
        technical: firstError
            ? `Resource saturation detected: "${firstError.title.slice(0, 100)}". ` +
              `The system ran out of a constrained resource (connection pool, memory, file descriptors, threads) during the incident.`
            : `Resource saturation was identified in the investigation. The system exhausted a constrained resource during the incident.`,
        operationalSteps: [
            `Check database connection pool utilization at the incident timestamp.`,
            `Review memory and CPU metrics during the incident window.`,
            `Identify the resource that was exhausted and increase limits or reduce demand.`,
            `Add connection pool sizing to your \`DATABASE_URL\` if pool exhaustion is confirmed.`,
        ],
        evidenceChain,
        verification: {
            steps: [
                `Confirm the saturated resource metric returns to normal levels after the fix.`,
                `Confirm errors no longer occur under normal load.`,
            ],
            expectedOutcome: `The resource remains within capacity bounds under expected load.`,
        },
        prevention: {
            items: [
                `Add resource utilization alerts (pool exhaustion, memory > 85%, CPU > 90%).`,
                `Load-test the system to identify resource saturation thresholds before they become incidents.`,
            ],
            monitoring: `Alert when resource utilization exceeds 80% of configured limits.`,
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Cross-service failure                                                       */
/* -------------------------------------------------------------------------- */

function buildCrossServiceRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const services = uniqueStrings(
        context.errors
            .filter(e => hypothesis.evidenceIds.includes(e.id))
            .map(e => e.service),
    );

    const evidenceChain: RecommendationEvidenceLink[] = hypothesis.evidenceIds.slice(0, 3).flatMap(id => {
        const ev = context.evidence.find(e => e.id === id);
        return ev ? [{
            evidenceId: ev.id,
            evidenceType: ev.type,
            role: "upstream-failure" as const,
            excerpt: `${ev.service}: ${ev.title.slice(0, 80)}`,
        }] : [];
    });

    return rec({
        id: `fix:cross-service:${normalizeId(hypothesis.id)}`,
        hypothesis,
        kind: "investigation-required",
        immediate: services.length >= 2
            ? `Identify the common dependency or change that caused failures across ${services.length} services: ${services.slice(0, 3).join(", ")}.`
            : `Determine whether service-level errors share a common upstream cause.`,
        technical: `Cross-service failure pattern detected. ${services.length} services are experiencing related failures. ` +
            `Common causes: shared database, cache, message queue, upstream API, or a deployment change affecting multiple services.`,
        operationalSteps: [
            `Identify the common dependency or shared component across all affected services.`,
            `Check deployment history — did a change deploy to multiple services simultaneously?`,
            `Inspect shared infrastructure health during the incident window.`,
        ],
        evidenceChain,
        verification: {
            steps: [
                `Confirm all affected services recover after the root cause is addressed.`,
                `Verify no new cross-service errors appear in the following 30 minutes.`,
            ],
            expectedOutcome: `All ${services.length} affected services return to normal operation.`,
        },
        prevention: {
            items: [
                `Add service dependency maps to understand the blast radius of shared component failures.`,
                `Implement circuit breakers between services to prevent cascading failures.`,
            ],
        },
    });
}

/* -------------------------------------------------------------------------- */
/* Generic fallback                                                             */
/* -------------------------------------------------------------------------- */

function buildGenericRecommendation(
    hypothesis: Hypothesis,
    context: InvestigationContext,
): Recommendation {
    const anchorError = findAnchorError(context, hypothesis.evidenceIds);
    const evidenceChain: RecommendationEvidenceLink[] = anchorError ? [{
        evidenceId: anchorError.id,
        evidenceType: anchorError.type,
        role: "error-event",
        excerpt: anchorError.title.slice(0, 120),
    }] : [];

    return {
        id: `fix:generic:${normalizeId(hypothesis.id)}`,
        title: hypothesis.title,
        description: hypothesis.description,
        priority: "HIGH",
        confidence: hypothesis.confidence,
        evidenceIds: hypothesis.evidenceIds,
        kind: "investigation-required",
        immediateAction: `Investigate: ${hypothesis.title}`,
        rootCauseTechnical: hypothesis.description,
        evidenceChain,
        verification: {
            steps: [
                `Resolve the identified cause.`,
                `Confirm the observed error no longer occurs.`,
            ],
            expectedOutcome: `The failure described by "${hypothesis.title}" is resolved.`,
        },
        prevention: {
            items: [
                `Instrument monitoring for the identified failure mode.`,
            ],
        },
        unknowns: {
            whatHaloKnows: anchorError ? [`Error: "${anchorError.title.slice(0, 80)}"`] : [`A failure was detected.`],
            whatIsMissing: [`Specific telemetry to determine the exact fix for this failure type.`],
            requiredEvidence: `More granular telemetry (stack traces, database error codes, HTTP logs) from the failing component.`,
            why: `The available evidence establishes the hypothesis but does not provide sufficient detail to prescribe an exact fix.`,
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Insufficient evidence path                                                  */
/* -------------------------------------------------------------------------- */

function buildInsufficientEvidenceRecommendation(
    context: InvestigationContext,
    evidenceIds: string[],
): Recommendation {
    const errors = context.errors.filter(e => evidenceIds.includes(e.id));
    const firstError = errors[0] ?? context.errors[0];

    const evidenceChain: RecommendationEvidenceLink[] = firstError ? [{
        evidenceId: firstError.id,
        evidenceType: firstError.type,
        role: "error-event",
        excerpt: firstError.title.slice(0, 120),
    }] : [];

    return {
        id: `insufficient-evidence:${Date.now()}`,
        title: "Exact fix cannot yet be determined from available evidence",
        description: "The available telemetry is insufficient to prescribe a specific fix. See the unknowns block for what additional information is needed.",
        priority: "HIGH",
        confidence: 0,
        evidenceIds,
        kind: "insufficient-evidence",
        immediateAction: "Collect the missing telemetry listed below, then re-run the investigation.",
        rootCauseTechnical: firstError
            ? `Halo captured "${firstError.title.slice(0, 100)}" but does not have sufficient correlated telemetry to determine the root cause with confidence.`
            : `No error events were found in the investigation evidence. Verify that the SDK is correctly installed and events are being ingested.`,
        evidenceChain,
        verification: {
            steps: [
                `Resolve the evidence gaps listed in the unknowns block.`,
                `Re-run the investigation with the additional telemetry.`,
            ],
            expectedOutcome: `The investigation resolves with a concrete root cause and specific fix.`,
        },
        prevention: {
            items: [
                `Enable server-side error tracking (stack traces, error codes, request context).`,
                `Configure distributed tracing to link browser errors to backend execution.`,
                `Ensure session IDs are propagated from client to server so errors can be correlated.`,
            ],
        },
        unknowns: {
            whatHaloKnows: firstError
                ? [`An error was captured: "${firstError.title.slice(0, 80)}"`, `${evidenceIds.length} evidence event(s) were evaluated.`]
                : [`No error events were found in the evidence set.`],
            whatIsMissing: [
                `Server-side error logs or stack traces for the failing request.`,
                `HTTP request/response telemetry linking the client error to a backend operation.`,
                `Database or dependency error logs if a downstream dependency is involved.`,
            ],
            requiredEvidence: `Server-side error event with stack trace and request context from the failing operation.`,
            why: `Without server-side execution telemetry, Halo cannot distinguish between a code bug, configuration error, dependency failure, or infrastructure issue.`,
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Secondary recommendations                                                  */
/* -------------------------------------------------------------------------- */

function buildSecondaryRecommendations(
    leading: Hypothesis,
    allHypotheses: Hypothesis[],
    context: InvestigationContext,
): Recommendation[] {
    const recs: Recommendation[] = [];

    // If leading has missing evidence, add a gap-closing recommendation
    for (const reason of leading.missingReasons) {
        if (!reason.title || !reason.description) continue;
        const q = buildMissingEvidenceQuestion(reason.title);
        recs.push({
            id: `investigate:missing:${normalizeId(reason.title)}`,
            title: reason.title,
            description: reason.description,
            priority: "HIGH",
            confidence: 0.85,
            evidenceIds: uniqueStrings([...leading.evidenceIds, ...reason.evidenceIds]),
            question: q,
            kind: "investigation-required",
            immediateAction: reason.title,
            rootCauseTechnical: reason.description,
            evidenceChain: [],
            verification: {
                steps: [`Collect the missing evidence described above.`, `Re-run the investigation.`],
                expectedOutcome: `The investigation resolves with higher confidence.`,
            },
            prevention: { items: [] },
            unknowns: {
                whatHaloKnows: [`The leading hypothesis is: ${leading.title}`],
                whatIsMissing: [reason.description],
                requiredEvidence: reason.title,
                why: reason.description,
            },
        });
    }

    return recs;
}

function buildMissingEvidenceQuestion(title: string): string {
    const normalized = title.trim().toLowerCase();
    if (normalized.includes("rollback") || normalized.includes("recovery")) {
        return "Did the service recover after the suspected deployment was rolled back?";
    }
    if (normalized.includes("dependency")) {
        return "Which dependency was unhealthy when the failure began?";
    }
    if (normalized.includes("infrastructure")) {
        return "What infrastructure condition changed when the incident began?";
    }
    return `What evidence can verify or contradict "${title}"?`;
}

/* -------------------------------------------------------------------------- */
/* Convenience builder                                                         */
/* -------------------------------------------------------------------------- */

function rec({
    id,
    hypothesis,
    kind,
    immediate,
    technical,
    operationalSteps,
    evidenceChain,
    verification,
    prevention,
    unknowns,
    codePatch,
}: {
    id: string;
    hypothesis: Hypothesis;
    kind: RecommendationKind;
    immediate: string;
    technical: string;
    operationalSteps?: string[];
    evidenceChain: RecommendationEvidenceLink[];
    verification: RecommendationVerification;
    prevention: RecommendationPrevention;
    unknowns?: Recommendation["unknowns"];
    codePatch?: RecommendationCodePatch;
}): Recommendation {
    return {
        id,
        title: immediate,
        description: technical,
        priority: "HIGH",
        confidence: hypothesis.confidence,
        evidenceIds: hypothesis.evidenceIds,
        kind,
        immediateAction: immediate,
        rootCauseTechnical: technical,
        codePatch,
        operationalSteps,
        evidenceChain,
        verification,
        prevention,
        unknowns,
    };
}

/* -------------------------------------------------------------------------- */
/* Evidence extraction helpers                                                 */
/* -------------------------------------------------------------------------- */

function findFailedRequest(context: InvestigationContext, evidenceIds: string[]): Evidence | undefined {
    return context.evidence.find(e =>
        evidenceIds.includes(e.id) &&
        (e.type === "TRACE" || e.type === "LOG") &&
        String(e.status ?? "").match(/^[45]/)
    ) ?? context.evidence.find(e =>
        evidenceIds.includes(e.id) &&
        String(e.status ?? "").match(/^[45]/)
    );
}

function findAnchorError(context: InvestigationContext, evidenceIds: string[]): Evidence | undefined {
    return context.errors.find(e => evidenceIds.includes(e.id)) ?? context.errors[0];
}

function isPrismaOrDatabaseError(e: Evidence): boolean {
    const text = [e.title, e.description ?? ""].join(" ");
    return /Prisma|P\d{4}|PostgreSQL|Postgres|constraint|connection pool|ECONNREFUSED|deadlock/i.test(text);
}

function extractPrismaCode(text: string): string | null {
    const match = /\bP(\d{4})\b/.exec(text);
    return match ? `P${match[1]}` : null;
}

function extractPrismaModel(text: string): string | null {
    const match = /prisma\.([a-zA-Z0-9_]+)\./i.exec(text) ??
                  /model\s+`?([a-zA-Z0-9_]+)`?/i.exec(text);
    return match?.[1] ?? null;
}

interface StackPatch {
    filePath: string;
    functionOrComponent?: string;
    lineRange?: string;
    before: string;
}

function extractCodePatchFromStack(error: Evidence | undefined): StackPatch | null {
    if (!error) return null;

    const stack = typeof error.metadata?.stack === "string" ? error.metadata.stack : "";
    if (!stack) return null;

    // Parse stack frames: "at FunctionName (file.ts:42:10)"
    const frameRegex = /at\s+(?:([a-zA-Z0-9_$<>.]+)\s+\()?([^:()]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+):(?:\d+)\)?/g;
    const frames: { func?: string; file: string; line: string }[] = [];

    let match;
    while ((match = frameRegex.exec(stack)) !== null) {
        frames.push({ func: match[1], file: match[2].trim(), line: match[3] });
    }

    // Find the first non-node_modules, non-next-internal frame
    const userFrame = frames.find(f =>
        !f.file.includes("node_modules") &&
        !f.file.includes("next/dist") &&
        !f.file.includes("webpack") &&
        !f.file.includes("<anonymous>"),
    ) ?? frames[0];

    if (!userFrame) return null;

    return {
        filePath: userFrame.file,
        functionOrComponent: userFrame.func,
        lineRange: userFrame.line,
        before: "",
    };
}

/* -------------------------------------------------------------------------- */
/* Dedup, rank, and limit                                                     */
/* -------------------------------------------------------------------------- */

function deduplicate(recs: Recommendation[]): Recommendation[] {
    const seen = new Set<string>();
    return recs.filter(r => {
        const key = [r.kind, r.immediateAction.slice(0, 60).toLowerCase().trim()].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function rankAndLimit(recs: Recommendation[]): Recommendation[] {
    const kindPriority: Record<RecommendationKind, number> = {
        "exact-code-fix": 5,
        "rollback": 4,
        "config-fix": 3,
        "operational-fix": 3,
        "dependency-fix": 3,
        "investigation-required": 2,
        "insufficient-evidence": 1,
    };

    const priorityWeight: Record<RecommendationPriority, number> = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
    };

    return [...recs]
        .sort((a, b) => {
            const kindDiff = (kindPriority[b.kind] ?? 0) - (kindPriority[a.kind] ?? 0);
            if (kindDiff !== 0) return kindDiff;
            const priDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
            if (priDiff !== 0) return priDiff;
            return b.confidence - a.confidence;
        })
        .slice(0, 5);
}

function uniqueStrings(values: (string | undefined | null)[]): string[] {
    return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

function normalizeId(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}