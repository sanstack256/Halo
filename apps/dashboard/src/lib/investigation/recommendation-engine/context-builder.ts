/**
 * Halo Recommendation Engine — Recommendation Context Builder
 *
 * Implements Phases 4, 5, 8, 10, 16, 17, and 38:
 * - Builds a compact, structured, provenance-aware context from EvidenceSnapshot.
 * - Enforces Epistemic separation: FACT, SUPPORTED_INFERENCE, RECOMMENDATION, UNKNOWN.
 * - Traces value-flow across callers, adapters, and consumers.
 * - Distinguishes historical failing release from current repository state (Already-Fixed detection).
 * - Avoids dumping entire investigations or repositories into the LLM context.
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { EpistemicCategory } from "./types";
import { analyzeContractMismatch } from "../repair-intelligence/contract-mismatch-engine";
import { analyzeProtections } from "../repair-intelligence/protection-analyzer";

export interface EpistemicClaim {
    category: EpistemicCategory;
    statement: string;
    evidenceIds: string[];
    sourceLocation?: {
        file: string;
        line?: number;
        symbol?: string;
    };
}

export interface RecommendationContext {
    tenant: {
        projectId: string;
        organizationId?: string;
    };
    scope: {
        issueId?: string;
        anchorEventId?: string;
        release?: string;
    };
    issue: {
        title: string;
        errorType: string;
        errorMessage: string;
        service?: string;
        environment?: string;
        release?: string;
    };
    runtime: {
        anchorErrorId?: string;
        primaryFrame?: {
            functionName: string;
            filePath: string;
            lineNumber?: number;
            columnNumber?: number;
            classification: string;
        };
        failingExpression?: string;
        failingStatement?: string;
        containingFunction?: string;
        runtimeValueStatus: "CAPTURED" | "NOT_CAPTURED";
        runtimeValue?: string;
        callChain: Array<{
            functionName: string;
            filePath?: string;
            lineNumber?: number;
        }>;
    };
    source: {
        filePath?: string;
        failingLine?: number;
        startLine?: number;
        lines?: Array<{ lineNumber: number; content: string; isFailingLine: boolean }>;
        resolutionStatus: string;
        isExactSourceVerified: boolean;
        isHistorical: boolean;
    };
    contractAnalysis: {
        hasMismatch: boolean;
        recommendedRepairSide: "CALLER" | "CALLEE" | "SHARED_TYPE" | "CONFIG" | "NONE";
        isAlreadyFixed: boolean;
        alreadyFixedDetails?: string;
        antiMaskingAlert?: string;
        brokenContractBoundary?: {
            caller?: { file: string; line?: number; symbol?: string };
            callee?: { file: string; line?: number; symbol?: string };
            contractType: string;
            mismatchKind: string;
            description: string;
        };
    };
    protectionStatus: {
        hasGuard: boolean;
        hasOptionalChaining: boolean;
        hasFallbackDefault: boolean;
        riskLevel: "SAFE" | "DEFENSIVE_MASKING" | "UNPROTECTED" | "PARTIALLY_GUARDED";
        notes: string;
    };
    epistemicClaims: EpistemicClaim[];
    unknowns: string[];
}

/**
 * Builds the compact, verified recommendation context from the canonical snapshot.
 */
