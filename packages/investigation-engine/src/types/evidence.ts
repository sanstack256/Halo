export type EvidenceType =
    | "ERROR"
    | "LOG"
    | "TRACE"
    | "METRIC"
    | "DEPLOYMENT"
    | "COMMIT"
    | "CONFIG"
    | "FEATURE_FLAG"
    | "INFRASTRUCTURE"
    | "THIRD_PARTY";

export interface Evidence {
    /**
     * Stable identifier for this individual observation.
     */
    id: string;

    /**
     * What kind of production evidence this is.
     */
    type: EvidenceType;

    /**
     * When the event actually occurred.
     */
    timestamp: Date;

    /**
     * System that supplied the evidence.
     *
     * Examples:
     * - halo-sdk
     * - github
     * - kubernetes
     * - sentry
     * - postgres
     */
    source: string;

    /**
     * Service associated with the evidence.
     *
     * Kept as a required field for now so the MVP
     * can reason across services consistently.
     */
    service: string;

    /**
     * Human-readable name of the observation.
     */
    title: string;

    /**
     * Additional human-readable detail.
     */
    description?: string;

    /**
     * Deployment/release identifier associated with the evidence.
     */
    release?: string;

    /**
     * Source-control commit associated with the evidence.
     */
    commit?: string;

    /**
     * Runtime environment.
     *
     * Examples:
     * - production
     * - staging
     * - development
     */
    environment?: string;

    /**
     * Distributed tracing identifiers.
     */
    traceId?: string;

    spanId?: string;

    parentSpanId?: string;

    /**
     * Identifier used to connect related requests
     * across services when available.
     */
    requestId?: string;

    /**
     * Logical operation associated with the evidence.
     *
     * Examples:
     * - GET /checkout
     * - payment.process
     * - database.query
     */
    operation?: string;

    /**
     * Resource involved in the observation.
     *
     * Examples:
     * - postgres-primary
     * - /api/checkout
     * - payment-service
     * - checkout-db
     */
    resource?: string;

    /**
     * Duration associated with the observation.
     *
     * Useful for traces, requests, database operations,
     * and latency-related investigation.
     */
    durationMs?: number;

    /**
     * Numeric measurement when the evidence represents
     * a measurable value.
     *
     * Examples:
     * - error rate
     * - latency
     * - CPU utilization
     * - connection count
     */
    value?: number;

    /**
     * Status associated with the observation.
     *
     * Examples:
     * - 200
     * - 500
     * - timeout
     * - failed
     * - success
     */
    status?: string | number;

    /**
     * Searchable categorical dimensions.
     */
    tags?: Record<string, string>;

    /**
     * Original structured data supplied by the source.
     *
     * This preserves information that the normalized model
     * does not explicitly understand yet.
     */
    metadata: Record<string, unknown>;
}