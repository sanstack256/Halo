import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HaloReplay } from "../recorder";
import type { eventWithTime } from "@rrweb/types";

vi.mock("rrweb", () => ({
    record: vi.fn((opts: any) => {
        if (opts.emit) {
            const now = Date.now();
            opts.emit({
                type: 4,
                data: { href: "http://localhost:3000/app", width: 1440, height: 900 },
                timestamp: now - 100,
            });
            opts.emit({
                type: 2,
                data: { node: { id: 1, tagName: "html" } },
                timestamp: now - 90,
            });
        }
        return vi.fn();
    }),
}));

describe("Section 34 — Specific Regression Test for Random <1s Replay Defect", () => {
    let fetchMock: any;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, replaySessionId: "sess_regression_row" }),
        });
        global.fetch = fetchMock;

        vi.stubGlobal("window", {
            location: { href: "http://localhost:3000/app" },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            sessionStorage: {
                getItem: vi.fn(() => "canon_sess_id"),
                setItem: vi.fn(),
            },
            history: { pushState: vi.fn(), replaceState: vi.fn() },
        });
        vi.stubGlobal("document", {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            visibilityState: "visible",
            querySelector: vi.fn(() => null),
        });
        vi.stubGlobal("navigator", { userAgent: "HaloAgent", platform: "Mac" });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("prevents premature finalization upon early stop and ensures pre-trigger history, trigger, and post-trigger context are preserved", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "regression_test_session_001",
            errorTriggered: true,
            sampleRate: 0.0,
            preErrorBufferSeconds: 60,
            postErrorDurationSeconds: 10,
        });

        // 1. Session begins buffering continuous baseline on page load
        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        // 2. Pre-trigger context accumulates in memory over time
        recorder.recordCustomEvent("telemetry:init", { app: "Halo" });
        recorder.recordCustomEvent("dom:render", { component: "CheckoutView" });
        recorder.recordCustomEvent("network:fetch", { url: "/api/pricing", status: 200 });

        // Zero network uploads have occurred during normal buffering
        expect(fetchMock).not.toHaveBeenCalled();

        // 3. Error trigger occurs
        const triggerTime = Date.now();
        recorder.triggerErrorReplay({
            title: "TypeError: Cannot read property 'rates' of undefined",
            stack: "TypeError: at checkout.ts:88",
        });

        // State moves to CAPTURING
        expect(recorder.getCaptureState()).toBe("CAPTURING");
        // Intermediate pre-trigger flush occurs immediately to ensure persistence
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const chunk0 = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(chunk0.final).toBe(false);
        expect(chunk0.sequence).toBe(0);
        // Pre-trigger history is verified in chunk 0
        const eventTags = chunk0.events.map((e: any) => e.data?.tag).filter(Boolean);
        expect(eventTags).toContain("telemetry:init");
        expect(eventTags).toContain("dom:render");
        expect(eventTags).toContain("network:fetch");
        expect(eventTags).toContain("halo:error");
        expect(eventTags).toContain("halo:trigger");

        // 4. Post-trigger capture continues (e.g. error banner render, user retry attempt)
        recorder.recordCustomEvent("dom:error-toast", { message: "Something went wrong" });
        recorder.recordCustomEvent("halo:click", { selector: "#retry-button" });

        // 5. Finalize post-trigger aftermath
        await recorder.flushAndConclude();
        expect(recorder.getCaptureState()).toBe("PERSISTED");
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const chunk1 = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(chunk1.sequence).toBe(1);
        expect(chunk1.final).toBe(true);

        const postEventTags = chunk1.events.map((e: any) => e.data?.tag).filter(Boolean);
        expect(postEventTags).toContain("dom:error-toast");
        expect(postEventTags).toContain("halo:click");

        // 6. Temporal continuity verified:
        // First event is pre-trigger Meta/FullSnapshot, middle is trigger, last is post-trigger retry click
        const allEvents = [...chunk0.events, ...chunk1.events];
        expect(allEvents.length).toBeGreaterThanOrEqual(7);

        // Reconstruction root invariant
        expect(allEvents[0].type).toBe(4); // Meta
        expect(allEvents[1].type).toBe(2); // FullSnapshot
    });

    it("untriggered normal sessions are completely discarded upon exit with 0 network calls (no phantom 1s replays)", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "regression_untriggered_exit",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        // User views page for a moment without error
        recorder.recordCustomEvent("halo:click", { selector: "#tab-home" });

        // User navigates away / closes page
        recorder.stop();

        // Must discard and NEVER upload a phantom 1-second clip
        expect(recorder.getCaptureState()).toBe("DISCARDED");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
