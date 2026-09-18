/**
 * Halo Recommendation Engine — Candidate Action Generation & Selection
 *
 * Core product requirement: NEVER short-circuit to "Do not modify production code yet"
 * merely because the FIRST pass produced ambiguity or uncertainty.
 *
 * Instead:
 * - Generate the BEST available action given the evidence level
 * - If evidence allows a concrete repair, recommend that repair
 * - If a regression candidate exists, recommend reversion or inspection
 * - If external integration failure, recommend application-side resilience code
 * - Only fall back to investigatory actions when repair evidence is truly absent
 *
 * Implements Phase D (Sections 16, 17, 18):
 * Generates evidence-grounded candidate actions, scores them on 11 dimensions,
 * and determines the single authoritative next best engineering action.
 */

import type {
    InvestigationSnapshot,
    CandidateAction,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    ReleaseRegressionContext,
    SourceAstAnalysis,
    ContractAnalysisResult,
} from "./types";

export interface CandidateActionSelection {
    candidates: CandidateAction[];
    selectedAction: CandidateAction;
}

interface ScoringContext {
    sufficiency: EvidenceSufficiencyEvaluation;
    causalState: CausalEpistemicState;
    sourceAst: SourceAstAnalysis;
    regressionContext: ReleaseRegressionContext;
}

/**
 * Layer 1: Hard Evidence Constraints
 * Enforces epistemic boundary conditions.
 *
 * IMPORTANT: These constraints are intentionally narrow. We only block code changes when
 * the failure mechanism is TRULY unproven AND source is unavailable. Ambiguity about
 * caller vs. callee contract ownership does NOT block a concrete recommendation —
 * the engine should pick the most defensible repair location and explain it.
 */
export function evaluateHardConstraints(
    action: CandidateAction,
    context: ScoringContext
): { passed: boolean; disqualificationReason?: string } {
    const { causalState, sourceAst } = context;

    // MAKE_CODE_CHANGE hard constraints — only two absolute blockers:
    // 1. Source code is completely unavailable (we cannot know what to change)
    // 2. Failure mechanism is completely unconfirmed (we don't know what broke)
    if (action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") {
        if (!sourceAst.hasExactSource && causalState.failureMechanism.status === "UNKNOWN") {
            return {
                passed: false,
                disqualificationReason: "Both exact source and failure mechanism are unavailable; concrete code modification cannot be determined.",
            };
        }
    }

    // REVERT_OR_INVESTIGATE_REGRESSION hard constraint
    if (action.category === "REVERT_OR_INVESTIGATE_REGRESSION") {
        const isRevertAction = action.title.toLowerCase().includes("revert") || action.repairLocation?.type === "DEPLOYMENT";
        if (isRevertAction && causalState.failureMechanism.status === "UNKNOWN") {
            return {
                passed: false,
                disqualificationReason: "Failure mechanism is UNKNOWN; a commit cannot be recommended for revert/rollback without proving the failure mechanism.",
            };
        }
        if (!context.regressionContext.stronglySupportedCandidate && !context.regressionContext.causallyProvenCandidate) {
            return {
                passed: false,
                disqualificationReason: "No regression candidate with verified behavioral association exists.",
            };
        }
    }

    // COLLECT_MISSING_RUNTIME_SIGNAL hard constraint
    if (action.category === "COLLECT_MISSING_RUNTIME_SIGNAL") {
        if (!context.sufficiency.isAdditionalRuntimeTelemetryNecessary) {
            return {
                passed: false,
                disqualificationReason: "Additional runtime telemetry is not necessary; deterministic repository evidence can resolve the decision.",
            };
        }
    }

    return { passed: true };
}

