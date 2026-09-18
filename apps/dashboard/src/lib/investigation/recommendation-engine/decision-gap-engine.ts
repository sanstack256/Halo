/**
 * Halo Trace — General Decision-Gap & Information-Frontier Engine
 *
 * Implements Phase 40 Directives 3 & 32:
 * Constructs formal DecisionGap records for unresolved decisions.
 *
 * Enforces the core engineering rule:
 * "What exact missing fact could change the repair decision?"
 * Never ask for telemetry or analysis simply because it is unavailable.
 * Only request data if it changes a material engineering decision.
 *
 * Emits machine-readable InformationFrontierAuditRecord before returning
 * EVIDENCE_ACQUISITION_REQUIRED or BLOCKED_BY_UNAVAILABLE_EVIDENCE.
 */

import type {
    DecisionGap,
    InformationFrontierAuditRecord,
    CausalHypothesis,
} from "./types";

export interface ConstructDecisionGapOptions {
    decision: string;
    currentConclusion: string;
    hypotheses: CausalHypothesis[];
    availableEvidenceIds: string[];
    contractBranchesOnArguments?: boolean;
    failingParameterOrSymbol?: string;
}

export function evaluateDecisionGaps(
    opts: ConstructDecisionGapOptions
): DecisionGap[] {
    const { decision, currentConclusion, hypotheses, availableEvidenceIds, contractBranchesOnArguments, failingParameterOrSymbol } = opts;

    const gaps: DecisionGap[] = [];

    // Identify hypotheses that are currently unconfirmed due to missing conditions
    const unconfirmedHypotheses = hypotheses.filter((h) => h.status !== "CONFIRMED" && h.status !== "CONTRADICTED");

    if (unconfirmedHypotheses.length === 0) {
        return []; // No decision gap if all hypotheses are confirmed or refuted
    }

    for (const hypo of unconfirmedHypotheses) {
        for (const condition of hypo.conditions) {
            if (condition.status === "UNKNOWN") {
                const unknownFact = condition.requiredFact;

                // Check: Does this missing fact change a material repair decision?
                const canChangeRepair = Boolean(
                    hypo.repairImplications &&
                    hypo.repairImplications.length > 0 &&
                    hypo.causalRelationships.length > 0
                );

                if (!canChangeRepair) {
                    continue; // Skip facts that do not alter the material repair decision
                }

                // Determine acquisition methods
                const acquisitionMethods: DecisionGap["acquisitionMethods"] = [];

                // 1. Static code inspection
                acquisitionMethods.push({
                    mechanismType: "STATIC_CODE_INSPECTION",
                    description: `Inspect repository AST for declarations and callers related to '${unknownFact}'.`,
                    acquisitionCost: "NEGLIGIBLE",
                    privacyRisk: "NONE",
                    operationalRisk: "NONE",
                    canExecuteAutonomously: true,
                });

                // 2. Local test execution
                acquisitionMethods.push({
                    mechanismType: "LOCAL_TEST_EXECUTION",
                    description: `Execute existing unit and integration tests covering the relevant module.`,
                    acquisitionCost: "LOW",
                    privacyRisk: "NONE",
                    operationalRisk: "NONE",
                    canExecuteAutonomously: true,
                });

                // 3. Local reproduction
                acquisitionMethods.push({
                    mechanismType: "LOCAL_REPRODUCTION",
                    description: `Attempt to trigger execution path in isolated reproduction environment.`,
                    acquisitionCost: "MEDIUM",
                    privacyRisk: "NONE",
                    operationalRisk: "NONE",
                    canExecuteAutonomously: true,
                });

                // 4. Targeted telemetry — ONLY if contract explicitly branches on arguments or runtime value
                if (contractBranchesOnArguments) {
                    acquisitionMethods.push({
                        mechanismType: "TARGETED_RUNTIME_TELEMETRY",
                        description: `Capture runtime value for '${failingParameterOrSymbol || "parameter"}' because contract branches on it.`,
                        acquisitionCost: "MEDIUM",
                        privacyRisk: "LOW_ANONYMIZED",
                        operationalRisk: "READ_ONLY",
                        canExecuteAutonomously: false,
                    });
                }

                gaps.push({
                    id: `gap_${hypo.id}_${condition.id}`,
                    decision,
                    currentConclusion,
                    unknown: unknownFact,
                    hypothesesAffected: [hypo.id],
                    evidenceCurrentlyAvailable: availableEvidenceIds,
                    evidenceCapableOfResolving: [
                        `Verified execution span matching '${unknownFact}'`,
                        `AST assertion establishing '${unknownFact}'`,
                    ],
                    acquisitionMethods,
                    expectedDecisionImpact: "CRITICAL_PATH",
                });
            }
        }
    }

    return gaps;
}

export interface BuildFrontierAuditOptions {
    decisionsEvaluated: string[];
    hypothesesEvaluated: string[];
    repositoryAreasSearched: string[];
    sourceAreasSearched: string[];
    testsInspected: string[];
    configurationInspected: string[];
    deploymentEvidenceInspected: string[];
    reproductionAttempted: boolean;
    runtimeEvidenceInspected: string[];
    acquisitionMethodsAttempted: string[];
    remainingUnknown: string;
    whyUnknownChangesRepairDecision: string;
    whyHaloCannotResolve: string;
}

export function buildInformationFrontierAuditRecord(
    opts: BuildFrontierAuditOptions
): InformationFrontierAuditRecord {
    return {
        decisionsEvaluated: opts.decisionsEvaluated,
        hypothesesEvaluated: opts.hypothesesEvaluated,
        repositoryAreasSearched: opts.repositoryAreasSearched,
        sourceAreasSearched: opts.sourceAreasSearched,
        testsInspected: opts.testsInspected,
        configurationInspected: opts.configurationInspected,
        deploymentEvidenceInspected: opts.deploymentEvidenceInspected,
        reproductionAttempted: opts.reproductionAttempted,
        runtimeEvidenceInspected: opts.runtimeEvidenceInspected,
        acquisitionMethodsAttempted: opts.acquisitionMethodsAttempted,
        remainingUnknown: opts.remainingUnknown,
        whyUnknownChangesRepairDecision: opts.whyUnknownChangesRepairDecision,
        whyHaloCannotResolve: opts.whyHaloCannotResolve,
    };
}
