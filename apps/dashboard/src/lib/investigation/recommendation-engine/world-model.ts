/**
 * Halo Recommendation Engine — Engineering World Model
 *
 * Implements Sections 3 & 4:
 * The recommendation engine's internal representation of the software system:
 * - services, modules, symbols, functions, classes, resources, tests, commits
 * - call graph, data flow, value flow, resource flow, contract graph, causal relations
 *
 * All relationships are derived from canonical evidence records and reference canonical evidence IDs.
 */

import type {
    InvestigationSnapshot,
    EngineeringWorldModel,
    EngineeringWorldNode,
    EngineeringWorldEdge,
} from "./types";
import { CanonicalEvidenceStore } from "./canonical-evidence-store";

export class EngineeringWorldModelBuilder {
    private nodes = new Map<string, EngineeringWorldNode>();
    private edges: EngineeringWorldEdge[] = [];
    private snapshotId: string;

    constructor(snapshotId: string) {
        this.snapshotId = snapshotId;
    }

    public addNode(node: EngineeringWorldNode): this {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
        }
        return this;
    }

    public addEdge(edge: EngineeringWorldEdge): this {
        // Prevent duplicate exact edges
        const exists = this.edges.some(
            (e) =>
                e.sourceId === edge.sourceId &&
                e.targetId === edge.targetId &&
                e.relation === edge.relation
        );
        if (!exists) {
            this.edges.push(edge);
        }
        return this;
    }

    public build(): EngineeringWorldModel {
        return {
            id: `world-model:${this.snapshotId}`,
            snapshotId: this.snapshotId,
            nodes: this.nodes,
            edges: this.edges,
            createdAt: new Date(),
        };
    }
}

/**
 * Builds the EngineeringWorldModel from an InvestigationSnapshot and its CanonicalEvidenceStore.
 */
