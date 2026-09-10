import { describe, it, expect } from "vitest";
import { ReplayRingBuffer } from "../ring-buffer";
import type { eventWithTime } from "@rrweb/types";

describe("ReplayRingBuffer", () => {
    it("preserves events within the time window", () => {
        const ringBuffer = new ReplayRingBuffer(60, 1000); // 60s
        const baseTime = 1000000;

        // Full snapshot at start
        ringBuffer.add({
            type: 2, // FullSnapshot
            data: { node: {} },
            timestamp: baseTime,
        } as any);

        // Incremental mutation at +10s
        ringBuffer.add({
            type: 3, // IncrementalSnapshot
            data: { source: 0 },
            timestamp: baseTime + 10000,
        } as any);

        // Incremental mutation at +20s
        ringBuffer.add({
            type: 3,
            data: { source: 0 },
            timestamp: baseTime + 20000,
        } as any);

        expect(ringBuffer.length).toBe(3);
        const all = ringBuffer.getAll();
        expect(all[0].type).toBe(2);
        expect(all[1].timestamp).toBe(baseTime + 10000);
        expect(all[2].timestamp).toBe(baseTime + 20000);
    });

    it("prunes events older than cutoff while preserving the full snapshot root", () => {
        const ringBuffer = new ReplayRingBuffer(30, 1000); // 30s window
        const baseTime = 1000000;

        // Full snapshot 1 at 0s
        ringBuffer.add({
            type: 2,
            data: { id: 1 },
            timestamp: baseTime,
        } as any);

        // Incremental at 10s
        ringBuffer.add({
            type: 3,
            data: { id: 2 },
            timestamp: baseTime + 10000,
        } as any);

        // Full snapshot 2 at 40s (so it replaces snapshot 1 as the active root)
        ringBuffer.add({
            type: 2,
            data: { id: 3 },
            timestamp: baseTime + 40000,
        } as any);

        // Incremental at 80s (cutoff is 80s - 30s = 50s. Snapshot 2 at 40s is retained as root)
        ringBuffer.add({
            type: 3,
            data: { id: 4 },
            timestamp: baseTime + 80000,
        } as any);

        const events = ringBuffer.getAll();
        expect(events[0].type).toBe(2);
        expect((events[0].data as any).id).toBe(3);
        expect(events.some((e: any) => e.data?.id === 1)).toBe(false);
    });

    it("enforces maxEvents memory bound without dropping the initial snapshot", () => {
        const ringBuffer = new ReplayRingBuffer(600, 100); // 100 max events
        const baseTime = 1000000;

        // Initial snapshot
        ringBuffer.add({
            type: 2,
            data: { root: true },
            timestamp: baseTime,
        } as any);

        // Add 150 incremental events
        for (let i = 1; i <= 150; i++) {
            ringBuffer.add({
                type: 3,
                data: { step: i },
                timestamp: baseTime + i * 100,
            } as any);
        }

        expect(ringBuffer.length).toBeLessThanOrEqual(100);
        const events = ringBuffer.getAll();
        // The very first event MUST remain the FullSnapshot
        expect(events[0].type).toBe(2);
        expect((events[0].data as any).root).toBe(true);
    });

    it("flushes and clears correctly", () => {
        const ringBuffer = new ReplayRingBuffer(60, 1000);
        ringBuffer.add({ type: 2, data: {}, timestamp: Date.now() } as any);
        ringBuffer.add({ type: 3, data: {}, timestamp: Date.now() + 100 } as any);

        expect(ringBuffer.length).toBe(2);
        const flushed = ringBuffer.flush();
        expect(flushed.length).toBe(2);
        expect(ringBuffer.length).toBe(0);
    });
});
