import { CoreClient } from '@halo-trace/sdk-core';
export * from '@halo-trace/sdk-core';
import { HaloOptions, HaloTraceContext, HaloUser } from '@halo-trace/sdk-types';

declare class NodeClient extends CoreClient {
    private teardowns;
    constructor(options: HaloOptions);
    private installNodeInstrumentations;
    close(): void;
}

interface NodeRequestContext {
    trace?: HaloTraceContext;
    requestId?: string;
    user?: HaloUser;
    route?: string;
    startedAt?: number;
}
declare function runWithContext<T>(context: NodeRequestContext, fn: () => Promise<T> | T): Promise<T> | T;
declare function getContext(): NodeRequestContext | undefined;
declare function getTraceId(): string | undefined;
declare function getRequestId(): string | undefined;

declare function registerProcessInstrumentation(client: CoreClient, exitOnUncaught?: boolean): () => void;

declare function registerNodeHttpInstrumentation(client: CoreClient, endpoint?: string): () => void;

declare function init(options: HaloOptions): NodeClient;
declare function getClient(): NodeClient | null;

export { NodeClient, type NodeRequestContext, getClient, getContext, getRequestId, getTraceId, init, registerNodeHttpInstrumentation, registerProcessInstrumentation, runWithContext };
