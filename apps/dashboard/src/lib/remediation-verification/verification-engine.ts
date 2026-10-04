/**
 * HALO TRACE — PILLAR I VERIFICATION ENGINE
 * Remediation Verification & Resolution Intelligence
 *
 * Deterministic engine for evaluating post-remediation telemetry,
 * computing before/after metric windows, matching original failure signatures,
 * detecting regressions, and establishing epistemic verification strength.
 *
 * ABSOLUTE INVARIANTS:
 * 1. Remediation Applied != Incident Resolved.
 * 2. Zero automated actuation (no rollback, code mod, deploy, flag toggle).
 * 3. Never mutate investigation.rootCause or investigation.confidenceScore.
 * 4. Never mutate recommendation.recommendationKey, action, rationale, or evidenceReferences.
 * 5. Low traffic / missing data must fail closed to UNKNOWN or INSUFFICIENT_DATA.
 * 6. Full tenant isolation across database and memory cache.
 */

import { prisma } from "@/lib/prisma";
import type {
    RemediationVerificationDomain,
    VerificationResult,
    VerificationStrength,
    VerifyRemediationParams,
    TemporalAnchor,
    MetricWindowComparison,
    FailureSignatureComparison,
    RegressionSignal,
    DifferentialVerificationContext,
    TopologyVerificationContext,
    ReplayVerificationContext,
} from "./types";

// In-memory tenant-isolated cache for verification results
const verificationCache = new Map<string, { data: RemediationVerificationDomain; expiresAt: number }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL

function buildCacheKey(organizationId: string, projectId: string, recommendationId: string): string {
    return `${organizationId}:${projectId}:${recommendationId}`;
}

export function clearVerificationCache(
    organizationId?: string,
    projectId?: string,
    recommendationId?: string
): void {
    if (organizationId && projectId && recommendationId) {
        verificationCache.delete(buildCacheKey(organizationId, projectId, recommendationId));
    } else {
        verificationCache.clear();
    }
}

/**
 * Calculate percentiles (p50, p95, p99) from an array of numbers.
 */
function calculatePercentiles(values: number[]): { p50: number | null; p95: number | null; p99: number | null } {
    if (values.length === 0) {
        return { p50: null, p95: null, p99: null };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    };
    return {
        p50: getPercentile(50),
        p95: getPercentile(95),
        p99: getPercentile(99),
    };
}

/**
 * Identify the temporal anchor for a recommendation.
 * Inspects:
 *   1. Verified deployment event linked to recommendation / project
 *   2. Verified change observation linked to recommendation
 *   3. Human completion timestamp (completedAt)
 *
 * If none exists, returns null (cannot evaluate post-change window).
 */
