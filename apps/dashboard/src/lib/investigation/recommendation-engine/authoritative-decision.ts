/**
 * Halo Recommendation Engine — Authoritative Engineering Decision Object Builder
 *
 * Implements Phase 2:
 * Consolidates all reasoning into a single authoritative structured decision object
 * (AuthoritativeEngineeringDecision) encompassing:
 *  - failure location and expression
 *  - mechanism, causality, invariant, ownership, repairBoundary
 *  - candidates, selectedCandidate
 *  - regression analysis (associations, relevance, rollback audit, superiority)
 *  - evidence (supporting, contradicting, missing, stale)
 *  - decisionGap, acquisitionPlan
 *  - proofs (diagnosisProof, repairProof, behavioralProof)
 *  - validation, consequences, uncertainty, finalState
 *  - decomposedConfidence, repairEquivalence, provenance
 *
 * This authoritative object is the SOLE source of truth for downstream modules:
 * prompt builder, fact-checker, decision gates, and UI presentation.
 */

import type {
    InvestigationSnapshot,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    CandidateAction,
    ReleaseRegressionContext,
    DecisionGap,
    EvidenceAcquisitionLifecycleRecord,
    DiagnosisProof,
    RepairProof,
    BehavioralProof,
    ConsequenceAnalysisRecord,
    DecomposedConfidence,
    FormalRecommendationState,
    RepairEquivalenceRecord,
    ClaimProvenance,
    AuthoritativeEngineeringDecision,
    FailureLocationStatus,
    SeparatedLocations,
    FirstDivergenceRecord,
    ValueOriginChain,
    ExplicitInvariant,
    SeniorEngineerAnalysis,
    AdversarialChallengeRecord,
    PreventionRecommendation,
    SystemicDefectRecord,
} from "./types";
import type { CausalRegressionGateVerdict } from "./causal-regression-gate";

export interface BuildAuthoritativeDecisionParams {
    snapshot: InvestigationSnapshot;
    causalState: CausalEpistemicState;
    repairLocation: DeterminedRepairLocation;
    evidenceSufficiency: EvidenceSufficiencyEvaluation;
    candidateActions: CandidateAction[];
    selectedCandidate?: CandidateAction;
    regressionContext: ReleaseRegressionContext;
    gateVerdict?: CausalRegressionGateVerdict;
    decisionGap?: DecisionGap;
    acquisitionPlan?: EvidenceAcquisitionLifecycleRecord | any;
    diagnosisProof?: DiagnosisProof;
    repairProof?: RepairProof;
    behavioralProof?: BehavioralProof;
    validation?: {
        steps: string[];
        isExecuted: boolean;
        isCleanPass: boolean;
    };
    consequences?: ConsequenceAnalysisRecord;
    uncertainty?: string[];
    finalState: FormalRecommendationState;
    decomposedConfidence: DecomposedConfidence;
    repairEquivalence?: RepairEquivalenceRecord;
    provenance?: ClaimProvenance[];
    // 10000/10 Reasoning Core additions
    worldModelSummary?: {
        servicesCount: number;
        symbolsCount: number;
        edgesCount: number;
    };
    reasoningVersion?: string;
    reasoningHistory?: Array<{ version: string; reason: string; timestamp: string }>;
    claimGraphSummary?: {
        totalClaims: number;
        supportedClaims: number;
        invalidatedClaims: number;
    };
    firstDivergence?: FirstDivergenceRecord;
    valueOriginChain?: ValueOriginChain;
    explicitInvariant?: ExplicitInvariant;
    seniorEngineerAnalysis?: SeniorEngineerAnalysis;
    adversarialChallenge?: AdversarialChallengeRecord;
    preventionRecommendation?: PreventionRecommendation;
    systemicDefects?: SystemicDefectRecord[];
}

