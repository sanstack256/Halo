import { describe, expect, it } from "vitest";
import {
    isolateOccurrenceEvents,
} from "../../../apps/dashboard/src/lib/investigation/occurrence-isolation";

describe("occurrence isolation", () => {
    it("does not use a shared session as a causal correlation key", () => {
        const anchor = { id: "range-error", sessionId: "one-browser-session" };
        const unrelated = {
            id: "plan-error",
            sessionId: "one-browser-session",
            traceId: "different-trace",
        };
        const upstreamRequest = {
            id: "dependency-request",
            sessionId: "one-browser-session",
            requestId: "different-request",
            traceId: "different-trace",
        };

        expect(isolateOccurrenceEvents(anchor, [anchor, unrelated, upstreamRequest])).toEqual([anchor]);
    });

    it("keeps only request/trace-linked evidence for an identified occurrence", () => {
        const anchor = {
            id: "client-error",
            sessionId: "shared-session",
            traceId: "trace-a",
        };
        const sameTrace = { id: "request-a", sessionId: "shared-session", traceId: "trace-a" };
        const differentTrace = { id: "request-b", sessionId: "shared-session", traceId: "trace-b" };
        const sessionOnly = { id: "other-error", sessionId: "shared-session" };

        expect(isolateOccurrenceEvents(anchor, [anchor, sameTrace, differentTrace, sessionOnly]))
            .toEqual([anchor, sameTrace]);
    });
});
