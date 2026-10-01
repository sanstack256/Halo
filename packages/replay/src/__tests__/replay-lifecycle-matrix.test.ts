import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HaloReplay } from "../recorder";
import { ReplayRingBuffer } from "../ring-buffer";
import { ReplayUploader } from "../uploader";
import type { eventWithTime } from "@rrweb/types";

let emitFn: ((e: eventWithTime) => void) | null = null;
vi.mock("rrweb", () => ({
    record: vi.fn((opts: any) => {
        emitFn = opts.emit;
        // Emit initial Meta (type 4) and FullSnapshot (type 2) as real rrweb does
        if (opts.emit) {
            opts.emit({
                type: 4,
                data: { href: "http://localhost:3000/app", width: 1920, height: 1080 },
                timestamp: Date.now(),
            });
            opts.emit({
                type: 2,
                data: { node: { id: 1, tagName: "html" } },
                timestamp: Date.now() + 10,
            });
        }
        return vi.fn();
    }),
}));

describe("Replay Lifecycle Matrix — Section 31 Verification", () => {
    let fetchMock: any;

    beforeEach(() => {
        emitFn = null;
        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, replaySessionId: "sess_test_row" }),
        });
        global.fetch = fetchMock;

        const store: Record<string, string> = {};
        vi.stubGlobal("window", {
            location: { href: "http://localhost:3000/app" },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            sessionStorage: {
                getItem: (k: string) => store[k] || null,
                setItem: (k: string, v: string) => { store[k] = v; },
                removeItem: (k: string) => { delete store[k]; },
            },
            history: {
                pushState: vi.fn(),
                replaceState: vi.fn(),
            },
        });
        vi.stubGlobal("document", {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            visibilityState: "visible",
            querySelector: vi.fn(() => null),
        });
        vi.stubGlobal("navigator", {
            userAgent: "Mozilla/5.0 Chrome/120.0",
            platform: "MacIntel",
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // Test 1: Page loads, no user interaction
    it("Test 1: Page loads without user interaction -> buffer exists, zero replay persisted", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t1_no_interaction",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        // rrweb should have automatically buffered initial Meta and FullSnapshot
        const buffer = recorder.getBufferEvents();
        expect(buffer.length).toBeGreaterThanOrEqual(2);
        expect(buffer[0].type).toBe(4); // Meta
        expect(buffer[1].type).toBe(2); // FullSnapshot

        // Zero network uploads
        expect(fetchMock).not.toHaveBeenCalled();

        // Page ends without trigger
        recorder.stop();
        expect(recorder.getCaptureState()).toBe("DISCARDED");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    // Test 2: Idle page then error
    it("Test 2: Idle page then error -> ONE persisted replay with pre-trigger & post-trigger context", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t2_idle_then_error",
            errorTriggered: true,
            sampleRate: 0.0,
            postErrorDurationSeconds: 1,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        // Simulate autonomous background update (e.g. clock or status update without clicks)
        recorder.recordCustomEvent("dom:autonomous-mutation", { banner: "loaded" });

        // Error occurs
        recorder.triggerErrorReplay({
            title: "UnhandledPromiseRejection: Failed to load config",
            stack: "Error: at api.js:12",
        });

        expect(recorder.getCaptureState()).toBe("CAPTURING");
        // Intermediate pre-trigger flush occurs
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const chunk0 = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(chunk0.sequence).toBe(0);
        expect(chunk0.final).toBe(false);
        expect(chunk0.meta.triggerType).toBe("ERROR");

        // Simulate post-trigger event (e.g. error boundary renders)
        recorder.recordCustomEvent("dom:error-boundary", { rendered: true });

        // Finalize
        await recorder.flushAndConclude();
        expect(recorder.getCaptureState()).toBe("PERSISTED");
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const chunk1 = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(chunk1.sequence).toBe(1);
        expect(chunk1.final).toBe(true);
    });

    // Test 3: User interaction then error
    it("Test 3: User interaction then error -> correct timeline sequence preserved", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t3_interaction_error",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        recorder.recordCustomEvent("halo:click", { target: "#checkout-btn" });
        recorder.recordCustomEvent("halo:input", { field: "zip" });

        recorder.triggerCapture("ERROR", { reason: "Payment declined" });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        const tags = body.events.filter((e: any) => e.type === 5).map((e: any) => e.data.tag);
        expect(tags).toContain("halo:click");
        expect(tags).toContain("halo:input");
        expect(tags).toContain("halo:trigger");

        await recorder.flushAndConclude();
        expect(recorder.getCaptureState()).toBe("PERSISTED");
    });

    // Test 4: Automatic DOM mutation then error (Zero user clicks)
    it("Test 4: Automatic DOM mutation then error without user interaction", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t4_autonomous_mutation",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        // Autonomous timer mutation
        recorder.recordCustomEvent("dom:timer-render", { tick: 1 });
        recorder.triggerCapture("ERROR", { reason: "Autonomous script failure" });

        expect(recorder.getCaptureState()).toBe("CAPTURING");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(payload.events.some((e: any) => e.data?.tag === "dom:timer-render")).toBe(true);
    });

    // Test 5: API failure without user interaction
    it("Test 5: API network 500 failure triggers capture autonomously", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t5_network_error",
            triggerOnNetworkError: true,
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        // Simulate background 500 response
        recorder.triggerCapture("NETWORK_5XX", {
            reason: "HTTP 500 on /api/sync",
            meta: { requestId: "req_500", traceId: "tr_500" },
        });

        expect(recorder.getCaptureState()).toBe("CAPTURING");
        expect(recorder.getTriggerType()).toBe("NETWORK_5XX");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Test 6: Multiple chunks aggregated into ONE session
    it("Test 6: Multiple internal chunks map to single logical session with incrementing sequences", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t6_multi_chunk",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Initial crash" });
        // Chunk 0 sent (pre-trigger)
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).sequence).toBe(0);

        // Subsequent stream chunks
        recorder.recordCustomEvent("halo:step", { step: 1 });
        await (recorder as any).uploader.flush(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).sequence).toBe(1);

        // Final chunk
        await recorder.flushAndConclude();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        const finalChunk = JSON.parse(fetchMock.mock.calls[2][1].body);
        expect(finalChunk.sequence).toBe(2);
        expect(finalChunk.final).toBe(true);
        expect(finalChunk.sessionId).toBe("test_t6_multi_chunk");
    });

    // Test 7: SPA navigation does not terminate the logical session
    it("Test 7: SPA navigation emits navigation marker without ending recording", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t7_spa_nav",
            captureNavigation: true,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        // Simulate history pushState
        recorder.recordCustomEvent("halo:navigation", { from: "/app", to: "/settings", type: "pushState" });
        expect(recorder.getCaptureState()).toBe("BUFFERING");
        expect(fetchMock).not.toHaveBeenCalled();

        recorder.triggerCapture("ERROR", { reason: "Settings crash" });
        expect(recorder.getCaptureState()).toBe("CAPTURING");
    });

    // Test 8: Session ID stability across lifecycle
    it("Test 8: Session ID remains stable across events, chunks, triggers, and finalization", async () => {
        const canonicalId = "test_t8_stable_session_id";
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: canonicalId,
        });

        recorder.start();
        recorder.recordCustomEvent("halo:ping", {});
        recorder.triggerCapture("ERROR", { reason: "Test error" });
        await recorder.flushAndConclude();

        for (const call of fetchMock.mock.calls) {
            const payload = JSON.parse(call[1].body);
            expect(payload.sessionId).toBe(canonicalId);
        }
    });

    // Test 9: Explicit lifecycle transitions
    it("Test 9: Trigger lifecycle transitions BUFFERING -> CAPTURING -> FINALIZING -> PERSISTED", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t9_lifecycle",
        });

        expect(recorder.getCaptureState()).toBe("DISABLED");
        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        recorder.triggerCapture("ERROR", { reason: "Crash" });
        expect(recorder.getCaptureState()).toBe("CAPTURING");

        const concludePromise = recorder.flushAndConclude();
        await concludePromise;
        expect(recorder.getCaptureState()).toBe("PERSISTED");
    });

    // Test 10: Untriggered session ends with BUFFERING -> DISCARDED
    it("Test 10: No trigger session ends with BUFFERING -> DISCARDED and 0 network uploads", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t10_discard",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        recorder.stop();
        expect(recorder.getCaptureState()).toBe("DISCARDED");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    // Test 11: Upload failure transitions to FAILED rather than PERSISTED
    it("Test 11: Upload failure transitions state to FAILED instead of falsely claiming PERSISTED", async () => {
        fetchMock.mockRejectedValueOnce(new Error("Network Unreachable"));

        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t11_failure",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Fail test" });

        // Finalize when network fails
        fetchMock.mockRejectedValueOnce(new Error("Network Unreachable"));
        await recorder.flushAndConclude();

        expect(recorder.getCaptureState()).toBe("FAILED");
    });

    // Test 12: Multiple triggers do not create duplicate replay sessions
    it("Test 12: Multiple subsequent errors append timeline markers to same session", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_t12_multiple_errors",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Error 1" });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Error 2 and Error 3 arrive while capturing
        recorder.triggerCapture("ERROR", { reason: "Error 2" });
        recorder.triggerCapture("ERROR", { reason: "Error 3" });

        // Still single sequence 0 flush done, not 3 duplicate sessions
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await recorder.flushAndConclude();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // Test 13: Long idle session retains bounded memory
    it("Test 13: Long session stays bounded in memory via ring buffer pruning", () => {
        const ringBuffer = new ReplayRingBuffer(60, 50); // 50 max events
        const start = Date.now();

        // Initial snapshot
        ringBuffer.add({ type: 2, data: { root: true }, timestamp: start } as any);

        for (let i = 1; i <= 200; i++) {
            ringBuffer.add({ type: 3, data: { i }, timestamp: start + i * 100 } as any);
        }

        expect(ringBuffer.length).toBeLessThanOrEqual(50);
        const events = ringBuffer.getAll();
        expect(events[0].type).toBe(2); // Retains initial snapshot
    });
});
