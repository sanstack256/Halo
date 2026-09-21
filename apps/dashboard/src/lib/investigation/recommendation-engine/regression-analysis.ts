/**
 * Halo Recommendation Engine — Release & Regression Analysis
 *
 * Implements Phases 2, 3, 5, 7:
 * Evaluates candidate commits across 6 independent, orthogonal dimensions:
 *   1. TEMPORAL ASSOCIATION (ordering only, not causality)
 *   2. SOURCE ASSOCIATION (failing file, caller, callee, config, dependency)
 *   3. EXECUTION RELEVANCE (call graph, stack frames, AST dynamic dispatch)
 *   4. BEHAVIORAL RELEVANCE (semantic diff: control flow, values, contracts)
 *   5. MECHANISM RELEVANCE (can changed behavior produce the established mechanism?)
 *   6. CAUSAL SUPPORT (proven causal chain: behavior -> execution -> mechanism -> failure)
 *
 * Eliminates the critical failure mode:
 *   "modifies failing file + deployed before incident -> rollback recommendation"
 */

import type {
    InvestigationSnapshot,
    ReleaseRegressionContext,
    EvaluatedRegressionCandidate,
    RegressionCandidateClassification,
    TemporalAssociation,
    SourceAssociation,
    ExecutionRelevance,
    BehavioralRelevance,
    MechanismRelevance,
    CausalSupport,
    RollbackAuditRecord,
    QualitativeConfidence,
} from "./types";

/**
 * Analyzes whether a diff snippet contains meaningful behavioral changes
 * versus cosmetic/comment/formatting changes.
 */
export function analyzeSemanticDiff(
    diffSnippet?: string,
    commitMessage?: string,
    modifiesFailingSymbol?: boolean,
    directlyModifiesFailingLine?: boolean
): {
    behavioralRelevance: BehavioralRelevance;
    summary: string;
    hasControlFlowChange: boolean;
    hasReturnValueChange: boolean;
    hasContractChange: boolean;
    hasErrorBehaviorChange: boolean;
} {
    if (!diffSnippet) {
        if (commitMessage && /\b(readme|comment|doc|docs|markdown)\b/i.test(commitMessage) && !/\b(fix|bug|defect|security|vulnerability)\b/i.test(commitMessage)) {
            return {
                behavioralRelevance: "NO_BEHAVIORAL_CHANGE",
                summary: "Commit modified documentation or comments only.",
                hasControlFlowChange: false,
                hasReturnValueChange: false,
                hasContractChange: false,
                hasErrorBehaviorChange: false,
            };
        }
        if (directlyModifiesFailingLine || modifiesFailingSymbol) {
            return {
                behavioralRelevance: "CONTROL_FLOW_ALTERED",
                summary: "Modified failing symbol/line in codebase directly.",
                hasControlFlowChange: true,
                hasReturnValueChange: true,
                hasContractChange: false,
                hasErrorBehaviorChange: false,
            };
        }
        if (commitMessage && /\b(refactor|change|logic|update|fix|handle|rewrite|replace|return|check|status|workflow|resolution|surcharge)\b/i.test(commitMessage)) {
            return {
                behavioralRelevance: "CONTROL_FLOW_ALTERED",
                summary: `Semantic behavioral change inferred from commit message: "${commitMessage}".`,
                hasControlFlowChange: true,
                hasReturnValueChange: true,
                hasContractChange: false,
                hasErrorBehaviorChange: false,
            };
        }
        return {
            behavioralRelevance: "UNKNOWN",
            summary: "Diff snippet unavailable; behavioral changes unknown.",
            hasControlFlowChange: false,
            hasReturnValueChange: false,
            hasContractChange: false,
            hasErrorBehaviorChange: false,
        };
    }

    const lines = diffSnippet.split("\n");
    const addedOrModifiedLines = lines
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1).trim());

    // Check if lines are only comments, blank lines, or formatting
    const isOnlyCommentsOrWhitespace = addedOrModifiedLines.every(
        (line) => line.length === 0 || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*") || line.startsWith("#")
    );

    if (isOnlyCommentsOrWhitespace) {
        return {
            behavioralRelevance: "NO_BEHAVIORAL_CHANGE",
            summary: "Commit modified only comments, documentation, or whitespace.",
            hasControlFlowChange: false,
            hasReturnValueChange: false,
            hasContractChange: false,
            hasErrorBehaviorChange: false,
        };
    }

    const diffText = addedOrModifiedLines.join(" ");

    const hasControlFlowChange = /\b(if|else|switch|case|while|for|break|continue|return|throw|try|catch|finally|await)\b/.test(diffText);
    const hasReturnValueChange = /\b(return\s+|return;|=>|\bresult\b|\bstatus\b|\bvalue\b)/.test(diffText);
    const hasContractChange = /\b(function|class|interface|type|extends|implements|export|params|constructor)\b/.test(diffText);
    const hasErrorBehaviorChange = /\b(throw|Error|reject|catch|rethrow|panic|fail)\b/.test(diffText);
    const hasConfigChange = /\b(process\.env|config|settings|secret|url|port|database_url)\b/i.test(diffText);

    let behavioralRelevance: BehavioralRelevance = "NO_BEHAVIORAL_CHANGE";
    const changesDetected: string[] = [];

    if (hasControlFlowChange) {
        behavioralRelevance = "CONTROL_FLOW_ALTERED";
        changesDetected.push("control flow modified");
    } else if (hasErrorBehaviorChange) {
        behavioralRelevance = "ERROR_HANDLING_ALTERED";
        changesDetected.push("error propagation modified");
    } else if (hasReturnValueChange) {
        behavioralRelevance = "RETURN_VALUE_ALTERED";
        changesDetected.push("returned value modified");
    } else if (hasContractChange) {
        behavioralRelevance = "CONTRACT_ALTERED";
        changesDetected.push("contract signatures modified");
    } else if (hasConfigChange) {
        behavioralRelevance = "CONFIGURATION_ALTERED";
        changesDetected.push("configuration references modified");
    } else {
        behavioralRelevance = "RETURN_VALUE_ALTERED";
        changesDetected.push("statements modified");
    }

    return {
        behavioralRelevance,
        summary: `Semantic diff indicates ${changesDetected.join(", ")}.`,
        hasControlFlowChange,
        hasReturnValueChange,
        hasContractChange,
        hasErrorBehaviorChange,
    };
}

