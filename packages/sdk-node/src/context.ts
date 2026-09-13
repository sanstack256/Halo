import { AsyncLocalStorage } from "node:async_hooks";
import type { HaloTraceContext, HaloUser } from "@halo-trace/sdk-types";

export interface NodeRequestContext {
    trace?: HaloTraceContext;
    requestId?: string;
    user?: HaloUser;
    route?: string;
    startedAt?: number;
}

const asyncLocalStorage = new AsyncLocalStorage<NodeRequestContext>();

export function runWithContext<T>(context: NodeRequestContext, fn: () => Promise<T> | T): Promise<T> | T {
    return asyncLocalStorage.run(context, fn);
}

export function getContext(): NodeRequestContext | undefined {
    return asyncLocalStorage.getStore();
}

export function getTraceId(): string | undefined {
    return asyncLocalStorage.getStore()?.trace?.traceId;
}

export function getRequestId(): string | undefined {
    return asyncLocalStorage.getStore()?.requestId;
}
