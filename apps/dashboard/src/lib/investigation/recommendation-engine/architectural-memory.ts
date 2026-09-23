/**
 * Halo Recommendation Engine — Architectural Memory & Systemic Prevention Reasoner
 *
 * Implements Sections 43, 44, 45, 47, 48:
 * - Structural Memory: Indexes verified repairs by execution topology, invariant pattern,
 *   and contract ownership (NEVER by raw error messages).
 * - Systemic Bug Detection: Identifies shared broken invariants across incidents.
 * - Prevention Reasoner: Clearly separates immediate executable repair from
 *   systemic preventive architectural improvements.
 */

import type {
    StructuralExperienceRecord,
    SystemicDefectRecord,
    PreventionRecommendation,
    ExplicitInvariant,
} from "./types";

export class ArchitecturalMemoryStore {
    private experiences: StructuralExperienceRecord[] = [];

    /**
     * Stores a verified repair experience by its structural fingerprint.
     * Implements Section 43 & 44: Zero error string indexing.
     */
    public recordVerifiedRepair(record: Omit<StructuralExperienceRecord, "relevanceCount">): void {
        const existing = this.experiences.find(
            (e) =>
                e.invariantPattern === record.invariantPattern &&
                e.contractOwnershipPattern === record.contractOwnershipPattern &&
                e.successfulRepairBoundary === record.successfulRepairBoundary
        );

        if (existing) {
            existing.relevanceCount += 1;
        } else {
            this.experiences.push({
                ...record,
                relevanceCount: 1,
            });
        }
    }

    /**
     * Retrieves structurally similar engineering experiences.
     * Matches by invariant pattern, causal pattern, or ownership boundary.
     */
    public findStructuralExperiences(
        invariantPattern: string,
        contractOwner: string
    ): StructuralExperienceRecord[] {
        return this.experiences.filter(
            (e) =>
                e.invariantPattern.toLowerCase().includes(invariantPattern.toLowerCase()) ||
                e.contractOwnershipPattern.toLowerCase().includes(contractOwner.toLowerCase())
        );
    }

    public getAllExperiences(): StructuralExperienceRecord[] {
        return [...this.experiences];
    }
}

export class SystemicPreventionReasoner {
    /**
     * Synthesizes an immediate repair vs systemic preventive improvement.
     * Implements Sections 47 & 48.
     */
    public reasonAboutPrevention(
        repairLocation: string,
        repairSymbol: string,
        invariant: ExplicitInvariant,
        contractOwner: string
    ): PreventionRecommendation {
        return {
            immediateRepair: `Restore invariant property forwarding in ${repairSymbol} (${repairLocation}).`,
            systemicPrevention: `Enforce contract schema validation at the request ingress boundary before reaching ${contractOwner}.`,
            architecturalEnforcementBoundary: `Gateway / RequestContext boundary`,
            preventionMechanism: "SCHEMA_VALIDATION",
        };
    }

    /**
     * Systemic Bug Detection: Evaluates whether multiple incidents share the same
     * broken invariant or contract boundary across the repository.
     * Implements Section 45.
     */
    public detectSystemicDefects(
        currentIncidentInvariant: string,
        currentContractBoundary: string,
        historicalIncidents: Array<{ invariant: string; boundary: string; occurrenceId: string }>
    ): SystemicDefectRecord[] {
        const matching = historicalIncidents.filter(
            (h) =>
                h.invariant === currentIncidentInvariant ||
                h.boundary === currentContractBoundary
        );

        if (matching.length >= 2) {
            return [
                {
                    defectClusterId: `systemic:${currentContractBoundary}`,
                    sharedBrokenInvariant: currentIncidentInvariant,
                    sharedContractBoundary: currentContractBoundary,
                    affectedOccurrencesCount: matching.length + 1,
                    systemicRecommendation: `Multiple incidents share invariant violation at ${currentContractBoundary}. Consolidate contract validation into a single upstream gate.`,
                },
            ];
        }

        return [];
    }
}
