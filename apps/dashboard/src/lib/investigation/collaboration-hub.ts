/**
 * In-memory Realtime Hub & Presence Manager for Halo Collaborative Investigation Rooms.
 *
 * Governs:
 * 1. Active participant presence with TTL expiry (ephemeral state).
 * 2. Multi-tab deduplication (same user in multiple tabs collapses to 1 active engineer).
 * 3. Domain event pub/sub dispatch to Server-Sent Event (SSE) subscribers.
 * 4. Zero mutation of raw telemetry or investigation engine root-cause models.
 */

export type InvestigationArea =
    | "OVERVIEW"
    | "EVIDENCE"
    | "CAUSAL_CHAIN"
    | "EVIDENCE_GRAPH"
    | "TOPOLOGY"
    | "DIFFERENTIAL_TRACE"
    | "REPLAY"
    | "HYPOTHESES"
    | "RECOMMENDATION";

export interface ParticipantSession {
    clientId: string;
    userId: string;
    userName: string;
    userEmail: string;
    currentArea: InvestigationArea;
    lastSeen: number;
}

export interface ActiveParticipantSummary {
    userId: string;
    userName: string;
    userEmail: string;
    currentArea: InvestigationArea;
    tabCount: number;
    lastSeen: number;
}

export type CollaborationEventType =
    | "CONNECTED"
    | "PRESENCE_UPDATED"
    | "COMMENT_ADDED"
    | "COMMENT_EDITED"
    | "COMMENT_DELETED"
    | "VERDICT_RECORDED"
    | "ACTIVITY_RECORDED"
    | "RELATION_PROPOSED";

export interface CollaborationDomainEvent {
    type: CollaborationEventType;
    investigationId: string;
    timestamp: string;
    payload: any;
}

const PRESENCE_TTL_MS = 25_000; // 25 seconds heartbeat TTL

class CollaborationHub {
    // investigationId -> Map<clientId, ParticipantSession>
    private presenceRooms = new Map<string, Map<string, ParticipantSession>>();

    // investigationId -> Set<listener callback>
    private subscribers = new Map<string, Set<(event: CollaborationDomainEvent) => void>>();

    /**
     * Record a participant heartbeat for an investigation.
     */
    public recordHeartbeat(
        investigationId: string,
        session: {
            clientId: string;
            userId: string;
            userName: string;
            userEmail: string;
            currentArea?: InvestigationArea;
        }
    ): ActiveParticipantSummary[] {
        let room = this.presenceRooms.get(investigationId);
        if (!room) {
            room = new Map();
            this.presenceRooms.set(investigationId, room);
        }

        const now = Date.now();
        const existing = room.get(session.clientId);
        const currentArea = session.currentArea || existing?.currentArea || "OVERVIEW";

        room.set(session.clientId, {
            clientId: session.clientId,
            userId: session.userId,
            userName: session.userName,
            userEmail: session.userEmail,
            currentArea,
            lastSeen: now,
        });

        // Prune expired sessions
        this.pruneExpiredSessions(investigationId);

        const activeSummaries = this.getActiveParticipants(investigationId);

        // Notify subscribers of presence change
        this.broadcast(investigationId, {
            type: "PRESENCE_UPDATED",
            investigationId,
            timestamp: new Date().toISOString(),
            payload: { activeParticipants: activeSummaries },
        });

        return activeSummaries;
    }

    /**
     * Remove a client session on disconnect or explicit leave.
     */
    public removeClient(investigationId: string, clientId: string): void {
        const room = this.presenceRooms.get(investigationId);
        if (!room) return;

        room.delete(clientId);
        if (room.size === 0) {
            this.presenceRooms.delete(investigationId);
        }

        const activeSummaries = this.getActiveParticipants(investigationId);
        this.broadcast(investigationId, {
            type: "PRESENCE_UPDATED",
            investigationId,
            timestamp: new Date().toISOString(),
            payload: { activeParticipants: activeSummaries },
        });
    }

    /**
     * Get active participants in an investigation, collapsing multiple tabs by userId.
     */
    public getActiveParticipants(investigationId: string): ActiveParticipantSummary[] {
        const room = this.presenceRooms.get(investigationId);
        if (!room) return [];

        this.pruneExpiredSessions(investigationId);

        const now = Date.now();
        const userMap = new Map<
            string,
            {
                userName: string;
                userEmail: string;
                currentArea: InvestigationArea;
                tabCount: number;
                lastSeen: number;
            }
        >();

        for (const session of room.values()) {
            if (now - session.lastSeen > PRESENCE_TTL_MS) continue;

            const existing = userMap.get(session.userId);
            if (!existing) {
                userMap.set(session.userId, {
                    userName: session.userName,
                    userEmail: session.userEmail,
                    currentArea: session.currentArea,
                    tabCount: 1,
                    lastSeen: session.lastSeen,
                });
            } else {
                existing.tabCount += 1;
                if (session.lastSeen > existing.lastSeen) {
                    existing.lastSeen = session.lastSeen;
                    existing.currentArea = session.currentArea;
                }
            }
        }

        return Array.from(userMap.entries()).map(([userId, data]) => ({
            userId,
            userName: data.userName,
            userEmail: data.userEmail,
            currentArea: data.currentArea,
            tabCount: data.tabCount,
            lastSeen: data.lastSeen,
        }));
    }

    /**
     * Subscribe a client SSE stream to domain events for an investigation.
     */
    public subscribe(
        investigationId: string,
        callback: (event: CollaborationDomainEvent) => void
    ): () => void {
        let subs = this.subscribers.get(investigationId);
        if (!subs) {
            subs = new Set();
            this.subscribers.set(investigationId, subs);
        }
        subs.add(callback);

        return () => {
            const currentSubs = this.subscribers.get(investigationId);
            if (currentSubs) {
                currentSubs.delete(callback);
                if (currentSubs.size === 0) {
                    this.subscribers.delete(investigationId);
                }
            }
        };
    }

    /**
     * Broadcast a domain event to all subscribers of an investigation room.
     */
    public broadcast(investigationId: string, event: CollaborationDomainEvent): void {
        const subs = this.subscribers.get(investigationId);
        if (!subs || subs.size === 0) return;

        for (const callback of subs) {
            try {
                callback(event);
            } catch (err) {
                console.error("[CollaborationHub] Error delivering event to subscriber:", err);
            }
        }
    }

    private pruneExpiredSessions(investigationId: string): void {
        const room = this.presenceRooms.get(investigationId);
        if (!room) return;

        const now = Date.now();
        for (const [clientId, session] of room.entries()) {
            if (now - session.lastSeen > PRESENCE_TTL_MS) {
                room.delete(clientId);
            }
        }

        if (room.size === 0) {
            this.presenceRooms.delete(investigationId);
        }
    }
}

// Global singleton instance
const globalForCollaboration = globalThis as unknown as {
    haloCollaborationHub?: CollaborationHub;
};

export const collaborationHub =
    globalForCollaboration.haloCollaborationHub || new CollaborationHub();

if (process.env.NODE_ENV !== "production") {
    globalForCollaboration.haloCollaborationHub = collaborationHub;
}
