import { CoreClient } from '@halo-trace/sdk-core';
export * from '@halo-trace/sdk-core';
import { HaloOptions, HaloCaptureOptions, HaloSeverity, HaloTagValue, HaloBreadcrumb, HaloUser, HaloTraceContext } from '@halo-trace/sdk-types';
export * from '@halo-trace/sdk-types';

declare class Halo {
    private client;
    constructor(options: HaloOptions);
    static init(options: HaloOptions): Halo;
    static getClient(): CoreClient | null;
    getClientInstance(): CoreClient;
    captureException(error: unknown, additional?: Partial<HaloCaptureOptions>): any;
    captureMessage(message: string, severity?: HaloSeverity, additional?: Partial<HaloCaptureOptions>): any;
    capturePerformance(options: {
        title: string;
        durationMs: number;
        operation?: string;
        resource?: string;
        status?: string | number;
        service?: string;
        metadata?: Record<string, unknown>;
        tags?: Record<string, HaloTagValue>;
    }): any;
    addBreadcrumb(breadcrumb: Omit<HaloBreadcrumb, "timestamp"> & {
        timestamp?: string;
    }): void;
    setUser(user: HaloUser): this;
    clearUser(): this;
    setTag(key: string, value: HaloTagValue): this;
    setTags(tags: Record<string, HaloTagValue>): this;
    setContext(name: string, data: Record<string, unknown>): this;
    setRelease(release: string): this;
    setEnvironment(environment: string): this;
    startSpan(name: string, operation?: string): {
        spanId: string;
        parentSpanId: string;
    };
    getSessionId(): string;
    getTraceContext(): HaloTraceContext;
    get replay(): {
        start: () => void;
        stop: () => void;
        flush: () => void;
        openFeedbackModal: (options?: any) => any;
        getSessionId: () => string;
    };
    get feedback(): {
        open: (options?: any) => any;
    };
    openFeedbackModal(options?: any): any;
    flush(): Promise<void>;
    close(): void;
    static captureException(error: unknown, additional?: Partial<HaloCaptureOptions>): any;
    static captureMessage(message: string, severity?: HaloSeverity, additional?: Partial<HaloCaptureOptions>): any;
    static addBreadcrumb(breadcrumb: Omit<HaloBreadcrumb, "timestamp"> & {
        timestamp?: string;
    }): void;
    static setUser(user: HaloUser): void;
    static clearUser(): void;
    static setTag(key: string, value: HaloTagValue): void;
    static setContext(name: string, data: Record<string, unknown>): void;
    static getSessionId(): string | undefined;
    static getTraceContext(): HaloTraceContext | undefined;
    static flush(): Promise<void>;
    static close(): void;
}

export { Halo, Halo as default };
