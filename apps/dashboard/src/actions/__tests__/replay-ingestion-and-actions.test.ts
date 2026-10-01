import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProjectReplaysPaginated, getReplaySession, getReplayEvents } from "../replay";
import { prisma } from "@/lib/prisma";

// Mock auth session and organization
vi.mock("@/lib/session", () => ({
    getSession: vi.fn().mockResolvedValue({
        user: { id: "test_user_id", email: "tester@halo.local" },
    }),
}));

vi.mock("@/lib/organization", () => ({
    getOrganization: vi.fn().mockResolvedValue({
        id: "test_org_id",
        name: "Test Organization",
    }),
}));

vi.mock("@/lib/prisma", () => {
    const mockSessions: any[] = [];
    const mockChunks: any[] = [];

    return {
        prisma: {
            project: {
                findFirst: vi.fn().mockResolvedValue({ id: "proj_123", organizationId: "test_org_id" }),
            },
            replaySession: {
                count: vi.fn().mockImplementation((args: any) => {
                    const where = args?.where || {};
                    let filtered = mockSessions.filter(s => s.projectId === where.projectId);
                    if (where.status && where.status.notIn) {
                        filtered = filtered.filter(s => !where.status.notIn.includes(s.status));
                    }
                    return Promise.resolve(filtered.length);
                }),
                findMany: vi.fn().mockImplementation((args: any) => {
                    const where = args?.where || {};
                    let filtered = mockSessions.filter(s => s.projectId === where.projectId);
                    if (where.status && where.status.notIn) {
                        filtered = filtered.filter(s => !where.status.notIn.includes(s.status));
                    }
                    return Promise.resolve(filtered);
                }),
                findFirst: vi.fn().mockImplementation((args: any) => {
                    const or = args?.where?.OR || [];
                    const idMatch = or.find((c: any) => c.id)?.id;
                    const sidMatch = or.find((c: any) => c.sessionId)?.sessionId;
                    const session = mockSessions.find(s => s.id === idMatch || s.sessionId === sidMatch);
                    if (!session) return Promise.resolve(null);
                    return Promise.resolve({
                        ...session,
                        project: { id: session.projectId, organizationId: "test_org_id" },
                        chunks: mockChunks.filter(c => c.replaySessionId === session.id),
                    });
                }),
            },
            replayChunk: {
                findMany: vi.fn().mockImplementation((args: any) => {
                    const sessionId = args?.where?.replaySessionId;
                    const chunks = mockChunks
                        .filter(c => c.replaySessionId === sessionId)
                        .sort((a, b) => a.sequence - b.sequence);
                    return Promise.resolve(chunks);
                }),
            },
            __setTestData: (sessions: any[], chunks: any[]) => {
                mockSessions.length = 0;
                mockSessions.push(...sessions);
                mockChunks.length = 0;
                mockChunks.push(...chunks);
            },
        },
    };
});

describe("Replay Ingestion & Dashboard Actions Verification", () => {
    beforeEach(() => {
        (prisma as any).__setTestData([
            {
                id: "rs_valid_1",
                sessionId: "sess_valid_1",
                projectId: "proj_123",
                status: "AVAILABLE",
                triggerType: "ERROR",
                captureReason: "TypeError in payment",
                totalDurationMs: 45000,
                chunkCount: 2,
                startedAt: new Date(Date.now() - 45000),
                endedAt: new Date(),
            },
            {
                id: "rs_expired_2",
                sessionId: "sess_broken_1s",
                projectId: "proj_123",
                status: "EXPIRED", // retired invalid <1s clip
                triggerType: null,
                totalDurationMs: 800,
                chunkCount: 1,
                startedAt: new Date(Date.now() - 10000),
                endedAt: new Date(Date.now() - 9200),
            },
        ], [
            {
                id: "chunk_0",
                replaySessionId: "rs_valid_1",
                sequence: 0,
                events: [
                    { type: 4, timestamp: 1000 },
                    { type: 2, timestamp: 1010 },
                ],
            },
            {
                id: "chunk_1",
                replaySessionId: "rs_valid_1",
                sequence: 1,
                events: [
                    { type: 5, data: { tag: "halo:error" }, timestamp: 1500 },
                    { type: 3, timestamp: 1600 },
                ],
            },
        ]);
    });

    it("getProjectReplaysPaginated filters out EXPIRED and DISABLED replays by default", async () => {
        const result = await getProjectReplaysPaginated("proj_123");
        expect(result.total).toBe(1);
        expect(result.replays.length).toBe(1);
        expect(result.replays[0].id).toBe("rs_valid_1");
        expect(result.replays[0].status).toBe("AVAILABLE");
    });

    it("getReplaySession returns single logical session with its chunks", async () => {
        const session = await getReplaySession("rs_valid_1");
        expect(session).toBeDefined();
        expect(session?.id).toBe("rs_valid_1");
        expect(session?.chunkCount).toBe(2);
        expect(session?.totalDurationMs).toBe(45000);
        expect(session?.triggerType).toBe("ERROR");
    });

    it("getReplayEvents concatenates and preserves multi-chunk event sequence", async () => {
        const events = await getReplayEvents("rs_valid_1");
        expect(events.length).toBe(4);
        expect(events[0].type).toBe(4); // Meta from chunk 0
        expect(events[1].type).toBe(2); // FullSnapshot from chunk 0
        expect(events[2].data.tag).toBe("halo:error"); // Error from chunk 1
        expect(events[3].type).toBe(3); // Incremental from chunk 1
    });
});
