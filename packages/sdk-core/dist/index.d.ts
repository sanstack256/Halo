import { HaloUser, HaloTagValue, HaloTraceContext, HaloBreadcrumb, SessionState, HaloEnvelope, HaloCaptureOptions, HaloRuntimeInfo, HaloOptions, HaloSeverity } from '@halo-trace/sdk-types';
export * from '@halo-trace/sdk-types';

interface ScopeData {
    user?: HaloUser;
    tags?: Record<string, HaloTagValue>;
    contexts?: Record<string, Record<string, unknown>>;
    release?: string;
    environment?: string;
    service?: string;
    deployment?: string;
    baggage?: Record<string, string>;
}
declare class Scope {
    private user?;
    private tags;
    private contexts;
    private release?;
    private environment?;
    private service?;
    private deployment?;
    private baggage;
    private listeners;
    constructor(initial?: Partial<ScopeData>);
    setUser(user: HaloUser | undefined): this;
    getUser(): HaloUser | undefined;
    clearUser(): this;
    setTag(key: string, value: HaloTagValue): this;
    setTags(tags: Record<string, HaloTagValue>): this;
    removeTag(key: string): this;
    getTags(): Record<string, HaloTagValue>;
    setContext(name: string, data: Record<string, unknown>): this;
    setContexts(contexts: Record<string, Record<string, unknown>>): this;
    getContexts(): Record<string, Record<string, unknown>>;
    setRelease(release: string | undefined): this;
    getRelease(): string | undefined;
    setEnvironment(environment: string | undefined): this;
    getEnvironment(): string | undefined;
    setService(service: string | undefined): this;
    getService(): string | undefined;
    setDeployment(deployment: string | undefined): this;
    getDeployment(): string | undefined;
    setBaggage(key: string, value: string): this;
    getBaggage(): Record<string, string>;
    clone(): Scope;
    onScopeChange(listener: (scope: Scope) => void): () => void;
    private notify;
}

declare function generateSessionId(): string;
declare class SessionManager {
    private sessionId;
    private startedAt;
    private lastSeenAt;
    private sequence;
    private crashed;
    constructor(existingSessionId?: string);
    getSessionId(): string;
    getStartedAt(): string;
    getLastSeenAt(): string;
    nextSequence(): number;
    touch(): void;
    markCrashed(): void;
    isCrashed(): boolean;
    rotate(): string;
}

declare function generateTraceId(): string;
declare function generateSpanId(): string;
declare function generateRequestId(): string;
/**
 * Parses W3C traceparent header: 00-{32 hex traceId}-{16 hex spanId}-{2 hex flags}
 */
declare function parseTraceParent(header: string): HaloTraceContext | null;
/**
 * Formats a HaloTraceContext into a standard W3C traceparent string.
 */
declare function formatTraceParent(context: HaloTraceContext): string;
declare class TraceContextManager {
    private currentContext;
    private currentRequestId;
    constructor(initialTrace?: Partial<HaloTraceContext>, initialRequestId?: string);
    getContext(): HaloTraceContext;
    getTraceId(): string;
    getSpanId(): string;
    getRequestId(): string;
    startSpan(name: string, parentSpanId?: string): {
        spanId: string;
        parentSpanId: string;
    };
    injectHeaders(headers: Record<string, string>): Record<string, string>;
    extractHeaders(headers: Headers | Record<string, string | null | undefined>): void;
}

declare class BreadcrumbRingBuffer {
    private readonly capacity;
    private buffer;
    constructor(capacity?: number);
    add(breadcrumb: HaloBreadcrumb): void;
    getAll(): HaloBreadcrumb[];
    clear(): void;
    size(): number;
    getCapacity(): number;
}

declare function sanitizeUrl(rawUrl: string | undefined): string;
declare function sanitizeHeaders(headers: Record<string, string | undefined> | Headers, allowlist?: string[]): Record<string, string>;
declare function sanitizeText(text: string): string;
declare function sanitizeObject<T>(obj: T, maxDepth?: number, currentDepth?: number, seen?: WeakSet<WeakKey>): T;

declare function safeSerialize(value: unknown, maxDepth?: number, maxLength?: number, maxKeys?: number, currentDepth?: number, seen?: WeakSet<WeakKey>): unknown;

declare class SessionStateMachine {
    private currentState;
    private readonly listeners;
    getState(): SessionState;
    canTransitionTo(next: SessionState): boolean;
    transition(next: SessionState): boolean;
    onTransition(listener: (state: SessionState, previous: SessionState) => void): () => void;
    private notify;
}

