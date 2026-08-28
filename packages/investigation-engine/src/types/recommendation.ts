export type RecommendationPriority =
    | "LOW"
    | "MEDIUM"
    | "HIGH";

/**
 * Discriminated kind for each recommendation.
 *
 * exact-code-fix       — a specific source-level change is supported by evidence
 * config-fix           — environment variable, secret, or configuration change
 * operational-fix      — manual operational step (migration, rollback command, etc.)
 * rollback             — revert a deployment to restore service
 * dependency-fix       — package version change or API migration
 * investigation-required — evidence is present but the exact fix requires more telemetry
 * insufficient-evidence  — Halo cannot determine the fix from current telemetry
 */
export type RecommendationKind =
    | "exact-code-fix"
    | "config-fix"
    | "operational-fix"
    | "rollback"
    | "dependency-fix"
    | "investigation-required"
    | "insufficient-evidence";

/**
 * A single item in the evidence chain linking a recommendation
 * to the specific telemetry that supports it.
 */
export interface RecommendationEvidenceLink {
    /** ID of the Evidence object this link points to */
    evidenceId: string;

    /** Evidence.type value */
    evidenceType: string;

    /** Role this evidence plays in supporting the recommendation */
    role:
        | "upstream-failure"
        | "error-event"
        | "stack-frame"
        | "deployment"
        | "log"
        | "trace"
        | "session"
        | "configuration"
        | "dependency";

    /** Human-readable excerpt from the evidence (e.g. truncated error message, endpoint, status) */
    excerpt: string;
}

/**
 * A concrete code change derived from real stack frame evidence.
 * MUST NOT be populated when the stack location is not available in evidence.
 */
export interface RecommendationCodePatch {
    /** Repository name if available from telemetry */
    repository?: string;

    /** File path from stack frame or source map */
    filePath: string;

    /** Function or component name from stack frame */
    functionOrComponent?: string;

    /** Line range from stack frame (e.g. "42" or "42-48") */
    lineRange?: string;

    /**
     * The problematic code as it appears in the stack/source.
     * Empty string when source is not available — never fabricated.
     */
    before: string;

    /** The corrected code or pattern */
    after: string;

    /** Explanation of why this change resolves the observed failure */
    explanation: string;

    /** Potential side effects of this change */
    sideEffects?: string;

    /** Any imports that must change */
    importsChanged?: string[];
}

/**
 * A verification step tied to the specific failure, not a generic "reproduce and check".
 */
export interface RecommendationVerification {
    /** Specific steps to verify the fix worked */
    steps: string[];

    /** What a successful outcome looks like (exact status code, log message, metric) */
    expectedOutcome: string;

    /** Optional regression test description */
    regressionTest?: string;
}

/**
 * A prevention improvement relevant to this specific failure class.
 */
export interface RecommendationPrevention {
    items: string[];
    monitoring?: string;
}

/**
 * Rich, evidence-grounded recommendation produced by the recommendation engine.
 *
 * Every populated field must be derivable from actual telemetry in the investigation.
 * Fields that cannot be determined must be absent (optional) rather than filled with
 * placeholder or fabricated content.
 */
export interface Recommendation {
    id: string;

    /**
     * Legacy fields — preserved for compatibility with existing pipeline consumers.
     * The `kind` + structured fields below are the primary output.
     */
    title: string;
    description: string;
    priority: RecommendationPriority;
    confidence: number;
    evidenceIds: string[];
    question?: string;

    /* ------------------------------------------------------------------ */
    /* Rich recommendation fields (new)                                   */
    /* ------------------------------------------------------------------ */

    /** Discriminated fix type */
    kind: RecommendationKind;

    /**
     * One-sentence direct answer: "What exactly should I do right now?"
     * Required for all kinds except insufficient-evidence.
     */
    immediateAction: string;

    /**
     * Precise technical explanation of why the code/config/infrastructure
     * produces the observed failure.
     */
    rootCauseTechnical: string;

    /**
     * Exact code change supported by stack frame evidence.
     * ONLY populated when real source location evidence exists.
     */
    codePatch?: RecommendationCodePatch;

    /**
     * Ordered operational steps for non-code fixes
     * (env variable change, migration command, rollback command, etc.).
     */
    operationalSteps?: string[];

    /**
     * Evidence chain linking every claim in this recommendation
     * to specific telemetry event IDs.
     */
    evidenceChain: RecommendationEvidenceLink[];

    /**
     * Specific verification procedure tied to this exact failure.
     * Never a generic "reproduce and verify".
     */
    verification: RecommendationVerification;

    /**
     * Prevention improvements directly relevant to this failure class.
     */
    prevention: RecommendationPrevention;

    /**
     * What Halo cannot determine from available telemetry.
     * Populated for kind "insufficient-evidence" and "investigation-required".
     */
    unknowns?: {
        whatHaloKnows: string[];
        whatIsMissing: string[];
        requiredEvidence: string;
        why: string;
    };
}