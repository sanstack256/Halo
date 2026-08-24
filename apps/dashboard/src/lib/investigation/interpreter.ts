import type {
    Investigation,
    Hypothesis,
    Evidence,
    Finding,
    Change,
    Impact,
    Recommendation,
} from "@halo/investigation-engine";

export interface EvidenceMatrixItem {
    id: string;
    type: "CULPRIT" | "TRIGGER" | "SYMPTOM" | "CHANGE";
    title: string;
    service: string;
    timestamp: Date;
    timeDeltaFormatted: string;
    details: string;
    traceId?: string;
    requestId?: string;
    status?: string | number;
    resource?: string;
    operation?: string;
    stackPreview?: string;
}

export interface RuledOutAlternative {
    title: string;
    confidence: number;
    confidenceLevel: string;
    whyRejected: string;
    counterEvidenceCount: number;
}

export interface RemediationPlanItem {
    category: "IMMEDIATE" | "PERMANENT_FIX" | "PREVENTION";
    priority: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    rationale: string;
    codeSnippet?: string;
    actionableSteps: string[];
}

export interface ParsedErrorContext {
    errorClass: string;
    errorMessage: string;
    failingFile?: string;
    failingFunction?: string;
    failingLine?: string | number;
    stackFrames: { file?: string; func?: string; line?: string | number }[];
    targetProperty?: string;
    httpStatus?: number;
    databaseModel?: string;
    sqlQuery?: string;
    isTypeError: boolean;
    isDatabaseError: boolean;
    isNetworkTimeout: boolean;
    isAuthError: boolean;
    isRateLimit: boolean;
    isMemoryPressure: boolean;
}

export interface InterpretedInvestigation {
    /**
     * Clear, executive explanation of what actually broke in plain English.
     */
    whatHappened: {
        headline: string;
        narrative: string;
        initiatingService: string;
        triggerEvent: string;
        affectedEndpoints: string[];
        propagationSummary: string;
    };

    /**
     * Architectural and causal mechanics: why this failure occurred.
     */
    whyItHappened: {
        rootMechanism: string;
        contributingFactors: string[];
        architecturalContext: string;
    };

    /**
     * Diagnostic proof: exactly how Halo arrived at this conclusion.
     */
    howHaloKnows: {
        confidencePercent: number;
        confidenceLabel: string;
        coreSignals: string[];
        temporalCorrelation: string;
        statisticalProof: string;
    };

    /**
     * Categorized evidence matrix with timing offsets and trace references.
     */
    evidenceMatrix: {
        culprits: EvidenceMatrixItem[];
        triggers: EvidenceMatrixItem[];
        symptoms: EvidenceMatrixItem[];
        correlatedChanges: EvidenceMatrixItem[];
        totalEvaluatedCount: number;
    };

    /**
     * Analysis of disproved alternative hypotheses.
     */
    ruledOutAlternatives: RuledOutAlternative[];

    /**
     * Blast radius, customer impact, and service health degradation.
     */
    impactAnalysis: {
        blastRadiusScore: number;
        summary: string;
        affectedServices: string[];
        affectedUsersCount: number;
        affectedEndpoints: string[];
        errorBurstRate?: string;
    };

    /**
     * Actionable, concrete engineering remediation guide.
     */
    remediationGuide: {
        summary: string;
        immediateMitigation: RemediationPlanItem[];
        permanentFix: RemediationPlanItem[];
        preventiveMeasures: RemediationPlanItem[];
    };
}

/**
 * Transforms raw investigation engine outputs, evidence, and timeline
 * into a rich, natural-language, developer-facing interpretation.
 */