export function buildAuthoritativeEngineeringDecision(
    params: BuildAuthoritativeDecisionParams
): AuthoritativeEngineeringDecision {
    const {
        snapshot,
        causalState,
        repairLocation,
        evidenceSufficiency,
        candidateActions,
        selectedCandidate,
        regressionContext,
        gateVerdict,
        decisionGap,
        acquisitionPlan,
        diagnosisProof,
        repairProof,
        behavioralProof,
        validation,
        consequences,
        uncertainty = [],
        finalState,
        decomposedConfidence,
        repairEquivalence,
        provenance = [],
        worldModelSummary,
        reasoningVersion,
        reasoningHistory,
        claimGraphSummary,
        firstDivergence,
        valueOriginChain,
        explicitInvariant,
        seniorEngineerAnalysis,
        adversarialChallenge,
        preventionRecommendation,
        systemicDefects,
    } = params;

    const cand =
        regressionContext.causallyProvenCandidate ||
        regressionContext.stronglySupportedCandidate ||
        regressionContext.candidates[0];

    let causalityStatus: "PROVEN" | "SUPPORTED" | "PLAUSIBLE" | "COINCIDENTAL" | "REFUTED" | "UNKNOWN" = "UNKNOWN";
    const causeStatus = (causalState.upstreamCause?.status as string) || "";
    if (causeStatus === "CONFIRMED") {
        causalityStatus = "PROVEN";
    } else if (causeStatus === "REGRESSION_SUSPECTED" || causeStatus === "AMBIGUOUS") {
        causalityStatus = "SUPPORTED";
    } else if (causeStatus === "PLAUSIBLE") {
        causalityStatus = "PLAUSIBLE";
    } else if (causeStatus === "REFUTED") {
        causalityStatus = "REFUTED";
    }

    const failureLocationProvenance =
        causalState.failureLocation?.provenance ||
        (snapshot.source?.filePath
            ? `Verified repository source at ${snapshot.source.filePath}:${snapshot.source.failingLineNumber || "?"}`
            : snapshot.failure.primaryFrame?.filePath
            ? `Observed in stack trace at ${snapshot.failure.primaryFrame.filePath}:${snapshot.failure.primaryFrame.lineNumber || "?"}`
            : "Primary stack frame unavailable");

    // Collect accumulated uncertainties
    const combinedUncertainties: string[] = [...uncertainty];
    if ((causalState.upstreamCause as any)?.competingHypotheses?.length) {
        combinedUncertainties.push(
            `Competing upstream causes remain unresolved (${(causalState.upstreamCause as any).competingHypotheses.join(" vs ")}).`
        );
    }
    if (gateVerdict && !gateVerdict.isRollbackEligible && gateVerdict.blockingReason) {
        combinedUncertainties.push(gateVerdict.blockingReason);
    }
    if (repairEquivalence?.isRepairEquivalent) {
        combinedUncertainties.push(repairEquivalence.unresolvedUpstreamCausalityReason);
    }

    // Build consolidated claim provenance
    const consolidatedProvenance: ClaimProvenance[] = [...provenance];
    if (causalState.failureMechanism?.status === "CONFIRMED") {
        consolidatedProvenance.push({
            claimText: causalState.failureMechanism.description,
            referencedEvidenceIds: (causalState.failureMechanism as any)?.evidenceIds || [],
            referencedSourceLocations: [
                `${causalState.failureLocation?.filePath || "unknown"}:${causalState.failureLocation?.lineNumber || "?"}`,
            ],
            analysisComponent: "causal-determination",
            epistemicStatus: "EMPIRICALLY_VERIFIED",
        });
    }
    if (repairLocation?.ownershipEstablished) {
        consolidatedProvenance.push({
            claimText: `Repair ownership established at ${repairLocation.targetFile} (${repairLocation.type}): ${repairLocation.rationale}`,
            referencedEvidenceIds: (repairLocation as any)?.evidenceIds || [],
            referencedSourceLocations: [repairLocation.targetFile || "unknown"],
            analysisComponent: "repair-location",
            epistemicStatus: "DERIVED_FROM_AST",
        });
    }

    const separatedLocations: SeparatedLocations = {
        observationLocation: causalState.locations?.observationLocation || {
            filePath: snapshot.failure.primaryFrame?.filePath || snapshot.source?.filePath,
            lineNumber: snapshot.failure.primaryFrame?.lineNumber || snapshot.source?.failingLineNumber,
            symbol: snapshot.failure.primaryFrame?.functionName || snapshot.source?.containingFunction,
            status: "OBSERVED" as FailureLocationStatus,
            provenance: "Primary frame observation",
        },
        originLocation: causalState.locations?.originLocation,
        mechanismLocation: causalState.locations?.mechanismLocation || {
            filePath: causalState.failureLocation?.filePath || snapshot.source?.filePath,
            lineNumber: causalState.failureLocation?.lineNumber || snapshot.source?.failingLineNumber,
            symbol: causalState.failureLocation?.symbol || snapshot.source?.containingFunction,
            status: (causalState.failureLocation?.status || "UNRESOLVED") as FailureLocationStatus,
            provenance: failureLocationProvenance,
        },
        contractViolationLocation: causalState.locations?.contractViolationLocation,
        repairLocation: {
            filePath: repairLocation?.targetFile || causalState.locations?.repairLocation?.filePath || causalState.failureLocation?.filePath || snapshot.source?.filePath,
            lineNumber: (repairLocation as any)?.targetLineNumber || repairLocation?.lineRange?.start || causalState.locations?.repairLocation?.lineNumber || causalState.failureLocation?.lineNumber || snapshot.source?.failingLineNumber,
            symbol: repairLocation?.targetSymbol || causalState.locations?.repairLocation?.symbol || causalState.failureLocation?.symbol || snapshot.source?.containingFunction,
            status: (repairLocation?.ownershipEstablished ? "ESTABLISHED" : "CANDIDATE") as FailureLocationStatus,
            provenance: repairLocation?.rationale || "Determined repair boundary",
        },
    };

    return {
        occurrenceId: snapshot.incident.issueId || "halo-incident",
        investigationVersion: snapshot.incident.eventCount || 1,
        failure: {
            location: {
                filePath: separatedLocations.mechanismLocation.filePath || snapshot.source?.filePath,
                lineNumber: separatedLocations.mechanismLocation.lineNumber || snapshot.source?.failingLineNumber,
                symbol: separatedLocations.mechanismLocation.symbol || snapshot.source?.containingFunction,
                status: causalState.failureLocation?.status || "UNRESOLVED",
                provenance: failureLocationProvenance,
            },
            expression: causalState.failureLocation?.expression || snapshot.source?.failingExpression,
            executionContext: snapshot.incident.environment,
        },
        separatedLocations,
        defectMechanismCause: causalState.defectMechanismCause,
        mechanism: {
            status: causalState.failureMechanism?.status || "UNKNOWN",
            description: causalState.failureMechanism?.description || "",
            evidenceIds: (causalState.failureMechanism as any)?.evidenceIds || [],
        },
        causality: {
            status: causalityStatus,
            causalChain: (causalState.upstreamCause as any)?.causalChain || [],
            evidenceIds: (causalState.upstreamCause as any)?.evidenceIds || [],
        },
        invariant: {
            description: causalState.brokenInvariant?.formalStatement || (causalState as any).invariantViolation?.description || "Execution invariant restored without violation.",
            formalStatement: causalState.brokenInvariant?.formalStatement || (causalState as any).invariantViolation?.formalInvariant,
            classification: causalState.brokenInvariant?.classification,
            evidenceIds: causalState.brokenInvariant?.evidenceIds || (causalState as any).invariantViolation?.evidenceIds || [],
        },
        brokenInvariant: causalState.brokenInvariant,
        ownership: {
            status: repairLocation?.ownershipEstablished ? "ESTABLISHED" : repairLocation?.isAmbiguous ? "AMBIGUOUS" : "UNKNOWN",
            owner: repairLocation?.targetSymbol || repairLocation?.targetFile,
            evidenceIds: (repairLocation as any)?.evidenceIds || [],
        },
        repairBoundary: {
            status: repairLocation?.ownershipEstablished ? "VERIFIED" : "CANDIDATE",
            entity: repairLocation?.targetFile,
            boundaryType: repairLocation?.type || "UNKNOWN",
            evidenceIds: (repairLocation as any)?.evidenceIds || [],
        },
        candidates: candidateActions,
        selectedCandidate: selectedCandidate
            ? {
                  candidateId: selectedCandidate.id,
                  category: selectedCandidate.category,
                  title: selectedCandidate.title,
                  justification: selectedCandidate.justification,
              }
            : undefined,
        regression: {
            temporalAssociation: cand?.temporalAssociation || "UNKNOWN",
            sourceAssociation: cand?.sourceAssociation || "UNRELATED",
            executionRelevance: cand?.executionRelevance || "UNKNOWN",
            behavioralRelevance: cand?.behavioralRelevance || "UNKNOWN",
            mechanismRelevance: cand?.mechanismRelevance || "MECHANISM_UNKNOWN",
            causalSupport: cand?.causalSupport || "UNPROVEN_ASSOCIATION",
            rollbackAudit: cand?.rollbackAudit,
            isRollbackSuperior: gateVerdict?.isRollbackSuperior,
            superiorityReason: gateVerdict?.superiorityRationale,
        },
        evidence: {
            supporting: (evidenceSufficiency as any).supportingEvidenceIds || [],
            contradicting: (evidenceSufficiency as any).contradictingEvidenceIds || [],
            missing: (evidenceSufficiency as any).missingEvidenceTypes || [],
            stale: (evidenceSufficiency as any).staleEvidenceIds || [],
        },
        decisionGap,
        acquisitionPlan,
        diagnosisProof,
        repairProof,
        behavioralProof,
        validation,
        consequences,
        uncertainty: Array.from(new Set(combinedUncertainties)),
        finalState,
        decomposedConfidence,
        repairEquivalence,
        provenance: consolidatedProvenance,
        evidenceStoreHash: (snapshot as any).evidenceStore?.computeHash?.() || undefined,
        findings: [
            {
                id: "finding-observed-failure",
                type: "ObservedFailure",
                status: "OBSERVED",
                title: "Observed Failure Manifestation",
                description: `${snapshot.failure.exceptionType}: ${snapshot.failure.exceptionMessage}`,
                evidenceRefs: [snapshot.runtimeContext.anchorErrorId || "anchor-error"],
                evidenceIds: [snapshot.runtimeContext.anchorErrorId || "anchor-error"],
                confidence: "CONFIRMED",
                createdAt: new Date(),
            },
            {
                id: "finding-observation-location",
                type: "ObservationLocation",
                status: separatedLocations.observationLocation.status === "CONFIRMED" ? "CONFIRMED" : "OBSERVED",
                title: "Failure Observation Location",
                description: `${separatedLocations.observationLocation.filePath}:${separatedLocations.observationLocation.lineNumber || "?"}`,
                evidenceRefs: separatedLocations.observationLocation.filePath ? [`file:${separatedLocations.observationLocation.filePath}`] : [],
                evidenceIds: separatedLocations.observationLocation.filePath ? [`file:${separatedLocations.observationLocation.filePath}`] : [],
                confidence: "CONFIRMED",
                createdAt: new Date(),
            },
            {
                id: "finding-mechanism-location",
                type: "MechanismLocation",
                status: separatedLocations.mechanismLocation.status === "CONFIRMED" ? "CONFIRMED" : "SUPPORTED",
                title: "Failure Mechanism Location",
                description: `${separatedLocations.mechanismLocation.filePath}:${separatedLocations.mechanismLocation.lineNumber || "?"}`,
                evidenceRefs: separatedLocations.mechanismLocation.filePath ? [`file:${separatedLocations.mechanismLocation.filePath}`] : [],
                evidenceIds: separatedLocations.mechanismLocation.filePath ? [`file:${separatedLocations.mechanismLocation.filePath}`] : [],
                confidence: "CONFIRMED",
                createdAt: new Date(),
            },
            ...(separatedLocations.originLocation ? [{
                id: "finding-origin-location",
                type: "OriginLocation" as const,
                status: separatedLocations.originLocation.status === "CONFIRMED" ? "CONFIRMED" as const : "SUPPORTED" as const,
                title: "Value / State Origin Location",
                description: `${separatedLocations.originLocation.filePath}:${separatedLocations.originLocation.lineNumber || "?"}`,
                evidenceRefs: separatedLocations.originLocation.filePath ? [`file:${separatedLocations.originLocation.filePath}`] : [],
                evidenceIds: separatedLocations.originLocation.filePath ? [`file:${separatedLocations.originLocation.filePath}`] : [],
                confidence: "CONFIRMED" as const,
                createdAt: new Date(),
            }] : []),
            ...(separatedLocations.contractViolationLocation ? [{
                id: "finding-contract-violation-location",
                type: "ContractViolationLocation" as const,
                status: "CONFIRMED" as const,
                title: "Contract Violation Boundary",
                description: `${separatedLocations.contractViolationLocation.filePath}:${separatedLocations.contractViolationLocation.lineNumber || "?"}`,
                evidenceRefs: separatedLocations.contractViolationLocation.filePath ? [`file:${separatedLocations.contractViolationLocation.filePath}`] : [],
                evidenceIds: separatedLocations.contractViolationLocation.filePath ? [`file:${separatedLocations.contractViolationLocation.filePath}`] : [],
                confidence: "CONFIRMED" as const,
                createdAt: new Date(),
            }] : []),
            {
                id: "finding-broken-invariant",
                type: "BrokenInvariant",
                status: causalState.brokenInvariant ? "CONFIRMED" : "SUPPORTED",
                title: "Violated Invariant",
                description: causalState.brokenInvariant?.description || "Execution invariant violated",
                evidenceRefs: causalState.brokenInvariant?.evidenceIds || [],
                evidenceIds: causalState.brokenInvariant?.evidenceIds || [],
                confidence: causalState.brokenInvariant ? "CONFIRMED" : "PLAUSIBLE",
                createdAt: new Date(),
            },
            {
                id: "finding-repair-boundary",
                type: "RepairBoundary",
                status: repairLocation?.ownershipEstablished ? "CONFIRMED" : "SUPPORTED",
                title: "Authoritative Repair Boundary",
                description: `${repairLocation.type} at ${repairLocation.targetFile || "target"}: ${repairLocation.rationale}`,
                evidenceRefs: (repairLocation as any)?.evidenceIds || [],
                evidenceIds: (repairLocation as any)?.evidenceIds || [],
                confidence: repairLocation?.ownershipEstablished ? "CONFIRMED" : "PLAUSIBLE",
                createdAt: new Date(),
            },
            ...(selectedCandidate ? [{
                id: "finding-candidate-repair",
                type: "CandidateRepair" as const,
                status: finalState === "VERIFIED_REPAIR" ? "CONFIRMED" as const : "SUPPORTED" as const,
                title: selectedCandidate.title,
                description: selectedCandidate.justification,
                evidenceRefs: [selectedCandidate.id],
                evidenceIds: [selectedCandidate.id],
                confidence: finalState === "VERIFIED_REPAIR" ? "CONFIRMED" as const : "SUPPORTED" as const,
                createdAt: new Date(),
            }] : []),
        ],
        worldModelSummary,
        reasoningVersion,
        reasoningHistory,
        claimGraphSummary,
        firstDivergence,
        valueOriginChain,
        explicitInvariant,
        seniorEngineerAnalysis,
        adversarialChallenge,
        preventionRecommendation,
        systemicDefects,
    };
}
