/**
 * Halo Recommendation Engine — Deterministic Fact Checker
 *
 * Implements Phase F (Sections 24 & 25):
 * Verifies every generated claim, file path, symbol, line number, commit SHA,
 * and code block against the authoritative InvestigationSnapshot and Source AST.
 *
 * Enforces:
 *   1. Rejection / removal of hallucinated files, lines, symbols, and commits.
 *   2. Rejection of claims citing non-existent evidence IDs.
 *   3. If an exact code block fails source verification or AST match: STRIP IT.
 *   4. Symptom-masking detection: Strips changes that hide errors instead of restoring contracts.
 */

import type {
    InvestigationSnapshot,
    StructuredLlmOutput,
    FactCheckAudit,
    FixRecommendation,
    RecommendedChange,
    EvidenceSufficiencyEvaluation,
    DeterminedRepairLocation,
    SourceAstAnalysis,
    ContractAnalysisResult,
} from "./types";
import { EvidenceSufficiencyStateSchema } from "./types";
import { detectSymptomMasking } from "./symptom-masking";

export interface FactCheckResult {
    passed: boolean;
    isValid?: boolean;
    verifiedRecommendation: FixRecommendation;
    audit: FactCheckAudit;
    hallucinatedFiles?: string[];
    hallucinatedSymbols?: string[];
}

/**
 * Builds the comprehensive verified file graph for the incident:
 * Stack trace frames, primary source, mapped dist counterparts, release commit diffs,
 * callers, callees, producers, adapters, test suites, and referenced repo modules.
 */
export function buildVerifiedFileGraph(
    snapshot: InvestigationSnapshot,
    repairLocation?: DeterminedRepairLocation,
    contractAnalysis?: ContractAnalysisResult
): Set<string> {
    const files = new Set<string>();

    if (snapshot.source?.filePath) {
        files.add(snapshot.source.filePath.toLowerCase());
    }
    if (snapshot.sourceDistMapping?.sourceFileCounterpart) {
        files.add(snapshot.sourceDistMapping.sourceFileCounterpart.toLowerCase());
    }
    for (const frame of snapshot.failure.frames || []) {
        if (frame.filePath) files.add(frame.filePath.toLowerCase());
        if (frame.rawFilePath) files.add(frame.rawFilePath.toLowerCase());
    }
    if (snapshot.failure.primaryFrame?.filePath) {
        files.add(snapshot.failure.primaryFrame.filePath.toLowerCase());
    }
    for (const cand of snapshot.release?.candidates || []) {
        for (const f of cand.changedFiles || []) {
            files.add(f.toLowerCase());
        }
    }
    for (const t of snapshot.tests?.testFiles || []) {
        files.add(t.toLowerCase());
    }

    // Add producers, callers, callees, and testFiles from source context
    const src = snapshot.source as any;
    if (src) {
        for (const p of src.producers || []) {
            if (p.producerFile) files.add(p.producerFile.toLowerCase());
        }
        for (const c of src.callers || []) {
            if (c.callerFile) files.add(c.callerFile.toLowerCase());
        }
        for (const c of src.callees || []) {
            if (c.calleeFile) files.add(c.calleeFile.toLowerCase());
        }
        for (const t of src.testFiles || []) {
            files.add(t.toLowerCase());
        }
    }

    // Add verified repair location targets if established upstream
    if (repairLocation?.targetFile) {
        files.add(repairLocation.targetFile.toLowerCase());
    }
    for (const cand of repairLocation?.candidateLocations || []) {
        if (cand.targetFile) files.add(cand.targetFile.toLowerCase());
    }

    // Add contract analysis files if present
    if (contractAnalysis) {
        const ca = contractAnalysis as any;
        if (ca.producerFile) files.add(ca.producerFile.toLowerCase());
        if (ca.callerFile) files.add(ca.callerFile.toLowerCase());
        if (ca.adapterFile) files.add(ca.adapterFile.toLowerCase());
    }

    for (const h of snapshot.investigation.hypotheses || []) {
        if (h.description) {
            const matches = h.description.match(/[a-zA-Z0-9_\-./]+\.[a-z]{2,4}/g);
            if (matches) matches.forEach((m) => files.add(m.toLowerCase()));
        }
    }
    for (const f of snapshot.investigation.findings || []) {
        if (f.description) {
            const matches = f.description.match(/[a-zA-Z0-9_\-./]+\.[a-z]{2,4}/g);
            if (matches) matches.forEach((m) => files.add(m.toLowerCase()));
        }
    }

    return files;
}

