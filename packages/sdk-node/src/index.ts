import { NodeClient } from "./node-client";
import type { HaloOptions } from "@halo-trace/sdk-types";

export { NodeClient } from "./node-client";
export { runWithContext, getContext, getTraceId, getRequestId, type NodeRequestContext } from "./context";
export { registerProcessInstrumentation } from "./instrumentations/process";
export { registerNodeHttpInstrumentation } from "./instrumentations/http";

export * from "@halo-trace/sdk-core";

let defaultNodeClient: NodeClient | null = null;

export function init(options: HaloOptions): NodeClient {
    if (defaultNodeClient) {
        defaultNodeClient.close();
    }
    defaultNodeClient = new NodeClient(options);
    return defaultNodeClient;
}

export function getClient(): NodeClient | null {
    return defaultNodeClient;
}
