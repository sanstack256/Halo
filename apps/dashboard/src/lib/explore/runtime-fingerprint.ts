import { prisma } from "../prisma";
import {
    getEventById,
    getEventsInTimeRange,
} from "./canonical-evidence-access";
import type {
    CanonicalEvidenceRecord,
    AnalyticalResultProvenance,
} from "./evidence-types";

export type FingerprintStatus = "MATCHING" | "DIFFERENT" | "UNKNOWN" | "NOT CAPTURED" | "NOT APPLICABLE";

export interface DiscoveredRuntimeAttribute {
    key: string;
    label: string;
    failureValue: string;
    referenceValue: string;
    status: FingerprintStatus;
    source: string;
    isInvestigationLead: boolean;
}

export interface RuntimeFingerprintResult {
    failureEvent: CanonicalEvidenceRecord;
    referenceEvent: CanonicalEvidenceRecord | null;
    attributes: DiscoveredRuntimeAttribute[];
    differenceCount: number;
    matchingCount: number;
    unknownCount: number;
    hasComparableReference: boolean;
    provenance: AnalyticalResultProvenance;
}

export async function compareRuntimeFingerprint(
    failureEventId: string | undefined,
    orgId: string
): Promise<RuntimeFingerprintResult | null> {
    let failureEvent: CanonicalEvidenceRecord | null = null;
    if (failureEventId) {
        failureEvent = await getEventById(failureEventId, orgId);
    }

    if (!failureEvent) {
        const { records } = await getEventsInTimeRange(
            { types: ["ERROR"], limit: 1 },
            orgId
        );
        failureEvent = records[0] || null;
    }

    if (!failureEvent) return null;

    // Search for a real comparable successful reference execution
    const refCandidates = await prisma.event.findMany({
        where: {
            project: { organizationId: orgId },
            projectId: failureEvent.projectId,
            service: failureEvent.service ?? undefined,
            id: { not: failureEvent.id },
            severity: "INFO",
            type: { in: ["TRACE", "LOG"] },
        },
        orderBy: { timestamp: "desc" },
        take: 5,
    });

    const referenceRaw = refCandidates[0] || null;
    const referenceEvent = referenceRaw ? await getEventById(referenceRaw.id, orgId) : null;

    const attributes: DiscoveredRuntimeAttribute[] = [];

    // Helper for dynamically discovered attributes
    function evaluateAttribute(
        key: string,
        label: string,
        failVal: unknown,
        refVal: unknown,
        source: string
    ) {
        const strFail = failVal !== undefined && failVal !== null && failVal !== "" ? String(failVal) : null;
        const strRef = refVal !== undefined && refVal !== null && refVal !== "" ? String(refVal) : null;

        let status: FingerprintStatus = "UNKNOWN";
        if (!strFail && !strRef) {
            status = "NOT CAPTURED";
        } else if (strFail && !strRef) {
            status = "DIFFERENT";
        } else if (!strFail && strRef) {
            status = "DIFFERENT";
        } else if (strFail === strRef) {
            status = "MATCHING";
        } else {
            status = "DIFFERENT";
        }

        attributes.push({
            key,
            label,
            failureValue: strFail || "NOT CAPTURED",
            referenceValue: strRef || "NOT CAPTURED",
            status,
            source,
            isInvestigationLead: status === "DIFFERENT",
        });
    }

    // Standard runtime attributes
    evaluateAttribute("service", "Service Name", failureEvent.service, referenceEvent?.service, "Event Schema");
    evaluateAttribute("environment", "Deployment Environment", failureEvent.environmentName, referenceEvent?.environmentName, "Environment Schema");
    evaluateAttribute("release", "Application Release", failureEvent.release, referenceEvent?.release, "Release Schema");
    evaluateAttribute("sdkName", "Halo SDK Client", failureEvent.sdkName, referenceEvent?.sdkName, "SDK Ingestion");
    evaluateAttribute("sdkVersion", "Halo SDK Version", failureEvent.sdkVersion, referenceEvent?.sdkVersion, "SDK Ingestion");

    // Dynamic metadata discovery: inspect metadata and tags from both records
    const failMeta = failureEvent.metadata || {};
    const refMeta = referenceEvent?.metadata || {};
    const failTags = failureEvent.tags || {};
    const refTags = referenceEvent?.tags || {};

    const allKeys = Array.from(
        new Set([
            ...Object.keys(failMeta),
            ...Object.keys(refMeta),
            ...Object.keys(failTags),
            ...Object.keys(refTags),
        ])
    );

    for (const key of allKeys) {
        // Skip large payload objects or internal arrays
        const valA = failMeta[key] ?? failTags[key];
        const valB = refMeta[key] ?? refTags[key];

        if (typeof valA === "object" && valA !== null) continue;
        if (typeof valB === "object" && valB !== null) continue;

        const friendlyLabel = key.replace(/([A-Z])/g, " $1").replace(/[._]/g, " ").trim();
        evaluateAttribute(key, friendlyLabel.charAt(0).toUpperCase() + friendlyLabel.slice(1), valA, valB, "Captured Metadata");
    }

    const differenceCount = attributes.filter((a) => a.status === "DIFFERENT").length;
    const matchingCount = attributes.filter((a) => a.status === "MATCHING").length;
    const unknownCount = attributes.filter((a) => a.status === "UNKNOWN" || a.status === "NOT CAPTURED").length;

    const provenance: AnalyticalResultProvenance = {
        basisEvidenceIds: referenceEvent ? [failureEvent.id, referenceEvent.id] : [failureEvent.id],
        relationshipType: "COMPARATIVE",
        derivationType: "Runtime Attribute Difference Extraction",
        evidenceState: referenceEvent ? "OBSERVED" : "INSUFFICIENT",
        summary: referenceEvent
            ? `Extracted ${attributes.length} dynamic runtime attribute(s) comparing failure (${failureEvent.id}) against reference (${referenceEvent.id}). Detected ${differenceCount} difference(s).`
            : "No comparable successful reference execution found in telemetry.",
        canBeEstablished: [
            "Exact environmental metadata differences between failure and reference executions.",
            "Differences categorized as investigation leads rather than assumed root causes.",
        ],
        cannotBeEstablished: [
            "Uninstrumented cloud container or infrastructure attributes not captured in event metadata.",
        ],
    };

    return {
        failureEvent,
        referenceEvent,
        attributes,
        differenceCount,
        matchingCount,
        unknownCount,
        hasComparableReference: Boolean(referenceEvent),
        provenance,
    };
}
