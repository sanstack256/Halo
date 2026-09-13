import type { CoreClient } from "@halo-trace/sdk-core";
import type { HaloReplayConfig } from "@halo-trace/sdk-types";

export class ReplayBridge {
    private replayInstance: any = null;
    private client: CoreClient;
    private config?: HaloReplayConfig;

    constructor(client: CoreClient, config?: HaloReplayConfig) {
        this.client = client;
        this.config = config;
    }

    public async initialize(endpoint: string, apiKey: string): Promise<void> {
        if (!this.config?.enabled && this.config?.enabled !== undefined) {
            return;
        }

        try {
            // Dynamically import replay or check global to keep bundle optional and tree-shakeable
            let ReplayModule: any = null;
            if (typeof window !== "undefined" && (window as any).HaloReplayBundle?.HaloReplay) {
                ReplayModule = (window as any).HaloReplayBundle;
            } else {
                try {
                    ReplayModule = await import("@halo-trace/replay");
                } catch {
                    // Replay package optional
                    return;
                }
            }

            if (!ReplayModule?.HaloReplay) return;

            const sessionId = this.client.getSessionId();
            const errorTriggered = this.config?.errorTriggered ?? true;
            const samplingRate = this.config?.samplingRate ?? this.config?.sampleRate ?? (errorTriggered ? 0.0 : 1.0);

            const replay = new ReplayModule.HaloReplay({
                apiKey,
                endpoint,
                sessionId,
                samplingRate,
                sampleRate: samplingRate,
                errorTriggered,
                triggerOnFrustration: this.config?.triggerOnFrustration ?? true,
                triggerOnNetworkError: this.config?.triggerOnNetworkError ?? true,
                preErrorBufferSeconds: this.config?.preErrorBufferSeconds,
                postErrorDurationSeconds: this.config?.postErrorDurationSeconds,
                maxBufferEvents: this.config?.maxBufferEvents,
                flushIntervalMs: this.config?.flushIntervalMs,
                recordCanvas: this.config?.recordCanvas ?? false,
                privacy: this.config?.privacy,
            });

            replay.start();
            this.replayInstance = replay;

            if (typeof window !== "undefined") {
                (window as any).__HALO_REPLAY__ = replay;
            }
        } catch (err) {
            console.warn("[Halo SDK] Failed to initialize session replay bridge:", err);
        }
    }

    public capture(options?: { reason?: string }): void {
        if (this.replayInstance && typeof this.replayInstance.capture === "function") {
            try {
                this.replayInstance.capture(options);
            } catch {
                // Safety
            }
        }
    }

    public getCaptureState(): string {
        if (this.replayInstance && typeof this.replayInstance.getCaptureState === "function") {
            return this.replayInstance.getCaptureState();
        }
        return "DISABLED";
    }

    public triggerError(error: Error, traceId?: string, requestId?: string): void {
        if (this.replayInstance && typeof this.replayInstance.triggerErrorReplay === "function") {
            try {
                this.replayInstance.triggerErrorReplay({
                    title: error.message || error.name,
                    stack: error.stack,
                    traceId,
                    requestId,
                });
            } catch {
                // Safety
            }
        }
    }

    public setIssueId(issueId: string): void {
        if (this.replayInstance && typeof this.replayInstance.setIssueId === "function") {
            try {
                this.replayInstance.setIssueId(issueId);
            } catch {
                // Safety
            }
        }
    }

    public openFeedbackModal(options?: any): any {
        if (this.replayInstance && typeof this.replayInstance.openFeedbackModal === "function") {
            return this.replayInstance.openFeedbackModal(options);
        }
        return null;
    }

    public flush(): void {
        if (this.replayInstance && typeof this.replayInstance.flushAndConclude === "function") {
            try {
                this.replayInstance.flushAndConclude();
            } catch {
                // Safety
            }
        }
    }

    public stop(): void {
        if (this.replayInstance && typeof this.replayInstance.stop === "function") {
            try {
                this.replayInstance.stop();
            } catch {
                // Safety
            }
        }
    }

    public getInstance(): any {
        return this.replayInstance;
    }
}
