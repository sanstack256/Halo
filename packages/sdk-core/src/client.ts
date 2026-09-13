import type {
    HaloBreadcrumb,
    HaloCaptureOptions,
    HaloContext,
    HaloEnvelope,
    HaloOptions,
    HaloSeverity,
    HaloTagValue,
    HaloTraceContext,
    HaloUser,
} from "@halo-trace/sdk-types";
import { Scope } from "./scope";
import { SessionManager } from "./session";
import { TraceContextManager } from "./trace-context";
import { BreadcrumbRingBuffer } from "./ring-buffer";
import { EnvelopeBuilder } from "./envelope";
import { BaseTransport } from "./transport";
import { SamplingEngine } from "./sampling";
import { SessionStateMachine } from "./state-machine";

export class CoreClient {
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

    constructor(options: HaloOptions, sdkName: string = "@halo-trace/sdk", sdkVersion: string = "1.0.0") {
        this.options = options;
        this.enabled = options.enabled ?? true;

        this.scope = new Scope();
        if (options.environment) this.scope.setEnvironment(options.environment);
        if (options.release) this.scope.setRelease(options.release);
        if (options.service) this.scope.setService(options.service);
        if (options.deployment) this.scope.setDeployment(options.deployment);

        this.session = new SessionManager(options.sessionId);
        this.trace = new TraceContextManager();
        this.breadcrumbs = new BreadcrumbRingBuffer(options.maxBreadcrumbs || 100);
        this.envelopeBuilder = new EnvelopeBuilder(sdkName, sdkVersion);
        this.stateMachine = new SessionStateMachine();
        this.sampling = new SamplingEngine({
            samplingRate: options.samplingRate,
            tracesSampleRate: options.tracesSampleRate,
            targetPredicate: options.targetPredicate,
        });

        if (this.enabled && options.apiKey && options.endpoint) {
            this.transport = new BaseTransport({
                endpoint: options.endpoint,
                apiKey: options.apiKey,
            });
            this.stateMachine.transition("RECORDING");
        }
    }

    public getScope(): Scope {
        return this.scope;
    }

    public getSession(): SessionManager {
        return this.session;
    }

    public getSessionId(): string {
        return this.session.getSessionId();
    }

    public getTraceManager(): TraceContextManager {
        return this.trace;
    }

    public getTraceContext(): HaloTraceContext {
        return this.trace.getContext();
    }

    public getBreadcrumbBuffer(): BreadcrumbRingBuffer {
        return this.breadcrumbs;
    }

    public setUser(user: HaloUser): this {
        this.scope.setUser(user);
        return this;
    }

    public clearUser(): this {
        this.scope.clearUser();
        return this;
    }

    public setTag(key: string, value: HaloTagValue): this {
        this.scope.setTag(key, value);
        return this;
    }

    public setTags(tags: Record<string, HaloTagValue>): this {
        this.scope.setTags(tags);
        return this;
    }

    public setContext(name: string, data: Record<string, unknown>): this {
        this.scope.setContext(name, data);
        return this;
    }

    public setRelease(release: string): this {
        this.scope.setRelease(release);
        return this;
    }

    public setEnvironment(environment: string): this {
        this.scope.setEnvironment(environment);
        return this;
    }

    public addBreadcrumb(breadcrumb: Omit<HaloBreadcrumb, "timestamp"> & { timestamp?: string }): void {
        const item: HaloBreadcrumb = {
            timestamp: breadcrumb.timestamp || new Date().toISOString(),
            category: breadcrumb.category,
            message: breadcrumb.message,
            level: breadcrumb.level,
            data: breadcrumb.data,
        };
        this.breadcrumbs.add(item);
    }

    public startSpan(name: string, operation?: string): { spanId: string; parentSpanId: string } {
        const span = this.trace.startSpan(name);
        this.addBreadcrumb({
            category: "trace",
            message: `span: ${name} (${operation || "internal"})`,
            data: { spanId: span.spanId, parentSpanId: span.parentSpanId },
        });
        return span;
    }

    public capture(options: HaloCaptureOptions): HaloEnvelope | null {
        if (!this.enabled) return null;

        if (options.type !== "ERROR" && !this.sampling.shouldSampleSession({ user: this.scope.getUser() })) {
            return null;
        }

        const breadcrumbs = options.breadcrumbs || this.breadcrumbs.getAll();
        const envelope = this.envelopeBuilder.build(
            { ...options, breadcrumbs },
            this.scope,
            this.session,
            this.trace
        );

        if (this.transport) {
            this.transport.send(envelope);
        }

        return envelope;
    }

    public captureException(error: unknown, additional?: Partial<HaloCaptureOptions>): HaloEnvelope | null {
        const err = error instanceof Error ? error : new Error(String(error));
        this.session.touch();

        const envelope = this.capture({
            type: "ERROR",
            title: err.message || err.name || "Error",
            message: err.message,
            severity: "ERROR",
            stack: err.stack,
            fingerprint: `${err.name}:${err.message}`,
            ...additional,
        });

        return envelope;
    }

    public captureMessage(message: string, severity: HaloSeverity = "INFO", additional?: Partial<HaloCaptureOptions>): HaloEnvelope | null {
        return this.capture({
            type: "MESSAGE",
            title: message,
            message,
            severity,
            ...additional,
        });
    }

    public capturePerformance(options: {
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
    }): HaloEnvelope | null {
        if (!this.sampling.shouldSampleTrace()) return null;

        return this.capture({
            type: "TRACE",
            title: options.title,
            durationMs: options.durationMs,
            operation: options.operation,
            resource: options.resource,
            status: options.status,
            service: options.service,
            metadata: options.metadata,
            tags: options.tags,
            requestId: options.requestId,
            traceId: options.traceId,
            severity: "INFO",
        });
    }

    public async flush(): Promise<void> {
        if (this.transport) {
            await this.transport.flush();
        }
    }

    public close(): void {
        if (this.transport) {
            this.transport.close();
        }
        this.stateMachine.transition("STOPPED");
    }
}
