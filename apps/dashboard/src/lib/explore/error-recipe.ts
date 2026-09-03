import { prisma } from "../prisma";
import {
    getEventById,
    getEventsInTimeRange,
    type CanonicalQueryFilter,
} from "./canonical-evidence-access";
import {
    assessErrorReproductionSufficiency,
    type EvidenceSufficiencyVerdict,
} from "./evidence-sufficiency";
import type {
    CanonicalEvidenceRecord,
    AnalyticalResultProvenance,
} from "./evidence-types";

export type ConditionClassification =
    | "OBSERVED ACROSS FAILURES"
    | "COMMON"
    | "VARIABLE"
    | "ABSENT FROM COMPARATORS"
    | "UNKNOWN"
    | "INSUFFICIENT";

export interface ObservedCondition {
    category: string;
    label: string;
    value: string;
    failureCount: number;
    totalFailures: number;
    failureFraction: string;
    failurePct: number;
    successCount?: number;
    totalSuccesses?: number;
    successFraction?: string;
    successPct?: number;
    classification: ConditionClassification;
    evidenceExplanation: string;
}

export interface ErrorReproductionRecipe {
    fingerprint: string;
    title: string;
    sampleEvent: CanonicalEvidenceRecord;
    totalOccurrences: number;
    totalComparators: number;
    firstSeen: Date;
    lastSeen: Date;
    conditions: ObservedCondition[];
    conditionMatrix: {
        observedAcrossFailures: ObservedCondition[];
        common: ObservedCondition[];
        variable: ObservedCondition[];
        absentFromComparators: ObservedCondition[];
        unknown: ObservedCondition[];
    };
    rawRecipeText: string;
    sufficiency: EvidenceSufficiencyVerdict;
    provenance: AnalyticalResultProvenance;
}