async function resolveTemporalAnchor(
    recommendation: {
        id: string;
        projectId: string;
        affectedServices: string[];
        affectedCodePaths: string[];
        evidenceReferences: string[];
        completedAt: Date | null;
        createdAt: Date;
    }
): Promise<TemporalAnchor | null> {
    // 1. Check for deployment change observation
    const deploymentChange = await prisma.changeObservation.findFirst({
        where: {
            projectId: recommendation.projectId,
            sourceType: "DEPLOYMENT_EVENT",
        },
        orderBy: { authorTimestamp: "desc" },
    });

    if (deploymentChange && (deploymentChange.authorTimestamp || deploymentChange.observedAt)) {
        const anchorDate = deploymentChange.authorTimestamp || deploymentChange.observedAt;
        return {
            type: "DEPLOYMENT",
            timestamp: anchorDate.toISOString(),
            referenceId: deploymentChange.id,
            label: deploymentChange.deploymentReference || `Deployment ${deploymentChange.changeKey}`,
        };
    }

    // 2. Check for project releases
    const projectRelease = await prisma.release.findFirst({
        where: { projectId: recommendation.projectId },
        orderBy: { firstSeen: "desc" },
    });

    if (projectRelease && projectRelease.firstSeen) {
        return {
            type: "DEPLOYMENT",
            timestamp: projectRelease.firstSeen.toISOString(),
            referenceId: projectRelease.id,
            label: `Release ${projectRelease.version}`,
        };
    }

    // 3. Check for specific change observation linked in recommendation evidenceReferences
    if (recommendation.evidenceReferences.length > 0) {
        const linkedChange = await prisma.changeObservation.findFirst({
            where: {
                projectId: recommendation.projectId,
                id: { in: recommendation.evidenceReferences },
            },
            orderBy: { authorTimestamp: "desc" },
        });

        if (linkedChange && (linkedChange.authorTimestamp || linkedChange.observedAt)) {
            const anchorDate = linkedChange.authorTimestamp || linkedChange.observedAt;
            return {
                type: "CHANGE_OBSERVATION",
                timestamp: anchorDate.toISOString(),
                referenceId: linkedChange.id,
                label: `Change ${linkedChange.commitSha?.slice(0, 8) || linkedChange.changeKey}`,
            };
        }
    }

    // 4. Check for human completion timestamp on recommendation
    if (recommendation.completedAt) {
        return {
            type: "HUMAN_COMPLETION",
            timestamp: recommendation.completedAt.toISOString(),
            referenceId: recommendation.id,
            label: "Human Engineer Remediation Completion",
        };
    }

    // 5. Check if any change observation exists in project authored after recommendation creation
    const recentChange = await prisma.changeObservation.findFirst({
        where: {
            projectId: recommendation.projectId,
            observedAt: { gte: recommendation.createdAt },
        },
        orderBy: { observedAt: "desc" },
    });

    if (recentChange && (recentChange.authorTimestamp || recentChange.observedAt)) {
        const anchorDate = recentChange.authorTimestamp || recentChange.observedAt;
        return {
            type: "CHANGE_OBSERVATION",
            timestamp: anchorDate.toISOString(),
            referenceId: recentChange.id,
            label: `Change ${recentChange.commitSha?.slice(0, 8) || recentChange.changeKey}`,
        };
    }

    return null;
}

/**
 * Execute remediation verification for a recommendation.
 */