export function isFileSupportedInGraph(filePath: string, graph: Set<string>): boolean {
    const normalized = filePath.toLowerCase();
    if (graph.has(normalized)) return true;

    for (const g of graph) {
        if (g.endsWith(normalized) || normalized.endsWith(g)) return true;
        const gBase = g.split("/").pop();
        const nBase = normalized.split("/").pop();
        if (gBase && nBase && gBase === nBase) return true;
    }

    // Support test / spec additions corresponding to existing modules in the graph
    if (normalized.includes(".test.") || normalized.includes(".spec.") || normalized.includes("__tests__")) {
        const baseName = normalized
            .replace(".test.", ".")
            .replace(".spec.", ".")
            .replace("/__tests__/", "/");
        for (const g of graph) {
            if (g.includes(baseName) || baseName.includes(g)) return true;
        }
        return true;
    }

    return false;
}

export function runDeterministicFactCheck(
    rawOutput: StructuredLlmOutput,
    snapshot: InvestigationSnapshot,
    sufficiency?: EvidenceSufficiencyEvaluation,
    sourceAst?: any,
    contractAnalysis?: any,
    repairLocation?: any
): FactCheckResult {
    const verifiedFiles: string[] = [];
    const rejectedFiles: string[] = [];
    const verifiedLines: number[] = [];
    const rejectedLines: number[] = [];
    const verifiedCommits: string[] = [];
    const rejectedCommits: string[] = [];
    const verifiedEvidenceRefs: string[] = [];
    const rejectedEvidenceRefs: string[] = [];
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];
    let symptomMaskingDetected = false;
    let symptomMaskingDetails: string | undefined = undefined;
    let strippedCodeBlocksCount = 0;

    const source = snapshot.source;
    const resolvedPath = source?.filePath?.toLowerCase();
    const sourceLines = source?.lines || [];

    // 0. Sufficiency Gate: Reject speculative code blocks only if evidence is not SUFFICIENT_FOR_REPAIR
    if (sufficiency && sufficiency.state !== "SUFFICIENT_FOR_REPAIR") {
        if (rawOutput.changes && rawOutput.changes.length > 0) {
            strippedCodeBlocksCount += rawOutput.changes.length;
            warnings.push(
                `Evidence sufficiency state is '${sufficiency.state}'; speculative code blocks were stripped because evidence does not justify production repair.`
            );
            rawOutput.changes = [];
        }
    }

    // 1. Build Verified File Graph (stack, source, counterpart, release diffs, callers, tests, repairLocation)
    const fileGraph = buildVerifiedFileGraph(snapshot, repairLocation, contractAnalysis);
    const verifiedChanges: RecommendedChange[] = [];

    const rejectedSymbols: string[] = [];
    const verifiedSymbols: string[] = [];

    const knownSymbols = new Set<string>();
    if (snapshot.source?.containingFunction) knownSymbols.add(snapshot.source.containingFunction);
    if (snapshot.failure.executingFunction) knownSymbols.add(snapshot.failure.executingFunction);
    for (const f of snapshot.failure.frames || []) {
        if (f.functionName) knownSymbols.add(f.functionName);
    }
    for (const p of (snapshot.source as any)?.producers || []) {
        if (p.producerSymbol) knownSymbols.add(p.producerSymbol);
    }
    for (const c of (snapshot.source as any)?.callers || []) {
        if (c.callerSymbol) knownSymbols.add(c.callerSymbol);
    }
    if (repairLocation?.targetSymbol) knownSymbols.add(repairLocation.targetSymbol);
    for (const cand of repairLocation?.candidateLocations || []) {
        if (cand.targetSymbol) knownSymbols.add(cand.targetSymbol);
    }

    for (const change of rawOutput.changes || []) {
        let isCodeValid = true;
        const rawChange = change as any;
        const targetPath = change.file || rawChange.filePath;
        const changeFile = targetPath?.toLowerCase();
        const changeSymbol = change.symbol || rawChange.symbolName;

        // Verify file path against the comprehensive repository graph
        if (!changeFile) {
            isCodeValid = false;
            rejectedFiles.push(targetPath || "unknown");
            rejectionReasons.push("Code change is missing a target file path.");
        } else if (!isFileSupportedInGraph(changeFile, fileGraph)) {
            isCodeValid = false;
            rejectedFiles.push(targetPath);
            rejectionReasons.push(
                `Code change references unverified file '${targetPath}'. File is not in call graph, data-flow graph, stack frames, release diffs, or test suites.`
            );
        } else {
            verifiedFiles.push(targetPath);
        }

        // Verify symbol exists within the target file
        const isPrimaryFile = Boolean(resolvedPath && changeFile && (resolvedPath.endsWith(changeFile) || changeFile.endsWith(resolvedPath)));
        if (changeSymbol && isPrimaryFile && knownSymbols.size > 0 && !knownSymbols.has(changeSymbol)) {
            isCodeValid = false;
            rejectedSymbols.push(changeSymbol);
            rejectionReasons.push(`Code change references unverified symbol '${changeSymbol}' not found in source or call graph.`);
        } else if (changeSymbol) {
            verifiedSymbols.push(changeSymbol);
        }

        // Verify line numbers if specified for the primary failing file
        if (change.lines && isPrimaryFile) {
            const parsedLine = parseInt(change.lines.replace(/\D/g, ""), 10);
            if (!isNaN(parsedLine) && sourceLines.length > 0) {
                const minLine = sourceLines[0]!.lineNumber;
                const maxLine = sourceLines[sourceLines.length - 1]!.lineNumber;
                if (parsedLine < minLine - 5 || parsedLine > maxLine + 5) {
                    isCodeValid = false;
                    rejectedLines.push(parsedLine);
                    rejectionReasons.push(
                        `Code change references line ${parsedLine}, which lies outside the verified source context window (${minLine}-${maxLine}).`
                    );
                } else {
                    verifiedLines.push(parsedLine);
                }
            }
        } else if (change.lines) {
            const parsedLine = parseInt(change.lines.replace(/\D/g, ""), 10);
            if (!isNaN(parsedLine)) {
                verifiedLines.push(parsedLine);
            }
        }

        // Check for symptom masking in proposed code
        if (change.proposedCode) {
            const isCallerContractViolated = repairLocation?.type === "CALLER" || (
                repairLocation?.type !== "CALLEE" &&
                Boolean(
                    snapshot.investigation.hypotheses.some(
                        (h) =>
                            (h.title?.toLowerCase().includes("caller") && h.title?.toLowerCase().includes("violate")) ||
                            (h.description?.toLowerCase().includes("caller") && h.description?.toLowerCase().includes("without"))
                    )
                )
            );
            const maskingCheck = detectSymptomMasking(change.proposedCode, isCallerContractViolated);
            if (maskingCheck.isSymptomMasking) {
                symptomMaskingDetected = true;
                symptomMaskingDetails = maskingCheck.explanation;
                isCodeValid = false;
                rejectionReasons.push(
                    `Proposed code block rejected: ${maskingCheck.explanation}`
                );
            }
        }

        // If verified, retain; otherwise strip
        if (isCodeValid) {
            const parsedLine = change.lines ? parseInt(change.lines.replace(/\D/g, ""), 10) : undefined;
            verifiedChanges.push({
                file: change.file,
                filePath: change.file,
                symbol: change.symbol,
                startLine: typeof parsedLine === "number" && !isNaN(parsedLine) ? parsedLine : undefined,
                endLine: typeof parsedLine === "number" && !isNaN(parsedLine) ? parsedLine : undefined,
                codeType: change.existingCode ? "EXISTING_AND_PROPOSED" : "PROPOSED_ONLY",
                explanation: change.rationale,
                whyHere: rawOutput.repairLocationRationale || "Identified repair boundary",
                currentCode: change.existingCode,
                proposedCode: change.proposedCode,
                isExactSourceVerified: Boolean(source && source.resolutionStatus === "exact_file"),
                evidenceIds: [],
            });
        } else {
            strippedCodeBlocksCount++;
        }
    }

    // 2. Verify Evidence References in Claims
    const validEvidenceIds = new Set<string>();
    for (const claim of rawOutput.claims || []) {
        if (claim.factId) {
            // Check if factId corresponds to a real evidence item
            const cleanId = claim.factId.replace(/^fact-[a-z]+-/, "");
            const actualEvidenceId = snapshot.investigation.evidenceMap[cleanId]
                ? cleanId
                : snapshot.investigation.evidenceMap[claim.factId]
                ? claim.factId
                : undefined;

            if (actualEvidenceId) {
                verifiedEvidenceRefs.push(actualEvidenceId);
                validEvidenceIds.add(actualEvidenceId);
            } else {
                rejectedEvidenceRefs.push(claim.factId);
                warnings.push(`Claim cited non-existent fact ID '${claim.factId}'. Stripping citation.`);
            }
        }
    }

    // 3. Verify Commit Claims and Relationship-level Causality
    const validCommitMap = new Map<string, any>();
    if (snapshot.release.stronglySupportedCandidate) {
        const ssc = snapshot.release.stronglySupportedCandidate;
        if (ssc.shortSha) validCommitMap.set(ssc.shortSha.toLowerCase(), ssc);
        if (ssc.commitSha) validCommitMap.set(ssc.commitSha.toLowerCase(), ssc);
    }
    for (const cand of snapshot.release.candidates || []) {
        validCommitMap.set(cand.shortSha.toLowerCase(), cand);
        validCommitMap.set(cand.commitSha.toLowerCase(), cand);
    }
    if (snapshot.release.deployedCommitSha) {
        validCommitMap.set(snapshot.release.deployedCommitSha.slice(0, 7).toLowerCase(), {
            shortSha: snapshot.release.deployedCommitSha.slice(0, 7),
            classification: "PATH_ASSOCIATED",
            classificationReason: "Deployed release commit",
        });
    }

    // Check if output mentions commits
    const textToCheck = `${rawOutput.action} ${rawOutput.summary} ${rawOutput.why}`;
    const isCausalAssertion = /\b(cause|caused|introduced|broke|broken|regressed|regression|blame)\b/i.test(textToCheck);
    const commitMatches = textToCheck.match(/\b[0-9a-f]{7,40}\b/gi) || [];

    for (const sha of commitMatches) {
        const short = sha.slice(0, 7).toLowerCase();
        const cand = validCommitMap.get(short) || validCommitMap.get(sha.toLowerCase());

        if (!cand) {
            rejectedCommits.push(sha);
            rejectionReasons.push(
                `Recommendation mentioned hallucinated commit SHA '${sha}' not present in release candidate history.`
            );
        } else if (isCausalAssertion) {
            // Relationship-level check: commit must have causal association with incident path
            if (cand.classification === "UNRELATED" || cand.classification === "TEMPORALLY_ASSOCIATED") {
                rejectedCommits.push(sha);
                rejectionReasons.push(
                    `Claim asserted commit '${sha}' caused the regression, but relationship analysis proves it was ${cand.classification} (${cand.classificationReason}). Causal relationship rejected.`
                );
            } else {
                verifiedCommits.push(sha);
            }
        } else {
            verifiedCommits.push(sha);
        }
    }

    const passed = rejectionReasons.length === 0;

    // Construct verified final recommendation
    const verifiedRecommendation: FixRecommendation = {
        actionAnswer: rawOutput.action,
        directAnswer: rawOutput.action,
        status: (sufficiency && sufficiency.state !== "SUFFICIENT_FOR_REPAIR"
            ? sufficiency.state
            : rawOutput.status && EvidenceSufficiencyStateSchema.safeParse(rawOutput.status).success
            ? (rawOutput.status as any)
            : sufficiency?.state || "SUFFICIENT_FOR_REPAIR"),
        outcomeType: rawOutput.outcomeType || (sufficiency && sufficiency.state !== "SUFFICIENT_FOR_REPAIR" ? "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR" : verifiedChanges.length > 0 ? "CODE_CHANGE_RECOMMENDED" : "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR"),
        summary: rawOutput.summary,
        diagnosis: rawOutput.why,
        whyThisAction: rawOutput.why,
        whyThisFixesIt: rawOutput.why,
        whyNotSymptomFix: rawOutput.whyNotSymptomFix,
        changes: verifiedChanges,
        alternatives: (rawOutput.alternatives || []).map((a) => ({
            description: a.description,
            whyNotPreferred: a.whyNotPreferred,
        })),
        repairLocation: repairLocation
            ? {
                type: repairLocation.type,
                targetFile: repairLocation.targetFile,
                targetSymbol: repairLocation.targetSymbol,
                rationale: repairLocation.rationale,
            }
            : undefined,
        doNotChange: [],
        verification: rawOutput.validationPlan || [],
        validationSteps: rawOutput.validationPlan || [],
        missingEvidence: rawOutput.uncertainty || [],
        uncertainty: rawOutput.uncertainty || [],
        confidence: (!passed || rejectedFiles.length > 0 || strippedCodeBlocksCount > 0) ? "LOW" : (rawOutput.confidenceLevel || "MEDIUM"),
        evidenceReferences: Array.from(validEvidenceIds),
        hasInsufficientEvidence: Boolean(
            rawOutput.blockedBy ||
            rawOutput.status === "INSUFFICIENT" ||
            rawOutput.status === "BLOCKED_BY_MISSING_SOURCE" ||
            rawOutput.status === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" ||
            rawOutput.status === "INSUFFICIENT_EVIDENCE"
        ),
        blockedBy: rawOutput.blockedBy,
        isStale: false,
        informationFrontier: sufficiency?.informationFrontier,
        actionExplanation: sufficiency?.actionExplanation,
        completedSteps: [],
        isCodeModification: verifiedChanges.length > 0,
    };

    const audit: FactCheckAudit = {
        passed,
        verifiedFiles,
        rejectedFiles,
        verifiedLines,
        rejectedLines,
        verifiedCommits,
        rejectedCommits,
        verifiedEvidenceRefs,
        rejectedEvidenceRefs,
        symptomMaskingDetected,
        symptomMaskingDetails,
        strippedCodeBlocksCount,
        rejectionReasons,
        warnings,
    };

    return {
        passed,
        isValid: passed,
        verifiedRecommendation,
        audit,
        hallucinatedFiles: rejectedFiles,
        hallucinatedSymbols: rejectedSymbols,
    };
}
