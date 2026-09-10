"use server";

import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { redirect } from "next/navigation";
import {
    loadCanonicalOverview,
    emptyOverviewData,
    CanonicalOverviewData,
} from "@/lib/overview/overview-service";
import type {
    ActiveIncident,
    RecentChange,
    RecentInvestigation,
    OverviewData,
} from "@/lib/overview/types";

export async function getOverviewData(projectId?: string): Promise<OverviewData> {
    const session = await getSession();
    if (!session) {
        redirect("/sign-in");
    }

    try {
        const organization = await getOrganization(session.user.id);
        if (!organization) {
            return formatExtendedOverview(emptyOverviewData());
        }

        const canonical = await loadCanonicalOverview({
            organizationId: organization.id,
            projectId,
        });

        return formatExtendedOverview(canonical);
    } catch (error: unknown) {
        if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
            throw error;
        }
        console.error("[getOverviewData] Unexpected error fetching overview data:", error);
        return formatExtendedOverview(emptyOverviewData());
    }
}

function formatExtendedOverview(canonical: CanonicalOverviewData): OverviewData {
    // Map canonical attention items to backward-compatible structures where needed by legacy pages
    const issueAttention = canonical.attentionItems.filter((i) => i.type === "ISSUE");
    const activeIncidents: ActiveIncident[] = issueAttention.map((att) => ({
        id: att.evidenceReference.entityId,
        title: att.title,
        severity: att.severity,
        eventCount: parseInt(att.evidenceReference.metricValue || "1", 10) || 1,
        occurrenceDescription: att.summary,
        service: att.source,
        projectName: att.source,
        projectId: canonical.projects[0]?.id || "",
        lastSeen: att.timestamp,
        status: att.status,
    }));

    const changeAttention = canonical.attentionItems.filter((i) => i.type === "CHANGE");
    const recentChanges: RecentChange[] = changeAttention.map((att) => ({
        id: att.evidenceReference.entityId,
        version: att.title.replace("Release ", "").replace(" correlated with errors", ""),
        type: "deployment",
        projectName: att.source,
        projectId: canonical.projects[0]?.id || "",
        timestamp: att.timestamp,
        correlatedErrors: parseInt(att.evidenceReference.metricValue || "0", 10) || 0,
        status: "suspicious",
    }));

    const invAttention = canonical.attentionItems.filter((i) => i.type === "INVESTIGATION");
    const recentInvestigations: RecentInvestigation[] = invAttention.map((att) => ({
        id: att.evidenceReference.entityId,
        title: att.title,
        issueId: null,
        projectId: canonical.projects[0]?.id || "",
        projectName: att.source,
        status: att.status,
        hasRootCause: att.title.startsWith("Root cause identified"),
        rootCauseTitle: att.title.startsWith("Root cause identified") ? att.title.replace("Root cause identified: ", "") : null,
        confidenceScore: null,
        updatedAt: att.timestamp,
    }));

    const primaryAlert = activeIncidents[0]
        ? {
              title: activeIncidents[0].title,
              service: activeIncidents[0].service,
              severity: activeIncidents[0].severity,
              occurrenceDescription: activeIncidents[0].occurrenceDescription,
              suspectedCause: `Failure observed in service: ${activeIncidents[0].service || "Unknown"}`,
              issueId: activeIncidents[0].id,
              projectId: activeIncidents[0].projectId,
          }
        : null;

    // Truthful system health metrics
    const errorEvents = canonical.observedState.recentErrorEvents ?? 0;
    const hasTelemetry = canonical.observedState.telemetryObserved;

    return {
        ...canonical,
        activeIncidents,
        recentChanges,
        recentInvestigations,
        needsAttention: {
            openIssuesCount: canonical.observedState.activeIssuesCount,
            fatalCount: canonical.attentionSummary.fatalCount,
            criticalServiceCount: canonical.serviceHealthSummary.critical,
            suspiciousChangeCount: changeAttention.length,
            primaryAlert,
        },
        systemHealth: {
            apdexScore: hasTelemetry ? 1.0 : 0.0,
            apdexRating: hasTelemetry ? "Satisfied" : "Tolerating",
            errorRate24h: 0,
            crashFreeRate: hasTelemetry ? 100 : 0,
            impactedUsers24h: errorEvents,
            totalErrors24h: errorEvents,
            activeServiceCount: canonical.observedState.observedServicesCount,
        },
        systemState: canonical.observedState,
    };
}