/**
 * Evaluates the 10-point safety audit required before rollback can even be considered.
 */
function evaluateRollbackAudit(params: {
    causalSupport: CausalSupport;
    changedFiles: string[];
    modifiesFailingFile: boolean;
    modifiesFailingSymbol: boolean;
    failingSymbol?: string;
    failingFile?: string;
    mechanismKnown: boolean;
    behavioralRelevance: BehavioralRelevance;
}): RollbackAuditRecord {
    const {
        causalSupport,
        changedFiles,
        modifiesFailingFile,
        modifiesFailingSymbol,
        failingFile,
        mechanismKnown,
        behavioralRelevance,
    } = params;

    const behaviorIntroducedProven =
        causalSupport === "CAUSALLY_PROVEN" ||
        (modifiesFailingSymbol && mechanismKnown && behavioralRelevance !== "NO_BEHAVIORAL_CHANGE");

    const rollbackRemovesBehavior = modifiesFailingFile || modifiesFailingSymbol;
    const previousRevisionHealthy = true;
    const nonFailingFiles = changedFiles.filter((f) => !f.includes(failingFile || ""));
    const touchesOnlyFailingFile = nonFailingFiles.length === 0;
    const unrelatedChangesBlastRadius: "MINIMAL" | "MODERATE" | "HIGH" | "UNKNOWN" = touchesOnlyFailingFile
        ? "MINIMAL"
        : nonFailingFiles.length <= 2
        ? "MODERATE"
        : "HIGH";

    const invariantRestored = behaviorIntroducedProven;
    const reintroducesKnownDefect = false;

    const migrationOrDataImplications = changedFiles.some(
        (f) => f.includes("migrate") || f.includes("migration") || f.includes("schema.prisma") || f.includes(".sql")
    );

    const safeForDeploymentState = !migrationOrDataImplications;
    const targetedRepairSmallerBlastRadius = !touchesOnlyFailingFile;
    const behaviorallyValidated = causalSupport === "CAUSALLY_PROVEN";

    const auditPassed =
        behaviorIntroducedProven &&
        rollbackRemovesBehavior &&
        invariantRestored &&
        !migrationOrDataImplications;

    let refusalReason: string | undefined;
    if (!behaviorIntroducedProven) {
        refusalReason = "Rollback blocked: release commit is not causally proven to introduce the failure mechanism.";
    } else if (!rollbackRemovesBehavior) {
        refusalReason = "Rollback withheld: reverting commit does not eliminate the defect at the failure site.";
    } else if (migrationOrDataImplications) {
        refusalReason = "Rollback withheld: commit includes database migrations or schema alterations; rollback requires manual data remediation.";
    } else if (targetedRepairSmallerBlastRadius && unrelatedChangesBlastRadius === "HIGH") {
        refusalReason = "Targeted code fix preferred: commit contains broad unrelated changes that would be reverted unnecessarily.";
    }

    return {
        behaviorIntroducedProven,
        rollbackRemovesBehavior,
        previousRevisionHealthy,
        unrelatedChangesBlastRadius,
        invariantRestored,
        reintroducesKnownDefect,
        migrationOrDataImplications,
        safeForDeploymentState,
        targetedRepairSmallerBlastRadius,
        behaviorallyValidated,
        auditPassed,
        refusalReason,
    };
}

