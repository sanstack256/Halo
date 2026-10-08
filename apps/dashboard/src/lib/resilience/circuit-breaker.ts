/**
 * Circuit Breaker Pattern & Resilience Mechanism for Halo Trace.
 *
 * Implements graceful degradation and fast-failing for external dependencies
 * (Git providers, replay blob stores, metrics aggregators, external webhooks)
 * to prevent cascaded failures and thread pool starvation.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
    name: string;
    failureThreshold?: number; // consecutive failures to trip
    cooldownMs?: number; // time to stay in OPEN before attempting HALF_OPEN
    halfOpenSuccessCount?: number; // successful calls in HALF_OPEN to reset to CLOSED
}

export class CircuitBreaker {
    public readonly name: string;
    private failureThreshold: number;
    private cooldownMs: number;
    private halfOpenSuccessCount: number;

    private state: CircuitState = "CLOSED";
    private consecutiveFailures = 0;
    private consecutiveSuccesses = 0;
    private nextAttemptTimestamp = 0;

    constructor(options: CircuitBreakerOptions) {
        this.name = options.name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.cooldownMs = options.cooldownMs ?? 10000;
        this.halfOpenSuccessCount = options.halfOpenSuccessCount ?? 2;
    }

    public getState(): CircuitState {
        if (this.state === "OPEN" && Date.now() >= this.nextAttemptTimestamp) {
            this.state = "HALF_OPEN";
            this.consecutiveSuccesses = 0;
        }
        return this.state;
    }

    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        const currentState = this.getState();

        if (currentState === "OPEN") {
            throw new Error(
                `[CircuitBreaker: ${this.name}] Circuit is OPEN. Failing fast to prevent cascade.`
            );
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        if (this.state === "HALF_OPEN") {
            this.consecutiveSuccesses++;
            if (this.consecutiveSuccesses >= this.halfOpenSuccessCount) {
                this.reset();
            }
        } else if (this.state === "CLOSED") {
            this.consecutiveFailures = 0;
        }
    }

    private onFailure(): void {
        this.consecutiveFailures++;
        if (this.state === "HALF_OPEN" || this.consecutiveFailures >= this.failureThreshold) {
            this.trip();
        }
    }

    public trip(): void {
        this.state = "OPEN";
        this.nextAttemptTimestamp = Date.now() + this.cooldownMs;
    }

    public reset(): void {
        this.state = "CLOSED";
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.nextAttemptTimestamp = 0;
    }

    public getStatus() {
        return {
            name: this.name,
            state: this.getState(),
            consecutiveFailures: this.consecutiveFailures,
            consecutiveSuccesses: this.consecutiveSuccesses,
            cooldownMs: this.cooldownMs,
            failureThreshold: this.failureThreshold,
        };
    }
}

/**
 * Execute an operation protected by a circuit breaker, with an optional fallback.
 */
export async function withCircuitBreaker<T>(
    breaker: CircuitBreaker,
    fn: () => Promise<T>,
    fallback?: (error: any) => T | Promise<T>
): Promise<T> {
    try {
        return await breaker.execute(fn);
    } catch (error) {
        if (fallback) {
            return await fallback(error);
        }
        throw error;
    }
}

/**
 * Central registry of circuit breakers across subsystems.
 */
class BreakerRegistry {
    private breakers = new Map<string, CircuitBreaker>();

    constructor() {
        // Register default platform breakers
        this.register("db-query", { failureThreshold: 5, cooldownMs: 10000 });
        this.register("git-provider", { failureThreshold: 3, cooldownMs: 15000 });
        this.register("replay-storage", { failureThreshold: 4, cooldownMs: 20000 });
        this.register("telemetry-stream", { failureThreshold: 5, cooldownMs: 5000 });
    }

    public register(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
        if (this.breakers.has(name)) {
            return this.breakers.get(name)!;
        }
        const breaker = new CircuitBreaker({ name, ...options });
        this.breakers.set(name, breaker);
        return breaker;
    }

    public getBreaker(name: string): CircuitBreaker | undefined {
        return this.breakers.get(name);
    }

    public getAllStatuses() {
        return Array.from(this.breakers.values()).map((b) => b.getStatus());
    }
}

export const ResilienceRegistry = new BreakerRegistry();