interface SamplingContext {
    user?: HaloUser;
    url?: string;
    route?: string;
    featureFlags?: Record<string, boolean | string>;
}
declare class SamplingEngine {
    private readonly sessionRate;
    private readonly traceRate;
    private readonly predicate?;
    constructor(options?: {
        samplingRate?: number;
        tracesSampleRate?: number;
        targetPredicate?: (ctx: SamplingContext) => boolean;
    });
    shouldSampleSession(context?: SamplingContext): boolean;
    shouldSampleTrace(): boolean;
}

interface TransportOptions {
    endpoint: string;
    apiKey: string;
    batchSize?: number;
    flushIntervalMs?: number;
    maxQueueSize?: number;
    maxRetries?: number;
    timeoutMs?: number;
    onSuccess?: (result: any) => void;
    onError?: (err: Error) => void;
}
declare class BaseTransport {
    private endpoint;
    private apiKey;
    private batchSize;
    private flushIntervalMs;
    private maxQueueSize;
    private maxRetries;
    private timeoutMs;
    private queue;
    private timer;
    private isFlushing;
    private isClosed;
    constructor(options: TransportOptions);
    send(event: HaloEnvelope): void;
    flush(): Promise<void>;
    private postBatchWithRetry;
    flushImmediate(beaconPreferred?: boolean): void;
    close(): void;
    private startTimer;
}

declare function generateEventId(): string;
declare function detectRuntime(): HaloRuntimeInfo;
declare class EnvelopeBuilder {
    private sdkName;
    private sdkVersion;
    private runtimeInfo;
    constructor(sdkName?: string, sdkVersion?: string);
    build(options: HaloCaptureOptions, scope: Scope, session?: SessionManager, trace?: TraceContextManager): HaloEnvelope;
}

declare class CoreClient {
    protected options: HaloOptions;
    protected scope: Scope;
    protected session: SessionManager;
    protected trace: TraceContextManager;
    protected breadcrumbs: BreadcrumbRingBuffer;
    protected envelopeBuilder: EnvelopeBuilder;
    protected transport?: BaseTransport;
    protected sampling: SamplingEngine;
    protected stateMachine: SessionStateMachine;
    protected enabled: boolean;
    constructor(options: HaloOptions, sdkName?: string, sdkVersion?: string);
    getScope(): Scope;
    getSession(): SessionManager;
    getSessionId(): string;
    getTraceManager(): TraceContextManager;
    getTraceContext(): HaloTraceContext;
    getBreadcrumbBuffer(): BreadcrumbRingBuffer;
    setUser(user: HaloUser): this;
    clearUser(): this;
    setTag(key: string, value: HaloTagValue): this;
    setTags(tags: Record<string, HaloTagValue>): this;
    setContext(name: string, data: Record<string, unknown>): this;
    setRelease(release: string): this;
    setEnvironment(environment: string): this;
    addBreadcrumb(breadcrumb: Omit<HaloBreadcrumb, "timestamp"> & {
        timestamp?: string;
    }): void;
    startSpan(name: string, operation?: string): {
        spanId: string;
        parentSpanId: string;
    };
    capture(options: HaloCaptureOptions): HaloEnvelope | null;
    captureException(error: unknown, additional?: Partial<HaloCaptureOptions>): HaloEnvelope | null;
    captureMessage(message: string, severity?: HaloSeverity, additional?: Partial<HaloCaptureOptions>): HaloEnvelope | null;
    capturePerformance(options: {
        title: string;
        durationMs: number;
        operation?: string;
        resource?: string;
        status?: string | number;
        service?: string;
        metadata?: Record<string, unknown>;
        tags?: Record<string, HaloTagValue>;
        requestId?: string;
        traceId?: string;
    }): HaloEnvelope | null;
    flush(): Promise<void>;
    close(): void;
}

export { BaseTransport, BreadcrumbRingBuffer, CoreClient, EnvelopeBuilder, type SamplingContext, SamplingEngine, Scope, SessionManager, SessionStateMachine, TraceContextManager, type TransportOptions, detectRuntime, formatTraceParent, generateEventId, generateRequestId, generateSessionId, generateSpanId, generateTraceId, parseTraceParent, safeSerialize, sanitizeHeaders, sanitizeObject, sanitizeText, sanitizeUrl };
