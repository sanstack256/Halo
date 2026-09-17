/**
 * Halo Recommendation Engine — Evidence Sufficiency Engine
 *
 * Implements Phase C (Section 8):
 * Evaluates the unresolved engineering decision against established facts,
 * inferences, and potential contradictions.
 * Produces structured sufficiency states:
 *   - SUFFICIENT_FOR_REPAIR
 *   - SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR
 *   - PARTIALLY_SUFFICIENT
 *   - INSUFFICIENT
 *   - BLOCKED_BY_MISSING_SOURCE
 *   - BLOCKED_BY_MISSING_RUNTIME_EVIDENCE
 *   - BLOCKED_BY_AMBIGUITY
 */

import type {
    InvestigationSnapshot,
    EvidenceSufficiencyEvaluation,
    EvidenceSufficiencyState,
    CausalEpistemicState,
    SourceAstAnalysis,
    ContractAnalysisResult,
    ReleaseRegressionContext,
    DeterminedRepairLocation,
} from "./types";

export function evaluateEvidenceSufficiency(
    snapshot: InvestigationSnapshot,
    causalState: CausalEpistemicState,
    sourceAst: SourceAstAnalysis,
    contractAnalysis: ContractAnalysisResult,
    regressionContext: ReleaseRegressionContext,
    repairLocation?: DeterminedRepairLocation
): EvidenceSufficiencyEvaluation {
    const establishedFacts: string[] = [];
    const inferredFacts: string[] = [];
    const contradictingFacts: string[] = [];
    const minimumAdditionalEvidenceNeeded: string[] = [];

    // 1. Gather established facts
    if (causalState.failureLocation.status === "CONFIRMED") {
        establishedFacts.push(
            `Failing location confirmed at ${causalState.failureLocation.filePath}:${causalState.failureLocation.lineNumber || "?"}`
        );
    }
    if (causalState.failureMechanism.status === "CONFIRMED") {
        establishedFacts.push(
            `Failure mechanism confirmed: ${causalState.failureMechanism.description}`
        );
    }
    if (regressionContext.stronglySupportedCandidate) {
        establishedFacts.push(
            `Strong regression candidate identified: Commit ${regressionContext.stronglySupportedCandidate.shortSha} modified incident path`
        );
    }

    // 2. Zero telemetry check
    if (snapshot.investigation.rawEvidence.length === 0) {
        return {
            state: "INSUFFICIENT",
            unresolvedDecision: "Determine whether an incident occurrence actually transpired.",
            establishedFacts: [],
            inferredFacts: [],
            contradictingFacts: [],
            canSourceOrReleaseResolve: false,
            isAdditionalRuntimeTelemetryNecessary: true,
            minimumAdditionalEvidenceNeeded: ["Correlated incident telemetry events"],
            blockingReason: "Zero telemetry events were recorded for this incident window.",
        };
    }

    // 3. Source Availability Check
    if (!sourceAst.hasExactSource || snapshot.source?.resolutionStatus !== "exact_file") {
        const sourceReason = snapshot.source?.unavailabilityReason || "Verified repository source is unavailable at this release commit.";
        return {
            state: "BLOCKED_BY_MISSING_SOURCE",
            unresolvedDecision: "Inspect actual repository implementation at failing location.",
            establishedFacts,
            inferredFacts,
            contradictingFacts,
            canSourceOrReleaseResolve: true,
            isAdditionalRuntimeTelemetryNecessary: false,
            minimumAdditionalEvidenceNeeded: [
                "Exact repository commit matching the deployed release version",
            ],
            blockingReason: sourceReason,
        };
    }

    // 4. Check if mechanism is underdetermined AND cannot be resolved by source/release
    const isMechanismUnderdetermined =
        causalState.failureMechanism.status === "UNKNOWN" &&
        !regressionContext.stronglySupportedCandidate;

    if (isMechanismUnderdetermined) {
        const expr = causalState.failureLocation.expression || "operation";
        const inv = sourceAst.invocationAnalysis;
        const tests = sourceAst.testsContractEvidence;

        const knownFacts = [
            ...establishedFacts,
            `Failing expression AST: '${expr}'`,
            inv?.isInvocation
                ? `Callee expression: '${inv.calleeExpression || expr}', Callee opacity: ${inv.calleeOpacity}`
                : "Non-invocation expression",
        ];
        const unknownFacts = [
            `Exact runtime evaluation of '${expr}'`,
            inv?.isInvocation
                ? `Resolved callee target and runtime return/rejection value`
                : "Dynamic value at failure site",
        ];
        const staticallyResolvable = [
            sourceAst.sourceDistMapping?.sourceMapAvailable
                ? "Source map resolution from dist to authoritative source"
                : "Static AST structure of failing function",
            tests?.hasRelevantTests
                ? `Test suite verification in ${tests.testFiles.join(", ")}`
                : "Repository function declarations and call hierarchy",
        ];
        const runtimeOnly = [
            inv?.isInvocation && inv.calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE"
                ? `Dynamic scenario/callback instance supplied to '${expr}'`
                : `Runtime evaluation payload of '${expr}'`,
            "Dynamic user input and remote service response data",
        ];

        const informationFrontier = {
            knownFacts,
            unknownFacts,
            staticallyResolvable,
            runtimeOnly,
        };

        const canReproInDev = Boolean(tests?.reproductionPossibleInDev);

        const actionExplanation = {
            whatWeKnow: `Failure surfaced at ${causalState.failureLocation.filePath || "target"}:${causalState.failureLocation.lineNumber || "?"} in '${causalState.failureLocation.symbol || "function"}' during '${expr}' with ${snapshot.failure.exceptionType} (${snapshot.failure.exceptionMessage}).`,
            whatWeDontKnow:
                inv?.calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE"
                    ? `Which concrete implementation was supplied to '${expr}' at runtime, and what argument '${inv.arguments.join(", ") || "context"}' contained.`
                    : `Exact dynamic argument state that caused '${expr}' to fail.`,
            whyThatMatters:
                "Guessing the callee implementation or adding defensive nullish checks risks masking the underlying contract violation or introducing incorrect default behavior.",
            whatWasAlreadyInvestigated: `Repository source AST, containing function '${sourceAst.containingFunction || "caller"}', release diff for commit ${regressionContext.stronglySupportedCandidate?.shortSha || "history"}, parameter guards, and call chain.`,
            whatShouldHappenNext: canReproInDev
                ? `Reproduce locally using the existing test fixture (${tests?.testFiles[0] || "test suite"}) to capture dynamic values.`
                : inv?.calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE"
                ? `Capture the resolved callee identifier and rejection value at the '${expr}' boundary; those two signals distinguish the candidate implementations.`
                : `Capture the runtime argument payload passed to '${expr}'.`,
            whyThatActionHasHighestValue: canReproInDev
                ? "Local reproduction resolves the execution path immediately without deploying production instrumentation or risk."
                : "Capturing the callee identifier and outcome directly resolves the remaining uncertainty with zero code modification risk and minimal operational overhead.",
        };

        return {
            state: "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE",
            unresolvedDecision: "Distinguish between competing runtime failure mechanisms.",
            establishedFacts,
            inferredFacts,
            contradictingFacts,
            canSourceOrReleaseResolve: canReproInDev,
            isAdditionalRuntimeTelemetryNecessary: !canReproInDev,
            minimumAdditionalEvidenceNeeded: canReproInDev
                ? [`Local test reproduction via ${tests?.testFiles[0] || "test suite"}`]
                : [`Runtime evaluation of '${expr}'`],
            blockingReason: `Runtime evaluation was not captured; cannot prove whether '${expr}' evaluated to undefined or if invocation threw internally.`,
            informationFrontier,
            actionExplanation,
        };
    }

    // 4b. No Code Change Justified (External Outage)
    if (repairLocation?.type === "NO_CODE_CHANGE" && repairLocation.ownershipEstablished) {
        return {
            state: "SUFFICIENT_FOR_REPAIR",
            unresolvedDecision: "External third-party provider outage: monitor provider status page, no application code change required.",
            establishedFacts,
            inferredFacts,
            contradictingFacts,
            canSourceOrReleaseResolve: false,
            isAdditionalRuntimeTelemetryNecessary: false,
            minimumAdditionalEvidenceNeeded: [],
        };
    }

    // 5. Confirmed Mechanism / Established Repair Location
    const isRepairOwnershipEstablished = Boolean(
        repairLocation &&
        repairLocation.ownershipEstablished &&
        !repairLocation.isAmbiguous &&
        repairLocation.type !== "NO_CODE_CHANGE"
    );

    if (isRepairOwnershipEstablished || causalState.failureMechanism.status === "CONFIRMED") {
        if (isRepairOwnershipEstablished) {
            return {
                state: "SUFFICIENT_FOR_REPAIR",
                unresolvedDecision: "Formulate targeted repair at established repair boundary.",
                establishedFacts,
                inferredFacts,
                contradictingFacts,
                canSourceOrReleaseResolve: true,
                isAdditionalRuntimeTelemetryNecessary: false,
                minimumAdditionalEvidenceNeeded: [],
            };
        } else if (repairLocation?.isAmbiguous && repairLocation.candidateLocations?.some((c) => c.type === "CALLER" && c.targetFile)) {
            // Multiple verified application frames compete on stack (State 3)
            return {
                state: "BLOCKED_BY_AMBIGUITY",
                unresolvedDecision: "Determine whether the contract expectation belongs to the caller or the callee.",
                establishedFacts,
                inferredFacts,
                contradictingFacts,
                canSourceOrReleaseResolve: true,
                isAdditionalRuntimeTelemetryNecessary: false,
                minimumAdditionalEvidenceNeeded: [
                    "Contract specification or design convention establishing whether callee must support empty/undefined inputs or caller must guarantee valid payloads",
                ],
                blockingReason: "Multiple repair locations remain plausible; cannot determine whether caller contract fix or callee defensive validation is the intended design without contract clarification.",
            };
        } else {
            // Section 13 (State 2): Mechanism is diagnosed, but contract ownership is unproven (Case J)
            const candSummary = repairLocation?.candidateLocations
                ? repairLocation.candidateLocations.map((c) => c.type).join(" vs ")
                : "Caller vs Callee";
            return {
                state: "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR",
                unresolvedDecision: `Determine contract ownership (${candSummary}) before modifying code.`,
                establishedFacts,
                inferredFacts,
                contradictingFacts,
                canSourceOrReleaseResolve: true,
                isAdditionalRuntimeTelemetryNecessary: false,
                minimumAdditionalEvidenceNeeded: [
                    "Contract specification, interface definitions, or repository tests establishing whether caller must supply valid arguments or callee must handle nullish inputs",
                ],
                blockingReason: repairLocation?.rationale || "Failure mechanism is confirmed, but contract ownership between caller and callee is not established by repository evidence.",
            };
        }
    }

    // 6. Check if regression candidate is strongly supported (allows regression diagnosis/revert)
    if (regressionContext.stronglySupportedCandidate) {
        return {
            state: "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR",
            unresolvedDecision: "Inspect regression diff before modifying production code.",
            establishedFacts,
            inferredFacts,
            contradictingFacts,
            canSourceOrReleaseResolve: true,
            isAdditionalRuntimeTelemetryNecessary: false,
            minimumAdditionalEvidenceNeeded: [
                `Local reproduction of commit ${regressionContext.stronglySupportedCandidate.shortSha}`,
            ],
            blockingReason: `Commit ${regressionContext.stronglySupportedCandidate.shortSha} modified the incident path; diff inspection is required.`,
        };
    }

    // 7. Plausible mechanism -> PARTIALLY_SUFFICIENT
    return {
        state: "PARTIALLY_SUFFICIENT",
        unresolvedDecision: "Confirm runtime invocation path before modifying code.",
        establishedFacts,
        inferredFacts,
        contradictingFacts,
        canSourceOrReleaseResolve: true,
        isAdditionalRuntimeTelemetryNecessary: false,
        minimumAdditionalEvidenceNeeded: [
            "Reproduction in development or integration environment",
        ],
    };
}
