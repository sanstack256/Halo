import { CoreClient } from "@halo-trace/sdk-core";
import type { HaloOptions } from "@halo-trace/sdk-types";
import { registerErrorInstrumentation } from "./instrumentations/errors";
import { registerHttpInstrumentation } from "./instrumentations/http";
import { registerConsoleInstrumentation } from "./instrumentations/console";
import { registerSpaInstrumentation } from "./instrumentations/spa";
import { registerLifecycleInstrumentation } from "./instrumentations/lifecycle";
import { registerPerformanceInstrumentation } from "./instrumentations/performance";
import { ReplayBridge } from "./replay-bridge";

export class BrowserClient extends CoreClient {
    private replayBridge: ReplayBridge;
    private teardowns: Array<() => void> = [];

    constructor(options: HaloOptions) {
        const endpoint = options.endpoint || (typeof window !== "undefined" ? "/api" : "http://localhost:3000/api");
        super({ ...options, endpoint }, "@halo-trace/sdk-browser", "1.0.0");

        // Sync global browser identifiers
        if (typeof window !== "undefined") {
            (window as any).__HALO_SESSION_ID__ = this.session.getSessionId();
            (window as any).__HALO_SDK__ = this;
        }

        this.replayBridge = new ReplayBridge(this, options.replay);

        if (this.enabled) {
            this.installInstrumentations(options, endpoint);
        }
    }

    private installInstrumentations(options: HaloOptions, endpoint: string): void {
        if (options.autoCapture !== false) {
            const unregisterErrors = registerErrorInstrumentation(this, (err) => {
                this.replayBridge.triggerError(err, this.trace.getTraceId(), this.trace.getRequestId());
            });
            this.teardowns.push(unregisterErrors);
        }

        if (options.captureHttp !== false) {
            const unregisterHttp = registerHttpInstrumentation(this, {
                endpoint,
                ignoreUrls: options.privacy?.ignoreUrls,
                allowlistHeaders: options.privacy?.allowlistHeaders,
            });
            this.teardowns.push(unregisterHttp);
        }

        if (options.captureConsole !== false) {
            const unregisterConsole = registerConsoleInstrumentation(this);
            this.teardowns.push(unregisterConsole);
        }

        if (options.captureNavigation !== false) {
            const unregisterSpa = registerSpaInstrumentation(this);
            this.teardowns.push(unregisterSpa);
        }

        const unregisterLifecycle = registerLifecycleInstrumentation(this);
        this.teardowns.push(unregisterLifecycle);

        if (options.capturePerformance !== false) {
            const unregisterPerf = registerPerformanceInstrumentation(this);
            this.teardowns.push(unregisterPerf);
        }

        // Initialize Replay if configured
        if (options.apiKey) {
            void this.replayBridge.initialize(endpoint, options.apiKey);
        }
    }

    public get replay(): ReplayBridge {
        return this.replayBridge;
    }

    public openFeedbackModal(options?: any): any {
        return this.replayBridge.openFeedbackModal(options);
    }

    public override captureException(error: unknown, additional?: any): any {
        const err = error instanceof Error ? error : new Error(String(error));
        this.replayBridge.triggerError(err, this.trace.getTraceId(), this.trace.getRequestId());
        return super.captureException(error, additional);
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
        this.replayBridge.stop();
        super.close();
    }
}