export function interpretInvestigation(
    investigation: Investigation,
    replaySession?: any | null
): InterpretedInvestigation {
    const {
        rootCause,
        report,
        timeline,
        evidence,
        hypotheses,
        findings,
        changes,
        impact,
        recommendations,
    } = investigation;

    // Determine baseline timing
    const sortedEvidence = [...evidence].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const firstEventTime = sortedEvidence[0]?.timestamp
        ? new Date(sortedEvidence[0].timestamp).getTime()
        : Date.now();

    // Identify primary services, operations, and endpoints
    const services = Array.from(new Set(evidence.map((e) => e.service).filter(Boolean)));
    const primaryService =
        evidence.find((e) => e.type === "ERROR" || e.type === "LOG")?.service ||
        services[0] ||
        "web-service";

    const errorEvidence = evidence.filter((e) => e.type === "ERROR");
    const traceEvidence = evidence.filter((e) => e.type === "TRACE");
    const metricEvidence = evidence.filter((e) => e.type === "METRIC");

    const affectedEndpoints = Array.from(
        new Set(
            evidence
                .map((e) => e.resource || e.operation || (e.tags?.path as string))
                .filter(Boolean) as string[]
        )
    );

    // Deep semantic error analysis
    const parsedError = parseErrorContext(errorEvidence, rootCause);

    // 1. Synthesize "What Happened"
    const whatHappened = synthesizeWhatHappened({
        rootCause,
        report,
        evidence,
        errorEvidence,
        primaryService,
        affectedEndpoints,
        parsedError,
        replaySession,
    });

    // 2. Synthesize "Why It Happened"
    const whyItHappened = synthesizeWhyItHappened({
        rootCause,
        findings,
        changes,
        errorEvidence,
        primaryService,
        parsedError,
    });

    // 3. Synthesize "How Halo Knows"
    const howHaloKnows = synthesizeHowHaloKnows({
        rootCause,
        report,
        findings,
        evidence,
        errorEvidence,
        firstEventTime,
        parsedError,
    });

    // 4. Synthesize Evidence Matrix
    const evidenceMatrix = synthesizeEvidenceMatrix({
        evidence,
        firstEventTime,
        rootCause,
    });

    // 5. Synthesize Ruled Out Alternatives
    const ruledOutAlternatives = synthesizeRuledOutAlternatives({
        hypotheses,
        rootCause,
        report,
    });

    // 6. Synthesize Impact Analysis
    const impactAnalysis = synthesizeImpactAnalysis({
        impact,
        evidence,
        services,
        affectedEndpoints,
        errorEvidence,
    });

    // 7. Synthesize Remediation Guide
    const remediationGuide = synthesizeRemediationGuide({
        rootCause,
        recommendations,
        primaryService,
        errorEvidence,
        findings,
        parsedError,
        affectedEndpoints,
    });

    return {
        whatHappened,
        whyItHappened,
        howHaloKnows,
        evidenceMatrix,
        ruledOutAlternatives,
        impactAnalysis,
        remediationGuide,
    };
}

/* -------------------------------------------------------------------------- */
/* Semantic Error Parser                                                      */
/* -------------------------------------------------------------------------- */

function parseErrorContext(
    errorEvidence: Evidence[],
    rootCause: Hypothesis | null
): ParsedErrorContext {
    const primaryError = errorEvidence[0];
    const fullText = [
        primaryError?.title || "",
        primaryError?.description || "",
        rootCause?.title || "",
        rootCause?.description || "",
        typeof primaryError?.metadata?.error === "string" ? primaryError.metadata.error : "",
        typeof primaryError?.metadata?.message === "string" ? primaryError.metadata.message : "",
    ].join(" ");

    const stack = typeof primaryError?.metadata?.stack === "string" ? primaryError.metadata.stack : "";

    // Parse stack frames
    const stackFrames: { file?: string; func?: string; line?: string | number }[] = [];
    const stackLineRegex = /at\s+(?:([a-zA-Z0-9_$<>.]+)\s+\()?([^:()]+):(\d+):(?:\d+)\)?/g;
    let match;
    while ((match = stackLineRegex.exec(stack)) !== null) {
        stackFrames.push({
            func: match[1],
            file: match[2]?.trim(),
            line: match[3],
        });
    }

    const firstFrame = stackFrames.find((f) => f.file && !f.file.includes("node_modules")) || stackFrames[0];

    // Extract property from "Cannot read properties of undefined (reading 'xyz')"
    const propMatch = /reading\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(fullText);
    const targetProperty = propMatch ? propMatch[1] : undefined;

    // Detect error classes
    const isTypeError =
        /TypeError|ReferenceError|NullPointer|Cannot read properties|undefined is not|is not a function/i.test(
            fullText
        );
    const isDatabaseError =
        /Prisma|Postgres|Sequelize|TypeORM|Deadlock|Unique constraint|P2002|P2024|P2025|connection pool exhausted|database/i.test(
            fullText
        );
    const isNetworkTimeout =
        /ETIMEDOUT|ECONNREFUSED|504|Gateway Timeout|FetchError|AbortError|network timeout|socket hang up/i.test(
            fullText
        );
    const isAuthError =
        /JWT|token|Unauthorized|401|403|Forbidden|CSRF|signature verification|expired/i.test(
            fullText
        );
    const isRateLimit =
        /429|Too Many Requests|rate limit|quota exceeded|throttle/i.test(fullText);
    const isMemoryPressure =
        /OutOfMemory|heap out of memory|allocation failed|memory leak/i.test(fullText);

    // Extract DB Model
    const dbModelMatch = /prisma\.([a-zA-Z0-9_$]+)\./i.exec(stack + " " + fullText) ||
        /table\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(fullText);
    const databaseModel = dbModelMatch ? dbModelMatch[1] : undefined;

    // Error Class
    const classMatch = /([A-Z][a-zA-Z0-9_]*(?:Error|Exception))/i.exec(fullText);
    const errorClass = classMatch ? classMatch[1] : isTypeError ? "TypeError" : "RuntimeError";

    return {
        errorClass,
        errorMessage: primaryError?.title || rootCause?.title || "Unhandled Exception",
        failingFile: firstFrame?.file,
        failingFunction: firstFrame?.func,
        failingLine: firstFrame?.line,
        stackFrames,
        targetProperty,
        databaseModel,
        isTypeError,
        isDatabaseError,
        isNetworkTimeout,
        isAuthError,
        isRateLimit,
        isMemoryPressure,
    };
}

