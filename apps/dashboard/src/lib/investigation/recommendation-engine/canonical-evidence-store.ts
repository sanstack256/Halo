/**
 * Halo Trace — Canonical Evidence Store & Relationship Graph
 *
 * Implements Phase 3, Phase 4, Phase 5, Phase 6, and Phase 7:
 * - Rule 0.6: "Collect Once, Canonicalize Once, Store Once, Reference Everywhere"
 * - Stable deterministic evidence identity:
 *     runtime-event:<id>
 *     stack-frame:<file>:<line>:<col>
 *     source-snapshot:<repoRevision>:<filePath>
 *     ast-symbol:<filePath>:<symbolName>
 *     git-commit:<sha>
 *     release:<version>
 *     deployment:<id>
 *     trace:<traceId>
 *     span:<spanId>
 *     replay:<sessionId>
 *     test-exec:<testId>:<timestamp>
 *     config:<hash>
 * - Single source of truth: No downstream component may recollect existing evidence.
 * - Directed Evidence Relationship Graph linking all evidence nodes.
 */

import crypto from "crypto";

export type EvidenceKind =
    | "RUNTIME_EVENT"
    | "ERROR_OCCURRENCE"
    | "STACK_FRAME"
    | "SOURCE_SNAPSHOT"
    | "AST_STRUCTURE"
    | "GIT_COMMIT"
    | "RELEASE_DEPLOYMENT"
    | "REPLAY_SESSION"
    | "TEST_EXECUTION"
    | "METRIC_BUCKET"
    | "CONFIGURATION_SNAPSHOT"
    | "ACTIVE_PROBE_RESULT"
    | "DERIVED_FINDING";

export interface CanonicalEvidenceRecord<T = unknown> {
    id: string;
    kind: EvidenceKind;
    source: string;
    collectedAt: Date;
    observedAt?: Date;
    snapshotId: string;
    provenance: {
        method: "INGEST" | "STATIC_ANALYSIS" | "GIT_API" | "EXECUTION_HARNESS" | "ACTIVE_PROBE" | "DERIVATION";
        origin: string;
        redacted: boolean;
    };
    content: T;
}

export type EvidenceRelationType =
    | "observedDuring"     // error -> span
    | "executed"           // span -> stackFrame
    | "locatedAt"          // stackFrame -> sourceSnapshot
    | "contains"           // sourceSnapshot -> astSymbol
    | "calls"              // astSymbol -> astSymbol
    | "produces"           // astSymbol -> value
    | "consumes"           // astSymbol -> value
    | "modified"           // gitCommit -> sourceSnapshot
    | "includesRelease"    // release -> gitCommit
    | "deployed"           // deployment -> release
    | "verifies"           // testExecution -> astSymbol
    | "correlatesWith"     // metric -> error
    | "replaysExecution";  // replaySession -> error

export interface EvidenceRelationship {
    fromId: string;
    relation: EvidenceRelationType;
    toId: string;
    confidence: "CONFIRMED" | "SUPPORTED" | "PLAUSIBLE";
    metadata?: Record<string, unknown>;
}

export interface EvidenceGraphNode {
    id: string;
    kind: EvidenceKind;
    label: string;
}

export interface CanonicalEvidenceGraph {
    nodes: EvidenceGraphNode[];
    edges: EvidenceRelationship[];
}

/**
 * Deterministic Stable Evidence Identity Generator
 */
export function getCanonicalEvidenceId(kind: EvidenceKind, key: string): string {
    const sanitizedKey = String(key || "unknown").trim().replace(/\s+/g, "_");
    switch (kind) {
        case "RUNTIME_EVENT":
            return `runtime-event:${sanitizedKey}`;
        case "ERROR_OCCURRENCE":
            return `error:${sanitizedKey}`;
        case "STACK_FRAME":
            return `stack-frame:${sanitizedKey}`;
        case "SOURCE_SNAPSHOT":
            return `source-snapshot:${sanitizedKey}`;
        case "AST_STRUCTURE":
            return `ast-symbol:${sanitizedKey}`;
        case "GIT_COMMIT":
            return `git-commit:${sanitizedKey}`;
        case "RELEASE_DEPLOYMENT":
            return `release:${sanitizedKey}`;
        case "REPLAY_SESSION":
            return `replay:${sanitizedKey}`;
        case "TEST_EXECUTION":
            return `test-exec:${sanitizedKey}`;
        case "METRIC_BUCKET":
            return `metric:${sanitizedKey}`;
        case "CONFIGURATION_SNAPSHOT":
            return `config:${sanitizedKey}`;
        case "ACTIVE_PROBE_RESULT":
            return `probe:${sanitizedKey}`;
        case "DERIVED_FINDING":
            return `finding:${sanitizedKey}`;
        default:
            return `evidence:${kind}:${sanitizedKey}`;
    }
}

/**
 * Canonical Evidence Store
 *
 * Implements the single collection point and in-memory registry for an investigation snapshot.
 * Guarantees zero duplicate queries or recollection.
 */
export class CanonicalEvidenceStore {
    private records: Map<string, CanonicalEvidenceRecord> = new Map();
    private relationships: EvidenceRelationship[] = [];
    public readonly snapshotId: string;
    public readonly createdAt: Date;
    public readonly projectId: string;
    public readonly issueId: string;

    constructor(projectId: string, issueId: string, snapshotId?: string) {
        this.projectId = projectId;
        this.issueId = issueId;
        this.createdAt = new Date();
        this.snapshotId = snapshotId || `snap_${crypto.randomBytes(8).toString("hex")}`;
    }