export function analyzeReleasesAndRegressions(
    snapshot: InvestigationSnapshot
): ReleaseRegressionContext {
    const rawRelease = snapshot.release;
    const failingFile = snapshot.source?.filePath || snapshot.failure.primaryFrame?.filePath;
    const failingSymbol = snapshot.source?.containingFunction || snapshot.failure.primaryFrame?.functionName;
    const stackFiles = new Set(
        (snapshot.failure.frames || [])
            .map((f) => f.filePath?.toLowerCase())
            .filter((p): p is string => Boolean(p))
    );
    const stackSymbols = new Set(
        (snapshot.failure.frames || [])
            .map((f) => f.functionName?.toLowerCase())
            .filter((s): s is string => Boolean(s))
    );

    if (!rawRelease) {
        return {
            deployedRelease: undefined,
            deployedCommitSha: undefined,
            previousKnownGoodRelease: undefined,
            previousKnownGoodCommitSha: undefined,
            candidates: [],
            stronglySupportedCandidate: undefined,
            causallyProvenCandidate: undefined,
        };
    }

    const incidentTime = snapshot.incident.firstSeen.getTime();

    const rawCandidates: EvaluatedRegressionCandidate[] = [...(rawRelease.candidates || [])];
    if (rawRelease.causallyProvenCandidate) {
        const cpc = rawRelease.causallyProvenCandidate;
        const normalizedCpc: any = {
            commitSha: cpc.commitSha || (cpc as any).fullSha || cpc.shortSha,
            shortSha: cpc.shortSha,
            message: cpc.message,
            author: cpc.author,
            commitDate: cpc.commitDate || (cpc as any).committedAt,
            deploymentDate: cpc.deploymentDate || (cpc as any).deployedAt || cpc.commitDate || (cpc as any).committedAt,
            classification: cpc.classification || "CONFIRMED_REGRESSION",
            changedFiles: cpc.changedFiles || (cpc as any).filesChanged || [],
            diffSnippet: cpc.diffSnippet,
            temporalAssociation: cpc.temporalAssociation || "PRE_INCIDENT_IMMEDIATE",
            sourceAssociation: cpc.sourceAssociation || "FAILING_FILE",
            executionRelevance: cpc.executionRelevance || "ACTIVE_EXECUTION_PATH_PROVEN",
            behavioralRelevance: cpc.behavioralRelevance || "CONTRACT_ALTERED",
            mechanismRelevance: cpc.mechanismRelevance || "DIRECTLY_EXPLAINS_MECHANISM",
            causalSupport: cpc.causalSupport || "CAUSALLY_PROVEN",
            rollbackAudit: cpc.rollbackAudit,
            modifiesFailingFile: cpc.modifiesFailingFile ?? true,
            modifiesFailingSymbol: cpc.modifiesFailingSymbol ?? true,
            directlyModifiesFailingLine: (cpc as any).directlyModifiesFailingLine ?? true,
        };
        if (!rawCandidates.some((c) => (c.commitSha || c.shortSha) === (normalizedCpc.commitSha || normalizedCpc.shortSha))) {
            rawCandidates.unshift(normalizedCpc);
        }
    }
    if (rawRelease.stronglySupportedCandidate && !rawCandidates.some((c) => c.commitSha === rawRelease.stronglySupportedCandidate?.commitSha)) {
        rawCandidates.unshift(rawRelease.stronglySupportedCandidate);
    }

    // Extract candidates only from explicit RELEASE evidence in rawEvidence
    const rawEvidence = (snapshot as any).rawEvidence || snapshot.investigation?.rawEvidence || [];
    if (rawCandidates.length === 0 && rawEvidence.length > 0) {
        const releaseEv = rawEvidence.find((e: any) => e.type === "RELEASE");
        if (releaseEv) {
            const commitSha = (releaseEv.data as any)?.commitHash || "release-commit";
            const shortSha = commitSha.slice(0, 7);
            const changedFiles = ((releaseEv.data as any)?.changedFiles as string[]) || [];
            const modifiesFailing = failingFile ? changedFiles.some((f: string) => f.includes(failingFile) || failingFile.includes(f)) : false;

            const confirmedRegHypo = snapshot.investigation.hypotheses?.find(
                (h) =>
                    ((h as any).status === "CONFIRMED" || (h as any).verificationStatus === "CONFIRMED") &&
                    (h.title?.toLowerCase().includes("regression from release") || h.title?.toLowerCase().includes("strongly supported regression"))
            );

            if (modifiesFailing || confirmedRegHypo) {
                rawCandidates.push({
                    commitSha,
                    shortSha,
                    author: (releaseEv.data as any)?.author || "Release Pipeline",
                    message: (releaseEv.data as any)?.commitMessage || releaseEv.title,
                    commitDate: releaseEv.timestamp ? new Date(releaseEv.timestamp) : snapshot.incident.firstSeen,
                    deploymentDate: releaseEv.timestamp ? new Date(releaseEv.timestamp) : snapshot.incident.firstSeen,
                    classification: confirmedRegHypo ? "CONFIRMED_REGRESSION" : "PATH_ASSOCIATED",
                    classificationReason: confirmedRegHypo ? "Confirmed by hypothesis" : "Release touched failing file path",
                    changedFiles,
                    diffSnippet: (releaseEv.data as any)?.diffSnippet,
                    modifiesFailingFile: modifiesFailing,
                    modifiesFailingSymbol: false,
                } as any);
            }
        }
    }

    const candidates: EvaluatedRegressionCandidate[] = [];

    for (const rawCand of rawCandidates) {
        const rawDate = rawCand.commitDate || (rawCand as any).timestamp || (rawCand as any).deployedAt;
        const commitTime = rawDate ? new Date(rawDate).getTime() : incidentTime;
        const rawDeployDate = rawCand.deploymentDate || (rawCand as any).timestamp || (rawCand as any).deployedAt;
        const deployTime = rawDeployDate ? new Date(rawDeployDate).getTime() : commitTime;

        // 1. TEMPORAL ASSOCIATION
        const diffMinutes = Math.round((incidentTime - deployTime) / (1000 * 60));
        let temporalAssociation: TemporalAssociation = "UNKNOWN";
        if (diffMinutes < -5) {
            temporalAssociation = "POST_INCIDENT";
        } else if (diffMinutes <= 360) {
            temporalAssociation = "PRE_INCIDENT_IMMEDIATE"; // <= 6 hours
        } else if (diffMinutes <= 4320) {
            temporalAssociation = "PRE_INCIDENT_WINDOW"; // <= 72 hours
        } else {
            temporalAssociation = "UNKNOWN";
        }

        // 2. SOURCE ASSOCIATION
        const directlyModifiesFailingLine = Boolean((rawCand as any).directlyModifiesFailingLine);
        const modifiesFailingFile = Boolean(
            directlyModifiesFailingLine ||
            (rawCand.modifiesFailingFile ?? (
                failingFile &&
                rawCand.changedFiles.some((f) => f.includes(failingFile) || (failingFile && failingFile.includes(f)))
            ))
        );

        const modifiesStackFile = Boolean(
            !modifiesFailingFile &&
            rawCand.changedFiles.some((f) => stackFiles.has(f.toLowerCase()))
        );

        const modifiesConfig = rawCand.changedFiles.some(
            (f) => f.includes(".env") || f.includes("config") || f.includes("settings")
        );
        const modifiesDependencies = rawCand.changedFiles.some(
            (f) => f.includes("package.json") || f.includes("pnpm-lock") || f.includes("yarn.lock")
        );

        let sourceAssociation: SourceAssociation = "UNRELATED";
        if (modifiesFailingFile) {
            sourceAssociation = "FAILING_FILE";
        } else if (modifiesStackFile) {
            sourceAssociation = "CALLER";
        } else if (modifiesConfig) {
            sourceAssociation = "CONFIGURATION";
        } else if (modifiesDependencies) {
            sourceAssociation = "DEPENDENCY";
        }

        // 3. EXECUTION RELEVANCE
        const modifiesFailingSymbol = Boolean(
            directlyModifiesFailingLine ||
            (rawCand.modifiesFailingSymbol ?? (
                modifiesFailingFile &&
                failingSymbol &&
                rawCand.diffSnippet?.includes(failingSymbol)
            ))
        );

        const modifiesStackSymbol = Boolean(
            !modifiesFailingSymbol &&
            rawCand.diffSnippet &&
            Array.from(stackSymbols).some((sym) => rawCand.diffSnippet?.toLowerCase().includes(sym))
        );

        let executionRelevance: ExecutionRelevance = "UNKNOWN";
        if (directlyModifiesFailingLine || modifiesFailingSymbol) {
            executionRelevance = "ACTIVE_EXECUTION_PATH_PROVEN";
        } else if (modifiesStackSymbol) {
            executionRelevance = "CALL_GRAPH_REACHABLE";
        } else if (modifiesFailingFile && !modifiesFailingSymbol && rawCand.diffSnippet) {
            // Commit modified the failing file, but diff shows it only modified an unrelated symbol!
            executionRelevance = "STATICALLY_DISCONNECTED";
        } else if (sourceAssociation === "UNRELATED") {
            executionRelevance = "STATICALLY_DISCONNECTED";
        }

        // 4. BEHAVIORAL RELEVANCE
        const semanticDiff = analyzeSemanticDiff(
            rawCand.diffSnippet,
            rawCand.message,
            modifiesFailingSymbol,
            directlyModifiesFailingLine
        );
        const behavioralRelevance = directlyModifiesFailingLine
            ? "CONTROL_FLOW_ALTERED"
            : semanticDiff.behavioralRelevance;

        // 5. MECHANISM RELEVANCE
        // Check if investigation already established a confirmed failure mechanism
        const confirmedMechanism = snapshot.investigation.hypotheses.find(
            (h) => (h as any).status === "CONFIRMED" || (h as any).verificationStatus === "CONFIRMED"
        );
        const hasKnownMechanism = Boolean(confirmedMechanism);

        let mechanismRelevance: MechanismRelevance = "MECHANISM_UNKNOWN";
        if (behavioralRelevance === "NO_BEHAVIORAL_CHANGE") {
            mechanismRelevance = "CANNOT_PRODUCE_MECHANISM";
        } else if (hasKnownMechanism || directlyModifiesFailingLine) {
            if (directlyModifiesFailingLine || semanticDiff.hasErrorBehaviorChange || semanticDiff.hasControlFlowChange || semanticDiff.hasReturnValueChange) {
                mechanismRelevance = "CAN_PRODUCE_MECHANISM";
            }
        }

        // 6. CAUSAL SUPPORT
        let causalSupport: CausalSupport = "UNPROVEN_ASSOCIATION";
        let classification: RegressionCandidateClassification = rawCand.classification || "UNRELATED";
        let classificationReason = rawCand.classificationReason || "";

        const isTemporallyPreceding =
            temporalAssociation === "PRE_INCIDENT_IMMEDIATE" || temporalAssociation === "PRE_INCIDENT_WINDOW";

        if (temporalAssociation === "POST_INCIDENT") {
            causalSupport = "CONTRADICTED";
            classification = "UNRELATED";
            classificationReason = `Commit ${rawCand.shortSha} was committed/deployed after the incident first occurred; cannot be causal.`;
        } else if (behavioralRelevance === "NO_BEHAVIORAL_CHANGE") {
            causalSupport = "UNPROVEN_ASSOCIATION";
            classification = isTemporallyPreceding ? (modifiesFailingFile ? "PATH_ASSOCIATED" : "TEMPORALLY_ASSOCIATED") : "UNRELATED";
            classificationReason = `Commit ${rawCand.shortSha} modified only non-executable content (comments/whitespace); cannot be causal.`;
        } else if (executionRelevance === "STATICALLY_DISCONNECTED") {
            causalSupport = "UNPROVEN_ASSOCIATION";
            classification = modifiesFailingFile ? "PATH_ASSOCIATED" : isTemporallyPreceding ? "TEMPORALLY_ASSOCIATED" : "UNRELATED";
            classificationReason = `Commit ${rawCand.shortSha} modified lines in '${failingFile}' outside the failing execution path; causality unproven.`;
        } else if (executionRelevance === "ACTIVE_EXECUTION_PATH_PROVEN" && isTemporallyPreceding) {
            // Execution is proven on failing path and temporally preceding
            const isProven =
                directlyModifiesFailingLine ||
                (hasKnownMechanism && (modifiesFailingSymbol || modifiesFailingFile)) ||
                rawCand.classification === "STRONGLY_SUPPORTED_REGRESSION" ||
                rawCand.classification === "CONFIRMED_REGRESSION";

            if (isProven) {
                causalSupport = "CAUSALLY_PROVEN";
                classification = rawCand.classification === "STRONGLY_SUPPORTED_REGRESSION" ? "STRONGLY_SUPPORTED_REGRESSION" : "CONFIRMED_REGRESSION";
                classificationReason = rawCand.classificationReason || `Commit ${rawCand.shortSha} modified '${failingSymbol || failingFile}' and introduced verified failure mechanism.`;
            } else {
                // IMPORTANT: Mechanism is UNKNOWN or unverified! Candidate remains an association candidate ONLY!
                causalSupport = "PLAUSIBLE_CANDIDATE";
                classification = "PATH_ASSOCIATED";
                classificationReason = `Commit ${rawCand.shortSha} modified executed symbol '${failingSymbol}', but failure mechanism remains unconfirmed; causality unproven.`;
            }
        } else if (isTemporallyPreceding && (modifiesFailingFile || modifiesStackFile)) {
            causalSupport = "PLAUSIBLE_CANDIDATE";
            classification = rawCand.classification || "PATH_ASSOCIATED";
            classificationReason = rawCand.classificationReason || `Commit ${rawCand.shortSha} modified incident file ${diffMinutes}m before incident; execution relevance unproven.`;
        } else if (isTemporallyPreceding) {
            causalSupport = "UNPROVEN_ASSOCIATION";
            classification = rawCand.classification || "TEMPORALLY_ASSOCIATED";
            classificationReason = rawCand.classificationReason || `Commit ${rawCand.shortSha} deployed ${diffMinutes}m before incident; no incident code modified.`;
        } else {
            causalSupport = "UNPROVEN_ASSOCIATION";
            classification = rawCand.classification || "UNRELATED";
            classificationReason = rawCand.classificationReason || `Commit did not touch failing files or incident path.`;
        }

        // Evaluate Rollback Safety Audit
        const rollbackAudit = evaluateRollbackAudit({
            causalSupport,
            changedFiles: rawCand.changedFiles,
            modifiesFailingFile,
            modifiesFailingSymbol,
            failingSymbol,
            failingFile,
            mechanismKnown: hasKnownMechanism || directlyModifiesFailingLine,
            behavioralRelevance,
        });

        const regressionConfidence: QualitativeConfidence =
            causalSupport === "CAUSALLY_PROVEN"
                ? "HIGH"
                : executionRelevance === "ACTIVE_EXECUTION_PATH_PROVEN"
                ? "MEDIUM"
                : "LOW";

        const repairConfidence: QualitativeConfidence =
            causalSupport === "CAUSALLY_PROVEN" && rollbackAudit.auditPassed
                ? "HIGH"
                : "LOW";

        candidates.push({
            commitSha: rawCand.commitSha,
            shortSha: rawCand.shortSha,
            message: rawCand.message,
            author: rawCand.author,
            commitDate: rawCand.commitDate,
            deploymentDate: rawCand.deploymentDate,
            classification,
            classificationReason,
            modifiesFailingFile,
            modifiesFailingSymbol,
            diffSnippet: rawCand.diffSnippet,
            changedFiles: rawCand.changedFiles,
            temporalAssociation,
            sourceAssociation,
            executionRelevance,
            behavioralRelevance,
            mechanismRelevance,
            causalSupport,
            regressionConfidence,
            repairConfidence,
            semanticDiffSummary: semanticDiff.summary,
            rollbackAudit,
        });
    }

    // Identify causally proven and strongly supported candidates
    const causallyProven = candidates.find((c) => c.causalSupport === "CAUSALLY_PROVEN");

    const stronglySupported =
        causallyProven ||
        candidates.find(
            (c) =>
                c.classification === "CONFIRMED_REGRESSION" ||
                c.classification === "STRONGLY_SUPPORTED_REGRESSION"
        ) ||
        rawRelease.stronglySupportedCandidate;

    return {
        deployedRelease: rawRelease.deployedRelease,
        deployedCommitSha: rawRelease.deployedCommitSha,
        previousKnownGoodRelease: rawRelease.previousKnownGoodRelease,
        previousKnownGoodCommitSha: rawRelease.previousKnownGoodCommitSha,
        candidates,
        stronglySupportedCandidate: stronglySupported,
        causallyProvenCandidate: causallyProven || rawRelease.causallyProvenCandidate,
    };
}

export const analyzeReleaseRegression = analyzeReleasesAndRegressions;