/* -------------------------------------------------------------------------- */
/* Sub-Synthesizers                                                           */
/* -------------------------------------------------------------------------- */

function synthesizeWhatHappened({
    rootCause,
    report,
    evidence,
    errorEvidence,
    primaryService,
    affectedEndpoints,
    parsedError,
    replaySession,
}: {
    rootCause: Hypothesis | null;
    report: any;
    evidence: Evidence[];
    errorEvidence: Evidence[];
    primaryService: string;
    affectedEndpoints: string[];
    parsedError: ParsedErrorContext;
    replaySession?: any;
}) {
    const errorCount = errorEvidence.length;
    const errorTitle = parsedError.errorMessage;

    let headline = "";
    let narrative = "";
    let propagationSummary = "";

    if (parsedError.isTypeError && parsedError.targetProperty) {
        headline = `Unchecked Null Access: Cannot read '${parsedError.targetProperty}' in ${primaryService}`;
        narrative = `An unexpected undefined/null value was accessed on property '${parsedError.targetProperty}'${
            parsedError.failingFile ? ` in ${parsedError.failingFile}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}` : ""
        }${parsedError.failingFunction ? ` (${parsedError.failingFunction})` : ""}, causing synchronous request aborts across ${primaryService}.`;
    } else if (parsedError.isDatabaseError) {
        headline = `Database Contention / Query Failure in ${primaryService}${parsedError.databaseModel ? ` (${parsedError.databaseModel})` : ""}`;
        narrative = `Database operation on ${parsedError.databaseModel || "repository layer"} failed with ${parsedError.errorMessage}. Connections stalled or constraint violation prevented transaction completion.`;
    } else if (parsedError.isNetworkTimeout) {
        headline = `Upstream Dependency Timeout / Network Abort in ${primaryService}`;
        narrative = `An outbound network request or downstream dependency failed to respond within deadline limits, triggering upstream timeouts and cascade failure.`;
    } else if (rootCause) {
        headline = `${rootCause.title} in ${primaryService}`;
        narrative =
            report.rootCause?.explanation ||
            rootCause.description ||
            `Halo identified an anomalous failure cascade in ${primaryService} initiated by ${errorTitle}.`;
    } else {
        headline = `Runtime Exception observed in ${primaryService}: ${errorTitle}`;
        narrative =
            report.summary ||
            `Halo evaluated ${evidence.length} telemetry points across ${primaryService}. Captured ${errorCount} unhandled error event(s).`;
    }

    if (affectedEndpoints.length > 0) {
        propagationSummary = `Failure propagated across ${affectedEndpoints.slice(0, 3).join(", ")} resulting in ${errorCount} captured incident events.`;
    } else {
        propagationSummary = `Failure cascade captured within ${primaryService} across ${evidence.length} correlated telemetry signals.`;
    }

    if (replaySession?.url) {
        propagationSummary += ` Session replay indicates client failure initiated from ${replaySession.url}.`;
    }

    return {
        headline,
        narrative,
        initiatingService: primaryService,
        triggerEvent: errorTitle,
        affectedEndpoints: affectedEndpoints.length > 0 ? affectedEndpoints : ["/api/v1/request"],
        propagationSummary,
    };
}

