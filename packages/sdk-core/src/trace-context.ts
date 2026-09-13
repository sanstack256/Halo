import type { HaloTraceContext } from "@halo-trace/sdk-types";

export function generateTraceId(): string {
    // 16 bytes = 32 hex chars
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    // Prevent all zeros
    bytes[0] = bytes[0] || 1;
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export function generateSpanId(): string {
    // 8 bytes = 16 hex chars
    const bytes = new Uint8Array(8);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 8; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    bytes[0] = bytes[0] || 1;
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parses W3C traceparent header: 00-{32 hex traceId}-{16 hex spanId}-{2 hex flags}
 */
export function parseTraceParent(header: string): HaloTraceContext | null {
    if (!header || typeof header !== "string") return null;
    const parts = header.trim().split("-");
    if (parts.length < 4) return null;

    const [version, traceId, spanId, flags] = parts;
    if (version !== "00" && version !== "ff") {
        // Only 00 is standardized, accept standard
    }
    if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === "00000000000000000000000000000000") {
        return null;
    }
    if (!/^[0-9a-f]{16}$/.test(spanId) || spanId === "0000000000000000") {
        return null;
    }

    return {
        traceId,
        spanId,
        sampled: flags === "01",
        traceFlags: flags,
    };
}

/**
 * Formats a HaloTraceContext into a standard W3C traceparent string.
 */
export function formatTraceParent(context: HaloTraceContext): string {
    const flags = context.sampled ? "01" : context.traceFlags || "01";
    return `00-${context.traceId}-${context.spanId}-${flags}`;
}

export class TraceContextManager {
    private currentContext: HaloTraceContext;
    private currentRequestId: string;

    constructor(initialTrace?: Partial<HaloTraceContext>, initialRequestId?: string) {
        this.currentContext = {
            traceId: initialTrace?.traceId || generateTraceId(),
            spanId: initialTrace?.spanId || generateSpanId(),
            parentSpanId: initialTrace?.parentSpanId,
            sampled: initialTrace?.sampled ?? true,
            traceFlags: initialTrace?.traceFlags || "01",
            traceState: initialTrace?.traceState,
            baggage: initialTrace?.baggage ? { ...initialTrace.baggage } : {},
        };
        this.currentRequestId = initialRequestId || generateRequestId();
    }

    public getContext(): HaloTraceContext {
        return { ...this.currentContext, baggage: { ...this.currentContext.baggage } };
    }

    public getTraceId(): string {
        return this.currentContext.traceId;
    }

    public getSpanId(): string {
        return this.currentContext.spanId;
    }

    public getRequestId(): string {
        return this.currentRequestId;
    }

    public startSpan(name: string, parentSpanId?: string): { spanId: string; parentSpanId: string } {
        const parent = parentSpanId || this.currentContext.spanId;
        const newSpanId = generateSpanId();
        this.currentContext.parentSpanId = parent;
        this.currentContext.spanId = newSpanId;
        return { spanId: newSpanId, parentSpanId: parent };
    }

    public injectHeaders(headers: Record<string, string>): Record<string, string> {
        headers["traceparent"] = formatTraceParent(this.currentContext);
        if (this.currentContext.traceState) {
            headers["tracestate"] = this.currentContext.traceState;
        }
        headers["x-trace-id"] = this.currentContext.traceId;
        headers["x-request-id"] = this.currentRequestId;
        return headers;
    }

    public extractHeaders(headers: Headers | Record<string, string | null | undefined>): void {
        const get = (key: string): string | null => {
            if (typeof (headers as any)?.get === "function") {
                return (headers as Headers).get(key);
            }
            const record = headers as Record<string, string | null | undefined>;
            return record[key] || record[key.toLowerCase()] || null;
        };

        const traceparent = get("traceparent");
        if (traceparent) {
            const parsed = parseTraceParent(traceparent);
            if (parsed) {
                this.currentContext = parsed;
            }
        } else {
            const customTraceId = get("x-trace-id");
            if (customTraceId) {
                this.currentContext.traceId = customTraceId;
            }
        }

        const customReqId = get("x-request-id");
        if (customReqId) {
            this.currentRequestId = customReqId;
        }
    }
}
