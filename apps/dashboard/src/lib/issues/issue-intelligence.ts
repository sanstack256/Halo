import { prisma } from "../prisma";
import { parseTimeRange } from "../analytics/time";

export type EvidenceStatus =
    | "OBSERVED"
    | "SUPPORTED"
    | "INFERRED"
    | "UNCERTAIN"
    | "UNKNOWN"
    | "INSUFFICIENT_EVIDENCE";

export type InvestigationReadinessStatus =
    | "READY"
    | "PARTIALLY_READY"
    | "BLOCKED_BY_TELEMETRY"
    | "INSUFFICIENT_EVIDENCE";

export type TriageCategory =
    | "INVESTIGATE_NOW"
    | "WORTH_INVESTIGATING"
    | "NEEDS_EVIDENCE"
    | "STABLE_MONITOR";

export type SurgeStatus =
    | "SURGE_OBSERVED"
    | "NO_COMPARABLE_BASELINE"
    | "NO_MATERIAL_CHANGE"
    | "REDUCED_ACTIVITY"
    | "INSUFFICIENT_OBSERVATION"
    | "NOT_APPLICABLE";

export type PatternEvidenceStrength = "ROBUST" | "MODERATE" | "LIMITED";

export interface IssueIntelligenceParams {
    organizationId?: string;
    projectId?: string;
    service?: string;
    environment?: string;
    release?: string;
    timeRangeKey?: string;
    search?: string;
}

/* ========================================================================== */
/* 1. TRIAGE PROJECTION TYPES                                                 */
/* ========================================================================== */

export interface TriageCandidate {
    id: string;
    issueId: string;
    title: string;
    fingerprint: string;
    projectId: string;
    projectName: string;
    service: string;
    environment: string;
    category: TriageCategory;
    firstObserved: Date;
    lastObserved: Date;
    hoursSinceLastSeen: number;
    eventCount: number;
    recentEventCount: number;
    baselineEventCount: number;
    surge: {
        status: SurgeStatus;
        changePct: number | null;
        explanation: string;
    };
    severity: string;
    status: string;
    readiness: {
        status: InvestigationReadinessStatus;
        availableEvidence: string[];
        missingEvidence: string[];
        whatCanBeEstablished: string;
        whatCannotBeEstablished: string;
        nextUsefulAction: string;
    };
    whyThisIsHere: string;
    impactSummary: {
        affectedRequests: number | null;
        affectedRequestsStatus: EvidenceStatus;
        affectedServices: string[];
    };
    hasInvestigation: boolean;
    investigationId?: string;
}

export interface TriageProjection {
    candidates: TriageCandidate[];
    summary: {
        total: number;
        investigateNow: number;
        worthInvestigating: number;
        needsEvidence: number;
        stableMonitor: number;
        readyCount: number;
        partiallyReadyCount: number;
        blockedCount: number;
        insufficientCount: number;
    };
    timeRange: { key: string; start: Date; end: Date };
}

/* ========================================================================== */
/* 2. PATTERNS PROJECTION TYPES                                               */
/* ========================================================================== */

export interface FailureFingerprintStep {
    stage: "TRIGGER" | "BOUNDARY" | "DOWNSTREAM" | "FAILURE";
    label: string;
    value: string;
    evidenceStatus: EvidenceStatus;
    evidenceDetail: string;
}

export interface FailurePattern {
    id: string;
    name: string;
    behavioralSignature: string;
    failureBoundary: string;
    exceptionClass: string;
    httpStatus: string | null;
    dependencyType: string | null;
    evidenceStrength: PatternEvidenceStrength;
    whyThisIsAPattern: string;
    commonObservedBehavior: string;
    fingerprintSteps: FailureFingerprintStep[];
    occurrencesCount: number;
    issuesCount: number;
    associatedIssues: Array<{ id: string; title: string; service: string; projectId: string; occurrences: number }>;
    affectedServices: string[];
    affectedRoutes: string[];
    affectedReleases: string[];
    firstObserved: Date;
    lastObserved: Date;
    invariants: string[];
    divergences: string[];
    evidenceStatus: EvidenceStatus;
    evidenceExplanation: string;
}

export interface PatternsProjection {
    patterns: FailurePattern[];
    summary: {
        totalPatterns: number;
        totalAffectedIssues: number;
        crossServicePatterns: number;
    };
    hasMeaningfulPatterns: boolean;
    emptyReason?: string;
    timeRange: { key: string; start: Date; end: Date };
}

/* ========================================================================== */
/* 3. IMPACT PROJECTION TYPES                                                 */
/* ========================================================================== */

export interface ImpactLayer {
    layer: "OBSERVATION" | "REQUESTS" | "SERVICES" | "OPERATIONS" | "SESSIONS";
    label: string;
    count: number | null; // NULL when UNKNOWN, ZERO only when verified 0
    isAvailable: boolean;
    evidenceStatus: EvidenceStatus;
    evidenceDetail: string;
    items?: string[];
}

export interface IssueImpact {
    issueId: string;
    title: string;
    service: string;
    environment: string;
    firstSeen: Date;
    lastSeen: Date;
    layers: ImpactLayer[];
    propagationSummary: string;
}

export interface ImpactProjection {
    impacts: IssueImpact[];
    summary: {
        totalEvaluatedIssues: number;
        totalObservedRequests: number | null;
        totalObservedServices: number;
        sessionLinkageAvailable: boolean;
    };
    timeRange: { key: string; start: Date; end: Date };
}

/* ========================================================================== */
/* 4. EVOLUTION PROJECTION TYPES                                              */
/* ========================================================================== */

export interface IssueDNAVersion {
    version?: string; // Only set when a real transition exists (e.g. "DNA v1.0")
    detectedAt: Date;
    failureBoundary: string;
    responseStatus: string;
    dependencyInvolvement: string;
    retryBehavior: "OBSERVED" | "NONE_DETECTED" | "UNKNOWN";
    exceptionClass: string;
    summary: string;
}

export interface EvolutionTransition {
    id: string;
    type: "TRANSITION" | "GAP";
    timestamp: Date;
    untilTimestamp?: Date;
    gapDurationHours?: number;
    title: string;
    description: string;
    dnaVersion?: string;
    diffs?: Array<{ property: string; previous: string; current: string }>;
    evidence: string;
    evidenceStatus: EvidenceStatus;
}

export interface IssueEvolution {
    issueId: string;
    title: string;
    service: string;
    hasTransition: boolean;
    dnaStatesRecorded: number;
    currentDNA: IssueDNAVersion;
    dnaHistory: IssueDNAVersion[];
    timeline: EvolutionTransition[];
    transitionSummary: string;
}

export interface EvolutionProjection {
    evolutions: IssueEvolution[];
    summary: {
        totalTracked: number;
        behaviorShiftsDetected: number;
        telemetryGapsDetected: number;
    };
    timeRange: { key: string; start: Date; end: Date };
}

/* ========================================================================== */
/* 5. EVIDENCE GAPS PROJECTION TYPES                                          */
/* ========================================================================== */

export interface EvidenceGap {
    id: string;
    category:
        | "DISTRIBUTED_TRACE_LINKAGE"
        | "DATABASE_QUERY_TELEMETRY"
        | "USER_SESSION_LINKAGE"
        | "DEPLOYMENT_RELEASE_TAG";
    title: string;
    description: string;
    blockedIssuesCount: number;
    blockedInvestigationCapabilitiesCount: number;
    blockedIssues: Array<{ id: string; title: string; service: string; projectId: string; severity: string }>;
    affectedServices: string[];
    whatItPrevents: string;
    leverageScore: number; // Internal ranking weight
    whyThisRanksHigh: string;
    possibleRemediation: string;
    repositoryVerifiedRemediation: string | null;
}

