import { CoreClient } from "@halo-trace/sdk-core";
import type { HaloOptions } from "@halo-trace/sdk-types";
import { registerProcessInstrumentation } from "./instrumentations/process";
import { registerNodeHttpInstrumentation } from "./instrumentations/http";

export class NodeClient extends CoreClient {
    private teardowns: Array<() => void> = [];

    constructor(options: HaloOptions) {
        const endpoint = options.endpoint || (typeof process !== "undefined" ? process.env?.HALO_ENDPOINT : "http://localhost:3000/api");
        super({ ...options, endpoint }, "@halo-trace/sdk-node", "1.0.0");

        if (this.enabled) {
            this.installNodeInstrumentations(options, endpoint);
        }
    }

    private installNodeInstrumentations(options: HaloOptions, endpoint?: string): void {
        if (options.autoCapture !== false) {
            const unregisterProcess = registerProcessInstrumentation(this);
            this.teardowns.push(unregisterProcess);
        }

        if (options.captureHttp !== false) {
            const unregisterHttp = registerNodeHttpInstrumentation(this, endpoint);
            this.teardowns.push(unregisterHttp);
        }

        // Attach system tags
        if (typeof process !== "undefined") {
            this.scope.setTag("node.version", process.version);
            this.scope.setTag("os.platform", process.platform);
            this.scope.setTag("os.arch", process.arch);
        }
    }

    public override close(): void {
        for (const teardown of this.teardowns) {
            try {
                teardown();
            } catch {
                // ignore
            }
        }
        this.teardowns = [];
        super.close();
    }
}
