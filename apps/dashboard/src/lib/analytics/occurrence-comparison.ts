import { prisma } from "@/lib/prisma";
import type { OccurrenceComparison } from "./types";
import { formatDeterministicDateTime } from "@/lib/date-format";

export async function compareFailureOccurrences(
    fingerprint: string,
    projectId: string
): Promise<OccurrenceComparison | null> {
    const events = await prisma.event.findMany({
        where: {
            projectId,
            fingerprint,
            type: "ERROR",
        },
        select: {
            id: true,
            title: true,
            service: true,
            release: true,
            durationMs: true,
            timestamp: true,
            resource: true,
        },
        orderBy: { timestamp: "desc" },
        take: 20,
    });

    if (events.length === 0) return null;

    const currentEvt = events[0];
    // Find previous distinct occurrence (at least 5 minutes apart or different release)
    const prevEvt = events.find(
        (e) =>
            Math.abs(e.timestamp.getTime() - currentEvt.timestamp.getTime()) > 5 * 60 * 1000 ||
            (e.release && e.release !== currentEvt.release)
    ) || events[events.length - 1];

    const currentService = currentEvt.service || "unknown-service";
    const prevService = prevEvt.service || "unknown-service";

    const differences: string[] = [];
    const sharedAttributes: string[] = [];

    // Service comparison
    if (currentService !== prevService) {
        differences.push(`Service shifted from '${prevService}' to '${currentService}'.`);
    } else {
        sharedAttributes.push(`Originating service: ${currentService}`);
    }

    // Release comparison
    if (currentEvt.release !== prevEvt.release) {
        differences.push(
            `Deployed release changed from ${prevEvt.release || "baseline"} to ${currentEvt.release || "unversioned"}.`
        );
    } else if (currentEvt.release) {
        sharedAttributes.push(`Recorded under release: ${currentEvt.release}`);
    }

    // Latency comparison
    const curLat = currentEvt.durationMs;
    const prevLat = prevEvt.durationMs;
    if (typeof curLat === "number" && typeof prevLat === "number" && curLat !== prevLat) {
        const diff = curLat - prevLat;
        differences.push(
            `Execution duration shifted by ${diff > 0 ? "+" : ""}${diff}ms (${prevLat}ms &rarr; ${curLat}ms).`
        );
    }

    // Resource / endpoint comparison
    if (currentEvt.resource && prevEvt.resource) {
        if (currentEvt.resource === prevEvt.resource) {
            sharedAttributes.push(`Target endpoint/resource: ${currentEvt.resource}`);
        } else {
            differences.push(`Target resource shifted from '${prevEvt.resource}' to '${currentEvt.resource}'.`);
        }
    }

    if (differences.length === 0) {
        differences.push("Telemetry signatures match previous occurrence with identical operational environment.");
    }

    return {
        fingerprint,
        title: currentEvt.title,
        currentOccurrence: {
            timestamp: currentEvt.timestamp.toISOString(),
            service: currentService,
            release: currentEvt.release || undefined,
            errorCount: 1,
            errorRate: 100.0,
            avgLatencyMs: currentEvt.durationMs || null,
        },
        previousOccurrence: {
            timestamp: prevEvt.timestamp.toISOString(),
            service: prevService,
            release: prevEvt.release || undefined,
            errorCount: 1,
            errorRate: 100.0,
            avgLatencyMs: prevEvt.durationMs || null,
        },
        differences,
        sharedAttributes,
    };
}