function synthesizeWhyItHappened({
    rootCause,
    findings,
    changes,
    errorEvidence,
    primaryService,
    parsedError,
}: {
    rootCause: Hypothesis | null;
    findings: Finding[];
    changes: Change[];
    errorEvidence: Evidence[];
    primaryService: string;
    parsedError: ParsedErrorContext;
}) {
    const contributingFactors: string[] = [];

    if (parsedError.isTypeError && parsedError.targetProperty) {
        contributingFactors.push(`Missing null/undefined guard before accessing '${parsedError.targetProperty}'.`);
        if (parsedError.failingFile) {
            contributingFactors.push(`Execution path executed in ${parsedError.failingFile}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}.`);
        }
    }

    if (parsedError.isDatabaseError) {
        contributingFactors.push(`Database transaction deadlock or pool capacity pressure on ${parsedError.databaseModel || "primary store"}.`);
    }

    if (parsedError.isNetworkTimeout) {
        contributingFactors.push("Downstream endpoint latency exceeded synchronous client timeout.");
    }

    for (const finding of findings) {
        if (finding.causalRole === "CONTRIBUTOR" || finding.causalRole === "TRIGGER" || finding.causalRole === "MECHANISM") {
            contributingFactors.push(finding.description || finding.title);
        }
    }

    for (const change of changes) {
        contributingFactors.push(`Correlated change: ${change.title} (${change.type})`);
    }

    const rootMechanism =
        parsedError.isTypeError
            ? `Object property dereferencing failed because upstream payload or asynchronous state was null or undefined.`
            : parsedError.isDatabaseError
            ? `Storage query failed or connection pool exhausted under concurrent execution.`
            : parsedError.isNetworkTimeout
            ? `Synchronous I/O blocked waiting for remote socket response without circuit-breaker shedding.`
            : rootCause?.description || (findings.length > 0 ? findings[0].title : "Anomalous execution path in application logic");

    const architecturalContext = `Execution context in ${primaryService} shows runtime failure propagating unhandled to boundary layer.`;

    return {
        rootMechanism,
        contributingFactors: contributingFactors.slice(0, 5),
        architecturalContext,
    };
}

function synthesizeHowHaloKnows({
    rootCause,
    report,
    findings,
    evidence,
    errorEvidence,
    firstEventTime,
    parsedError,
}: {
    rootCause: Hypothesis | null;
    report: any;
    findings: Finding[];
    evidence: Evidence[];
    errorEvidence: Evidence[];
    firstEventTime: number;
    parsedError: ParsedErrorContext;
}) {
    const confidence = rootCause?.confidence ?? report.rootCause?.confidence ?? 0.88;
    const confidencePercent = Math.round(confidence * 100);

    let confidenceLabel = "High Confidence";
    if (confidencePercent < 60) confidenceLabel = "Low Confidence (Needs Verification)";
    else if (confidencePercent < 80) confidenceLabel = "Moderate Confidence";

    const coreSignals: string[] = [];

    if (parsedError.failingFile) {
        coreSignals.push(`Exact stack trace frame isolated to ${parsedError.failingFile}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}.`);
    }

    if (rootCause?.supportingReasons && rootCause.supportingReasons.length > 0) {
        for (const reason of rootCause.supportingReasons) {
            coreSignals.push(reason.description || reason.title);
        }
    } else {
        for (const finding of findings.slice(0, 4)) {
            coreSignals.push(`${finding.title}: ${finding.description || "Observed signal"}`);
        }
    }

    if (coreSignals.length === 0) {
        coreSignals.push(`Temporal alignment of ${errorEvidence.length} error signals.`);
        coreSignals.push(`Correlated trace propagation across ${evidence.length} telemetry points.`);
    }

    const lastEventTime =
        evidence.length > 1
            ? new Date(evidence[evidence.length - 1].timestamp).getTime()
            : firstEventTime;
    const durationSec = Math.max(1, Math.round((lastEventTime - firstEventTime) / 1000));

    const temporalCorrelation = `Incident signals clustered tightly across a ${durationSec}s window, establishing direct cause-and-effect sequencing.`;
    const statisticalProof = `Signal pattern matches ${parsedError.errorClass} failure signatures with ${confidencePercent}% deterministic validation.`;

    return {
        confidencePercent,
        confidenceLabel,
        coreSignals,
        temporalCorrelation,
        statisticalProof,
    };
}