export function buildRecommendationContext(snapshot: EvidenceSnapshot): RecommendationContext {
    const anchor = snapshot.runtime?.anchorError || snapshot.evidence[0];
    const frame = snapshot.runtime?.primaryFailingFrame;
    const source = snapshot.source;

    const errorType = (anchor?.metadata?.class as string) || anchor?.title?.split(":")[0] || "Error";
    const errorMessage = (anchor?.metadata?.message as string) || anchor?.title || "Unknown error";

    const isExactSourceVerified = Boolean(
        source &&
        source.resolutionStatus === "exact_file" &&
        source.lines &&
        source.lines.length > 0
    );

    // Epistemic category buckets
    const claims: EpistemicClaim[] = [];
    const unknowns: string[] = [];

    // 1. Establish observed runtime facts
    if (anchor) {
        claims.push({
            category: "FACT",
            statement: `Incident occurrence recorded in ${anchor.service || "service"} (${anchor.environment || "production"}) on release ${anchor.release || "unspecified"}.`,
            evidenceIds: [anchor.id],
        });
        claims.push({
            category: "FACT",
            statement: `Exception: ${anchor.title}.`,
            evidenceIds: [anchor.id],
        });
    }

    if (frame) {
        claims.push({
            category: "FACT",
            statement: `Failing execution reached ${frame.functionName} at ${frame.filePath}:${frame.lineNumber || "?"}.`,
            evidenceIds: anchor ? [anchor.id] : [],
            sourceLocation: {
                file: frame.filePath,
                line: frame.lineNumber,
                symbol: frame.functionName,
            },
        });
    }

    // 2. Source resolution facts
    if (isExactSourceVerified && source) {
        claims.push({
            category: "FACT",
            statement: `Source code verified for ${source.filePath} around line ${source.failingLineNumber}.`,
            evidenceIds: anchor ? [anchor.id] : [],
            sourceLocation: {
                file: source.filePath,
                line: source.failingLineNumber,
                symbol: source.containingFunction,
            },
        });
    } else {
        unknowns.push("Exact source code corresponding to the failing release revision could not be resolved.");
    }

    // 3. Runtime value flow observation
    const runtimeValue = anchor?.metadata?.failingValue as string | undefined;
    const runtimeValueStatus = runtimeValue !== undefined ? "CAPTURED" : "NOT_CAPTURED";
    if (runtimeValueStatus === "NOT_CAPTURED") {
        unknowns.push("Exact dynamic runtime argument values and return outcomes were not captured in telemetry.");
    } else {
        claims.push({
            category: "FACT",
            statement: `Runtime value observed: ${runtimeValue}`,
            evidenceIds: anchor ? [anchor.id] : [],
        });
    }

    // 4. Protection & AST analysis
    let protectionStatus: {
        hasGuard: boolean;
        hasOptionalChaining: boolean;
        hasFallbackDefault: boolean;
        riskLevel: "SAFE" | "DEFENSIVE_MASKING" | "UNPROTECTED" | "PARTIALLY_GUARDED";
        notes: string;
    } = {
        hasGuard: false,
        hasOptionalChaining: false,
        hasFallbackDefault: false,
        riskLevel: "UNPROTECTED",
        notes: "No protective constructs detected around failing expression.",
    };

    if (source?.lines && source.failingLineNumber) {
        const analysis = analyzeProtections({
            source,
            failingLineNumber: source.failingLineNumber,
            failingExpression: source.failingExpression || snapshot.runtime?.failingExpression,
            containingFunction: source.containingFunction || snapshot.runtime?.containingFunction,
        });

        const hasGuard = analysis.guards.length > 0;
        const hasOptionalChaining = analysis.guards.some((g) => g.guardType === "OPTIONAL_CHAINING");
        const hasFallbackDefault = analysis.guards.some((g) => g.guardType === "FALLBACK");
        const riskLevel = analysis.isSymptomSuppressionOnly
            ? ("DEFENSIVE_MASKING" as const)
            : hasGuard
            ? ("PARTIALLY_GUARDED" as const)
            : ("UNPROTECTED" as const);

        protectionStatus = {
            hasGuard,
            hasOptionalChaining,
            hasFallbackDefault,
            riskLevel,
            notes: analysis.summary,
        };

        if (riskLevel === "DEFENSIVE_MASKING") {
            claims.push({
                category: "SUPPORTED_INFERENCE",
                statement: `Failing site exhibits defensive symptom-masking constructs without addressing root caller contract.`,
                evidenceIds: anchor ? [anchor.id] : [],
            });
        }
    }

    // 5. Contract Mismatch Analysis
    let contractAnalysisResult: {
        hasMismatch: boolean;
        recommendedRepairSide: "CALLER" | "CALLEE" | "SHARED_TYPE" | "CONFIG" | "NONE";
        isAlreadyFixed: boolean;
        alreadyFixedDetails?: string;
        antiMaskingAlert?: string;
        brokenContractBoundary?: any;
    } = {
        hasMismatch: false,
        recommendedRepairSide: "NONE",
        isAlreadyFixed: false,
        alreadyFixedDetails: undefined,
        antiMaskingAlert: undefined,
        brokenContractBoundary: undefined,
    };

    if (source) {
        const fullSource = source.lines ? source.lines.map((l) => l.content).join("\n") : "";
        const analysis = analyzeContractMismatch({
            calleeSource: fullSource ? { filePath: source.filePath, content: fullSource } : undefined,
            failingSymbol: source.containingFunction,
            failingLine: source.failingLineNumber,
            failingExpression: source.failingExpression,
            runtimeValue,
            runtimeValueStatus,
            errorTitle: anchor?.title,
            errorMessage,
        });

        contractAnalysisResult = {
            hasMismatch: analysis.hasMismatch,
            recommendedRepairSide: analysis.recommendedRepairSide,
            isAlreadyFixed: analysis.isAlreadyFixed,
            alreadyFixedDetails: analysis.alreadyFixedDetails,
            antiMaskingAlert: analysis.antiMaskingAlert,
            brokenContractBoundary: analysis.brokenBoundary ? {
                caller: {
                    file: analysis.brokenBoundary.callerFile,
                    line: analysis.brokenBoundary.callerLine,
                    symbol: analysis.brokenBoundary.callerSymbol,
                },
                callee: {
                    file: analysis.brokenBoundary.calleeFile,
                    line: analysis.brokenBoundary.calleeLine,
                    symbol: analysis.brokenBoundary.calleeSymbol,
                },
                contractType: analysis.brokenBoundary.expectedContract,
                mismatchKind: analysis.brokenBoundary.contractMismatchKind,
                description: analysis.brokenBoundary.discrepancyExplanation,
            } : undefined,
        };

        if (analysis.isAlreadyFixed) {
            claims.push({
                category: "FACT",
                statement: `Current repository source revision already contains the fix: ${analysis.alreadyFixedDetails || "Contract check or guard is present."}`,
                evidenceIds: [],
            });
        }
    }

    // 6. Causal chain & findings from investigation
    if (snapshot.investigation?.findings) {
        for (const finding of snapshot.investigation.findings) {
            claims.push({
                category: finding.causalRole === "CAUSE" || finding.causalRole === "TRIGGER" ? "SUPPORTED_INFERENCE" : "FACT",
                statement: `Investigation finding: ${finding.title}. ${finding.description}`,
                evidenceIds: finding.evidenceIds,
            });
        }
    }

    return {
        tenant: {
            projectId: snapshot.tenant.projectId,
            organizationId: snapshot.tenant.organizationId,
        },
        scope: {
            issueId: snapshot.scope.issueId,
            anchorEventId: snapshot.scope.anchorEventId,
            release: snapshot.scope.release,
        },
        issue: {
            title: anchor?.title || "Incident Occurrence",
            errorType,
            errorMessage,
            service: anchor?.service,
            environment: anchor?.environment,
            release: anchor?.release,
        },
        runtime: {
            anchorErrorId: anchor?.id,
            primaryFrame: frame ? {
                functionName: frame.functionName,
                filePath: frame.filePath,
                lineNumber: frame.lineNumber,
                columnNumber: frame.columnNumber,
                classification: frame.classification,
            } : undefined,
            failingExpression: source?.failingExpression || snapshot.runtime?.failingExpression,
            failingStatement: source?.failingStatement || snapshot.runtime?.failingStatement,
            containingFunction: source?.containingFunction || snapshot.runtime?.containingFunction,
            runtimeValueStatus,
            runtimeValue,
            callChain: (snapshot.runtime?.callChain || []).map((step) => ({
                functionName: step.functionName,
                filePath: step.filePath,
                lineNumber: step.lineNumber,
            })),
        },
        source: {
            filePath: source?.filePath,
            failingLine: source?.failingLineNumber,
            startLine: source?.startLineNumber,
            lines: source?.lines,
            resolutionStatus: source?.resolutionStatus || "source_unavailable",
            isExactSourceVerified,
            isHistorical: Boolean(snapshot.scope.release && snapshot.scope.release !== "latest"),
        },
        contractAnalysis: contractAnalysisResult,
        protectionStatus,
        epistemicClaims: claims,
        unknowns,
    };
}
