import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HaloReplay } from "../recorder";

describe("Frustration Signals (Rage Clicks & Dead Clicks)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("initializes frustration telemetry counters to zero", () => {
        const replay = new HaloReplay({
            sessionId: "test-session-frustration",
            detectRageClicks: true,
            detectDeadClicks: true,
        });

        expect(replay.getHasRageClicks()).toBe(false);
        expect(replay.getHasDeadClicks()).toBe(false);
        expect(replay.getRageClickCount()).toBe(0);
        expect(replay.getDeadClickCount()).toBe(0);
    });

    it("allows recording custom frustration events with explainable metrics", () => {
        const replay = new HaloReplay({
            sessionId: "test-session-frustration",
            detectRageClicks: true,
        });

        // Record a real rage-click payload
        replay.recordCustomEvent("halo:rage-click", {
            count: 4,
            targetSelector: "#submit-pay-btn",
            x: 240,
            y: 380,
            durationMs: 620,
            windowStartMs: Date.now() - 620,
            windowEndMs: Date.now(),
        });

        const events = replay.getRecordedEvents();
        const rageEvent = events.find((e: any) => e.type === 5 && e.data?.tag === "halo:rage-click");
        expect(rageEvent).toBeDefined();
        expect(rageEvent.data.payload.count).toBe(4);
        expect(rageEvent.data.payload.targetSelector).toBe("#submit-pay-btn");
        expect(rageEvent.data.payload.durationMs).toBe(620);
    });

    it("allows recording dead click events when actionable target produces no mutations", () => {
        const replay = new HaloReplay({
            sessionId: "test-session-frustration",
            detectDeadClicks: true,
        });

        replay.recordCustomEvent("halo:dead-click", {
            targetSelector: "button.unresponsive-cta",
            x: 150,
            y: 220,
            inactiveDurationMs: 2500,
        });

        const events = replay.getRecordedEvents();
        const deadEvent = events.find((e: any) => e.type === 5 && e.data?.tag === "halo:dead-click");
        expect(deadEvent).toBeDefined();
        expect(deadEvent.data.payload.targetSelector).toBe("button.unresponsive-cta");
        expect(deadEvent.data.payload.inactiveDurationMs).toBe(2500);
    });

    it("records lifecycle events on page transitions", () => {
        const replay = new HaloReplay({
            sessionId: "test-session-lifecycle",
        });

        replay.recordCustomEvent("halo:lifecycle", {
            event: "visibilitychange",
            state: "hidden",
        });

        const events = replay.getRecordedEvents();
        const lifecycleEvent = events.find((e: any) => e.type === 5 && e.data?.tag === "halo:lifecycle");
        expect(lifecycleEvent).toBeDefined();
        expect(lifecycleEvent.data.payload.event).toBe("visibilitychange");
        expect(lifecycleEvent.data.payload.state).toBe("hidden");
    });
});
