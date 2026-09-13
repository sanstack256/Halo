import type {
    EvidenceStatus,
    HaloCaptureOptions,
    HaloEnvelope,
    HaloEventType,
    HaloRuntimeInfo,
    HaloSeverity,
} from "@halo-trace/sdk-types";
import type { Scope } from "./scope";
import type { SessionManager } from "./session";
import type { TraceContextManager } from "./trace-context";
import { sanitizeObject } from "./sanitizer";

export function generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function detectRuntime(): HaloRuntimeInfo {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
        return {
            name: "browser",
            version: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            engine: "v8/blink/webkit/gecko",
            platform: typeof navigator !== "undefined" ? navigator.platform : "web",
        };
    }
    if (typeof process !== "undefined" && process.versions?.node) {
        return {
            name: "node",
            version: process.versions.node,
            engine: process.versions.v8,
            platform: process.platform,
        };
    }
    return {
        name: "unknown",
    };
}

export class EnvelopeBuilder {
    private sdkName: string;
    private sdkVersion: string;
    private runtimeInfo: HaloRuntimeInfo;

    constructor(sdkName: string = "@halo-trace/sdk", sdkVersion: string = "1.0.0") {
        this.sdkName = sdkName;
        this.sdkVersion = sdkVersion;
        this.runtimeInfo = detectRuntime();
    }

    public build(
        options: HaloCaptureOptions,
        scope: Scope,
        session?: SessionManager,
        trace?: TraceContextManager
    ): HaloEnvelope {
        const now = Date.now();
        const iso = options.timestamp || new Date(now).toISOString();
        const traceCtx = trace?.getContext();

        const tags = {
            ...scope.getTags(),
            ...(options.tags || {}),
        };

        const metadata = sanitizeObject({
            ...scope.getContexts(),
            ...(options.metadata || {}),
        });

        const envelope: HaloEnvelope = {
            eventId: generateEventId(),
            eventType: options.type || "MESSAGE",
            timestamp: iso,
            timestampPrecision: "ms",
            sessionId: options.sessionId || session?.getSessionId(),
            sessionStartedAt: options.sessionStartedAt || session?.getStartedAt(),
            traceId: options.traceId || traceCtx?.traceId,
            spanId: options.spanId || traceCtx?.spanId,
            parentSpanId: options.parentSpanId || traceCtx?.parentSpanId,
            requestId: options.requestId || trace?.getRequestId(),
            user: options.user || scope.getUser(),
            environment: scope.getEnvironment(),
            release: scope.getRelease(),
            service: options.service || scope.getService(),
            deployment: scope.getDeployment(),
            sdkName: this.sdkName,
            sdkVersion: this.sdkVersion,
            runtime: this.runtimeInfo,
            platform: this.runtimeInfo.platform || this.runtimeInfo.name,
            clock: {
                clientTimestamp: now,
                clientTimestampIso: iso,
                timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            },
            evidenceStatus: "OBSERVED",
            sequence: session ? session.nextSequence() : undefined,
            title: options.title,
            message: options.message,
            severity: options.severity || "INFO",
            stack: options.stack,
            fingerprint: options.fingerprint,
            durationMs: options.durationMs,
            operation: options.operation,
            resource: options.resource,
            status: options.status,
            tags,
            breadcrumbs: options.breadcrumbs || [],
            metadata,
            data: options.data,
        };

        return envelope;
    }
}