export interface EvidenceGapsProjection {
    gaps: EvidenceGap[];
    summary: {
        totalGaps: number;
        totalBlockedIssues: number;
        totalBlockedInvestigationCapabilities: number;
        highestLeverageGapTitle: string | null;
        highestLeverageRationale: string | null;
    };
    timeRange: { key: string; start: Date; end: Date };
}

/* ========================================================================== */
/* 6. RESOLUTION PROJECTION TYPES                                             */
/* ========================================================================== */

export type ResolutionStatus =
    | "RECOVERED"
    | "PARTIALLY_RECOVERED"
    | "STILL_OBSERVED"
    | "INSUFFICIENT_EVIDENCE"
    | "NO_BASELINE_OCCURRENCE"
    | "CHANGE_NOT_ISOLATED";

export interface ResolutionCandidate {
    issueId: string;
    title: string;
    service: string;
    projectId: string;
    changeReference: {
        type: "RELEASE" | "STATUS_CHANGE";
        identifier: string;
        timestamp: Date;
        multipleChangesInWindow: boolean;
        allCandidateChanges?: string[];
    };
    preChange: {
        windowStart: Date;
        windowEnd: Date;
        errorCount: number;
        requestExposure: number | null;
        observedSignature: string;
        hadActiveFailures: boolean;
    };
    postChange: {
        windowStart: Date;
        windowEnd: Date;
        errorCount: number;
        requestExposure: number | null;
        residualOccurrences: number;
        durationHours: number;
        hasSufficientExposure: boolean;
        exposureAssessment: "COMPARABLE" | "NOT_COMPARABLE" | "UNKNOWN";
        signatureSearch: "COMPLETE" | "LIMITED";
        telemetryContinuity: "GOOD" | "LIMITED";
    };
    assessment: {
        status: ResolutionStatus;
        signatureEliminated: boolean;
        volumeReduced: boolean;
        verdictExplanation: string;
        evidenceStatus: EvidenceStatus;
    };
}

export interface ResolutionProjection {
    candidates: ResolutionCandidate[];
    summary: {
        totalEvaluated: number;
        recovered: number;
        partiallyRecovered: number;
        stillObserved: number;
        insufficientEvidence: number;
        noBaseline: number;
        changeNotIsolated: number;
    };
    timeRange: { key: string; start: Date; end: Date };
}

/* ========================================================================== */
/* CANONICAL DATA LOADER                                                      */
/* ========================================================================== */

async function loadCanonicalIssueData(params: IssueIntelligenceParams) {
    const timeRange = parseTimeRange(params.timeRangeKey || "30d", "PREVIOUS_PERIOD");

    const projectWhere: any = {};
    if (params.organizationId) {
        projectWhere.organizationId = params.organizationId;
    }
    if (params.projectId && params.projectId !== "ALL") {
        projectWhere.id = params.projectId;
    }

    const projects = await prisma.project.findMany({
        where: projectWhere,
        select: {
            id: true,
            name: true,
            slug: true,
            environments: { select: { id: true, name: true } },
        },
    });

    if (projects.length === 0) {
        return {
            projects: [],
            issues: [],
            events: [],
            baselineEvents: [],
            releases: [],
            investigations: [],
            timeRange,
        };
    }

    const projectIds = projects.map((p) => p.id);

    const envFilter: any = {};
    if (params.environment && params.environment !== "ALL") {
        envFilter.name = params.environment;
    }

    const [issues, events, baselineEvents, releases, investigations] = await Promise.all([
        prisma.issue.findMany({
            where: {
                projectId: { in: projectIds },
            },
            include: {
                project: { select: { id: true, name: true } },
                events: {
                    select: {
                        id: true,
                        timestamp: true,
                        type: true,
                        severity: true,
                        service: true,
                        release: true,
                        requestId: true,
                        traceId: true,
                        sessionId: true,
                        resource: true,
                        operation: true,
                        durationMs: true,
                        stack: true,
                        message: true,
                        environment: { select: { name: true } },
                    },
                    orderBy: { timestamp: "asc" },
                },
            },
            orderBy: { lastSeen: "desc" },
        }),
        prisma.event.findMany({
            where: {
                projectId: { in: projectIds },
                timestamp: { gte: timeRange.start, lte: timeRange.end },
                ...(params.service && params.service !== "ALL" ? { service: params.service } : {}),
                ...(params.environment && params.environment !== "ALL" ? { environment: envFilter } : {}),
            },
            select: {
                id: true,
                type: true,
                severity: true,
                timestamp: true,
                service: true,
                release: true,
                requestId: true,
                traceId: true,
                sessionId: true,
                resource: true,
                operation: true,
                durationMs: true,
                issueId: true,
                stack: true,
                message: true,
                environment: { select: { name: true } },
            },
            orderBy: { timestamp: "asc" },
        }),
        prisma.event.findMany({
            where: {
                projectId: { in: projectIds },
                timestamp: { gte: timeRange.comparisonStart!, lte: timeRange.comparisonEnd! },
                ...(params.service && params.service !== "ALL" ? { service: params.service } : {}),
            },
            select: {
                id: true,
                type: true,
                service: true,
                issueId: true,
                timestamp: true,
            },
        }),
        prisma.release.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
        prisma.investigation.findMany({
            where: { projectId: { in: projectIds } },
            select: {
                id: true,
                issueId: true,
                title: true,
                status: true,
                rootCause: true,
                confidenceScore: true,
                createdAt: true,
            },
        }),
    ]);

    return {
        projects,
        issues,
        events,
        baselineEvents,
        releases,
        investigations,
        timeRange,
    };
}

/* ========================================================================== */
/* 1. GET TRIAGE PROJECTION                                                   */
/* ========================================================================== */