export function buildEngineeringWorldModel(
    snapshot: InvestigationSnapshot,
    evidenceStore?: CanonicalEvidenceStore
): EngineeringWorldModel {
    const builder = new EngineeringWorldModelBuilder(snapshot.snapshotId);
    const store =
        evidenceStore ||
        ((snapshot as any).evidenceStore as CanonicalEvidenceStore | undefined) ||
        ((snapshot as any).canonicalEvidenceStore as CanonicalEvidenceStore | undefined);

    // 1. Index services and modules from snapshot
    const serviceName = snapshot.incident?.service || (snapshot as any).serviceName;
    if (serviceName) {
        const serviceNodeId = `service:${serviceName}`;
        builder.addNode({
            id: serviceNodeId,
            type: "SERVICE",
            name: serviceName,
            metadata: { environment: snapshot.incident?.environment || (snapshot as any).environment },
        });
    }

    // 2. Index stack trace frames & symbols
    const rawFrames =
        snapshot.failure?.frames && snapshot.failure.frames.length > 0
            ? snapshot.failure.frames
            : (snapshot as any).stackTrace?.frames || [];
    const frames: Array<{ file: string; line: number; method: string }> = rawFrames.map((f: any) => ({
        file: f.filePath || f.file || "unknown",
        line: f.lineNumber || f.line || 0,
        method: f.functionName || f.method || "anonymous",
    }));
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const fileNodeId = `file:${frame.file}`;
        builder.addNode({
            id: fileNodeId,
            type: "FILE",
            name: frame.file,
            filePath: frame.file,
        });

        const symbolNodeId = `symbol:${frame.file}:${frame.method || `line_${frame.line}`}`;
        builder.addNode({
            id: symbolNodeId,
            type: "FUNCTION",
            name: frame.method || `anonymous@${frame.line}`,
            filePath: frame.file,
            lineNumber: frame.line,
        });

        // Edge: File contains symbol
        builder.addEdge({
            sourceId: fileNodeId,
            targetId: symbolNodeId,
            relation: "DEPENDS_ON",
        });

        // Edge: Call chain between stack frames
        if (i < frames.length - 1) {
            const nextFrame = frames[i + 1];
            const nextSymbolNodeId = `symbol:${nextFrame.file}:${nextFrame.method || `line_${nextFrame.line}`}`;
            builder.addEdge({
                sourceId: nextSymbolNodeId,
                targetId: symbolNodeId,
                relation: "CALLS",
                metadata: { callDepth: i },
            });
        }
    }

    // 3. Index Git Commits & Modified Files
    const recentCommits = (snapshot.release?.candidates || (snapshot as any).gitCommits || []) as any[];
    for (const commit of recentCommits) {
        const commitNodeId = `commit:${commit.sha || commit.commitSha || commit.id}`;
        builder.addNode({
            id: commitNodeId,
            type: "COMMIT",
            name: commit.message || commit.title || commit.sha || commit.commitSha,
            metadata: { author: commit.author, timestamp: commit.timestamp || commit.commitDate },
        });

        const modifiedFiles = commit.modifiedFiles || commit.changedFiles || commit.files || [];
        for (const file of modifiedFiles) {
            const fileNodeId = `file:${file}`;
            builder.addNode({
                id: fileNodeId,
                type: "FILE",
                name: file,
                filePath: file,
            });

            builder.addEdge({
                sourceId: commitNodeId,
                targetId: fileNodeId,
                relation: "MODIFIES",
                metadata: { commitSha: commit.sha },
            });
        }
    }

    // 4. Index AST & Symbol Graph if available in store
    if (store) {
        const records = store.getAllRecords();
        for (const record of records) {
            if (record.kind === "AST_STRUCTURE" && typeof record.content === "object" && record.content !== null) {
                const astContent = record.content as any;
                if (astContent.symbols && Array.isArray(astContent.symbols)) {
                    for (const sym of astContent.symbols) {
                        const symNodeId = `ast-symbol:${astContent.filePath || "unknown"}:${sym.name}`;
                        builder.addNode({
                            id: symNodeId,
                            type: sym.kind === "class" ? "CLASS" : "FUNCTION",
                            name: sym.name,
                            filePath: astContent.filePath,
                            lineNumber: sym.line,
                        });
                    }
                }
            } else if (record.kind === "TEST_EXECUTION" && typeof record.content === "object" && record.content !== null) {
                const testContent = record.content as any;
                const testNodeId = `test:${testContent.name || record.id}`;
                builder.addNode({
                    id: testNodeId,
                    type: "TEST",
                    name: testContent.name || "TestExecution",
                    filePath: testContent.file,
                });
            }
        }

        // Incorporate canonical relationship edges
        const relEdges = store.getAllRelationships();
        for (const rel of relEdges) {
            let mappedRelation: EngineeringWorldEdge["relation"] = "DEPENDS_ON";
            switch (rel.relation) {
                case "calls":
                    mappedRelation = "CALLS";
                    break;
                case "produces":
                    mappedRelation = "PRODUCES";
                    break;
                case "consumes":
                    mappedRelation = "CONSUMES";
                    break;
                case "modified":
                    mappedRelation = "MODIFIES";
                    break;
                case "verifies":
                    mappedRelation = "VERIFIES";
                    break;
            }
            builder.addEdge({
                sourceId: rel.fromId,
                targetId: rel.toId,
                relation: mappedRelation,
            });
        }
    }

    return builder.build();
}

/**
 * World Model Query Utilities
 */
export function queryWorldModelSummary(world: EngineeringWorldModel): {
    servicesCount: number;
    symbolsCount: number;
    edgesCount: number;
} {
    const nodes = world.nodes instanceof Map ? Array.from(world.nodes.values()) : Object.values(world.nodes);
    const servicesCount = nodes.filter((n) => n.type === "SERVICE").length;
    const symbolsCount = nodes.filter((n) => n.type === "FUNCTION" || n.type === "CLASS" || n.type === "VARIABLE").length;

    return {
        servicesCount,
        symbolsCount,
        edgesCount: world.edges.length,
    };
}