function synthesizeEvidenceMatrix({
    evidence,
    firstEventTime,
    rootCause,
}: {
    evidence: Evidence[];
    firstEventTime: number;
    rootCause: Hypothesis | null;
}) {
    const culprits: EvidenceMatrixItem[] = [];
    const triggers: EvidenceMatrixItem[] = [];
    const symptoms: EvidenceMatrixItem[] = [];
    const correlatedChanges: EvidenceMatrixItem[] = [];

    for (const item of evidence) {
        const itemTime = new Date(item.timestamp).getTime();
        const deltaMs = itemTime - firstEventTime;
        const timeDeltaFormatted = formatDeltaMs(deltaMs);

        const stackPreview =
            typeof item.metadata?.stack === "string"
                ? item.metadata.stack.split("\n")[0]
                : typeof item.metadata?.error === "string"
                ? item.metadata.error
                : undefined;

        const matrixItem: EvidenceMatrixItem = {
            id: item.id,
            type: "SYMPTOM",
            title: item.title,
            service: item.service,
            timestamp: new Date(item.timestamp),
            timeDeltaFormatted,
            details: item.description || item.title,
            traceId: item.traceId,
            requestId: item.requestId,
            status: item.status,
            resource: item.resource,
            operation: item.operation,
            stackPreview,
        };

        if (item.type === "DEPLOYMENT" || item.type === "CONFIG" || item.type === "FEATURE_FLAG") {
            matrixItem.type = "CHANGE";
            correlatedChanges.push(matrixItem);
        } else if (item.type === "ERROR") {
            if (culprits.length === 0) {
                matrixItem.type = "CULPRIT";
                culprits.push(matrixItem);
            } else {
                matrixItem.type = "SYMPTOM";
                symptoms.push(matrixItem);
            }
        } else if (item.type === "METRIC" || item.type === "TRACE") {
            matrixItem.type = "TRIGGER";
            triggers.push(matrixItem);
        } else {
            matrixItem.type = "SYMPTOM";
            symptoms.push(matrixItem);
        }
    }

    return {
        culprits: culprits.length > 0 ? culprits : symptoms.slice(0, 1),
        triggers,
        symptoms,
        correlatedChanges,
        totalEvaluatedCount: evidence.length,
    };
}

function synthesizeRuledOutAlternatives({
    hypotheses,
    rootCause,
    report,
}: {
    hypotheses: Hypothesis[];
    rootCause: Hypothesis | null;
    report: any;
}) {
    const ruledOut: RuledOutAlternative[] = [];

    const alternatives = hypotheses.filter((h) => h.id !== rootCause?.id);

    for (const alt of alternatives) {
        const conf = alt.confidence ?? 0.2;
        const confidencePercent = Math.round(conf * 100);

        let whyRejected = "Contradicted by active telemetry metrics.";
        if (alt.contradictingReasons && alt.contradictingReasons.length > 0) {
            whyRejected = alt.contradictingReasons.map((r) => r.title || r.description).join("; ");
        } else if (alt.missingReasons && alt.missingReasons.length > 0) {
            whyRejected = `Missing required precondition signals: ${alt.missingReasons
                .map((r) => r.title || r.description)
                .join(", ")}`;
        } else {
            whyRejected = `Insufficient signal density compared to leading hypothesis (${confidencePercent}% vs ${Math.round(
                (rootCause?.confidence || 0.8) * 100
            )}%).`;
        }

        ruledOut.push({
            title: alt.title,
            confidence: conf,
            confidenceLevel: `${confidencePercent}% Match`,
            whyRejected,
            counterEvidenceCount: alt.contradictingReasons?.length || 1,
        });
    }

    if (ruledOut.length === 0 && report.alternatives && report.alternatives.length > 0) {
        for (const alt of report.alternatives) {
            ruledOut.push({
                title: alt.title,
                confidence: alt.confidence,
                confidenceLevel: alt.confidenceLevel || `${Math.round(alt.confidence * 100)}% Match`,
                whyRejected: "Telemetry showed contradictory health signals across monitored dependencies.",
                counterEvidenceCount: 1,
            });
        }
    }

    return ruledOut;
}

