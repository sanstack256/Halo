import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HaloReplay } from "../recorder";
import { ReplayUploader } from "../uploader";

vi.mock("rrweb", () => ({
    record: vi.fn(() => vi.fn()),
}));

describe("Evidence-Triggered Replay Capture", () => {
    let fetchMock: any;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, replaySessionId: "test_replay_id" }),
        });
        global.fetch = fetchMock;

        vi.stubGlobal("window", {
            location: { href: "http://localhost:3000/checkout" },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
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
            userAgent: "Mozilla/5.0 HaloTest",
            platform: "MacIntel",
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("ReplayUploader never uploads when sequence is 0 and queue is empty", async () => {
        const uploader = new ReplayUploader({
            endpoint: "http://localhost:3000/api",
            sessionId: "test_session_empty",
        });

        // Even with isFinal: true, empty initial queue MUST NOT upload
        await uploader.flush(true);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(uploader.getSequence()).toBe(0);
    });

    it("Normal session without triggers stays in OBSERVING state and discards buffer on exit with ZERO uploads", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "sess_normal_001",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("OBSERVING");
        expect(recorder.getSampleRate()).toBe(0);

        // Record events (simulating normal DOM interactions)
        recorder.recordCustomEvent("halo:click", { selector: "#button-a" });
        recorder.recordCustomEvent("halo:navigation", { to: "/dashboard" });

        // Verify events entered the local ring buffer
        const buffer = recorder.getBufferEvents();
        expect(buffer.length).toBeGreaterThanOrEqual(2);

        // Verify ZERO HTTP requests were sent
        expect(fetchMock).not.toHaveBeenCalled();

        // End the session normally
        recorder.stop();

        // State must transition to DISCARDED
        expect(recorder.getCaptureState()).toBe("DISCARDED");

        // Local buffer must be cleared
        expect(recorder.getBufferEvents().length).toBe(0);

        // ZERO HTTP requests must have occurred
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("Error trigger transitions state from OBSERVING to CAPTURING and uploads pre-error buffer with error metadata", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "sess_error_002",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("OBSERVING");

        // Simulate pre-error user interactions
        recorder.recordCustomEvent("halo:click", { selector: "#pay-btn" });
        recorder.recordCustomEvent("halo:input", { selector: "#amount" });

        expect(fetchMock).not.toHaveBeenCalled();

        // Trigger error
        recorder.triggerErrorReplay({
            title: "TypeError: Network request failed",
            stack: "Error: at checkout.ts:42",
        });

        // State must transition to CAPTURING
        expect(recorder.getCaptureState()).toBe("CAPTURING");
        expect(recorder.getTriggerType()).toBe("ERROR");
        expect(recorder.getCaptureReason()).toBe("TypeError: Network request failed");

        // An immediate flush must have occurred to persist the pre-error evidence
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const callPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callPayload.sessionId).toBe("sess_error_002");
        expect(callPayload.sequence).toBe(0);
        expect(callPayload.meta.triggerType).toBe("ERROR");
        expect(callPayload.meta.captureReason).toBe("TypeError: Network request failed");
        expect(callPayload.meta.errorAt).toBeDefined();

        // Pre-error events must be present in the uploaded payload
        expect(callPayload.events.length).toBeGreaterThanOrEqual(2);

        recorder.stop();
    });

    it("Multiple triggers in the same session append markers without duplicate sessions or resetting sequence", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "sess_multi_003",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();

        // Trigger 1: Error
        recorder.triggerCapture("ERROR", { reason: "Initial error" });
        expect(recorder.getCaptureState()).toBe("CAPTURING");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Trigger 2: Subsequent unhandled rejection
        recorder.triggerCapture("UNHANDLED_REJECTION", { reason: "Promise rejected" });

        // State remains CAPTURING
        expect(recorder.getCaptureState()).toBe("CAPTURING");
        // Does not trigger a redundant flush immediately
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Trigger 3: Rage click
        recorder.triggerCapture("RAGE_CLICK", { reason: "Rage burst" });
        expect(recorder.getCaptureState()).toBe("CAPTURING");

        // Finalize
        recorder.flushAndConclude();
        expect(recorder.getCaptureState()).toBe("PERSISTED");
    });

    it("Explicit manual capture via halo.replay.capture() initiates evidence persistence", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "sess_manual_004",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("OBSERVING");

        recorder.recordCustomEvent("halo:step", { step: 1 });

        // Manual capture API
        recorder.capture({ reason: "User requested investigation" });

        expect(recorder.getCaptureState()).toBe("CAPTURING");
        expect(recorder.getTriggerType()).toBe("MANUAL");
        expect(recorder.getCaptureReason()).toBe("User requested investigation");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const callPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callPayload.meta.triggerType).toBe("MANUAL");
        expect(callPayload.meta.captureReason).toBe("User requested investigation");

        recorder.stop();
    });

    it("Investigation triggers override sampleRate: 0.0", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "sess_override_005",
            errorTriggered: true,
            sampleRate: 0.0, // Zero sampling
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("OBSERVING");

        // Error occurs despite sampleRate = 0
        recorder.triggerCapture("ERROR", { reason: "Critical system fault" });

        // Must persist!
        expect(recorder.getCaptureState()).toBe("CAPTURING");
        expect(fetchMock).toHaveBeenCalledTimes(1);

        recorder.stop();
    });
});
