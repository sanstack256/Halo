import { BrowserClient } from "./browser-client";
import type { HaloOptions } from "@halo-trace/sdk-types";

export { BrowserClient } from "./browser-client";
export { ReplayBridge } from "./replay-bridge";
export { registerErrorInstrumentation } from "./instrumentations/errors";
export { registerHttpInstrumentation } from "./instrumentations/http";
export { registerConsoleInstrumentation } from "./instrumentations/console";
export { registerSpaInstrumentation } from "./instrumentations/spa";
export { registerLifecycleInstrumentation } from "./instrumentations/lifecycle";
export { registerPerformanceInstrumentation } from "./instrumentations/performance";

export * from "@halo-trace/sdk-core";

let defaultClient: BrowserClient | null = null;

export function init(options: HaloOptions): BrowserClient {
    if (defaultClient) {
        defaultClient.close();
    }
    defaultClient = new BrowserClient(options);
    return defaultClient;
}

export function getClient(): BrowserClient | null {
    return defaultClient;
}