    /**
     * Check if evidence already exists in the store.
     */
    public has(id: string): boolean {
        return this.records.has(id);
    }

    /**
     * Retrieve an existing evidence record.
     */
    public get<T = unknown>(id: string): CanonicalEvidenceRecord<T> | undefined {
        return this.records.get(id) as CanonicalEvidenceRecord<T> | undefined;
    }

    /**
     * Register a newly collected piece of evidence.
     * Enforces that the same ID cannot be silently overwritten with diverging data.
     */
    public register<T>(record: Omit<CanonicalEvidenceRecord<T>, "snapshotId">): CanonicalEvidenceRecord<T> {
        if (this.records.has(record.id)) {
            // Return existing canonical copy — zero duplicate persistence
            return this.records.get(record.id) as CanonicalEvidenceRecord<T>;
        }

        const canonical: CanonicalEvidenceRecord<T> = {
            ...record,
            snapshotId: this.snapshotId,
        };

        this.records.set(canonical.id, canonical as CanonicalEvidenceRecord);
        return canonical;
    }

    /**
     * "Collect Once" primitive:
     * If the evidence exists, return it immediately.
     * If not, invoke collector once, store once, return canonical record.
     */
    public async getOrCreate<T>(
        kind: EvidenceKind,
        key: string,
        collector: () => Promise<{
            source: string;
            observedAt?: Date;
            provenance: CanonicalEvidenceRecord["provenance"];
            content: T;
        }>
    ): Promise<CanonicalEvidenceRecord<T>> {
        const id = getCanonicalEvidenceId(kind, key);
        const existing = this.records.get(id);
        if (existing) {
            return existing as CanonicalEvidenceRecord<T>;
        }

        const collected = await collector();
        return this.register<T>({
            id,
            kind,
            source: collected.source,
            collectedAt: new Date(),
            observedAt: collected.observedAt,
            provenance: collected.provenance,
            content: collected.content,
        });
    }

    /**
     * Synchronous variant of getOrCreate for in-memory / parsed representations.
     */
    public getOrCreateSync<T>(
        kind: EvidenceKind,
        key: string,
        collector: () => {
            source: string;
            observedAt?: Date;
            provenance: CanonicalEvidenceRecord["provenance"];
            content: T;
        }
    ): CanonicalEvidenceRecord<T> {
        const id = getCanonicalEvidenceId(kind, key);
        const existing = this.records.get(id);
        if (existing) {
            return existing as CanonicalEvidenceRecord<T>;
        }

        const collected = collector();
        return this.register<T>({
            id,
            kind,
            source: collected.source,
            collectedAt: new Date(),
            observedAt: collected.observedAt,
            provenance: collected.provenance,
            content: collected.content,
        });
    }

    /**
     * Add a directed relationship between two evidence records.
     */
    public addRelationship(rel: EvidenceRelationship): void {
        const exists = this.relationships.some(
            (r) => r.fromId === rel.fromId && r.relation === rel.relation && r.toId === rel.toId
        );
        if (!exists) {
            this.relationships.push(rel);
        }
    }

    /**
     * Retrieve all evidence records.
     */
    public getAllRecords(): CanonicalEvidenceRecord[] {
        return Array.from(this.records.values());
    }

    /**
     * Retrieve all records of a specific kind.
     */
    public getRecordsByKind(kind: EvidenceKind): CanonicalEvidenceRecord[] {
        return this.getAllRecords().filter((r) => r.kind === kind);
    }

    /**
     * Retrieve all relationships.
     */
    public getAllRelationships(): EvidenceRelationship[] {
        return [...this.relationships];
    }

    /**
     * Construct the full Directed Evidence Graph.
     */
    public buildGraph(): CanonicalEvidenceGraph {
        const nodes: EvidenceGraphNode[] = Array.from(this.records.values()).map((r) => ({
            id: r.id,
            kind: r.kind,
            label: `${r.kind}: ${r.id.split(":").slice(1).join(":")}`,
        }));

        return {
            nodes,
            edges: [...this.relationships],
        };
    }

    /**
     * Computes an immutable content hash of this evidence store.
     */
    public computeHash(): string {
        const keys = Array.from(this.records.keys()).sort();
        const contentStr = keys.map((k) => `${k}:${JSON.stringify(this.records.get(k)?.content)}`).join("|");
        return crypto.createHash("sha256").update(contentStr).digest("hex").slice(0, 16);
    }

    /**
     * Export complete store for serialization or snapshot immutability.
     */
    public toJSON() {
        return {
            snapshotId: this.snapshotId,
            projectId: this.projectId,
            issueId: this.issueId,
            createdAt: this.createdAt.toISOString(),
            hash: this.computeHash(),
            records: Array.from(this.records.entries()),
            relationships: this.relationships,
        };
    }

    /**
     * Hydrate a CanonicalEvidenceStore from serialized state.
     */
    public static fromJSON(json: any): CanonicalEvidenceStore {
        const store = new CanonicalEvidenceStore(json.projectId, json.issueId, json.snapshotId);
        if (Array.isArray(json.records)) {
            for (const [id, rec] of json.records) {
                store.records.set(id, {
                    ...rec,
                    collectedAt: new Date(rec.collectedAt),
                    observedAt: rec.observedAt ? new Date(rec.observedAt) : undefined,
                });
            }
        }
        if (Array.isArray(json.relationships)) {
            store.relationships.push(...json.relationships);
        }
        return store;
    }
}
