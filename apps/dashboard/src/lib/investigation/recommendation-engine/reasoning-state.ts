/**
 * Halo Recommendation Engine — Versioned Reasoning State & Claim Dependency Graph
 *
 * Implements Sections 5, 6, 7, 8, 22, 23, 24, 25, 52:
 * - Versioned reasoning state R0..R10
 * - Directed Claim Dependency Graph with recursive cascading invalidation
 * - Competing hypothesis generation, required conditions & elimination
 * - "Why is this wrong?" recursion
 * - "What would change the decision?" tracking
 */

import type {
    EngineeringReasoningState,
    ReasoningStateVersion,
    Claim,
    ClaimDependencyGraph,
    ClaimType,
    ClaimStatus,
    HypothesisElimination,
} from "./types";

export class ClaimGraphManager {
    private claims: Record<string, Claim> = {};
    private dependencies: Record<string, string[]> = {}; // parentClaimId -> childClaimIds

    constructor(initialGraph?: ClaimDependencyGraph) {
        if (initialGraph) {
            this.claims = { ...initialGraph.claims };
            this.dependencies = { ...initialGraph.dependencies };
        }
    }

    public addClaim(claim: Omit<Claim, "createdAt"> & { createdAt?: Date }): Claim {
        const fullClaim: Claim = {
            ...claim,
            createdAt: claim.createdAt || new Date(),
        };
        this.claims[fullClaim.claimId] = fullClaim;

        if (!this.dependencies[fullClaim.claimId]) {
            this.dependencies[fullClaim.claimId] = [];
        }

        // Register reverse dependency: each parent in reasoningRefs has this claim as child
        for (const parentId of fullClaim.reasoningRefs) {
            if (!this.dependencies[parentId]) {
                this.dependencies[parentId] = [];
            }
            if (!this.dependencies[parentId].includes(fullClaim.claimId)) {
                this.dependencies[parentId].push(fullClaim.claimId);
            }
        }

        return fullClaim;
    }

    public getClaim(claimId: string): Claim | undefined {
        return this.claims[claimId];
    }

    public getAllClaims(): Claim[] {
        return Object.values(this.claims);
    }

    public getActiveClaims(): Claim[] {
        return Object.values(this.claims).filter((c) => c.status === "SUPPORTED");
    }

    public getClaimsByType(type: ClaimType): Claim[] {
        return Object.values(this.claims).filter((c) => c.type === type);
    }

    /**
     * Recursively invalidates a claim and all downstream dependent claims.
     * Implements Section 8: Claim Dependencies & Cascading Invalidation.
     */
    public invalidateClaim(claimId: string, reason: string): string[] {
        const target = this.claims[claimId];
        if (!target) return [];

        const invalidatedIds: string[] = [];
        const queue: string[] = [claimId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const claim = this.claims[currentId];
            if (claim && claim.status !== "INVALIDATED") {
                claim.status = "INVALIDATED";
                claim.invalidatedAt = new Date();
                claim.invalidationReason = currentId === claimId ? reason : `Cascading invalidation from upstream claim ${claimId}`;
                invalidatedIds.push(currentId);
            }

            // Enqueue all dependent children
            const children = this.dependencies[currentId] || [];
            for (const childId of children) {
                if (!visited.has(childId)) {
                    queue.push(childId);
                }
            }
        }

        return invalidatedIds;
    }

    public toGraph(): ClaimDependencyGraph {
        return {
            claims: { ...this.claims },
            dependencies: { ...this.dependencies },
        };
    }
}

export class ReasoningStateManager {
    private state: EngineeringReasoningState;
    private claimManager: ClaimGraphManager;

    constructor(initialVersion: ReasoningStateVersion = "R0") {
        this.claimManager = new ClaimGraphManager();
        this.state = {
            version: initialVersion,
            versionHistory: [
                {
                    version: initialVersion,
                    transitionReason: "Initial reasoning state created from evidence snapshot",
                    timestamp: new Date(),
                },
            ],
            claims: this.claimManager.toGraph(),
            hypotheses: [],
            whyRecursion: [],
            decisionChangingConditions: [],
        };
    }

    public get currentVersion(): ReasoningStateVersion {
        return this.state.version;
    }

    public get claims(): ClaimGraphManager {
        return this.claimManager;
    }

    public transition(nextVersion: ReasoningStateVersion, reason: string): this {
        this.state.version = nextVersion;
        this.state.versionHistory.push({
            version: nextVersion,
            transitionReason: reason,
            timestamp: new Date(),
        });
        this.state.claims = this.claimManager.toGraph();
        return this;
    }

    public addHypothesis(hypothesis: HypothesisElimination): this {
        this.state.hypotheses.push(hypothesis);
        return this;
    }

    public evaluateHypothesis(
        hypothesisId: string,
        evaluation: {
            supportingEvidence?: string[];
            contradictingEvidence?: string[];
            missingConditions?: string[];
            status?: HypothesisElimination["status"];
            eliminationReason?: string;
        }
    ): this {
        const hyp = this.state.hypotheses.find((h) => h.hypothesisId === hypothesisId);
        if (!hyp) return this;

        if (evaluation.supportingEvidence) {
            hyp.supportingEvidence = Array.from(new Set([...hyp.supportingEvidence, ...evaluation.supportingEvidence]));
        }
        if (evaluation.contradictingEvidence) {
            hyp.contradictingEvidence = Array.from(new Set([...hyp.contradictingEvidence, ...evaluation.contradictingEvidence]));
        }
        if (evaluation.eliminationReason) {
            hyp.eliminationReason = evaluation.eliminationReason;
        }

        if (evaluation.status) {
            hyp.status = evaluation.status;
        } else {
            // Compute status from evidence balance
            if (hyp.contradictingEvidence.length > 0) {
                hyp.status = "CONTRADICTED";
            } else if (evaluation.missingConditions && evaluation.missingConditions.length > 0) {
                hyp.status = "WEAK";
            } else if (hyp.supportingEvidence.length >= 2) {
                hyp.status = "CONFIRMED";
            } else if (hyp.supportingEvidence.length === 1) {
                hyp.status = "SUPPORTED";
            } else {
                hyp.status = "UNKNOWN";
            }
        }

        return this;
    }

    public recordWhyRecursion(level: number, question: string, answer: string, contractOwner?: string): this {
        this.state.whyRecursion.push({ level, question, answer, contractOwner });
        return this;
    }

    public addDecisionChangingCondition(condition: string): this {
        if (!this.state.decisionChangingConditions.includes(condition)) {
            this.state.decisionChangingConditions.push(condition);
        }
        return this;
    }

    public getState(): EngineeringReasoningState {
        this.state.claims = this.claimManager.toGraph();
        return this.state;
    }
}