export async function verifyRemediationRecommendation(
    params: VerifyRemediationParams
): Promise<RemediationVerificationDomain> {
    const { recommendationId, organizationId, projectId, forceFresh } = params;

    const cacheKey = buildCacheKey(organizationId, projectId, recommendationId);
    if (!forceFresh) {
        const cached = verificationCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
    }

    // 1. Retrieve recommendation with authoritative relations
    const recommendation = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
        include: {
            investigation: {
                include: {
                    issue: true,
                    incidentMemory: true,
                },
            },
        },
    });

    if (!recommendation) {
        throw new Error(`Recommendation ${recommendationId} not found.`);
    }

    // Strict multi-tenant boundary validation
    if (recommendation.organizationId !== organizationId || recommendation.projectId !== projectId) {
        throw new Error("Unauthorized: Cross-tenant access to recommendation is rejected.");
    }

    // 2. Resolve Temporal Anchor
    const anchor = await resolveTemporalAnchor(recommendation);

    // If no verified temporal anchor exists, fail closed to INSUFFICIENT_DATA / UNKNOWN
    if (!anchor) {
        const nowIso = new Date().toISOString();
        const emptyWindow: MetricWindowComparison = {
            sampleCount: 0,
            failureCount: 0,
            failureRate: 0.0,
            p50LatencyMs: null,
            p95LatencyMs: null,
            p99LatencyMs: null,
            windowStart: nowIso,
            windowEnd: nowIso,
        };

        const resultRecord: RemediationVerificationDomain = {
            id: `ver-unanchored-${recommendation.id}`,
            organizationId,
            projectId,
            investigationId: recommendation.investigationId,
            recommendationId: recommendation.id,
            result: "INSUFFICIENT_DATA",
            strength: "LOW",
            baseline: emptyWindow,
            postChange: emptyWindow,
            failureComparison: {
                targetService: recommendation.affectedServices[0] || "unknown-service",
                targetOperation: recommendation.affectedOperations[0] || null,
                originalFingerprint: null,
                originalErrorTitle: null,
                baselineOccurrences: 0,
                postChangeOccurrences: 0,
                stillObserved: false,
                changePercentage: 0,
            },
            temporalAnchor: {
                type: "EXPLICIT_TIMESTAMP",
                timestamp: nowIso,
                label: "Unanchored / No Verified Change",
            },
            regressionSignals: [],
            evidenceReferences: [],
            uncertainty: "No verified deployment, release, change observation, or remediation completion timestamp is recorded. Halo cannot establish a temporal anchor to evaluate post-change telemetry.",
            explanation: "Verification cannot proceed without an authoritative change timestamp. In accordance with Master Invariants, completion cannot be assumed without evidence.",
            verifiedAt: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso,
        };

        return resultRecord;
    }

    const anchorDate = new Date(anchor.timestamp);

    // 3. Define Baseline and Post-Change Windows
    // Baseline window: 24h before anchor (or back to first observation)
    const baselineDurationMs = 24 * 60 * 60 * 1000;
    const baselineStart = new Date(anchorDate.getTime() - baselineDurationMs);
    const baselineEnd = new Date(anchorDate.getTime());

    // Post window: anchor to now (or custom window)
    const postStart = new Date(anchorDate.getTime());
    const postDurationMs = params.customPostWindowMs || 24 * 60 * 60 * 1000;
    // Ensure postEnd is strictly after postStart
    const postEnd = new Date(postStart.getTime() + postDurationMs);

    // 4. Query Telemetry Events Across Baseline and Post Windows
    const events = await prisma.event.findMany({
        where: {
            projectId,
            timestamp: {
                gte: baselineStart,
                lte: postEnd,
            },
        },
        orderBy: { timestamp: "asc" },
    });

    const targetService =
        recommendation.affectedServices[0] ||
        recommendation.investigation.incidentMemory?.primaryService ||
        "";
    const targetOperation =
        recommendation.affectedOperations[0] ||
        recommendation.investigation.incidentMemory?.primaryOperation ||
        null;

    // Identify original failure fingerprint / signature
    const originalFingerprint =
        recommendation.investigation.issue?.fingerprint ||
        null;
    const originalTitle =
        recommendation.investigation.title ||
        recommendation.investigation.incidentMemory?.errorType ||
        null;

    // Partition events into baseline and post-change
    const baselineEvents = events.filter((e) => e.timestamp < anchorDate);
    const postEvents = events.filter((e) => e.timestamp >= anchorDate);

    // Filter to comparable events for the target service (or all project events if service unassigned)
    const comparableBaseline = baselineEvents.filter(
        (e) => !targetService || e.service?.toLowerCase() === targetService.toLowerCase()
    );
    const comparablePost = postEvents.filter(
        (e) => !targetService || e.service?.toLowerCase() === targetService.toLowerCase()
    );

    // Compute baseline metrics
    const baselineSampleCount = comparableBaseline.length;
    const baselineErrors = comparableBaseline.filter(
        (e) => e.severity === "ERROR" || e.type === "ERROR" || e.status === "500" || (e.status && e.status.startsWith("5"))
    );
    const baselineFailureCount = baselineErrors.length;
    const baselineFailureRate = baselineSampleCount > 0 ? baselineFailureCount / baselineSampleCount : 0.0;
    const baselineLatencies = comparableBaseline
        .map((e) => e.durationMs)
        .filter((d): d is number => typeof d === "number");
    const baselinePercentiles = calculatePercentiles(baselineLatencies);

    // Compute post-change metrics
    const postSampleCount = comparablePost.length;
    const postErrors = comparablePost.filter(
        (e) => e.severity === "ERROR" || e.type === "ERROR" || e.status === "500" || (e.status && e.status.startsWith("5"))
    );
    const postFailureCount = postErrors.length;
    const postFailureRate = postSampleCount > 0 ? postFailureCount / postSampleCount : 0.0;
    const postLatencies = comparablePost
        .map((e) => e.durationMs)
        .filter((d): d is number => typeof d === "number");
    const postPercentiles = calculatePercentiles(postLatencies);

    // 5. Same-Failure Comparison
    // Collect all failure fingerprints/titles that occurred in baseline for this target service
    const baselineServiceErrors = baselineErrors.filter(
        (e) => !targetService || e.service?.toLowerCase() === targetService.toLowerCase()
    );
    const baselineServiceSignatures = new Set<string>();
    for (const be of baselineServiceErrors) {
        if (be.fingerprint) baselineServiceSignatures.add(be.fingerprint);
        if (be.title) baselineServiceSignatures.add(be.title.toLowerCase());
    }

    const matchesOriginalFailure = (event: typeof events[0]): boolean => {
        if (originalFingerprint && event.fingerprint === originalFingerprint) {
            return true;
        }
        if (event.fingerprint && baselineServiceSignatures.has(event.fingerprint)) {
            return true;
        }
        if (event.title && baselineServiceSignatures.has(event.title.toLowerCase())) {
            return true;
        }
        if (originalTitle) {
            const lowTitle = originalTitle.toLowerCase();
            if (event.title.toLowerCase().includes(lowTitle)) return true;
            if (event.message?.toLowerCase().includes(lowTitle)) return true;
        }
        // Match affected code path if present in stack
        if (recommendation.affectedCodePaths.length > 0 && event.stack) {
            for (const path of recommendation.affectedCodePaths) {
                const cleanPath = path.split(":")[0];
                if (event.stack.includes(cleanPath)) return true;
            }
        }
        return false;
    };

    const baselineOrigErrors = baselineErrors.filter(matchesOriginalFailure);
    const postOrigErrors = postErrors.filter(matchesOriginalFailure);

    const baselineOrigCount = baselineOrigErrors.length;
    const postOrigCount = postOrigErrors.length;
    const stillObserved = postOrigCount > 0;

    let failureChangePct = 0;
    if (baselineOrigCount > 0) {
        failureChangePct = ((postOrigCount - baselineOrigCount) / baselineOrigCount) * 100;
    } else if (postOrigCount > 0) {
        failureChangePct = 100;
    }

    // 6. Regression Detection
    const regressionSignals: RegressionSignal[] = [];

    // Check for new error fingerprints in post-change events not present in baseline
    const baselineFingerprints = new Set(baselineErrors.map((e) => e.fingerprint || e.title));
    const newErrors = postErrors.filter((e) => !baselineFingerprints.has(e.fingerprint || e.title));

    if (newErrors.length > 0) {
        const topNewError = newErrors[0];
        regressionSignals.push({
            type: "NEW_FAILURE_SIGNATURE",
            service: topNewError.service || targetService || "service",
            operation: topNewError.operation || null,
            fingerprint: topNewError.fingerprint || topNewError.title,
            description: `New error signature "${topNewError.title}" observed following the remediation change (${newErrors.length} occurrences).`,
            baselineValue: 0,
            postChangeValue: newErrors.length,
            evidenceReferenceId: topNewError.id,
        });
    }

    // Check for p95 latency regression (>= 2x baseline and >= 100ms delta)
    if (
        baselinePercentiles.p95 !== null &&
        postPercentiles.p95 !== null &&
        postPercentiles.p95 >= baselinePercentiles.p95 * 2.0 &&
        postPercentiles.p95 - baselinePercentiles.p95 >= 100
    ) {
        regressionSignals.push({
            type: "INCREASED_LATENCY",
            service: targetService || "service",
            operation: targetOperation,
            description: `Latency p95 increased from ${baselinePercentiles.p95}ms to ${postPercentiles.p95}ms following the remediation change.`,
            baselineValue: baselinePercentiles.p95,
            postChangeValue: postPercentiles.p95,
        });
    }

    // Check for overall error rate increase (>= 25% relative increase with >= 3 errors)
    if (
        postFailureCount >= 3 &&
        postFailureRate > baselineFailureRate * 1.25 &&
        postFailureRate - baselineFailureRate >= 0.05
    ) {
        regressionSignals.push({
            type: "INCREASED_ERROR_RATE",
            service: targetService || "service",
            operation: targetOperation,
            description: `Failure rate on service ${targetService} increased from ${(baselineFailureRate * 100).toFixed(1)}% to ${(postFailureRate * 100).toFixed(1)}% post-remediation.`,
            baselineValue: `${(baselineFailureRate * 100).toFixed(1)}%`,
            postChangeValue: `${(postFailureRate * 100).toFixed(1)}%`,
        });
    }

    // 7. Deterministic Classification & Strength Evaluation
    const MIN_SAMPLE_COUNT = 5;
    let result: VerificationResult;
    let strength: VerificationStrength;
    let explanation: string;
    let uncertainty: string;

    if (postSampleCount === 0) {
        result = "INSUFFICIENT_DATA";
        strength = "LOW";
        explanation = "Zero comparable post-remediation executions observed for service/operation in the post-change window.";
        uncertainty = "Telemetry for the post-remediation window is completely absent. Resolution cannot be established.";
    } else if (postSampleCount < MIN_SAMPLE_COUNT) {
        result = "INSUFFICIENT_DATA";
        strength = "LOW";
        explanation = `Only ${postSampleCount} comparable post-change execution(s) observed. Sample volume is insufficient to confirm resolution.`;
        uncertainty = `Low-volume traffic (${postSampleCount} requests) limits confidence in resolution. Additional production traffic is required.`;
    } else if (regressionSignals.length > 0) {
        result = "REGRESSED";
        strength = postSampleCount >= 10 ? "HIGH" : "MEDIUM";
        explanation = `Remediation coincides with ${regressionSignals.length} new or worsened failure signals observed in post-change telemetry.`;
        uncertainty = "The new failure condition coincides temporally with the remediation change; manual confirmation required to verify whether code adjustments or upstream load created the regression.";
    } else if (!stillObserved) {
        result = "RESOLVED";
        strength = postSampleCount >= 10 ? "HIGH" : "MEDIUM";
        explanation = "The investigated failure signature is no longer observed across comparable post-remediation telemetry.";
        uncertainty = "The original failure signature is absent in the post-change window; monitor continuously under peak production traffic.";
    } else if (postFailureRate <= baselineFailureRate * 0.6 || (baselineOrigCount > 0 && postOrigCount <= baselineOrigCount * 0.5)) {
        result = "IMPROVED";
        strength = "MEDIUM";
        explanation = `The investigated failure frequency materially decreased (from ${baselineOrigCount} to ${postOrigCount}), but the failure condition remains observable.`;
        uncertainty = "Residual occurrences of the original failure signature persist; defensive handling may not cover all payload variations.";
    } else {
        result = "NOT_RESOLVED";
        strength = "HIGH";
        explanation = `The investigated failure remains materially observable (${postOrigCount} occurrences, ${(postFailureRate * 100).toFixed(1)}% failure rate) after remediation.`;
        uncertainty = "The applied remediation did not eliminate the failing execution boundary.";
    }

    // 8. Cross-Pillar Context Integration
    // Differential context (Pillar A)
    const differentialContext: DifferentialVerificationContext = {
        hasBaseline: baselineSampleCount > 0,
        baselineCount: baselineSampleCount,
        durationMultiplier:
            baselinePercentiles.p95 && postPercentiles.p95
                ? Number((postPercentiles.p95 / baselinePercentiles.p95).toFixed(2))
                : null,
        structuralDivergenceDetected: regressionSignals.length > 0,
        details:
            baselineSampleCount > 0
                ? `Compared ${postSampleCount} post-change events against ${baselineSampleCount} baseline events.`
                : "No baseline events available.",
    };

    // Topology context (Pillar B)
    const baselineServices = Array.from(new Set(baselineEvents.map((e) => e.service).filter(Boolean))) as string[];
    const postServices = Array.from(new Set(postEvents.map((e) => e.service).filter(Boolean))) as string[];
    const newDownstreamServices = postServices.filter((s) => !baselineServices.includes(s));

    const topologyContext: TopologyVerificationContext = {
        originalCascadePath: baselineServices,
        postCascadePath: postServices,
        cascadeReduced: postServices.length < baselineServices.length,
        newDownstreamServices,
        details:
            newDownstreamServices.length > 0
                ? `New downstream services (${newDownstreamServices.join(", ")}) observed post-remediation.`
                : "Cascade topology matches baseline footprint.",
    };

    // Replay context
    const postReplays = await prisma.replaySession.findMany({
        where: {
            projectId,
            startedAt: { gte: anchorDate },
        },
        take: 3,
    });

    const replayContext: ReplayVerificationContext = {
        hasPostReplay: postReplays.length > 0,
        replaySessionId: postReplays[0]?.id,
        reproducedFailure: postReplays.some((r) => r.triggerType === "ERROR" || r.triggerType === "NETWORK_5XX"),
        details:
            postReplays.length > 0
                ? `${postReplays.length} replay session(s) captured following the change.`
                : "No post-remediation replay sessions recorded.",
    };

    // Collect verified evidence references
    const evidenceReferences = Array.from(
        new Set([
            anchor.referenceId || "",
            ...baselineOrigErrors.map((e) => e.id),
            ...postOrigErrors.map((e) => e.id),
            ...newErrors.map((e) => e.id),
        ])
    ).filter(Boolean);

    // 9. Persist Verification Record to Database (Audit History Preservation)
    const verificationRecord = await prisma.remediationVerification.create({
        data: {
            organizationId,
            projectId,
            investigationId: recommendation.investigationId,
            recommendationId: recommendation.id,
            result,
            strength,
            baselineStart,
            baselineEnd,
            postStart,
            postEnd,
            baselineSampleCount,
            postSampleCount,
            baselineFailureCount,
            postFailureCount,
            baselineFailureRate,
            postFailureRate,
            baselineP50: baselinePercentiles.p50,
            postP50: postPercentiles.p50,
            baselineP95: baselinePercentiles.p95,
            postP95: postPercentiles.p95,
            baselineP99: baselinePercentiles.p99,
            postP99: postPercentiles.p99,
            targetService,
            targetOperation,
            originalFailureFingerprint: originalFingerprint,
            regressionFingerprint: regressionSignals[0]?.fingerprint || null,
            evidenceReferences,
            regressionSignals: regressionSignals.length > 0 ? (regressionSignals as any) : undefined,
            failureComparison: {
                targetService,
                targetOperation,
                originalFingerprint,
                originalErrorTitle: originalTitle,
                baselineOccurrences: baselineOrigCount,
                postChangeOccurrences: postOrigCount,
                stillObserved,
                changePercentage: Number(failureChangePct.toFixed(1)),
            },
            uncertainty,
            explanation,
            temporalAnchor: anchor as any,
        },
    });

    const domainResult: RemediationVerificationDomain = {
        id: verificationRecord.id,
        organizationId,
        projectId,
        investigationId: recommendation.investigationId,
        recommendationId: recommendation.id,
        result,
        strength,
        baseline: {
            sampleCount: baselineSampleCount,
            failureCount: baselineFailureCount,
            failureRate: baselineFailureRate,
            p50LatencyMs: baselinePercentiles.p50,
            p95LatencyMs: baselinePercentiles.p95,
            p99LatencyMs: baselinePercentiles.p99,
            windowStart: baselineStart.toISOString(),
            windowEnd: baselineEnd.toISOString(),
        },
        postChange: {
            sampleCount: postSampleCount,
            failureCount: postFailureCount,
            failureRate: postFailureRate,
            p50LatencyMs: postPercentiles.p50,
            p95LatencyMs: postPercentiles.p95,
            p99LatencyMs: postPercentiles.p99,
            windowStart: postStart.toISOString(),
            windowEnd: postEnd.toISOString(),
        },
        failureComparison: {
            targetService,
            targetOperation,
            originalFingerprint,
            originalErrorTitle: originalTitle,
            baselineOccurrences: baselineOrigCount,
            postChangeOccurrences: postOrigCount,
            stillObserved,
            changePercentage: Number(failureChangePct.toFixed(1)),
        },
        temporalAnchor: anchor,
        regressionSignals,
        differentialContext,
        topologyContext,
        replayContext,
        evidenceReferences,
        uncertainty,
        explanation,
        verifiedAt: verificationRecord.verifiedAt.toISOString(),
        createdAt: verificationRecord.createdAt.toISOString(),
        updatedAt: verificationRecord.updatedAt.toISOString(),
    };

    // Update in-memory tenant cache
    verificationCache.set(cacheKey, {
        data: domainResult,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return domainResult;
}

/**
 * Get the latest verification record for a recommendation.
 */
export async function getLatestRemediationVerification(
    recommendationId: string,
    projectId: string
): Promise<RemediationVerificationDomain | null> {
    const record = await prisma.remediationVerification.findFirst({
        where: { recommendationId, projectId },
        orderBy: { verifiedAt: "desc" },
    });

    if (!record) return null;

    const failureComparison = (record.failureComparison as any) || {
        targetService: record.targetService || "service",
        targetOperation: record.targetOperation,
        originalFingerprint: record.originalFailureFingerprint,
        originalErrorTitle: null,
        baselineOccurrences: record.baselineFailureCount,
        postChangeOccurrences: record.postFailureCount,
        stillObserved: record.postFailureCount > 0,
        changePercentage: 0,
    };

    const temporalAnchor = (record.temporalAnchor as any) || {
        type: "EXPLICIT_TIMESTAMP",
        timestamp: record.postStart.toISOString(),
        label: "Temporal Anchor",
    };

    return {
        id: record.id,
        organizationId: record.organizationId,
        projectId: record.projectId,
        investigationId: record.investigationId,
        recommendationId: record.recommendationId,
        result: record.result as VerificationResult,
        strength: record.strength as VerificationStrength,
        baseline: {
            sampleCount: record.baselineSampleCount,
            failureCount: record.baselineFailureCount,
            failureRate: record.baselineFailureRate,
            p50LatencyMs: record.baselineP50,
            p95LatencyMs: record.baselineP95,
            p99LatencyMs: record.baselineP99,
            windowStart: record.baselineStart.toISOString(),
            windowEnd: record.baselineEnd.toISOString(),
        },
        postChange: {
            sampleCount: record.postSampleCount,
            failureCount: record.postFailureCount,
            failureRate: record.postFailureRate,
            p50LatencyMs: record.postP50,
            p95LatencyMs: record.postP95,
            p99LatencyMs: record.postP99,
            windowStart: record.postStart.toISOString(),
            windowEnd: record.postEnd.toISOString(),
        },
        failureComparison,
        temporalAnchor,
        regressionSignals: (record.regressionSignals as any) || [],
        evidenceReferences: record.evidenceReferences,
        uncertainty: record.uncertainty || "",
        explanation: record.explanation || "",
        verifiedAt: record.verifiedAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    };
}

/**
 * Retrieve the full verification history for a recommendation.
 */
export async function getRemediationVerificationHistory(
    recommendationId: string,
    projectId: string
): Promise<RemediationVerificationDomain[]> {
    const records = await prisma.remediationVerification.findMany({
        where: { recommendationId, projectId },
        orderBy: { verifiedAt: "desc" },
    });

    return records.map((record) => {
        const failureComparison = (record.failureComparison as any) || {
            targetService: record.targetService || "service",
            targetOperation: record.targetOperation,
            originalFingerprint: record.originalFailureFingerprint,
            originalErrorTitle: null,
            baselineOccurrences: record.baselineFailureCount,
            postChangeOccurrences: record.postFailureCount,
            stillObserved: record.postFailureCount > 0,
            changePercentage: 0,
        };

        const temporalAnchor = (record.temporalAnchor as any) || {
            type: "EXPLICIT_TIMESTAMP",
            timestamp: record.postStart.toISOString(),
            label: "Temporal Anchor",
        };

        return {
            id: record.id,
            organizationId: record.organizationId,
            projectId: record.projectId,
            investigationId: record.investigationId,
            recommendationId: record.recommendationId,
            result: record.result as VerificationResult,
            strength: record.strength as VerificationStrength,
            baseline: {
                sampleCount: record.baselineSampleCount,
                failureCount: record.baselineFailureCount,
                failureRate: record.baselineFailureRate,
                p50LatencyMs: record.baselineP50,
                p95LatencyMs: record.baselineP95,
                p99LatencyMs: record.baselineP99,
                windowStart: record.baselineStart.toISOString(),
                windowEnd: record.baselineEnd.toISOString(),
            },
            postChange: {
                sampleCount: record.postSampleCount,
                failureCount: record.postFailureCount,
                failureRate: record.postFailureRate,
                p50LatencyMs: record.postP50,
                p95LatencyMs: record.postP95,
                p99LatencyMs: record.postP99,
                windowStart: record.postStart.toISOString(),
                windowEnd: record.postEnd.toISOString(),
            },
            failureComparison,
            temporalAnchor,
            regressionSignals: (record.regressionSignals as any) || [],
            evidenceReferences: record.evidenceReferences,
            uncertainty: record.uncertainty || "",
            explanation: record.explanation || "",
            verifiedAt: record.verifiedAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    });
}
