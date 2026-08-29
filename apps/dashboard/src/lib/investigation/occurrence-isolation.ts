/**
 * Correlation helpers for a single incident occurrence.
 *
 * A session can contain many user actions and failures, so it is context, not
 * proof that two events belong to the same occurrence. Request and trace IDs
 * are the only automatic cross-event admission keys used for causal evidence.
 */
export interface OccurrenceCorrelationEvent {
    id: string;
    requestId?: string | null;
    traceId?: string | null;
}

export function hasStrongOccurrenceIdentifier(event: OccurrenceCorrelationEvent): boolean {
    return Boolean(event.requestId || event.traceId);
}

export function isStronglyCorrelatedOccurrenceEvent(
    anchor: OccurrenceCorrelationEvent,
    candidate: OccurrenceCorrelationEvent,
): boolean {
    return candidate.id === anchor.id ||
        Boolean(anchor.requestId && candidate.requestId === anchor.requestId) ||
        Boolean(anchor.traceId && candidate.traceId === anchor.traceId);
}

/**
 * Returns only causal evidence that can be tied to the anchor by an exact
 * request/trace identity. With no strong anchor identifier, retain the anchor
 * rather than guessing based on session membership or timing.
 */
export function isolateOccurrenceEvents<T extends OccurrenceCorrelationEvent>(
    anchor: T,
    candidates: T[],
): T[] {
    if (!hasStrongOccurrenceIdentifier(anchor)) {
        return candidates.filter((candidate) => candidate.id === anchor.id);
    }

    return candidates.filter((candidate) =>
        isStronglyCorrelatedOccurrenceEvent(anchor, candidate),
    );
}
