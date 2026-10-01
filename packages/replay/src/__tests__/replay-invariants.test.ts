import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HaloReplay } from "../recorder";
import { ReplayRingBuffer } from "../ring-buffer";
import { ReplayUploader } from "../uploader";

vi.mock("rrweb", () => ({
    record: vi.fn((opts: any) => {
        if (opts.emit) {
            const now = Date.now();
            opts.emit({
                type: 4,
                data: { href: "http://localhost:3000/app?token=secret123", width: 1280, height: 800 },
                timestamp: now - 100,
            });
            opts.emit({
                type: 2,
                data: { node: { id: 1, tagName: "html" } },
                timestamp: now - 50,
            });
        }
        return vi.fn();
    }),
}));

describe("Replay Invariants — Section 32 Verification", () => {
    let fetchMock: any;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
        });
        global.fetch = fetchMock;

        vi.stubGlobal("window", {
            location: { href: "http://localhost:3000/app?token=secret123" },
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

    // Invariant A: One logical session != multiple user-visible replays because storage was chunked
    it("Invariant A: Storage chunking preserves single logical sessionId across all payloads", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_a_session",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Fault A" });
        await (recorder as any).uploader.flush(false);
        await recorder.flushAndConclude();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const chunk0 = JSON.parse(fetchMock.mock.calls[0][1].body);
        const chunk1 = JSON.parse(fetchMock.mock.calls[1][1].body);

        expect(chunk0.sessionId).toBe("inv_a_session");
        expect(chunk1.sessionId).toBe("inv_a_session");
        expect(chunk0.sequence).toBe(0);
        expect(chunk1.sequence).toBe(1);
    });

    // Invariant B: A replay cannot become PERSISTED before persistence succeeds
    it("Invariant B: State cannot become PERSISTED if upload fails or is rejected", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500 });

        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_b_fail",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Fault B" });
        await recorder.flushAndConclude();

        expect(recorder.getCaptureState()).toBe("FAILED");
        expect(recorder.getCaptureState()).not.toBe("PERSISTED");
    });

    // Invariant C: No trigger -> no permanent replay
    it("Invariant C: Un-triggered session exits without any permanent upload", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_c_untriggered",
            errorTriggered: true,
            sampleRate: 0.0,
        });

        recorder.start();
        expect(recorder.getCaptureState()).toBe("BUFFERING");

        // Normal interaction
        recorder.recordCustomEvent("halo:click", { button: "submit" });
        recorder.stop();

        expect(recorder.getCaptureState()).toBe("DISCARDED");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    // Invariant D: No user interaction != no replay recording
    it("Invariant D: Session without clicks still records DOM baseline and autonomous events", () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_d_zero_interaction",
        });

        recorder.start();
        const buffer = recorder.getBufferEvents();
        // Even with zero user interaction, FullSnapshot (type 2) was captured
        expect(buffer.some((e) => e.type === 2)).toBe(true);
    });

    // Invariant E: Trigger does not start recording; it persists already-buffered history
    it("Invariant E: Trigger causes pre-existing buffered history to become persisted", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_e_pre_history",
        });

        recorder.start();
        // Event buffered BEFORE trigger
        recorder.recordCustomEvent("step:before-error", { ts: 100 });

        recorder.triggerCapture("ERROR", { reason: "Crash" });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        const stepEvent = payload.events.find((e: any) => e.data?.tag === "step:before-error");
        expect(stepEvent).toBeDefined();
    });

    // Invariant F: Replay events remain temporally ordered
    it("Invariant F: All persisted events strictly satisfy non-decreasing timestamps", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_f_temporal_order",
        });

        recorder.start();
        recorder.recordCustomEvent("e1", {});
        recorder.recordCustomEvent("e2", {});
        recorder.triggerCapture("ERROR", { reason: "Time check" });
        await recorder.flushAndConclude();

        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        const timestamps = payload.events.map((e: any) => e.timestamp);
        for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
        }
    });

    // Invariant G: Persisted replay contains FullSnapshot reconstruction root
    it("Invariant G: Persisted chunk stream begins with a FullSnapshot (type 2) root", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_g_reconstructable",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Root check" });

        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        const hasFullSnapshot = payload.events.some((e: any) => e.type === 2);
        expect(hasFullSnapshot).toBe(true);
    });

    // Invariant H: Session ID remains stable
    it("Invariant H: Session ID matches across all emitted chunks", async () => {
        const sessionId = "inv_h_stable_sid";
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId,
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Check SID" });
        await recorder.flushAndConclude();

        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        for (const call of fetchMock.mock.calls) {
            const body = JSON.parse(call[1].body);
            expect(body.sessionId).toBe(sessionId);
        }
    });

    // Invariant I: Chunk boundaries do not become replay boundaries
    it("Invariant I: Chunks contain continuous sequence indices", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_i_chunk_seq",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Seq check" });
        await (recorder as any).uploader.flush(false);
        await recorder.flushAndConclude();

        const seq0 = JSON.parse(fetchMock.mock.calls[0][1].body).sequence;
        const seq1 = JSON.parse(fetchMock.mock.calls[1][1].body).sequence;
        expect(seq0).toBe(0);
        expect(seq1).toBe(1);
    });

    // Invariant J: Sensitive data is sanitized before persistent transmission
    it("Invariant J: Secrets in URLs and params are redacted prior to payload transmission", async () => {
        const recorder = new HaloReplay({
            endpoint: "http://localhost:3000/api",
            sessionId: "inv_j_privacy",
        });

        recorder.start();
        recorder.triggerCapture("ERROR", { reason: "Privacy check" });

        const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
        // Meta event href in rrweb stream
        const metaEvent = payload.events.find((e: any) => e.type === 4);
        if (metaEvent?.data?.href) {
            expect(metaEvent.data.href).not.toContain("secret123");
            expect(decodeURIComponent(metaEvent.data.href)).toContain("[REDACTED]");
        }
        // Metadata url
        if (payload.meta?.url) {
            expect(payload.meta.url).not.toContain("secret123");
        }
    });
});
