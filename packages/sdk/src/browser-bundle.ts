import { BrowserClient, init, getClient } from "@halo-trace/sdk-browser";
import * as Core from "@halo-trace/sdk-core";
import * as Types from "@halo-trace/sdk-types";
import { HaloReplay } from "@halo-trace/replay";

export class Halo {
    private client: BrowserClient;

    constructor(options: Types.HaloOptions) {
        this.client = new BrowserClient(options);
        (window as any).__HALO_INSTANCE__ = this;
    }

    public static init(options: Types.HaloOptions): Halo {
        if ((window as any).__HALO_INSTANCE__) {
            (window as any).__HALO_INSTANCE__.close();
        }
        const inst = new Halo(options);
        return inst;
    }

    public static getClient(): BrowserClient | null {
        return (window as any).__HALO_INSTANCE__?.client || null;
    }

    public getClientInstance(): BrowserClient {
        return this.client;
    }

    public captureException(error: unknown, additional?: Partial<Types.HaloCaptureOptions>): any {
        return this.client.captureException(error, additional);
    }

    public captureMessage(message: string, severity: Types.HaloSeverity = "INFO", additional?: Partial<Types.HaloCaptureOptions>): any {
        return this.client.captureMessage(message, severity, additional);
    }

    public capturePerformance(options: {
        title: string;
        durationMs: number;
        operation?: string;
        resource?: string;
        status?: string | number;
        service?: string;
        metadata?: Record<string, unknown>;
        tags?: Record<string, Types.HaloTagValue>;
    }): any {
        return this.client.capturePerformance(options);
    }

    public addBreadcrumb(breadcrumb: Omit<Types.HaloBreadcrumb, "timestamp"> & { timestamp?: string }): void {
        this.client.addBreadcrumb(breadcrumb);
    }

    public setUser(user: Types.HaloUser): this {
        this.client.setUser(user);
        return this;
    }

    public clearUser(): this {
        this.client.clearUser();
        return this;
    }

    public setTag(key: string, value: Types.HaloTagValue): this {
        this.client.setTag(key, value);
        return this;
    }

    public setTags(tags: Record<string, Types.HaloTagValue>): this {
        this.client.setTags(tags);
        return this;
    }

    public setContext(name: string, data: Record<string, unknown>): this {
        this.client.setContext(name, data);
        return this;
    }

    public setRelease(release: string): this {
        this.client.setRelease(release);
        return this;
    }

    public setEnvironment(environment: string): this {
        this.client.setEnvironment(environment);
        return this;
    }

    public startSpan(name: string, operation?: string): { spanId: string; parentSpanId: string } {
        return this.client.startSpan(name, operation);
    }

    public getSessionId(): string {
        return this.client.getSessionId();
    }

    public getTraceContext(): Types.HaloTraceContext {
        return this.client.getTraceContext();
    }

    public get replay() {
        return {
            start: () => {
                // Bridge starts automatically on init if replay enabled
            },
            stop: () => this.client.replay.stop(),
            flush: () => this.client.replay.flush(),
            openFeedbackModal: (opts?: any) => this.client.openFeedbackModal(opts),
            getSessionId: () => this.client.getSessionId(),
        };
    }

    public get feedback() {
        return {
            open: (opts?: any) => this.client.openFeedbackModal(opts),
        };
    }

    public openFeedbackModal(options?: any): any {
        return this.client.openFeedbackModal(options);
    }

    public async flush(): Promise<void> {
        await this.client.flush();
    }

    public close(): void {
        this.client.close();
    }

    public static captureException(error: unknown, additional?: Partial<Types.HaloCaptureOptions>): any {
        return (window as any).__HALO_INSTANCE__?.captureException(error, additional);
    }

    public static captureMessage(message: string, severity?: Types.HaloSeverity, additional?: Partial<Types.HaloCaptureOptions>): any {
        return (window as any).__HALO_INSTANCE__?.captureMessage(message, severity, additional);
    }

    public static addBreadcrumb(breadcrumb: Omit<Types.HaloBreadcrumb, "timestamp"> & { timestamp?: string }): void {
        (window as any).__HALO_INSTANCE__?.addBreadcrumb(breadcrumb);
    }

    public static setUser(user: Types.HaloUser): void {
        (window as any).__HALO_INSTANCE__?.setUser(user);
    }

    public static clearUser(): void {
        (window as any).__HALO_INSTANCE__?.clearUser();
    }

    public static setTag(key: string, value: Types.HaloTagValue): void {
        (window as any).__HALO_INSTANCE__?.setTag(key, value);
    }

    public static setContext(name: string, data: Record<string, unknown>): void {
        (window as any).__HALO_INSTANCE__?.setContext(name, data);
    }

    public static getSessionId(): string | undefined {
        return (window as any).__HALO_INSTANCE__?.getSessionId();
    }

    public static getTraceContext(): Types.HaloTraceContext | undefined {
        return (window as any).__HALO_INSTANCE__?.getTraceContext();
    }

    public static async flush(): Promise<void> {
        await (window as any).__HALO_INSTANCE__?.flush();
    }

    public static close(): void {
        (window as any).__HALO_INSTANCE__?.close();
    }
}

// Auto-attach to window for script-tag consumers
if (typeof window !== "undefined") {
    (window as any).Halo = Halo;
}

export { BrowserClient, init, getClient, HaloReplay };
export * from "@halo-trace/sdk-core";
export * from "@halo-trace/sdk-types";
export default Halo;