function scoreCandidateAction(
    action: CandidateAction,
    context: ScoringContext
): { totalScore: number; dimensions: Record<string, number> } {
    const { sufficiency, causalState } = context;

    // Layer 1 Check: Hard Constraint Disqualification
    const constraintCheck = evaluateHardConstraints(action, context);
    if (!constraintCheck.passed) {
        return { totalScore: -1000, dimensions: { hardConstraintViolation: -1000 } };
    }

    // 1. Evidence Grounding: supported by verified facts
    const evidenceGrounding = Math.min(10, Math.max(2, action.evidenceSupport.length * 3));

    // 2. Causal Directness — code changes rank highest when mechanism is proven; proven regression ranks highest
    const isProvenRegression =
        action.category === "REVERT_OR_INVESTIGATE_REGRESSION" &&
        (Boolean(context.regressionContext.causallyProvenCandidate) ||
            Boolean(context.regressionContext.stronglySupportedCandidate));

    let causalDirectness = 5;
    if (isProvenRegression) {
        causalDirectness = 10;
    } else if ((action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") && causalState.failureMechanism.status === "CONFIRMED") {
        causalDirectness = 10;
    } else if ((action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") && causalState.failureMechanism.status === "PLAUSIBLE") {
        // Probable mechanism still supports code change
        causalDirectness = 9;
    } else if (action.category === "COLLECT_MISSING_RUNTIME_SIGNAL") {
        causalDirectness = (sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" || sufficiency.isAdditionalRuntimeTelemetryNecessary) ? 10 : 6;
    } else if (action.category === "APPLICATION_RESILIENCE_CHANGE") {
        causalDirectness = 8;
    } else if (action.category === "INVESTIGATE_EXTERNAL_DEPENDENCY") {
        causalDirectness = 7;
    } else if (action.category === "REVERT_OR_INVESTIGATE_REGRESSION") {
        // Unproven regression candidate — investigatory only
        causalDirectness = 4;
    }

    // 3. Blast Radius Safety
    const blastRadiusSafety =
        action.blastRadius === "LOCAL_ONLY" ? 10 : action.blastRadius === "CALLERS_AFFECTED" ? 6 : 2;

    // 4. Regression Risk
    const regressionRisk =
        action.regressionRisk === "LOW" ? 10 : action.regressionRisk === "MEDIUM" ? 6 : 2;

    // 5. Reversibility
    const reversibility =
        action.reversibility === "IMMEDIATE" ? 10 : action.reversibility === "NEEDS_MIGRATION" ? 5 : 2;

    // 6. Uncertainty Preservation (Humility) — not penalizing repair actions when well-evidenced
    const uncertaintyPreservation = action.uncertainty.length > 0 ? 9 : 7;

    // 7. Information Gain
    let informationGain =
        action.informationGain === "CRITICAL" ? 10 : action.informationGain === "HIGH" ? 7 : 3;
    if (action.category === "COLLECT_MISSING_RUNTIME_SIGNAL" && (sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" || sufficiency.isAdditionalRuntimeTelemetryNecessary)) {
        informationGain = 10;
    }

    // 8. Diagnostic Economy — concrete repairs beat investigatory actions when evidenced
    let diagnosticEconomy = 6;
    if (isProvenRegression) {
        diagnosticEconomy = 10;
    } else if (action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") {
        // A code change backed by evidence is the most economical resolution
        diagnosticEconomy = sufficiency.state === "SUFFICIENT_FOR_REPAIR" ? 10
            : causalState.failureMechanism.status !== "UNKNOWN" ? 8
            : 4;
    } else if (action.category === "COLLECT_MISSING_RUNTIME_SIGNAL") {
        diagnosticEconomy = (sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" || sufficiency.isAdditionalRuntimeTelemetryNecessary) ? 10 : 5;
    } else if (action.category === "APPLICATION_RESILIENCE_CHANGE") {
        diagnosticEconomy = 8;
    } else if (action.category === "INSPECT_SOURCE_BEFORE_CHANGING") {
        diagnosticEconomy = 7;
    } else if (action.category === "REVERT_OR_INVESTIGATE_REGRESSION") {
        diagnosticEconomy = 4;
    } else if (action.category === "DO_NOT_MODIFY_CODE_YET") {
        // This should be a last resort, never a first recommendation
        diagnosticEconomy = 1;
    }

    // 9. Verification Feasibility
    const verificationFeasibility = Math.min(10, Math.max(3, action.validationPlan.length * 4));

    // 10. Contract Integrity (Avoid symptom suppression)
    const contractIntegrity = action.justification.toLowerCase().includes("suppress") ? 1 : 10;

    // 11. Sufficiency Alignment
    let sufficiencyAlignment = 5;
    if (isProvenRegression) {
        sufficiencyAlignment = 10;
    } else if (sufficiency.state === "SUFFICIENT_FOR_REPAIR") {
        sufficiencyAlignment = (action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") ? 10 : 7;
    } else if (sufficiency.state === "BLOCKED_BY_AMBIGUITY") {
        if (action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") {
            sufficiencyAlignment = 8;
        } else {
            sufficiencyAlignment = 5;
        }
    } else if (sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE") {
        sufficiencyAlignment =
            action.category === "COLLECT_MISSING_RUNTIME_SIGNAL" ? 10
            : action.category === "REPRODUCE_EXECUTION_PATH" ? 8
            : (action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") ? 5
            : 3;
    } else if (sufficiency.state === "BLOCKED_BY_MISSING_SOURCE") {
        sufficiencyAlignment =
            action.category === "INSPECT_SOURCE_BEFORE_CHANGING" ? 10 : 4;
    } else if (sufficiency.state === "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR") {
        sufficiencyAlignment =
            (action.category === "MAKE_CODE_CHANGE" || action.category === "MULTI_FILE_CODE_CHANGE") ? 9
            : action.category === "REVERT_OR_INVESTIGATE_REGRESSION" ? 8
            : action.category === "APPLICATION_RESILIENCE_CHANGE" ? 7
            : 4;
    }

    const dimensions: Record<string, number> = {
        evidenceGrounding,
        causalDirectness,
        blastRadiusSafety,
        regressionRisk,
        reversibility,
        uncertaintyPreservation,
        informationGain,
        diagnosticEconomy,
        verificationFeasibility,
        contractIntegrity,
        sufficiencyAlignment,
    };

    const totalScore = Object.values(dimensions).reduce((sum, v) => sum + v, 0);

    return { totalScore, dimensions };
}

export function generateAndEvaluateCandidateActions(
    snapshot: InvestigationSnapshot,
    causalState: CausalEpistemicState,
    repairLocation: DeterminedRepairLocation,
    sufficiency: EvidenceSufficiencyEvaluation,
    regressionContext: ReleaseRegressionContext,
    sourceAst: SourceAstAnalysis,
    contractAnalysis: ContractAnalysisResult
): CandidateActionSelection {
    const candidates: CandidateAction[] = [];

    const failingFile = causalState.failureLocation.filePath;
    const failingLine = causalState.failureLocation.lineNumber;
    const failingSymbol = causalState.failureLocation.symbol;
    const excType = snapshot.failure.exceptionType;
    const excMessage = snapshot.failure.exceptionMessage;

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 1: Confirmed Mechanism → Make Targeted Code Change
    // Generated whenever the failure mechanism is confirmed, regardless of
    // ownership ambiguity. The engine resolves ownership via rationale.
    // ─────────────────────────────────────────────────────────────────────────────
    const mechanismConfirmed = causalState.failureMechanism.status === "CONFIRMED" || causalState.failureMechanism.status === "PLAUSIBLE";
    const hasSource = sourceAst.hasExactSource;
    const hasRepairTarget = repairLocation.type !== "NO_CODE_CHANGE" && repairLocation.type !== "EXTERNAL_INTEGRATION" && repairLocation.type !== "DEPENDENCY" && repairLocation.type !== "CONFIGURATION" && repairLocation.type !== "DEPLOYMENT";

    if (mechanismConfirmed && hasSource && hasRepairTarget) {
        const isCallerFix = repairLocation.type === "CALLER";
        const isMultiFile = repairLocation.candidateLocations && repairLocation.candidateLocations.length > 1;
        const isAmbiguous = repairLocation.isAmbiguous;

        candidates.push({
            id: "act-code-repair",
            category: isMultiFile && !isAmbiguous ? "MULTI_FILE_CODE_CHANGE" : "MAKE_CODE_CHANGE",
            title: isCallerFix
                ? `Fix caller '${repairLocation.targetSymbol || repairLocation.targetFile}' to satisfy callee contract`
                : `Fix '${repairLocation.targetSymbol || failingSymbol}' in '${repairLocation.targetFile || failingFile}'`,
            description: isCallerFix
                ? `Caller in '${repairLocation.targetFile}' supplied invalid or incomplete arguments to '${failingSymbol}'. Correct the caller's data-generation or invocation logic.`
                : isMultiFile
                ? `Failure originates in producer/upstream code. Apply coordinated fix across producer and consumer files to restore the contract.`
                : `Validate or guard contract inputs at entrypoint of '${repairLocation.targetSymbol || failingSymbol}' before executing '${causalState.failureLocation.expression || "operations"}'.`,
            repairLocation,
            evidenceSupport: [
                causalState.failureMechanism.description,
                `${causalState.failureMechanism.status === "CONFIRMED" ? "Confirmed" : "Probable"} at ${failingFile}:${failingLine}`,
                ...(contractAnalysis.calleeContract ? [`Contract: ${contractAnalysis.calleeContract}`] : []),
            ],
            justification: repairLocation.rationale + (isAmbiguous ? " (Best available repair location based on current evidence; contract ownership requires validation against test suite.)" : ""),
            regressionRisk: "LOW",
            blastRadius: isCallerFix ? "CALLERS_AFFECTED" : "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "NONE",
            uncertainty: isAmbiguous
                ? ["Contract ownership between caller and callee — verify against repository test suite"]
                : [],
            validationPlan: [
                `Exercise invocation path to ${failingSymbol || "target"} and verify correct behavior for edge case inputs`,
                "Run existing test suite to detect regressions",
                "Add targeted regression test for the specific failure scenario",
            ],
            score: 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 2: Application Resilience Change for External Failures
    // When the incident is an external integration failure, recommend application-side
    // retry policy, circuit breaker, or timeout adjustment.
    // ─────────────────────────────────────────────────────────────────────────────
    if (repairLocation.type === "EXTERNAL_INTEGRATION") {
        const callerFrame = snapshot.failure.frames.find(f => f.isApplication && f.filePath);
        const clientFile = callerFrame?.filePath;
        const clientSymbol = callerFrame?.functionName;

        candidates.push({
            id: "act-application-resilience",
            category: "APPLICATION_RESILIENCE_CHANGE",
            title: `Add retry policy, timeout, and circuit breaker in application client${clientFile ? ` (${clientFile})` : ""}`,
            description: `The incident is caused by an upstream network/gateway failure (${excType}: ${excMessage}). The application client code${clientFile ? ` in '${clientFile}'` : ""} does not implement retry logic with exponential backoff or a circuit breaker. Add configurable timeout, retry-with-backoff, and circuit breaker so transient external failures do not propagate as unhandled errors.`,
            repairLocation: {
                type: "CALLER",
                targetFile: clientFile,
                targetSymbol: clientSymbol,
                rationale: "Application client code is the appropriate repair boundary for external integration resilience.",
                whyNotFailingLine: "The failing socket/HTTP call cannot succeed during an outage; the repair is to handle the failure gracefully at the application boundary.",
                ownershipEstablished: true,
            },
            evidenceSupport: [
                `Exception: ${excType} — ${excMessage}`,
                "Network/gateway failure confirmed as failure mechanism",
                ...(clientFile ? [`Application client identified at ${clientFile}`] : []),
            ],
            justification: "Adding exponential backoff retry, configurable timeout, and circuit breaker prevents cascading failures and provides graceful degradation for transient external outages.",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "NONE",
            uncertainty: clientFile ? [] : ["Application client file path — trace HTTP/fetch call in source to identify the client adapter"],
            validationPlan: [
                "Inject simulated network timeout in test environment and verify retry behavior",
                "Verify circuit breaker opens after N consecutive failures",
                "Verify graceful degradation (fallback response or queuing) under outage",
            ],
            score: 0,
        });

        // Also keep the operational investigation action as an alternative
        candidates.push({
            id: "act-investigate-external",
            category: "INVESTIGATE_EXTERNAL_DEPENDENCY",
            title: `Investigate upstream provider health for ${excType}`,
            description: `Verify external service health and network connectivity before concluding this is a permanent application code issue.`,
            repairLocation,
            evidenceSupport: [`Exception message: ${excMessage}`],
            justification: "Confirm whether this is a transient outage or a persistent integration defect requiring application-side resilience changes.",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "HIGH",
            uncertainty: ["Upstream provider recovery timeline", "Whether outage is transient or persistent"],
            validationPlan: ["Verify upstream provider status page", "Test network connectivity from production VPC"],
            score: 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 3: Regression Candidate → Causal Revert vs Association Investigation
    // ─────────────────────────────────────────────────────────────────────────────
    const regressionCand =
        regressionContext.causallyProvenCandidate ||
        regressionContext.stronglySupportedCandidate ||
        regressionContext.candidates.find((c) => c.classification === "CONFIRMED_REGRESSION" || c.classification === "PATH_ASSOCIATED");

    if (regressionCand) {
        const isCausallyProven = regressionCand.causalSupport === "CAUSALLY_PROVEN" && causalState.failureMechanism.status === "CONFIRMED";
        const title = isCausallyProven
            ? `Roll back or revert regressed commit ${regressionCand.shortSha}`
            : `Investigate candidate commit ${regressionCand.shortSha} association (causality unproven)`;

        const description = isCausallyProven
            ? `Commit ${regressionCand.shortSha} ("${regressionCand.message}") introduced the verified failure mechanism in '${failingSymbol || failingFile}'. Reverting this commit or applying a targeted fix eliminates the failure.`
            : `Commit ${regressionCand.shortSha} ("${regressionCand.message}") modified '${failingSymbol || failingFile}' prior to the incident, but the failure mechanism (${causalState.failureMechanism.status}) is not proven to be caused by this change. Inspect diff before selecting a repair.`;

        const repairLoc: DeterminedRepairLocation = isCausallyProven
            ? {
                  type: "DEPLOYMENT",
                  targetFile: failingFile,
                  targetSymbol: failingSymbol,
                  ownershipEstablished: true,
                  rationale: `Commit ${regressionCand.shortSha} introduced verified failure mechanism (${causalState.failureMechanism.description}).`,
                  whyNotFailingLine: "Restoring the verified revision eliminates the regressed behavior safely.",
              }
            : {
                  type: "NO_CODE_CHANGE",
                  targetFile: failingFile,
                  targetSymbol: failingSymbol,
                  ownershipEstablished: false,
                  rationale: `Commit ${regressionCand.shortSha} is temporally/source associated, but causal mechanism is unproven.`,
                  whyNotFailingLine: "Do not roll back without verifying that changed code caused the failure.",
              };

        candidates.push({
            id: `act-regression-${regressionCand.shortSha}`,
            category: "REVERT_OR_INVESTIGATE_REGRESSION",
            title,
            description,
            repairLocation: repairLoc,
            evidenceSupport: [
                `Commit ${regressionCand.shortSha} authored by ${regressionCand.author}`,
                regressionCand.classificationReason,
                `Incident first seen at ${snapshot.incident.firstSeen.toISOString()}`,
            ],
            justification: isCausallyProven
                ? `Commit ${regressionCand.shortSha} introduced the verified failure mechanism in '${failingSymbol || failingFile}'.`
                : `Commit ${regressionCand.shortSha} is associated with the incident, but causality has not been proven; diff inspection required.`,
            regressionRisk: isCausallyProven ? "LOW" : "HIGH",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "HIGH",
            uncertainty: isCausallyProven
                ? ["Whether reverting commit introduces other side effects in unrelated modules"]
                : ["Whether changed behavior created the failure mechanism", "Dynamic runtime values"],
            validationPlan: [
                `Review git diff of commit ${regressionCand.shortSha}`,
                "Run test suite against the previous deployment commit",
                "Deploy to staging to verify incident resolution",
            ],
            score: 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 4: Dependency Code → Investigate / Pin Dependency
    // ─────────────────────────────────────────────────────────────────────────────
    if (repairLocation.type === "DEPENDENCY") {
        candidates.push({
            id: "act-dependency-pin",
            category: "INVESTIGATE_EXTERNAL_DEPENDENCY",
            title: `Pin or patch third-party dependency at '${failingFile}'`,
            description: `The failure originated inside third-party dependency code. Pin the dependency version to the last known-good release or wrap the invocation in an application-level adapter that handles the exception gracefully.`,
            repairLocation,
            evidenceSupport: [`Stack frame inside '${failingFile}'`],
            justification: "Modifying vendor bundles directly in production is prohibited and unmaintainable. Pinning is safe and reversible.",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "HIGH",
            uncertainty: ["Whether upstream package has an existing patch release"],
            validationPlan: [
                "Check package changelog for patch releases addressing this error",
                "Test pinned release against the existing test suite in staging",
                "Monitor error rate after pinning to confirm resolution",
            ],
            score: 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 5: Missing Source → Inspect Repository
    // ─────────────────────────────────────────────────────────────────────────────
    if (sufficiency.state === "BLOCKED_BY_MISSING_SOURCE") {
        candidates.push({
            id: "act-inspect-missing-source",
            category: "INSPECT_SOURCE_BEFORE_CHANGING",
            title: `Inspect ${failingFile || "source repository"} before modifying code`,
            description: `Source code for the failing release could not be resolved. Inspect the local repository at ${failingFile || "stack trace target"}:${failingLine || "?"} to determine the executing code before making changes.`,
            repairLocation,
            evidenceSupport: [
                `Stack frame observed at ${failingFile || "unknown"}:${failingLine || "?"}`,
                `Unavailability reason: ${sufficiency.blockingReason}`,
            ],
            justification: "Modifying production code without verified source inspection creates fabrication risk. Source must be confirmed before proposing code changes.",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "CRITICAL",
            uncertainty: ["Exact repository code at release commit"],
            validationPlan: ["Resolve commit matching deployed release in Project Settings → Source Control"],
            score: 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 6: Underdetermined mechanism → Collect runtime signal or Reproduce
    // Only generated when all repair paths above are unavailable.
    // ─────────────────────────────────────────────────────────────────────────────
    if (
        sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" ||
        sufficiency.isAdditionalRuntimeTelemetryNecessary
    ) {
        const expl = sufficiency.actionExplanation;
        const isRepro = sufficiency.canSourceOrReleaseResolve && !sufficiency.isAdditionalRuntimeTelemetryNecessary;
        candidates.push({
            id: isRepro ? "act-reproduce-in-dev" : "act-collect-telemetry",
            category: isRepro ? "REPRODUCE_EXECUTION_PATH" : "COLLECT_MISSING_RUNTIME_SIGNAL",
            title: isRepro
                ? `Reproduce execution path in development using test fixture before altering production`
                : `Capture runtime signal for '${causalState.failureLocation.expression || "operation"}' to resolve failure mechanism`,
            description: expl
                ? `${expl.whatWeKnow} ${expl.whatShouldHappenNext}`
                : `Source and release analysis cannot distinguish competing runtime failure mechanisms. Deploy targeted instrumentation or reproduce in development before modifying code.`,
            repairLocation,
            evidenceSupport: [
                `Failing location confirmed at ${failingFile}:${failingLine}`,
                `Runtime evaluation of '${causalState.failureLocation.expression}' was unrecorded`,
                ...(expl ? [`Unresolved: ${expl.whatWeDontKnow}`] : []),
            ],
            justification: expl?.whyThatActionHasHighestValue || "Speculative code changes risk introducing invalid defaults or masking symptoms.",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "CRITICAL",
            uncertainty: expl ? [expl.whatWeDontKnow] : ["Exact runtime argument payload"],
            validationPlan: isRepro
                ? ["Run local test suite with reproduction fixture"]
                : ["Deploy targeted instrumentation to capture invocation arguments and outcome"],
            score: 0,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Candidate 7: Fallback — only if absolutely no other candidate was generated
    // This should rarely be reached in a properly functioning engine.
    // ─────────────────────────────────────────────────────────────────────────────
    if (candidates.length === 0) {
        // Even in the fallback, produce the most useful action possible
        // If we have a confirmed mechanism but no repair target, guide source inspection
        const hasConfirmedMechanism = causalState.failureMechanism.status === "CONFIRMED" || causalState.failureMechanism.status === "PLAUSIBLE";
        candidates.push({
            id: "act-fallback-investigation",
            category: hasConfirmedMechanism ? "INSPECT_SOURCE_BEFORE_CHANGING" : "DO_NOT_MODIFY_CODE_YET",
            title: hasConfirmedMechanism
                ? `Inspect source at ${failingFile || "target"}:${failingLine || "?"} — mechanism confirmed, repair target needed`
                : "Establish failure mechanism before modifying production code",
            description: hasConfirmedMechanism
                ? `The failure mechanism is ${causalState.failureMechanism.status.toLowerCase()} (${causalState.failureMechanism.description}), but source code or exact repair target could not be verified. Inspect repository source to confirm the repair location before applying changes.`
                : `Evidence does not yet establish the complete failure mechanism. Deploy targeted telemetry or reproduce in development to determine the root cause.`,
            repairLocation: {
                type: "NO_CODE_CHANGE",
                rationale: "Repair target not yet verified — source inspection or reproduction is the safest next step.",
                whyNotFailingLine: "Modifying code without a verified source snapshot risks introducing new defects.",
            },
            evidenceSupport: [
                `Observed ${snapshot.investigation.rawEvidence.length} telemetry events`,
                causalState.failureMechanism.description,
            ],
            justification: "Preserving system integrity until repair target is verified.",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "HIGH",
            uncertainty: hasConfirmedMechanism
                ? ["Exact source code at deployed release commit"]
                : ["Failure mechanism", "Upstream caller context"],
            validationPlan: hasConfirmedMechanism
                ? ["Resolve repository source commit and inspect the failing function"]
                : ["Capture correlated telemetry or reproduce in development"],
            score: 0,
        });
    }

    // Dynamically score each candidate across the 11 dimensions
    const scoringContext: ScoringContext = {
        sufficiency,
        causalState,
        sourceAst,
        regressionContext,
    };

    for (const cand of candidates) {
        const { totalScore } = scoreCandidateAction(cand, scoringContext);
        cand.score = totalScore;
    }

    // Filter and sort
    const eligibleCandidates = candidates.filter((c) => c.score > -1000);
    const finalCandidates = eligibleCandidates.length > 0 ? eligibleCandidates : candidates;

    finalCandidates.sort((a, b) => b.score - a.score);
    const selectedAction = finalCandidates[0]!;

    return {
        candidates: finalCandidates,
        selectedAction,
    };
}