export async function getTriageProjection(params: IssueIntelligenceParams): Promise<TriageProjection> {
    const { issues, baselineEvents, investigations, timeRange } =
        await loadCanonicalIssueData(params);

    const now = new Date();
    const candidates: TriageCandidate[] = [];
    const investigationMap = new Map(investigations.filter((i) => i.issueId).map((i) => [i.issueId!, i]));

    const baselineCountMap = new Map<string, number>();
    for (const b of baselineEvents) {
        if (b.issueId) {
            baselineCountMap.set(b.issueId, (baselineCountMap.get(b.issueId) || 0) + 1);
        }
    }

    for (const issue of issues) {
        const allIssueEvents = issue.events || [];
        const activeEvents = allIssueEvents.filter(
            (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );

        const recentCount = activeEvents.length;
        const baselineCount = baselineCountMap.get(issue.id) || 0;

        const lastSeenDate = issue.lastSeen || (allIssueEvents.length > 0 ? allIssueEvents[allIssueEvents.length - 1].timestamp : issue.createdAt);
        const hoursSinceLastSeen = Math.max(0, Math.round((now.getTime() - lastSeenDate.getTime()) / (1000 * 3600)));

        const serviceSet = new Set<string>();
        const envSet = new Set<string>();
        const requestIds = new Set<string>();
        let hasStack = false;
        let hasTrace = false;
        let hasRelease = false;
        let hasDownstream = false;
        let hasSession = false;
        let hasDatabaseTiming = false;

        const eventsToAnalyze = activeEvents.length > 0 ? activeEvents : allIssueEvents;
        for (const ev of eventsToAnalyze) {
            if (ev.service) serviceSet.add(ev.service);
            if (ev.environment?.name) envSet.add(ev.environment.name);
            if (ev.requestId) requestIds.add(ev.requestId);
            if (ev.stack) hasStack = true;
            if (ev.traceId) hasTrace = true;
            if (ev.release) hasRelease = true;
            if (ev.resource) {
                hasDownstream = true;
                const r = ev.resource.toLowerCase();
                if (r.includes("db") || r.includes("postgres") || r.includes("sql") || r.includes("prisma")) {
                    hasDatabaseTiming = true;
                }
            }
            if (ev.sessionId) hasSession = true;
        }

        const primaryService = serviceSet.size > 0 ? Array.from(serviceSet)[0] : "unassigned";
        const primaryEnv = envSet.size > 0 ? Array.from(envSet)[0] : "production";

        if (params.service && params.service !== "ALL" && !serviceSet.has(params.service)) {
            continue;
        }

        if (params.search && params.search.trim()) {
            const q = params.search.trim().toLowerCase();
            const match =
                issue.title.toLowerCase().includes(q) ||
                primaryService.toLowerCase().includes(q) ||
                issue.project.name.toLowerCase().includes(q);
            if (!match) continue;
        }

        // SURGE SEMANTICS
        let surgeStatus: SurgeStatus = "NOT_APPLICABLE";
        let surgeChangePct: number | null = null;
        let surgeExplanation = "Not applicable";

        if (recentCount === 0 && baselineCount === 0) {
            surgeStatus = "NOT_APPLICABLE";
            surgeExplanation = "No events observed in current or comparison window.";
        } else if (recentCount > 0 && baselineCount === 0) {
            surgeStatus = "NO_COMPARABLE_BASELINE";
            surgeExplanation = "Zero events observed during comparison baseline window; surge cannot be computed.";
        } else if (recentCount < 3 && baselineCount < 3) {
            surgeStatus = "INSUFFICIENT_OBSERVATION";
            surgeExplanation = "Sparse event volume (< 3 occurrences); rate change is statistically unverified.";
        } else if (baselineCount > 0) {
            surgeChangePct = Math.round(((recentCount - baselineCount) / baselineCount) * 100);
            if (surgeChangePct > 25) {
                surgeStatus = "SURGE_OBSERVED";
                surgeExplanation = `Observed failure rate increased by ${surgeChangePct}% relative to comparison window.`;
            } else if (surgeChangePct < -25) {
                surgeStatus = "REDUCED_ACTIVITY";
                surgeExplanation = `Observed failure rate decreased by ${Math.abs(surgeChangePct)}% relative to comparison window.`;
            } else {
                surgeStatus = "NO_MATERIAL_CHANGE";
                surgeExplanation = "Failure rate remained within normal steady-state variation (±25%).";
            }
        }

        // INVESTIGATION READINESS
        const availableEvidence: string[] = [];
        const missingEvidence: string[] = [];

        if (hasStack) availableEvidence.push("Application stack trace");
        else missingEvidence.push("Application stack trace");

        if (hasTrace) availableEvidence.push("Distributed trace linkage");
        else missingEvidence.push("Distributed trace linkage");

        if (hasRelease) availableEvidence.push("Release metadata");
        else missingEvidence.push("Release metadata");

        if (hasDownstream) availableEvidence.push("Downstream resource span");
        else missingEvidence.push("Downstream resource span");

        if (hasDatabaseTiming) availableEvidence.push("Database query telemetry");
        else missingEvidence.push("Database query telemetry");

        if (hasSession) availableEvidence.push("User session linkage");
        else missingEvidence.push("User session linkage");

        let readinessStatus: InvestigationReadinessStatus = "READY";
        let whatCanBeEstablished = "";
        let whatCannotBeEstablished = "";
        let nextUsefulAction = "";

        if (eventsToAnalyze.length === 0) {
            readinessStatus = "INSUFFICIENT_EVIDENCE";
            whatCanBeEstablished = "Issue identity exists in catalog.";
            whatCannotBeEstablished = "No telemetry events are available to reconstruct failure execution.";
            nextUsefulAction = "Awaiting incoming telemetry.";
        } else if (!hasStack && !hasTrace) {
            readinessStatus = "BLOCKED_BY_TELEMETRY";
            whatCanBeEstablished = "Failure occurrence timestamp and service boundary.";
            whatCannotBeEstablished = "Execution stack and downstream caller/callee relationships cannot be established.";
            nextUsefulAction = "Capture application stack frames or enable distributed tracing.";
        } else if (!hasTrace || !hasDownstream) {
            readinessStatus = "PARTIALLY_READY";
            whatCanBeEstablished = "Application failure line, stack frames, and execution context.";
            whatCannotBeEstablished = "Whether an external or downstream dependency initiated the fault.";
            nextUsefulAction = "Investigate local application stack frames.";
        } else {
            readinessStatus = "READY";
            whatCanBeEstablished = "End-to-end trace tree, exception frames, and downstream dependencies.";
            whatCannotBeEstablished = "None — full causal reconstruction is supported.";
            nextUsefulAction = "Launch Investigation Engine to isolate root cause.";
        }

        // STALE INCIDENT PROTECTION: > 24 hours inactive cannot be INVESTIGATE_NOW
        let category: TriageCategory = "STABLE_MONITOR";
        let whyThisIsHere = "";

        const isStale = hoursSinceLastSeen > 24;

        if (issue.status === "OPEN") {
            if (!isStale && (surgeStatus === "SURGE_OBSERVED" || issue.severity === "FATAL" || recentCount >= 10)) {
                category = "INVESTIGATE_NOW";
                whyThisIsHere = surgeStatus === "SURGE_OBSERVED"
                    ? `Active error surge (${surgeChangePct}% increase) observed in the last 24h.`
                    : issue.severity === "FATAL"
                    ? `Fatal exception actively observed in the last ${hoursSinceLastSeen}h.`
                    : `High failure volume (${recentCount} occurrences) actively observed recently.`;
            } else if (!isStale && (recentCount > 0 || surgeStatus === "NO_COMPARABLE_BASELINE")) {
                category = "WORTH_INVESTIGATING";
                whyThisIsHere = surgeStatus === "NO_COMPARABLE_BASELINE"
                    ? `New active failure (${recentCount} events) with no baseline in previous window.`
                    : `Recent failure activity (${recentCount} events in active window).`;
            } else if (readinessStatus === "BLOCKED_BY_TELEMETRY" || readinessStatus === "PARTIALLY_READY") {
                category = "NEEDS_EVIDENCE";
                whyThisIsHere = isStale
                    ? `Unresolved issue inactive for ${hoursSinceLastSeen}h; causal analysis blocked by missing telemetry.`
                    : `Investigation blocked by missing telemetry (${missingEvidence.slice(0, 2).join(", ")}).`;
            } else {
                category = "STABLE_MONITOR";
                whyThisIsHere = isStale
                    ? `Inactive for ${hoursSinceLastSeen}h; no active escalation detected.`
                    : `Steady-state failure behavior without active surge.`;
            }
        } else {
            category = "STABLE_MONITOR";
            whyThisIsHere = `Issue is marked ${issue.status}.`;
        }

        const affectedRequestsCount = requestIds.size > 0 ? requestIds.size : null;
        const affectedRequestsStatus: EvidenceStatus = requestIds.size > 0 ? "OBSERVED" : "UNKNOWN";

        const inv = investigationMap.get(issue.id);

        candidates.push({
            id: issue.id,
            issueId: issue.id,
            title: issue.title,
            fingerprint: issue.fingerprint,
            projectId: issue.projectId,
            projectName: issue.project.name,
            service: primaryService,
            environment: primaryEnv,
            category,
            firstObserved: issue.firstSeen,
            lastObserved: lastSeenDate,
            hoursSinceLastSeen,
            eventCount: issue.eventCount,
            recentEventCount: recentCount,
            baselineEventCount: baselineCount,
            surge: {
                status: surgeStatus,
                changePct: surgeChangePct,
                explanation: surgeExplanation,
            },
            severity: issue.severity,
            status: issue.status,
            readiness: {
                status: readinessStatus,
                availableEvidence,
                missingEvidence,
                whatCanBeEstablished,
                whatCannotBeEstablished,
                nextUsefulAction,
            },
            whyThisIsHere,
            impactSummary: {
                affectedRequests: affectedRequestsCount,
                affectedRequestsStatus,
                affectedServices: Array.from(serviceSet),
            },
            hasInvestigation: Boolean(inv),
            investigationId: inv?.id,
        });
    }

    const categoryWeight: Record<TriageCategory, number> = {
        INVESTIGATE_NOW: 4,
        WORTH_INVESTIGATING: 3,
        NEEDS_EVIDENCE: 2,
        STABLE_MONITOR: 1,
    };

    candidates.sort((a, b) => {
        const diff = categoryWeight[b.category] - categoryWeight[a.category];
        if (diff !== 0) return diff;
        const countDiff = b.recentEventCount - a.recentEventCount;
        if (countDiff !== 0) return countDiff;
        return a.hoursSinceLastSeen - b.hoursSinceLastSeen;
    });

    const summary = {
        total: candidates.length,
        investigateNow: candidates.filter((c) => c.category === "INVESTIGATE_NOW").length,
        worthInvestigating: candidates.filter((c) => c.category === "WORTH_INVESTIGATING").length,
        needsEvidence: candidates.filter((c) => c.category === "NEEDS_EVIDENCE").length,
        stableMonitor: candidates.filter((c) => c.category === "STABLE_MONITOR").length,
        readyCount: candidates.filter((c) => c.readiness.status === "READY").length,
        partiallyReadyCount: candidates.filter((c) => c.readiness.status === "PARTIALLY_READY").length,
        blockedCount: candidates.filter((c) => c.readiness.status === "BLOCKED_BY_TELEMETRY").length,
        insufficientCount: candidates.filter((c) => c.readiness.status === "INSUFFICIENT_EVIDENCE").length,
    };

    return {
        candidates,
        summary,
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}

/* ========================================================================== */
/* 2. GET PATTERNS PROJECTION                                                 */
/* ========================================================================== */

export async function getPatternsProjection(params: IssueIntelligenceParams): Promise<PatternsProjection> {
    const { issues, timeRange } = await loadCanonicalIssueData(params);

    const patternMap = new Map<string, {
        failureBoundary: string;
        exceptionClass: string;
        httpStatus: string | null;
        dependencyType: string | null;
        signature: string;
        issues: Array<{ id: string; title: string; service: string; projectId: string; occurrences: number }>;
        occurrencesCount: number;
        services: Set<string>;
        routes: Set<string>;
        releases: Set<string>;
        firstObserved: Date | null;
        lastObserved: Date | null;
        invariants: Set<string>;
        divergences: Set<string>;
    }>();

    for (const issue of issues) {
        const activeEvents = (issue.events || []).filter(
            (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );
        if (activeEvents.length === 0) continue;

        const sample = activeEvents[0];

        // Determine failure boundary
        let failureBoundary = "Application Exception";
        if (sample.resource && (sample.resource.toLowerCase().includes("db") || sample.resource.toLowerCase().includes("postgres") || sample.resource.toLowerCase().includes("sql"))) {
            failureBoundary = "Database Query Boundary";
        } else if (sample.resource && (sample.resource.toLowerCase().includes("api") || sample.resource.toLowerCase().includes("http"))) {
            failureBoundary = "Downstream HTTP Dependency";
        } else if (sample.message?.toLowerCase().includes("timeout") || issue.title.toLowerCase().includes("timeout")) {
            failureBoundary = "Gateway Timeout Boundary";
        }

        // Extract exception class specifically
        let exceptionClass = "Error";
        if (issue.title.includes("TypeError") || issue.title.includes("Cannot read properties") || issue.title.includes("is not a function")) {
            exceptionClass = "TypeError (Null/Undefined Property or Function)";
        } else if (issue.title.toLowerCase().includes("timeout")) {
            exceptionClass = "TimeoutError";
        } else if (issue.title.toLowerCase().includes("json") || issue.title.toLowerCase().includes("syntaxerror")) {
            exceptionClass = "SyntaxError (JSON Parsing)";
        } else if (issue.title.includes(":")) {
            const prefix = issue.title.split(":")[0].trim();
            if (prefix.length > 2 && !prefix.toLowerCase().includes("error")) {
                exceptionClass = prefix;
            }
        }

        const httpStatus = sample.durationMs && sample.durationMs > 5000 ? "504" : null;
        const dependencyType = sample.resource || null;

        // QUALITY BAR: Reject generic "Application Exception :: Error" with no other dimension
        const isGenericError = failureBoundary === "Application Exception" && exceptionClass === "Error" && !httpStatus && !dependencyType;
        if (isGenericError) {
            continue; // Do NOT form a pattern from generic error fallbacks
        }

        const sigParts = [failureBoundary, exceptionClass];
        if (httpStatus) sigParts.push(`HTTP ${httpStatus}`);
        if (dependencyType) sigParts.push(`Resource: ${dependencyType}`);
        const signatureKey = sigParts.join(" :: ");

        let entry = patternMap.get(signatureKey);
        if (!entry) {
            entry = {
                failureBoundary,
                exceptionClass,
                httpStatus,
                dependencyType,
                signature: signatureKey,
                issues: [],
                occurrencesCount: 0,
                services: new Set<string>(),
                routes: new Set<string>(),
                releases: new Set<string>(),
                firstObserved: null,
                lastObserved: null,
                invariants: new Set<string>([
                    `Execution boundary: ${failureBoundary}`,
                    `Exception signature: ${exceptionClass}`,
                ]),
                divergences: new Set<string>(),
            };
            patternMap.set(signatureKey, entry);
        }

        entry.issues.push({
            id: issue.id,
            title: issue.title,
            service: sample.service || "unknown",
            projectId: issue.projectId,
            occurrences: activeEvents.length,
        });
        entry.occurrencesCount += activeEvents.length;

        for (const ev of activeEvents) {
            if (ev.service) entry.services.add(ev.service);
            if (ev.operation) entry.routes.add(ev.operation);
            if (ev.release) entry.releases.add(ev.release);

            if (!entry.firstObserved || ev.timestamp < entry.firstObserved) {
                entry.firstObserved = ev.timestamp;
            }
            if (!entry.lastObserved || ev.timestamp > entry.lastObserved) {
                entry.lastObserved = ev.timestamp;
            }
        }
    }

    const patterns: FailurePattern[] = [];
    for (const [key, p] of patternMap.entries()) {
        // Enforce: Must group at least 2 distinct issues
        if (p.issues.length < 2) {
            continue;
        }

        const invariants = Array.from(p.invariants);
        if (p.services.size === 1) {
            invariants.push(`Service scope: ${Array.from(p.services)[0]}`);
        }

        const divergences: string[] = [];
        if (p.releases.size > 1) divergences.push(`Observed across ${p.releases.size} separate deployments`);
        if (p.routes.size > 1) divergences.push(`Triggered across ${p.routes.size} distinct endpoints/operations`);
        if (p.services.size > 1) divergences.push(`Traversed ${p.services.size} participating services`);

        const fingerprintSteps: FailureFingerprintStep[] = [
            {
                stage: "TRIGGER",
                label: "Inbound Invocation",
                value: p.routes.size > 0 ? Array.from(p.routes)[0] : "HTTP Request",
                evidenceStatus: p.routes.size > 0 ? "OBSERVED" : "SUPPORTED",
                evidenceDetail: "Observed route / operation span",
            },
            {
                stage: "BOUNDARY",
                label: "Execution Boundary",
                value: p.failureBoundary,
                evidenceStatus: "OBSERVED",
                evidenceDetail: `Failure boundary identified on ${Array.from(p.services).join(", ") || "service"}`,
            },
        ];

        if (p.dependencyType) {
            fingerprintSteps.push({
                stage: "DOWNSTREAM",
                label: "Downstream Call",
                value: p.dependencyType,
                evidenceStatus: "SUPPORTED",
                evidenceDetail: "Downstream resource call captured in spans",
            });
        }

        fingerprintSteps.push({
            stage: "FAILURE",
            label: "Failure Signature",
            value: p.exceptionClass,
            evidenceStatus: "OBSERVED",
            evidenceDetail: `${p.occurrencesCount} failure events matching ${p.exceptionClass}`,
        });

        const evidenceStrength: PatternEvidenceStrength =
            p.dependencyType && p.httpStatus ? "ROBUST" : p.issues.length >= 3 ? "MODERATE" : "LIMITED";

        const whyThisIsAPattern = `Identified across ${p.issues.length} distinct issues sharing identical ${p.failureBoundary} and ${p.exceptionClass} behavior.`;
        const commonObservedBehavior = `Consistent execution failure in ${p.failureBoundary} with ${p.exceptionClass}.`;

        patterns.push({
            id: key,
            name: `${p.failureBoundary}: ${p.exceptionClass}`,
            behavioralSignature: p.signature,
            failureBoundary: p.failureBoundary,
            exceptionClass: p.exceptionClass,
            httpStatus: p.httpStatus,
            dependencyType: p.dependencyType,
            evidenceStrength,
            whyThisIsAPattern,
            commonObservedBehavior,
            fingerprintSteps,
            occurrencesCount: p.occurrencesCount,
            issuesCount: p.issues.length,
            associatedIssues: p.issues,
            affectedServices: Array.from(p.services),
            affectedRoutes: Array.from(p.routes),
            affectedReleases: Array.from(p.releases),
            firstObserved: p.firstObserved || new Date(),
            lastObserved: p.lastObserved || new Date(),
            invariants,
            divergences: divergences.length > 0 ? divergences : ["Uniform behavior across occurrences"],
            evidenceStatus: p.services.size > 1 ? "SUPPORTED" : "OBSERVED",
            evidenceExplanation: "Observed behavioral similarity across distinct issues. Does not establish shared root cause.",
        });
    }

    patterns.sort((a, b) => b.occurrencesCount - a.occurrencesCount);

    const hasMeaningfulPatterns = patterns.length > 0;
    const emptyReason = hasMeaningfulPatterns
        ? undefined
        : "Multiple issues exist, but available telemetry does not establish a recurring cross-issue behavioral fingerprint. Generic error classifications were rejected to prevent false clustering.";

    return {
        patterns,
        summary: {
            totalPatterns: patterns.length,
            totalAffectedIssues: patterns.reduce((sum, p) => sum + p.issuesCount, 0),
            crossServicePatterns: patterns.filter((p) => p.affectedServices.length > 1).length,
        },
        hasMeaningfulPatterns,
        emptyReason,
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}

/* ========================================================================== */
/* 3. GET IMPACT PROJECTION                                                   */
/* ========================================================================== */

export async function getImpactProjection(params: IssueIntelligenceParams): Promise<ImpactProjection> {
    const { issues, timeRange } = await loadCanonicalIssueData(params);

    const impacts: IssueImpact[] = [];
    let globalObservedRequests = 0;
    let hasAnyRequests = false;
    const globalServices = new Set<string>();
    let sessionLinkageDetected = false;

    for (const issue of issues) {
        const activeEvents = (issue.events || []).filter(
            (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );
        if (activeEvents.length === 0) continue;

        const requestIds = new Set<string>();
        const serviceSet = new Set<string>();
        const operationsSet = new Set<string>();
        const sessionIds = new Set<string>();

        let requestLinkageAvailable = false;
        let downstreamLinkageAvailable = false;
        let sessionLinkageAvailable = false;

        for (const ev of activeEvents) {
            if (ev.requestId) {
                requestIds.add(ev.requestId);
                requestLinkageAvailable = true;
            }
            if (ev.service) {
                serviceSet.add(ev.service);
                globalServices.add(ev.service);
            }
            if (ev.operation) {
                operationsSet.add(ev.operation);
                downstreamLinkageAvailable = true;
            }
            if (ev.resource) {
                downstreamLinkageAvailable = true;
            }
            if (ev.sessionId) {
                sessionIds.add(ev.sessionId);
                sessionLinkageAvailable = true;
                sessionLinkageDetected = true;
            }
        }

        if (requestLinkageAvailable) {
            hasAnyRequests = true;
            globalObservedRequests += requestIds.size;
        }

        const layers: ImpactLayer[] = [
            {
                layer: "OBSERVATION",
                label: "Observed Failure Occurrences",
                count: activeEvents.length,
                isAvailable: true,
                evidenceStatus: "OBSERVED",
                evidenceDetail: `${activeEvents.length} failure occurrences captured by SDK`,
            },
            {
                layer: "REQUESTS",
                label: "Correlated Inbound Requests",
                count: requestLinkageAvailable ? requestIds.size : null,
                isAvailable: requestLinkageAvailable,
                evidenceStatus: requestLinkageAvailable ? "OBSERVED" : "UNKNOWN",
                evidenceDetail: requestLinkageAvailable
                    ? `${requestIds.size} distinct requests recorded with failure`
                    : "Request identifiers not captured in SDK events",
            },
            {
                layer: "SERVICES",
                label: "Trace-Linked Services",
                count: serviceSet.size > 0 ? serviceSet.size : null,
                isAvailable: serviceSet.size > 0,
                evidenceStatus: serviceSet.size > 0 ? "SUPPORTED" : "UNKNOWN",
                evidenceDetail: serviceSet.size > 0
                    ? `Traced across: ${Array.from(serviceSet).join(", ")}`
                    : "Service context not captured in events",
                items: Array.from(serviceSet),
            },
            {
                layer: "OPERATIONS",
                label: "Downstream Operations",
                count: downstreamLinkageAvailable ? operationsSet.size : null,
                isAvailable: downstreamLinkageAvailable,
                evidenceStatus: downstreamLinkageAvailable ? "OBSERVED" : "UNKNOWN",
                evidenceDetail: downstreamLinkageAvailable
                    ? `${operationsSet.size} downstream operations executed`
                    : "No downstream operation telemetry is available to determine affected set",
                items: Array.from(operationsSet),
            },
            {
                layer: "SESSIONS",
                label: "Sessions with Linked Failure Events",
                count: sessionLinkageAvailable ? sessionIds.size : null,
                isAvailable: sessionLinkageAvailable,
                evidenceStatus: sessionLinkageAvailable ? "OBSERVED" : "UNKNOWN",
                evidenceDetail: sessionLinkageAvailable
                    ? `${sessionIds.size} session(s) with linked failure events`
                    : "User session linkage was not collected for these events",
            },
        ];

        const primaryService = serviceSet.size > 0 ? Array.from(serviceSet)[0] : "unassigned";

        impacts.push({
            issueId: issue.id,
            title: issue.title,
            service: primaryService,
            environment: activeEvents[0]?.environment?.name || "production",
            firstSeen: issue.firstSeen,
            lastSeen: issue.lastSeen,
            layers,
            propagationSummary: requestLinkageAvailable
                ? `${requestIds.size} request(s) across ${serviceSet.size} service(s).`
                : `${activeEvents.length} event(s) (request lineage unknown).`,
        });
    }

    impacts.sort((a, b) => {
        const aCount = a.layers[0]?.count || 0;
        const bCount = b.layers[0]?.count || 0;
        return bCount - aCount;
    });

    return {
        impacts,
        summary: {
            totalEvaluatedIssues: impacts.length,
            totalObservedRequests: hasAnyRequests ? globalObservedRequests : null,
            totalObservedServices: globalServices.size,
            sessionLinkageAvailable: sessionLinkageDetected,
        },
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}

/* ========================================================================== */
/* 4. GET EVOLUTION PROJECTION                                                */
/* ========================================================================== */

export async function getEvolutionProjection(params: IssueIntelligenceParams): Promise<EvolutionProjection> {
    const { issues, timeRange } = await loadCanonicalIssueData(params);

    const evolutions: IssueEvolution[] = [];
    let behaviorShiftsDetected = 0;
    let telemetryGapsDetected = 0;

    for (const issue of issues) {
        const events = (issue.events || []).filter(
            (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );
        if (events.length === 0) continue;

        const service = events[0]?.service || "unassigned";
        const dnaHistory: IssueDNAVersion[] = [];
        const timeline: EvolutionTransition[] = [];

        // Base observation (NO version string unless transition occurs)
        const baseDNA: IssueDNAVersion = {
            detectedAt: events[0].timestamp,
            failureBoundary: events[0].resource ? "Downstream Dependency" : "Application Exception",
            responseStatus: events[0].durationMs && events[0].durationMs > 5000 ? "504 Gateway Timeout" : "HTTP 500",
            dependencyInvolvement: events[0].resource || "Internal Execution",
            retryBehavior: "NONE_DETECTED",
            exceptionClass: issue.title.split(":")[0] || "Error",
            summary: "Initial failure signature captured at service boundary.",
        };
        dnaHistory.push(baseDNA);

        let previousEvent = events[0];
        let currentDNAState = baseDNA;

        for (let i = 1; i < events.length; i++) {
            const currentEvent = events[i];
            const intervalHours = Math.round((currentEvent.timestamp.getTime() - previousEvent.timestamp.getTime()) / (1000 * 3600));

            if (intervalHours > 48) {
                telemetryGapsDetected++;
                timeline.push({
                    id: `${issue.id}-gap-${i}`,
                    type: "GAP",
                    timestamp: previousEvent.timestamp,
                    untilTimestamp: currentEvent.timestamp,
                    gapDurationHours: intervalHours,
                    title: "Telemetry Gap / Missing Continuity",
                    description: `No telemetry recorded for this issue across a ${intervalHours}-hour interval. Continuous behavioral reconstruction is interrupted.`,
                    evidence: "Temporal boundary gap between database events",
                    evidenceStatus: "INSUFFICIENT_EVIDENCE",
                });
            }

            const newBoundary = currentEvent.resource ? "Downstream Dependency" : "Application Exception";
            const newStatus = currentEvent.durationMs && currentEvent.durationMs > 5000 ? "504 Gateway Timeout" : "HTTP 500";
            const newResource = currentEvent.resource || "Internal Execution";

            const diffs: Array<{ property: string; previous: string; current: string }> = [];
            if (newBoundary !== currentDNAState.failureBoundary) {
                diffs.push({ property: "Failure Boundary", previous: currentDNAState.failureBoundary, current: newBoundary });
            }
            if (newStatus !== currentDNAState.responseStatus) {
                diffs.push({ property: "Response Status", previous: currentDNAState.responseStatus, current: newStatus });
            }
            if (newResource !== currentDNAState.dependencyInvolvement) {
                diffs.push({ property: "Dependency Call", previous: currentDNAState.dependencyInvolvement, current: newResource });
            }

            if (diffs.length > 0) {
                behaviorShiftsDetected++;
                // Versions ONLY appear when transitions exist!
                if (dnaHistory.length === 1 && !dnaHistory[0].version) {
                    dnaHistory[0].version = "DNA v1.0";
                }
                const newVersion = `DNA v${(dnaHistory.length + 1).toFixed(1)}`;
                const shiftedDNA: IssueDNAVersion = {
                    version: newVersion,
                    detectedAt: currentEvent.timestamp,
                    failureBoundary: newBoundary,
                    responseStatus: newStatus,
                    dependencyInvolvement: newResource,
                    retryBehavior: currentDNAState.retryBehavior,
                    exceptionClass: currentDNAState.exceptionClass,
                    summary: `Behavioral shift detected: ${diffs.map((d) => d.property).join(", ")} changed.`,
                };
                dnaHistory.push(shiftedDNA);
                currentDNAState = shiftedDNA;

                timeline.push({
                    id: `${issue.id}-shift-${i}`,
                    type: "TRANSITION",
                    timestamp: currentEvent.timestamp,
                    title: "Behavioral Transition",
                    description: `Observed change in failure behavior: ${diffs.map((d) => `${d.property}: ${d.previous} → ${d.current}`).join("; ")}.`,
                    dnaVersion: newVersion,
                    diffs,
                    evidence: "Event field transition in telemetry record",
                    evidenceStatus: "OBSERVED",
                });
            }

            previousEvent = currentEvent;
        }

        const hasTransition = dnaHistory.length > 1;

        // Timeline initial entry: If NO transition, do NOT display DNA v1.0
        timeline.unshift({
            id: `${issue.id}-init`,
            type: "TRANSITION",
            timestamp: events[0].timestamp,
            title: hasTransition ? "First Observed State (DNA v1.0)" : "Current Observed Behavior",
            description: hasTransition
                ? `Initial state recorded on ${service}. Signature: ${baseDNA.exceptionClass}.`
                : "One stable behavioral state observed. No behavioral transition established during the selected window.",
            dnaVersion: hasTransition ? "DNA v1.0" : undefined,
            evidence: "SDK telemetry record",
            evidenceStatus: "OBSERVED",
        });

        const transitionSummary = hasTransition
            ? `Observed ${dnaHistory.length - 1} behavioral transition(s) over ${events.length} events.`
            : `One stable behavioral state observed. No behavioral transition established during the selected window.`;

        evolutions.push({
            issueId: issue.id,
            title: issue.title,
            service,
            hasTransition,
            dnaStatesRecorded: dnaHistory.length,
            currentDNA: currentDNAState,
            dnaHistory,
            timeline,
            transitionSummary,
        });
    }

    return {
        evolutions,
        summary: {
            totalTracked: evolutions.length,
            behaviorShiftsDetected,
            telemetryGapsDetected,
        },
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}

/* ========================================================================== */
/* 5. GET EVIDENCE GAPS PROJECTION                                            */
/* ========================================================================== */

export async function getEvidenceGapsProjection(params: IssueIntelligenceParams): Promise<EvidenceGapsProjection> {
    const { issues, investigations, timeRange } = await loadCanonicalIssueData(params);

    const gapBlockers: Record<string, {
        category: EvidenceGap["category"];
        title: string;
        description: string;
        blockedIssues: Array<{ id: string; title: string; service: string; projectId: string; severity: string }>;
        services: Set<string>;
        whatItPrevents: string;
        possibleRemediation: string;
        repositoryVerifiedRemediation: string | null;
        leverageRationale: string;
    }> = {
        DISTRIBUTED_TRACE_LINKAGE: {
            category: "DISTRIBUTED_TRACE_LINKAGE",
            title: "Missing Distributed Trace Linkage",
            description: "Events lack distributed trace identifiers, preventing cross-service causal tree reconstruction.",
            blockedIssues: [],
            services: new Set<string>(),
            whatItPrevents: "Prevents establishing whether an upstream caller or downstream callee initiated the failure.",
            possibleRemediation: "Propagate W3C trace-context headers across service boundaries.",
            repositoryVerifiedRemediation: null,
            leverageRationale: "Unlocks cross-service causal propagation and service dependency failure attribution.",
        },
        DATABASE_QUERY_TELEMETRY: {
            category: "DATABASE_QUERY_TELEMETRY",
            title: "Missing Database Query Telemetry",
            description: "No query execution duration or database resource spans are captured in event context.",
            blockedIssues: [],
            services: new Set<string>(),
            whatItPrevents: "Prevents isolating database connection contention and query latency from application faults.",
            possibleRemediation: "Configure database query tracing on database client.",
            repositoryVerifiedRemediation: null,
            leverageRationale: "Unlocks database query duration vs application latency boundary isolation.",
        },
        USER_SESSION_LINKAGE: {
            category: "USER_SESSION_LINKAGE",
            title: "Missing User Session Telemetry",
            description: "Events lack session identifiers, preventing session replay correlation.",
            blockedIssues: [],
            services: new Set<string>(),
            whatItPrevents: "Prevents determining user blast radius and client replay reconstruction.",
            possibleRemediation: "Initialize Halo Browser SDK with session tracking enabled.",
            repositoryVerifiedRemediation: null,
            leverageRationale: "Unlocks user blast radius measurement and deterministic session replay playback.",
        },
        DEPLOYMENT_RELEASE_TAG: {
            category: "DEPLOYMENT_RELEASE_TAG",
            title: "Missing Deployment Release Association",
            description: "Events lack release or commit metadata, preventing regression attribution.",
            blockedIssues: [],
            services: new Set<string>(),
            whatItPrevents: "Blocks Change Intelligence from attributing regressions to specific code deployments.",
            possibleRemediation: "Provide HALO_RELEASE or release configuration during build / CI.",
            repositoryVerifiedRemediation: null,
            leverageRationale: "Unlocks deployment regression attribution and change verification.",
        },
    };

    const distinctBlockedIssueIds = new Set<string>();

    for (const issue of issues) {
        const events = (issue.events || []).filter(
            (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );
        if (events.length === 0) continue;

        let hasTrace = false;
        let hasDb = false;
        let hasSession = false;
        let hasRelease = false;
        const service = events[0]?.service || "unassigned";

        for (const ev of events) {
            if (ev.traceId) hasTrace = true;
            if (ev.resource && (ev.resource.toLowerCase().includes("db") || ev.resource.toLowerCase().includes("sql"))) hasDb = true;
            if (ev.sessionId) hasSession = true;
            if (ev.release) hasRelease = true;
        }

        const issueItem = {
            id: issue.id,
            title: issue.title,
            service,
            projectId: issue.projectId,
            severity: issue.severity,
        };

        if (!hasTrace) {
            gapBlockers.DISTRIBUTED_TRACE_LINKAGE.blockedIssues.push(issueItem);
            gapBlockers.DISTRIBUTED_TRACE_LINKAGE.services.add(service);
            distinctBlockedIssueIds.add(issue.id);
        }
        if (!hasDb) {
            gapBlockers.DATABASE_QUERY_TELEMETRY.blockedIssues.push(issueItem);
            gapBlockers.DATABASE_QUERY_TELEMETRY.services.add(service);
            distinctBlockedIssueIds.add(issue.id);
        }
        if (!hasSession) {
            gapBlockers.USER_SESSION_LINKAGE.blockedIssues.push(issueItem);
            gapBlockers.USER_SESSION_LINKAGE.services.add(service);
            distinctBlockedIssueIds.add(issue.id);
        }
        if (!hasRelease) {
            gapBlockers.DEPLOYMENT_RELEASE_TAG.blockedIssues.push(issueItem);
            gapBlockers.DEPLOYMENT_RELEASE_TAG.services.add(service);
            distinctBlockedIssueIds.add(issue.id);
        }
    }

    const gaps: EvidenceGap[] = [];
    for (const [key, val] of Object.entries(gapBlockers)) {
        if (val.blockedIssues.length > 0) {
            const fatalCount = val.blockedIssues.filter((i) => i.severity === "FATAL").length;
            const errorCount = val.blockedIssues.filter((i) => i.severity === "ERROR").length;
            const leverageScore = fatalCount * 3 + errorCount * 2 + val.services.size * 2;

            const explanation = `Affects ${val.blockedIssues.length} issue(s) across ${val.services.size} service(s). ${val.leverageRationale}`;

            gaps.push({
                id: key,
                category: val.category,
                title: val.title,
                description: val.description,
                blockedIssuesCount: val.blockedIssues.length,
                blockedInvestigationCapabilitiesCount: val.blockedIssues.length,
                blockedIssues: val.blockedIssues,
                affectedServices: Array.from(val.services),
                whatItPrevents: val.whatItPrevents,
                leverageScore,
                whyThisRanksHigh: explanation,
                possibleRemediation: val.possibleRemediation,
                repositoryVerifiedRemediation: val.repositoryVerifiedRemediation,
            });
        }
    }

    gaps.sort((a, b) => b.leverageScore - a.leverageScore);

    return {
        gaps,
        summary: {
            totalGaps: gaps.length,
            totalBlockedIssues: distinctBlockedIssueIds.size,
            totalBlockedInvestigationCapabilities: gaps.reduce((sum, g) => sum + g.blockedInvestigationCapabilitiesCount, 0),
            highestLeverageGapTitle: gaps[0]?.title || null,
            highestLeverageRationale: gaps[0]?.whyThisRanksHigh || null,
        },
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}

/* ========================================================================== */
/* 6. GET RESOLUTION PROJECTION (RIGOROUSLY AUDITED)                          */
/* ========================================================================== */

export async function getResolutionProjection(params: IssueIntelligenceParams): Promise<ResolutionProjection> {
    const { issues, releases, timeRange } = await loadCanonicalIssueData(params);

    const candidates: ResolutionCandidate[] = [];

    for (const issue of issues) {
        const allEvents = issue.events || [];
        if (allEvents.length === 0) continue;

        const service = allEvents[0]?.service || "unassigned";

        const projectReleases = releases.filter((r) => r.projectId === issue.projectId);
        let changeRef: ResolutionCandidate["changeReference"] | null = null;

        if (projectReleases.length > 0) {
            const rel = projectReleases[0];
            const multipleChanges = projectReleases.length > 1;
            changeRef = {
                type: "RELEASE",
                identifier: rel.version,
                timestamp: rel.createdAt,
                multipleChangesInWindow: multipleChanges,
                allCandidateChanges: projectReleases.map((r) => r.version),
            };
        } else if (issue.status === "RESOLVED") {
            changeRef = {
                type: "STATUS_CHANGE",
                identifier: "Marked Resolved",
                timestamp: issue.updatedAt,
                multipleChangesInWindow: false,
            };
        }

        if (!changeRef) continue;

        const changeTime = changeRef.timestamp.getTime();
        const preEvents = allEvents.filter((e) => e.timestamp.getTime() < changeTime);
        const postEvents = allEvents.filter((e) => e.timestamp.getTime() >= changeTime);

        const durationHours = Math.max(0, Math.round((timeRange.end.getTime() - changeTime) / (1000 * 3600)));
        const hadActiveFailures = preEvents.length > 0;

        const preRequests = new Set(preEvents.map((e) => e.requestId).filter(Boolean));
        const postRequests = new Set(postEvents.map((e) => e.requestId).filter(Boolean));

        const preRequestExposure = preRequests.size > 0 ? preRequests.size : null;
        const postRequestExposure = postRequests.size > 0 ? postRequests.size : null;

        // RIGOROUS EXPOSURE AUDIT:
        // Elapsed hours alone are NOT sufficient exposure evidence.
        // We require verified post-change request/span exposure.
        let exposureAssessment: "COMPARABLE" | "NOT_COMPARABLE" | "UNKNOWN" = "UNKNOWN";
        let signatureSearch: "COMPLETE" | "LIMITED" = "LIMITED";
        let telemetryContinuity: "GOOD" | "LIMITED" = "LIMITED";

        if (postRequestExposure !== null && preRequestExposure !== null) {
            if (postRequestExposure >= preRequestExposure * 0.5 && postRequestExposure >= 10) {
                exposureAssessment = "COMPARABLE";
                signatureSearch = "COMPLETE";
                telemetryContinuity = "GOOD";
            } else {
                exposureAssessment = "NOT_COMPARABLE";
                signatureSearch = "LIMITED";
                telemetryContinuity = "LIMITED";
            }
        } else {
            // Post-change request volume is uncollected
            exposureAssessment = "UNKNOWN";
            signatureSearch = "LIMITED";
            telemetryContinuity = "LIMITED";
        }

        const hasSufficientExposure = exposureAssessment === "COMPARABLE" && durationHours >= 2;

        let status: ResolutionStatus = "INSUFFICIENT_EVIDENCE";
        let signatureEliminated = false;
        let volumeReduced = false;
        let verdictExplanation = "";

        if (!hadActiveFailures) {
            // ZERO BASELINE INVARIANT: If pre-change failures = 0, never claim active signature
            status = "NO_BASELINE_OCCURRENCE";
            verdictExplanation = "No occurrences were recorded before the change; baseline failure signature was absent.";
        } else if (changeRef.multipleChangesInWindow) {
            // MULTI-CHANGE ISOLATION INVARIANT
            if (postEvents.length === 0) {
                if (hasSufficientExposure) {
                    status = "CHANGE_NOT_ISOLATED";
                    signatureEliminated = true;
                    volumeReduced = true;
                    verdictExplanation = `Failure signature eliminated, but multiple deployments (${changeRef.allCandidateChanges?.slice(0, 3).join(", ")}) occurred; specific change not isolated.`;
                } else {
                    status = "INSUFFICIENT_EVIDENCE";
                    verdictExplanation = `Post-change exposure is unverified or limited; recovery cannot be confirmed from elapsed time (${durationHours}h) alone.`;
                }
            } else if (postEvents.length < preEvents.length) {
                status = "PARTIALLY_RECOVERED";
                volumeReduced = true;
                verdictExplanation = `Failure volume decreased from ${preEvents.length} to ${postEvents.length}, but multiple changes occurred and residual failures persist.`;
            } else {
                status = "STILL_OBSERVED";
                verdictExplanation = `Failure continues to recur after deployments (${postEvents.length} post-change occurrences observed).`;
            }
        } else if (!hasSufficientExposure) {
            // If request exposure is unknown or post-change duration is too short, DO NOT force RECOVERED!
            if (postEvents.length === 0) {
                status = "INSUFFICIENT_EVIDENCE";
                verdictExplanation = `No post-change failures observed, but request exposure is unverified or observation is too short (${durationHours}h); recovery cannot be proven.`;
            } else if (postEvents.length < preEvents.length) {
                status = "PARTIALLY_RECOVERED";
                volumeReduced = true;
                verdictExplanation = `Failure volume decreased from ${preEvents.length} to ${postEvents.length}, but residual occurrences persist.`;
            } else {
                status = "STILL_OBSERVED";
                verdictExplanation = `Failure continues to recur after change (${postEvents.length} post-change occurrences observed).`;
            }
        } else if (postEvents.length === 0) {
            status = "RECOVERED";
            signatureEliminated = true;
            volumeReduced = true;
            verdictExplanation = `Original failure signature eliminated under verified comparable exposure (${postRequestExposure} requests over ${durationHours}h).`;
        } else if (postEvents.length < preEvents.length) {
            status = "PARTIALLY_RECOVERED";
            signatureEliminated = false;
            volumeReduced = true;
            verdictExplanation = `Failure volume decreased from ${preEvents.length} to ${postEvents.length}, but ${postEvents.length} residual occurrence(s) remain observed.`;
        } else {
            status = "STILL_OBSERVED";
            signatureEliminated = false;
            volumeReduced = false;
            verdictExplanation = `Failure continues to recur after change (${postEvents.length} post-change occurrences observed).`;
        }

        candidates.push({
            issueId: issue.id,
            title: issue.title,
            service,
            projectId: issue.projectId,
            changeReference: changeRef,
            preChange: {
                windowStart: timeRange.start,
                windowEnd: changeRef.timestamp,
                errorCount: preEvents.length,
                requestExposure: preRequestExposure,
                observedSignature: `${service}: ${issue.title}`,
                hadActiveFailures,
            },
            postChange: {
                windowStart: changeRef.timestamp,
                windowEnd: timeRange.end,
                errorCount: postEvents.length,
                requestExposure: postRequestExposure,
                residualOccurrences: postEvents.length,
                durationHours,
                hasSufficientExposure,
                exposureAssessment,
                signatureSearch,
                telemetryContinuity,
            },
            assessment: {
                status,
                signatureEliminated,
                volumeReduced,
                verdictExplanation,
                evidenceStatus: status === "INSUFFICIENT_EVIDENCE" || status === "NO_BASELINE_OCCURRENCE"
                    ? "INSUFFICIENT_EVIDENCE"
                    : "OBSERVED",
            },
        });
    }

    candidates.sort((a, b) => {
        const order: Record<ResolutionStatus, number> = {
            RECOVERED: 1,
            CHANGE_NOT_ISOLATED: 2,
            PARTIALLY_RECOVERED: 3,
            STILL_OBSERVED: 4,
            INSUFFICIENT_EVIDENCE: 5,
            NO_BASELINE_OCCURRENCE: 6,
        };
        return order[a.assessment.status] - order[b.assessment.status];
    });

    return {
        candidates,
        summary: {
            totalEvaluated: candidates.length,
            recovered: candidates.filter((c) => c.assessment.status === "RECOVERED").length,
            partiallyRecovered: candidates.filter((c) => c.assessment.status === "PARTIALLY_RECOVERED").length,
            stillObserved: candidates.filter((c) => c.assessment.status === "STILL_OBSERVED").length,
            insufficientEvidence: candidates.filter((c) => c.assessment.status === "INSUFFICIENT_EVIDENCE").length,
            noBaseline: candidates.filter((c) => c.assessment.status === "NO_BASELINE_OCCURRENCE").length,
            changeNotIsolated: candidates.filter((c) => c.assessment.status === "CHANGE_NOT_ISOLATED").length,
        },
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}
