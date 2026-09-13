import type { HaloUser } from "@halo-trace/sdk-types";

export interface SamplingContext {
    user?: HaloUser;
    url?: string;
    route?: string;
    featureFlags?: Record<string, boolean | string>;
}

export class SamplingEngine {
    private readonly sessionRate: number;
    private readonly traceRate: number;
    private readonly predicate?: (ctx: SamplingContext) => boolean;

    constructor(options?: {
        samplingRate?: number;
        tracesSampleRate?: number;
        targetPredicate?: (ctx: SamplingContext) => boolean;
    }) {
        this.sessionRate = typeof options?.samplingRate === "number" ? Math.max(0, Math.min(1, options.samplingRate)) : 1.0;
        this.traceRate = typeof options?.tracesSampleRate === "number" ? Math.max(0, Math.min(1, options.tracesSampleRate)) : 1.0;
        this.predicate = options?.targetPredicate;
    }

    public shouldSampleSession(context?: SamplingContext): boolean {
        if (this.predicate && context) {
            try {
                if (!this.predicate(context)) {
                    return false;
                }
            } catch {
                // If user predicate throws, fail closed to avoid unwanted recording
                return false;
            }
        }

        if (this.sessionRate >= 1.0) return true;
        if (this.sessionRate <= 0.0) return false;
        return Math.random() < this.sessionRate;
    }

    public shouldSampleTrace(): boolean {
        if (this.traceRate >= 1.0) return true;
        if (this.traceRate <= 0.0) return false;
        return Math.random() < this.traceRate;
    }
}
