import { BrowserClient } from "@halo-trace/sdk-browser";
import { NodeClient } from "@halo-trace/sdk-node";
import type { CoreClient } from "@halo-trace/sdk-core";
import type {
    HaloBreadcrumb,
    HaloCaptureOptions,
    HaloOptions,
    HaloSeverity,
    HaloTagValue,
    HaloTraceContext,
    HaloUser,
} from "@halo-trace/sdk-types";

let globalHaloInstance: Halo | null = null;

export class Halo {
    private client: CoreClient;

    constructor(options: HaloOptions) {
        if (typeof window !== "undefined" && typeof document !== "undefined") {
            this.client = new BrowserClient(options);
        } else {
            this.client = new NodeClient(options);
        }
        globalHaloInstance = this;
    }

    public static init(options: HaloOptions): Halo {
        if (globalHaloInstance) {
            globalHaloInstance.close();
        }
        globalHaloInstance = new Halo(options);
        return globalHaloInstance;
    }

    public static getClient(): CoreClient | null {
        return globalHaloInstance?.client || null;
    }

    public getClientInstance(): CoreClient {
        return this.client;
    }

    public captureException(error: unknown, additional?: Partial<HaloCaptureOptions>): any {
        return this.client.captureException(error, additional);
    }

    public captureMessage(message: string, severity: HaloSeverity = "INFO", additional?: Partial<HaloCaptureOptions>): any {
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
        tags?: Record<string, HaloTagValue>;
    }): any {
        return this.client.capturePerformance(options);
    }

    public addBreadcrumb(breadcrumb: Omit<HaloBreadcrumb, "timestamp"> & { timestamp?: string }): void {
        this.client.addBreadcrumb(breadcrumb);
    }

    public setUser(user: HaloUser): this {
        this.client.setUser(user);
        return this;
    }

    public clearUser(): this {
        this.client.clearUser();
        return this;
    }

    public setTag(key: string, value: HaloTagValue): this {
        this.client.setTag(key, value);
        return this;
    }

    public setTags(tags: Record<string, HaloTagValue>): this {
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

    public getTraceContext(): HaloTraceContext {
        return this.client.getTraceContext();
    }

    public get replay(): {
        start: () => void;
        stop: () => void;
        flush: () => void;
        openFeedbackModal: (options?: any) => any;
        getSessionId: () => string;
    } {
        const browserClient = this.client instanceof BrowserClient ? this.client : null;
        return {
            start: () => {
                // If already initialized, bridge starts automatically
            },
            stop: () => {
                browserClient?.replay.stop();
            },
            flush: () => {
                browserClient?.replay.flush();
            },
            openFeedbackModal: (options?: any) => {
                return browserClient?.openFeedbackModal(options);
            },
            getSessionId: () => {
                return this.getSessionId();
            },
        };
    }

    public get feedback(): {
        open: (options?: any) => any;
    } {
        return {
            open: (options?: any) => {
                return this.openFeedbackModal(options);
            },
        };
    }

    public openFeedbackModal(options?: any): any {
        if (this.client instanceof BrowserClient) {
            return this.client.openFeedbackModal(options);
        }
        return null;
    }

    public async flush(): Promise<void> {
        await this.client.flush();
    }

    public close(): void {
        this.client.close();
    }

    // Static helpers for global convenience
    public static captureException(error: unknown, additional?: Partial<HaloCaptureOptions>): any {
        return globalHaloInstance?.captureException(error, additional);
    }

    public static captureMessage(message: string, severity?: HaloSeverity, additional?: Partial<HaloCaptureOptions>): any {
        return globalHaloInstance?.captureMessage(message, severity, additional);
    }

    public static addBreadcrumb(breadcrumb: Omit<HaloBreadcrumb, "timestamp"> & { timestamp?: string }): void {
        globalHaloInstance?.addBreadcrumb(breadcrumb);
    }

    public static setUser(user: HaloUser): void {
        globalHaloInstance?.setUser(user);
    }

    public static clearUser(): void {
        globalHaloInstance?.clearUser();
    }

    public static setTag(key: string, value: HaloTagValue): void {
        globalHaloInstance?.setTag(key, value);
    }

    public static setContext(name: string, data: Record<string, unknown>): void {
        globalHaloInstance?.setContext(name, data);
    }

    public static getSessionId(): string | undefined {
        return globalHaloInstance?.getSessionId();
    }

    public static getTraceContext(): HaloTraceContext | undefined {
        return globalHaloInstance?.getTraceContext();
    }

    public static async flush(): Promise<void> {
        await globalHaloInstance?.flush();
    }

    public static close(): void {
        globalHaloInstance?.close();
    }
}