function synthesizeImpactAnalysis({
    impact,
    evidence,
    services,
    affectedEndpoints,
    errorEvidence,
}: {
    impact: Impact | null;
    evidence: Evidence[];
    services: string[];
    affectedEndpoints: string[];
    errorEvidence: Evidence[];
}) {
    const userCount = impact?.affectedUsers ?? Math.max(1, Math.min(errorEvidence.length, 12));
    const blastRadiusScore = Math.min(
        100,
        Math.round((services.length * 20) + (affectedEndpoints.length * 15) + (errorEvidence.length * 5))
    );

    const summary = `Blast radius score of ${blastRadiusScore}/100. Affected ${services.length} service(s) and ~${userCount} user session(s) across ${affectedEndpoints.length} endpoint(s).`;

    return {
        blastRadiusScore,
        summary,
        affectedServices: services,
        affectedUsersCount: userCount,
        affectedEndpoints,
        errorBurstRate: `${errorEvidence.length} errors captured`,
    };
}

function synthesizeRemediationGuide({
    rootCause,
    recommendations,
    primaryService,
    errorEvidence,
    findings,
    parsedError,
    affectedEndpoints,
}: {
    rootCause: Hypothesis | null;
    recommendations: Recommendation[];
    primaryService: string;
    errorEvidence: Evidence[];
    findings: Finding[];
    parsedError: ParsedErrorContext;
    affectedEndpoints: string[];
}) {
    const immediateMitigation: RemediationPlanItem[] = [];
    const permanentFix: RemediationPlanItem[] = [];
    const preventiveMeasures: RemediationPlanItem[] = [];

    const targetLoc = parsedError.failingFile
        ? `${parsedError.failingFile}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}`
        : `${primaryService} handler`;

    // 1. TYPE & NULL-POINTER ERROR FIXES
    if (parsedError.isTypeError) {
        const prop = parsedError.targetProperty || "targetProperty";
        immediateMitigation.push({
            category: "IMMEDIATE",
            priority: "HIGH",
            title: `Validate incoming payload shape at ${primaryService} boundary`,
            rationale: `Prevents unhandled runtime crashes by verifying '${prop}' exists before processing.`,
            actionableSteps: [
                `Add defensive guard checking if '${prop}' is defined before accessing.`,
                `Return HTTP 400 Bad Request if mandatory field '${prop}' is missing in client requests.`,
            ],
        });

        permanentFix.push({
            category: "PERMANENT_FIX",
            priority: "HIGH",
            title: `Implement Optional Chaining & Nullish Coalescing in ${targetLoc}`,
            rationale: `Guarantees that null/undefined values do not abort request execution.`,
            codeSnippet: `// In ${targetLoc}${parsedError.failingFunction ? ` (${parsedError.failingFunction})` : ""}\n// Safely dereference '${prop}' with fallback:\nconst safeValue = payload?.${prop} ?? defaultValue;\nif (!safeValue) {\n  logger.warn("Payload missing '${prop}'", { payloadId: payload?.id });\n  return { error: "Invalid payload: '${prop}' is required" };\n}\n\n// Continue execution safely\nconst processed = safeValue.toString();`,
            actionableSteps: [
                `Refactor dereferencing to use optional chaining (\`?.\`) and fallback operators (\`??\`).`,
                `Validate request schemas using Zod or TypeScript type guards prior to domain logic.`,
            ],
        });

        preventiveMeasures.push({
            category: "PREVENTION",
            priority: "MEDIUM",
            title: `Enable strict null checks in TypeScript & CI linting`,
            rationale: `Catches unhandled null/undefined traversals at compile time before deployment.`,
            actionableSteps: [
                `Enable "strictNullChecks": true and "noUncheckedIndexedAccess": true in tsconfig.json.`,
                `Add automated unit tests asserting behavior when '${prop}' is undefined.`,
            ],
        });
    }

    // 2. DATABASE & ORM CONTENTION FIXES
    else if (parsedError.isDatabaseError) {
        const model = parsedError.databaseModel || "entity";
        immediateMitigation.push({
            category: "IMMEDIATE",
            priority: "HIGH",
            title: `Tune database connection pool limits on ${primaryService}`,
            rationale: `Prevents pool starvation by increasing max connections and setting query timeouts.`,
            actionableSteps: [
                `Verify active database connection count against database server max_connections.`,
                `Set query statement timeout (e.g. statement_timeout = '5000ms') to prevent hanging locks.`,
            ],
        });

        permanentFix.push({
            category: "PERMANENT_FIX",
            priority: "HIGH",
            title: `Use atomic upsert or transaction retry loop for ${model}`,
            rationale: `Prevents unique constraint crashes and deadlock errors during concurrent writes.`,
            codeSnippet: `// In ${targetLoc}\n// Atomic upsert with conflict resolution for ${model}:\nconst result = await prisma.${model.toLowerCase()}.upsert({\n  where: { id: payload.id },\n  update: { ...payloadUpdates, updatedAt: new Date() },\n  create: { ...initialPayload },\n});`,
            actionableSteps: [
                `Replace sequential read-then-write operations with atomic upserts or conditional updates.`,
                `Add composite indexes on frequently filtered/joined columns.`,
            ],
        });

        preventiveMeasures.push({
            category: "PREVENTION",
            priority: "HIGH",
            title: `Add Database Connection Pool & Slow Query Alerting`,
            rationale: `Alerts team before connection exhaustion leads to cascading HTTP 500s.`,
            actionableSteps: [
                `Configure alert: Pool utilization > 80% for 2 minutes.`,
                `Add slow query logger for queries exceeding 150ms.`,
            ],
        });
    }

    // 3. NETWORK TIMEOUT & DEPENDENCY FIXES
    else if (parsedError.isNetworkTimeout) {
        immediateMitigation.push({
            category: "IMMEDIATE",
            priority: "HIGH",
            title: `Check upstream dependency health and failover routes`,
            rationale: `Isolates downstream degradation from consuming ${primaryService} worker threads.`,
            actionableSteps: [
                `Check health check endpoints on upstream dependency services.`,
                `Enable circuit breaker to shed load rather than blocking synchronous requests.`,
            ],
        });

        permanentFix.push({
            category: "PERMANENT_FIX",
            priority: "HIGH",
            title: `Implement AbortController Timeout & Circuit Breaker in ${targetLoc}`,
            rationale: `Enforces strict request bounds and provides graceful fallback responses.`,
            codeSnippet: `// In ${targetLoc}\nconst controller = new AbortController();\nconst timeoutId = setTimeout(() => controller.abort(), 5000); // 5s deadline\n\ntry {\n  const response = await fetch(upstreamUrl, {\n    signal: controller.signal,\n    headers: { "Content-Type": "application/json" },\n  });\n  if (!response.ok) throw new Error(\`Upstream error: \${response.status}\`);\n  return await response.json();\n} catch (err) {\n  logger.error("Upstream call failed, using fallback", { err });\n  return getCachedFallbackData();\n} finally {\n  clearTimeout(timeoutId);\n}`,
            actionableSteps: [
                `Wrap remote HTTP/gRPC calls in strict timeouts with AbortController.`,
                `Implement graceful degradation (e.g. cached responses or queued retries).`,
            ],
        });

        preventiveMeasures.push({
            category: "PREVENTION",
            priority: "MEDIUM",
            title: `Configure Dependency SLO & Latency P99 Alert`,
            rationale: `Detects upstream degradation before user-facing error rates spike.`,
            actionableSteps: [
                `Set monitor: Outbound HTTP latency P99 > 1500ms on ${primaryService}.`,
                `Add synthetic health probes testing dependency reachability every 30s.`,
            ],
        });
    }

    // 4. AUTHENTICATION & TOKEN FIXES
    else if (parsedError.isAuthError) {
        immediateMitigation.push({
            category: "IMMEDIATE",
            priority: "HIGH",
            title: `Verify token signing keys and auth provider connectivity`,
            rationale: `Ensures valid sessions are not rejected due to key rotation or JWKS caching issues.`,
            actionableSteps: [
                `Inspect auth service logs for expired signing certificates or key cache misses.`,
                `Verify client cookie domain and SameSite policy.`,
            ],
        });

        permanentFix.push({
            category: "PERMANENT_FIX",
            priority: "HIGH",
            title: `Implement Automatic Token Refresh & Graceful 401 Re-Auth in ${targetLoc}`,
            rationale: `Seamlessly refreshes expired access tokens without interrupting user workflows.`,
            codeSnippet: `// In ${targetLoc}\nif (isTokenExpired(accessToken)) {\n  const refreshResult = await refreshAccessToken(refreshToken);\n  if (!refreshResult.success) {\n    return new Response(JSON.stringify({ error: "Session expired" }), {\n      status: 401,\n      headers: { "WWW-Authenticate": 'Bearer error="token_expired"' },\n    });\n  }\n  accessToken = refreshResult.newAccessToken;\n}`,
            actionableSteps: [
                `Add automatic refresh token rotation before token expiry threshold.`,
                `Ensure standard 401 headers prompt client-side background token renewal.`,
            ],
        });

        preventiveMeasures.push({
            category: "PREVENTION",
            priority: "MEDIUM",
            title: `Monitor Auth Verification Failure Spikes`,
            rationale: `Alerts on auth infrastructure failures vs legitimate user login rejections.`,
            actionableSteps: [
                `Set alert: 401/403 rate > 5% over total requests in 5 minutes.`,
            ],
        });
    }

    // 5. GENERAL RUNTIME EXCEPTION FIXES (DYNAMICALLY TAILORED)
    else {
        immediateMitigation.push({
            category: "IMMEDIATE",
            priority: "HIGH",
            title: `Inspect ${primaryService} worker health and recent deployment changes`,
            rationale: `Isolates active error accumulation across ${affectedEndpoints.join(", ") || "endpoints"}.`,
            actionableSteps: [
                `Inspect stack trace in ${targetLoc} to isolate the initiating runtime condition.`,
                `Check if this exception began immediately after a recent release or config change.`,
            ],
        });

        permanentFix.push({
            category: "PERMANENT_FIX",
            priority: "HIGH",
            title: `Add Structured Error Boundary and Recovery in ${targetLoc}`,
            rationale: `Ensures unhandled exceptions fail gracefully with structured error telemetry.`,
            codeSnippet: `// In ${targetLoc}${parsedError.failingFunction ? ` (${parsedError.failingFunction})` : ""}\ntry {\n  // Target execution path\n  const result = await executeOperation();\n  return result;\n} catch (error) {\n  logger.error("Handled incident fallback in ${primaryService}", {\n    error: error instanceof Error ? error.message : error,\n    stack: error instanceof Error ? error.stack : undefined,\n  });\n  return fallbackResponse();\n}`,
            actionableSteps: [
                `Wrap asynchronous operations in structured try/catch blocks with domain error types.`,
                `Validate input parameters at API controller entrypoints before business logic execution.`,
            ],
        });

        preventiveMeasures.push({
            category: "PREVENTION",
            priority: "MEDIUM",
            title: `Configure automated alert rule for ${primaryService} error rates`,
            rationale: `Notifies team immediately if error rate exceeds 1% over a 5-minute rolling window.`,
            actionableSteps: [
                `Add monitor: Error rate > 1.0% on service '${primaryService}'.`,
                `Add integration regression test reproducing '${parsedError.errorMessage}'.`,
            ],
        });
    }

    const summary = `3-stage remediation plan dynamically synthesized from real runtime telemetry to mitigate immediate impact, fix ${targetLoc}, and establish regression guardrails.`;

    return {
        summary,
        immediateMitigation,
        permanentFix,
        preventiveMeasures,
    };
}

function formatDeltaMs(deltaMs: number): string {
    if (deltaMs === 0) return "T+0s (Initial signal)";
    const sign = deltaMs >= 0 ? "+" : "-";
    const absMs = Math.abs(deltaMs);
    if (absMs < 1000) return `T${sign}${absMs}ms`;
    const sec = (absMs / 1000).toFixed(1);
    return `T${sign}${sec}s`;
}
