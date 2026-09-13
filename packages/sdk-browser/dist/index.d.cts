import { CoreClient } from '@halo-trace/sdk-core';
export * from '@halo-trace/sdk-core';
import { HaloReplayConfig, HaloOptions } from '@halo-trace/sdk-types';

declare class ReplayBridge {
    private replayInstance;
    private client;
    private config?;
    constructor(client: CoreClient, config?: HaloReplayConfig);
    initialize(endpoint: string, apiKey: string): Promise<void>;
    capture(options?: {
        reason?: string;
    }): void;
    getCaptureState(): string;
    triggerError(error: Error, traceId?: string, requestId?: string): void;
    setIssueId(issueId: string): void;
    openFeedbackModal(options?: any): any;
    flush(): void;
    stop(): void;
    getInstance(): any;
}

declare class BrowserClient extends CoreClient {
    private replayBridge;
    private teardowns;
    constructor(options: HaloOptions);
    private installInstrumentations;
    get replay(): ReplayBridge;
    openFeedbackModal(options?: any): any;
    captureException(error: unknown, additional?: any): any;
    close(): void;
}

declare function registerErrorInstrumentation(client: CoreClient, onFatalError?: (err: Error) => void): () => void;

interface BrowserHttpOptions {
    endpoint?: string;
    ignoreUrls?: (string | RegExp)[];
    allowlistHeaders?: string[];
}
declare function registerHttpInstrumentation(client: CoreClient, options?: BrowserHttpOptions): () => void;

declare function registerConsoleInstrumentation(client: CoreClient): () => void;

declare function registerSpaInstrumentation(client: CoreClient): () => void;

declare function registerLifecycleInstrumentation(client: CoreClient): () => void;

declare function registerPerformanceInstrumentation(client: CoreClient): () => void;

declare function init(options: HaloOptions): BrowserClient;
declare function getClient(): BrowserClient | null;

export { BrowserClient, ReplayBridge, getClient, init, registerConsoleInstrumentation, registerErrorInstrumentation, registerHttpInstrumentation, registerLifecycleInstrumentation, registerPerformanceInstrumentation, registerSpaInstrumentation };
