import {
    investigate,
} from "@halo/investigation-engine";

import {
    getInvestigationEvents,
    getInvestigationEventsForOccurrence,
} from "@/actions/issue";

import {
    eventsToEvidence,
} from "./evidence";

/**
 * Run a complete investigation for an Issue.
 *
 * Investigation flow:
 *
 * Issue
 *   ↓
 * correlated project telemetry
 *   ↓
 * normalized evidence
 *   ↓
 * investigation engine
 *   ↓
 * timeline / findings / hypotheses
 *   ↓
 * validation
 *   ↓
 * root cause or uncertainty
 *
 * The database layer is responsible for selecting
 * relevant telemetry. This layer is responsible only
 * for adapting that telemetry and executing the
 * investigation engine.
 */
export async function investigateIssue(
    issueId: string,
    projectId: string,
) {
    if (!issueId) {
        throw new Error(
            "Cannot investigate without an issue ID.",
        );
    }

    if (!projectId) {
        throw new Error(
            "Cannot investigate without a project ID.",
        );
    }

    /*
     * --------------------------------------------------
     * Investigation evidence
     * --------------------------------------------------
     *
     * Do NOT investigate only the Issue's own events.
     *
     * getInvestigationEvents() returns:
     *
     * - the Issue's anchor events
     * - correlated requests
     * - correlated traces
     * - related sessions
     * - related services
     * - shared resources
     * - related releases
     * - temporally relevant telemetry
     *
     * The query is bounded so an investigation cannot
     * accidentally consume an entire project's history.
     */
    const events =
        await getInvestigationEvents(
            issueId,
            projectId,
        );

    /*
     * A missing Issue is different from an Issue that
     * simply has no events.
     *
     * getInvestigationEvents() returns null only when
     * the Issue itself does not exist in the project.
     */
    if (events === null) {
        throw new Error(
            "Issue not found.",
        );
    }

    /*
     * There should normally be at least one anchor
     * event because Issues are created from events.
     *
     * Still, handle an empty result explicitly so the
     * investigation engine never receives an accidental
     * empty investigation without the caller knowing why.
     */
    if (events.length === 0) {
        throw new Error(
            "Cannot investigate an Issue with no events.",
        );
    }

    /*
     * --------------------------------------------------
     * Evidence normalization
     * --------------------------------------------------
     *
     * The investigation engine must never depend on
     * Prisma's database representation.
     *
     * Convert persisted Halo events into the engine's
     * stable Evidence model.
     */
    const evidence =
        eventsToEvidence(
            events,
        );

    /*
     * --------------------------------------------------
     * Investigation engine
     * --------------------------------------------------
     *
     * From this point onward the investigation engine
     * owns:
     *
     * - normalization
     * - correlation
     * - timeline reconstruction
     * - change detection
     * - findings
     * - hypotheses
     * - evaluation
     * - ranking
     * - validation
     * - recommendations
     * - impact analysis
     * - root-cause selection
     *
     * This boundary keeps the dashboard application
     * independent from the internal investigation
     * algorithm.
     */
    return investigate(
        evidence,
    );
}

/**
 * Run an investigation for ONE specific occurrence of an Issue.
 *
 * Issue grouping and Incident reconstruction are strictly separate:
 *
 * - Issue grouping:        fingerprint matching → many events → one Issue.
 * - Incident reconstruction: one occurrence (anchor event) → causal graph
 *                            built from evidence around THAT event only.
 *
 * If `anchorEventId` is provided, that exact event is the incident anchor.
 * If omitted, the most recent occurrence is chosen automatically.
 *
 * Historical occurrences of the same error are excluded from the
 * active causal chain; their count is returned for UI display only.
 *
 * This answers: "Why did THIS occurrence happen?"
 * not:          "Why does this Issue exist?"
 */
export async function investigateIssueOccurrence(
    issueId: string,
    projectId: string,
    anchorEventId?: string | null,
): Promise<{
    investigation: Awaited<ReturnType<typeof investigate>>;
    incidentAnchorId: string;
    incidentAnchorTimestamp: Date;
    historicalOccurrenceCount: number;
}> {
    if (!issueId) {
        throw new Error(
            "Cannot investigate without an issue ID.",
        );
    }

    if (!projectId) {
        throw new Error(
            "Cannot investigate without a project ID.",
        );
    }

    /*
     * --------------------------------------------------
     * Occurrence-scoped evidence
     * --------------------------------------------------
     *
     * getInvestigationEventsForOccurrence() returns:
     *
     * - anchorEvent:              the one specific occurrence
     * - events:                   telemetry correlated to that
     *                             occurrence only (same session/
     *                             trace/request, ±5 min window)
     * - historicalOccurrenceCount: count of other occurrences
     *                             in the Issue (excluded from
     *                             causal reasoning)
     */
    const result =
        await getInvestigationEventsForOccurrence(
            issueId,
            projectId,
            anchorEventId,
        );

    if (result === null) {
        throw new Error(
            "Issue not found or has no events.",
        );
    }

    const { anchorEvent, events, historicalOccurrenceCount } = result;

    if (events.length === 0) {
        throw new Error(
            "Cannot investigate an occurrence with no correlated evidence.",
        );
    }

    /*
     * --------------------------------------------------
     * Evidence normalization
     * --------------------------------------------------
     */
    const evidence = eventsToEvidence(events);

    /*
     * --------------------------------------------------
     * Investigation engine
     * --------------------------------------------------
     */
    const investigation = await investigate(evidence);

    return {
        investigation,
        incidentAnchorId: anchorEvent.id,
        incidentAnchorTimestamp: anchorEvent.timestamp,
        historicalOccurrenceCount,
    };
}