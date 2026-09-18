/**
 * Halo Trace — Open-World Repair Boundary & Ownership Discovery Engine
 *
 * Implements Phase 40 Directives 7 & 8:
 * Discovers repair boundaries via open-world invariant tracing:
 *   violated invariant
 *       ↓
 *   identify entities participating in invariant
 *       ↓
 *   trace ownership/data/control/resource relationships
 *       ↓
 *   identify possible mutation/control boundaries
 *       ↓
 *   classify discovered boundaries
 *       ↓
 *   compare candidates
 *
 * Invariants:
 * 1. Labels (CALLER, PRODUCER, CONSUMER, etc.) are communicative classifications,
 *    never a closed-world ontology. The engine can represent arbitrary custom boundaries.
 * 2. Explicitly separates "WHERE should repair happen?" from "WHAT should repair be?".
 *    Repair location determination does not generate code patches.
 */

import type { OpenRepairBoundary } from "./types";
import type { ReconstructedInvariant } from "./contract-extractor";

export interface ParticipantEntity {
    name: string;
    filePath: string;
    roleInExecution: "ORIGINATES_PAYLOAD" | "CONSUMES_PAYLOAD" | "MANAGES_RESOURCE" | "INVOKES_OPERATION" | "CONFIGURES_SYSTEM";
    canMutateState: boolean;
    holdsOwnership: boolean;
    evidenceIds: string[];
}

export interface BoundarySearchOptions {
    confirmedMechanism: string;
    violatedInvariant: ReconstructedInvariant;
    participants: ParticipantEntity[];
    isExternalOutageOrInfrastructure?: boolean;
}

export interface BoundarySearchResult {
    discoveredBoundaries: OpenRepairBoundary[];
    selectedPrimaryBoundary: OpenRepairBoundary | null;
    isAmbiguous: boolean;
    rankingRationale: string;
}

export function searchRepairBoundaries(
    opts: BoundarySearchOptions
): BoundarySearchResult {
    const { confirmedMechanism, violatedInvariant, participants, isExternalOutageOrInfrastructure } = opts;

    const discoveredBoundaries: OpenRepairBoundary[] = [];

    // If verified external outage / infrastructure failure
    if (isExternalOutageOrInfrastructure) {
        const noCodeBoundary: OpenRepairBoundary = {
            id: "boundary_no_code_change",
            entity: "Infrastructure / External System",
            entityRoleDescription: "External service or host system is unavailable; application code functions to specification.",
            discoveredVia: "RESOURCE_CONTROLLER",
            classificationTag: "NO_CODE_CHANGE",
            isCapableOfRestoringInvariant: true,
            ownershipEvidenceIds: ["ev_external_outage_verified"],
        };

        return {
            discoveredBoundaries: [noCodeBoundary],
            selectedPrimaryBoundary: noCodeBoundary,
            isAmbiguous: false,
            rankingRationale: "Issue originates in external infrastructure; application code change is inappropriate.",
        };
    }

    // Trace participating entities
    for (const p of participants) {
        let classificationTag: OpenRepairBoundary["classificationTag"] = "CUSTOM_BOUNDARY";
        let discoveredVia: OpenRepairBoundary["discoveredVia"] = "INVARIANT_PARTICIPANT";

        if (p.roleInExecution === "ORIGINATES_PAYLOAD") {
            classificationTag = "PRODUCER";
            discoveredVia = "DATA_FLOW_MUTATION";
        } else if (p.roleInExecution === "CONSUMES_PAYLOAD") {
            classificationTag = "CONSUMER";
            discoveredVia = "INVARIANT_PARTICIPANT";
        } else if (p.roleInExecution === "MANAGES_RESOURCE") {
            classificationTag = "SHARED_ABSTRACTION";
            discoveredVia = "RESOURCE_CONTROLLER";
        } else if (p.roleInExecution === "INVOKES_OPERATION") {
            classificationTag = "CALLER";
            discoveredVia = "OWNERSHIP_HANDOFF";
        } else if (p.roleInExecution === "CONFIGURES_SYSTEM") {
            classificationTag = "CONFIGURATION";
            discoveredVia = "RESOURCE_CONTROLLER";
        }

        // Determine whether this boundary is capable of restoring the violated invariant
        let canRestore = p.canMutateState;
        let eliminationRationale: string | undefined = undefined;

        if (violatedInvariant.invariantType === "NON_NULL_FIELD") {
            // If producer is responsible for non-null schema, consumer patching is symptom masking
            if (classificationTag === "CONSUMER" && participants.some((other) => other.roleInExecution === "ORIGINATES_PAYLOAD" && other.holdsOwnership)) {
                canRestore = false;
                eliminationRationale = "Patching consumer masks invalid payload produced upstream by contract owner.";
            }
        } else if (violatedInvariant.invariantType === "LIFECYCLE_CLEANUP") {
            // If boundary does not hold the lifecycle reference, it cannot release it
            if (!p.holdsOwnership && p.roleInExecution !== "MANAGES_RESOURCE") {
                canRestore = false;
                eliminationRationale = "Entity does not own resource handle or allocation lifecycle.";
            }
        }

        discoveredBoundaries.push({
            id: `boundary_${p.name}_${Date.now()}`,
            entity: p.filePath ? `${p.filePath}:${p.name}` : p.name,
            entityRoleDescription: `Participant in invariant '${violatedInvariant.formalStatement}' as ${p.roleInExecution}`,
            discoveredVia,
            classificationTag,
            isCapableOfRestoringInvariant: canRestore,
            ownershipEvidenceIds: p.evidenceIds,
            eliminationRationale,
        });
    }

    // Filter valid boundaries
    const validBoundaries = discoveredBoundaries.filter((b) => b.isCapableOfRestoringInvariant);

    if (validBoundaries.length === 0) {
        return {
            discoveredBoundaries,
            selectedPrimaryBoundary: null,
            isAmbiguous: true,
            rankingRationale: "No discovered boundary is capable of restoring the violated invariant without symptom masking.",
        };
    }

    if (validBoundaries.length === 1) {
        return {
            discoveredBoundaries,
            selectedPrimaryBoundary: validBoundaries[0],
            isAmbiguous: false,
            rankingRationale: `Uniquely verified boundary '${validBoundaries[0].entity}' (${validBoundaries[0].classificationTag}) owns the contract.`,
        };
    }

    // If multiple valid boundaries exist, check if one has direct ownership
    const ownerBoundary = validBoundaries.find((b) =>
        participants.some((p) => p.name === b.entity && p.holdsOwnership)
    );

    if (ownerBoundary) {
        return {
            discoveredBoundaries,
            selectedPrimaryBoundary: ownerBoundary,
            isAmbiguous: false,
            rankingRationale: `Selected primary boundary '${ownerBoundary.entity}' based on verified contract ownership.`,
        };
    }

    // Ambiguous ownership
    return {
        discoveredBoundaries,
        selectedPrimaryBoundary: validBoundaries[0],
        isAmbiguous: true,
        rankingRationale: `Multiple candidate boundaries (${validBoundaries.map((b) => b.entity).join(", ")}) can restore the invariant; ownership requires developer confirmation.`,
    };
}