export async function generateErrorReproductionRecipe(
    target: { fingerprint?: string; eventId?: string; issueId?: string },
    orgId: string
): Promise<ErrorReproductionRecipe | null> {
    let sampleEvent: CanonicalEvidenceRecord | null = null;

    if (target.eventId) {
        sampleEvent = await getEventById(target.eventId, orgId);
    }

    if (!sampleEvent && target.issueId) {
        const issue = await prisma.issue.findFirst({
            where: { id: target.issueId, project: { organizationId: orgId } },
        });
        if (issue) {
            const { records } = await getEventsInTimeRange(
                { projectIds: [issue.projectId], types: ["ERROR"], limit: 1 },
                orgId
            );
            sampleEvent = records[0] || null;
        }
    }

    if (!sampleEvent && target.fingerprint) {
        const { records } = await getEventsInTimeRange(
            { search: target.fingerprint, types: ["ERROR"], limit: 1 },
            orgId
        );
        sampleEvent = records[0] || null;
    }

    // Fallback: pick latest error event
    if (!sampleEvent) {
        const { records } = await getEventsInTimeRange(
            { types: ["ERROR"], limit: 1 },
            orgId
        );
        sampleEvent = records[0] || null;
    }

    if (!sampleEvent) return null;

    const fingerprint = sampleEvent.fingerprint || sampleEvent.title;

    // 1. Fetch failure occurrences
    const { records: occurrences } = await getEventsInTimeRange(
        {
            projectIds: [sampleEvent.projectId],
            types: ["ERROR"],
            search: sampleEvent.title,
            limit: 100,
        },
        orgId
    );

    const totalFailures = occurrences.length;
    if (totalFailures === 0) return null;

    // 2. Fetch comparable successful executions (same service / route)
    const { records: comparators } = await getEventsInTimeRange(
        {
            projectIds: [sampleEvent.projectId],
            service: sampleEvent.service ?? undefined,
            types: ["TRACE"],
            limit: 100,
        },
        orgId
    );
    const validComparators = comparators.filter((c) => c.status !== "500" && c.severity === "INFO");
    const totalSuccesses = validComparators.length;

    // 3. Extract dimensions
    const envCounts = new Map<string, number>();
    const serviceCounts = new Map<string, number>();
    const releaseCounts = new Map<string, number>();
    const routeCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    const browserCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    let authenticatedCount = 0;
    let traceLinkedCount = 0;

    // Comparator dimension maps
    const compEnvCounts = new Map<string, number>();
    const compReleaseCounts = new Map<string, number>();
    const compRouteCounts = new Map<string, number>();

    let minTime = occurrences[0].timestamp;
    let maxTime = occurrences[0].timestamp;

    for (const occ of occurrences) {
        if (occ.timestamp < minTime) minTime = occ.timestamp;
        if (occ.timestamp > maxTime) maxTime = occ.timestamp;

        const env = occ.environmentName || "unknown";
        envCounts.set(env, (envCounts.get(env) || 0) + 1);

        const srv = occ.service || "unspecified";
        serviceCounts.set(srv, (serviceCounts.get(srv) || 0) + 1);

        if (occ.release) releaseCounts.set(occ.release, (releaseCounts.get(occ.release) || 0) + 1);
        if (occ.resource) routeCounts.set(occ.resource, (routeCounts.get(occ.resource) || 0) + 1);
        if (occ.status) statusCounts.set(String(occ.status), (statusCounts.get(String(occ.status)) || 0) + 1);

        if (occ.user && (occ.user.id || occ.user.email || occ.user.username)) authenticatedCount++;
        if (occ.traceId) traceLinkedCount++;

        const browser = occ.metadata.browser || occ.tags.browser;
        if (typeof browser === "string") browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);

        const os = occ.metadata.os || occ.tags.os;
        if (typeof os === "string") osCounts.set(os, (osCounts.get(os) || 0) + 1);
    }

    for (const comp of validComparators) {
        const env = comp.environmentName || "unknown";
        compEnvCounts.set(env, (compEnvCounts.get(env) || 0) + 1);
        if (comp.release) compReleaseCounts.set(comp.release, (compReleaseCounts.get(comp.release) || 0) + 1);
        if (comp.resource) compRouteCounts.set(comp.resource, (compRouteCounts.get(comp.resource) || 0) + 1);
    }

    const conditions: ObservedCondition[] = [];

    function addCondition(
        category: string,
        label: string,
        value: string,
        failCount: number,
        succCount?: number
    ) {
        const failPct = Math.round((failCount / totalFailures) * 100);
        const succPct = succCount !== undefined && totalSuccesses > 0 ? Math.round((succCount / totalSuccesses) * 100) : undefined;

        let classification: ConditionClassification = "VARIABLE";
        let evidenceExplanation = `Observed in ${failCount}/${totalFailures} failures.`;

        // STRICT RULE: If totalFailures == 1, NEVER label REQUIRED
        if (totalFailures === 1) {
            classification = "INSUFFICIENT";
            evidenceExplanation = "Observed in 1/1 failure. Insufficient evidence to establish requirement.";
        } else if (failCount === totalFailures) {
            if (succCount !== undefined && succCount === 0 && totalSuccesses >= 5) {
                classification = "ABSENT FROM COMPARATORS";
                evidenceExplanation = `Present in 100% of failures (${failCount}/${totalFailures}) and absent in all ${totalSuccesses} comparable successes.`;
            } else {
                classification = "OBSERVED ACROSS FAILURES";
                evidenceExplanation = `Observed across 100% of failure occurrences (${failCount}/${totalFailures}).`;
            }
        } else if (failPct >= 60) {
            classification = "COMMON";
            evidenceExplanation = `Common condition (observed in ${failPct}% of failures).`;
        } else if (failCount === 0) {
            classification = "UNKNOWN";
            evidenceExplanation = "Telemetry not captured or field absent in payload.";
        } else {
            classification = "VARIABLE";
            evidenceExplanation = `Variable condition (observed in ${failPct}% of failures).`;
        }

        conditions.push({
            category,
            label,
            value,
            failureCount: failCount,
            totalFailures,
            failureFraction: `${failCount}/${totalFailures}`,
            failurePct: failPct,
            successCount: succCount,
            totalSuccesses: succCount !== undefined ? totalSuccesses : undefined,
            successFraction: succCount !== undefined ? `${succCount}/${totalSuccesses}` : undefined,
            successPct: succPct,
            classification,
            evidenceExplanation,
        });
    }

    // Add extracted conditions
    for (const [env, count] of envCounts.entries()) {
        addCondition("Environment", "Target Environment", env, count, compEnvCounts.get(env) || 0);
    }
    for (const [srv, count] of serviceCounts.entries()) {
        addCondition("Service", "Affected Service", srv, count);
    }
    for (const [rel, count] of releaseCounts.entries()) {
        addCondition("Release", "Deployed Release", rel, count, compReleaseCounts.get(rel) || 0);
    }
    for (const [route, count] of routeCounts.entries()) {
        addCondition("Request", "Target Route", route, count, compRouteCounts.get(route) || 0);
    }
    for (const [st, count] of statusCounts.entries()) {
        addCondition("Request", "Response Status", st, count);
    }

    if (authenticatedCount > 0) {
        addCondition("Session", "Authenticated User State", "Active Session", authenticatedCount);
    } else {
        addCondition("Session", "Authenticated User State", "Unauthenticated / Not Captured", 0);
    }

    for (const [browser, count] of browserCounts.entries()) {
        addCondition("Runtime", "Client Browser", browser, count);
    }
    for (const [os, count] of osCounts.entries()) {
        addCondition("Runtime", "Operating System", os, count);
    }

    if (browserCounts.size === 0) {
        addCondition("Runtime", "Client Browser", "Not Captured (Server execution or uninstrumented)", 0);
    }

    const conditionMatrix = {
        observedAcrossFailures: conditions.filter(
            (c) => c.classification === "OBSERVED ACROSS FAILURES" || c.classification === "ABSENT FROM COMPARATORS"
        ),
        common: conditions.filter((c) => c.classification === "COMMON"),
        variable: conditions.filter((c) => c.classification === "VARIABLE"),
        absentFromComparators: conditions.filter((c) => c.classification === "ABSENT FROM COMPARATORS"),
        unknown: conditions.filter((c) => c.classification === "UNKNOWN"),
    };

    const sufficiency = assessErrorReproductionSufficiency({
        failureCount: totalFailures,
        comparatorCount: totalSuccesses,
        evidenceIds: occurrences.map((o) => o.id),
    });

    const rawRecipeLines: string[] = [
        `HALO TRACE — FACTUAL ERROR REPRODUCTION RECIPE`,
        `Failure Signature: ${sampleEvent.title}`,
        `Total Evaluated Failures: ${totalFailures}`,
        `Comparable Successes: ${totalSuccesses}`,
        `Observed Window: ${minTime.toISOString()} to ${maxTime.toISOString()}`,
        ``,
        `EVIDENCE QUALITY: ${sufficiency.status}`,
        ...sufficiency.reasons.map((r) => `  - ${r}`),
        ``,
        `CONDITIONS OBSERVED ACROSS FAILURES:`,
        ...(conditionMatrix.observedAcrossFailures.length > 0
            ? conditionMatrix.observedAcrossFailures.map(
                  (c) =>
                      `  - [${c.category}] ${c.label}: ${c.value} (Failures: ${c.failureFraction}${c.successFraction ? `, Successes: ${c.successFraction}` : ""})`
              )
            : [`  - [None established across 100% of failures]`]),
        ``,
        `COMMON CONDITIONS (Present in ≥60% of failures):`,
        ...conditionMatrix.common.map(
            (c) => `  - [${c.category}] ${c.label}: ${c.value} (${c.failureFraction})`
        ),
        ``,
        `VARIABLE CONDITIONS (<60% of failures):`,
        ...conditionMatrix.variable.map(
            (c) => `  - [${c.category}] ${c.label}: ${c.value} (${c.failureFraction})`
        ),
        ``,
        `UNOBSERVED TELEMETRY / UNKNOWN CONDITIONS:`,
        ...conditionMatrix.unknown.map(
            (c) => `  - [${c.category}] ${c.label}: ${c.value}`
        ),
        ``,
        `NOTE: This recipe is derived purely from observed telemetry without inferred causal steps.`,
    ];

    const provenance: AnalyticalResultProvenance = {
        basisEvidenceIds: occurrences.slice(0, 10).map((o) => o.id),
        relationshipType: "COMPARATIVE",
        derivationType: "Population Condition Correlation",
        evidenceState: sufficiency.status === "SUFFICIENT" ? "OBSERVED" : "INSUFFICIENT",
        summary: `Evaluated ${totalFailures} failure occurrence(s) against ${totalSuccesses} comparable successful executions.`,
        canBeEstablished: sufficiency.whatCanBeEstablished,
        cannotBeEstablished: sufficiency.whatCannotBeEstablished,
    };

    return {
        fingerprint,
        title: sampleEvent.title,
        sampleEvent,
        totalOccurrences: totalFailures,
        totalComparators: totalSuccesses,
        firstSeen: minTime,
        lastSeen: maxTime,
        conditions,
        conditionMatrix,
        rawRecipeText: rawRecipeLines.join("\n"),
        sufficiency,
        provenance,
    };
}
