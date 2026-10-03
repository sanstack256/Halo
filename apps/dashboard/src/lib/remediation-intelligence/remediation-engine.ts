/**
 * HALO TRACE — PILLAR H REMEDIATION INTELLIGENCE ENGINE
 * Evidence-Backed Remediation Intelligence
 *
 * Deterministic generation of inspectable, evidence-backed remediation recommendations.
 * Every recommendation is downstream of observed evidence from Pillars 1–G.
 * Zero automatic fixes. Zero blame. Zero fake recommendations. Zero root-cause mutation.
 */

import { prisma } from "@/lib/prisma";
import { synthesizeInvestigationEvidence } from "@/lib/evidence-synthesis/synthesis-engine";
import type {
    InvestigationSynthesis,
    EvidenceClaim,
    EvidenceReference,
} from "@/lib/evidence-synthesis/types";
import type {
    RemediationType,
    RemediationStatus,
    RemediationSupportLevel,
    RemediationRiskLevel,
    RemediationOwnerContext,
    HistoricalRemediationContext,
    RemediationRecommendationDomain,
    RemediationNoteDomain,
    GenerateRemediationsParams,
    RemediationPlanResult,
} from "./types";
import crypto from "crypto";

// Tenant-safe in-memory cache
interface CacheEntry {
    result: RemediationPlanResult;
    cachedAt: number;
}
const remediationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30s cache TTL

export function clearRemediationCache(organizationId?: string, investigationId?: string): void {
    if (!organizationId) {
        remediationCache.clear();
        return;
    }
    for (const key of Array.from(remediationCache.keys())) {
        if (investigationId) {
            if (key === `${organizationId}::${investigationId}`) {
                remediationCache.delete(key);
            }
        } else if (key.startsWith(`${organizationId}::`)) {
            remediationCache.delete(key);
        }
    }
}

/**
 * Generate a deterministic hash for a recommendation key.
 */
function computeRecommendationKey(
    investigationId: string,
    type: RemediationType,
    services: string[],
    paths: string[],
    identifier: string
): string {
    const raw = [
        investigationId,
        type,
        services.slice().sort().join(","),
        paths.slice().sort().join(","),
        identifier,
    ].join("::");
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Primary Remediation Intelligence Generator
 */
export async function generateRemediationRecommendations(
    params: GenerateRemediationsParams
): Promise<RemediationPlanResult> {
    const { investigationId, organizationId, projectId, forceFresh = false } = params;
    const cacheKey = `${organizationId}::${investigationId}`;

    if (!forceFresh) {
        const cached = remediationCache.get(cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
            return cached.result;
        }
    }

    // 1. Fetch canonical Investigation record (read-only verification)
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        include: {
            project: { select: { id: true, organizationId: true } },
            incidentMemory: true,
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    if (investigation.project.organizationId !== organizationId) {
        throw new Error("Tenant isolation violation: Access denied.");
    }

    if (investigation.projectId !== projectId) {
        throw new Error("Project mismatch: Access denied.");
    }

    // 2. Consume existing Pillar G Evidence Synthesis directly (no re-running raw collectors)
    const synthesis: InvestigationSynthesis = await synthesizeInvestigationEvidence({
        investigationId,
        organizationId,
        forceFresh,
    });

    // 3. Fetch any existing stored recommendations to preserve human state (completed, dismissed, notes)
    const existingRecs = await prisma.remediationRecommendation.findMany({
        where: { investigationId, organizationId },
        include: {
            notes: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true, email: true } } },
            },
        },
    });

    const existingByKey = new Map<string, typeof existingRecs[0]>();
    for (const rec of existingRecs) {
        existingByKey.set(rec.recommendationKey, rec);
    }

    // 4. Candidate recommendations accumulator
    const candidates: RemediationRecommendationDomain[] = [];
    const establishedClaims = synthesis.establishedClaims;
    const supportedClaims = synthesis.supportedClaims;
    const activeClaims = [...establishedClaims, ...supportedClaims];

    // Determine root cause service from topology / claims
    let rootCauseService: string | undefined;
    for (const node of synthesis.chain.nodes) {
        if (node.type === "SERVICE" && node.status === "ESTABLISHED") {
            rootCauseService = node.label;
            break;
        }
    }
    if (!rootCauseService && synthesis.claims.length > 0) {
        const svcClaim = synthesis.claims.find((c) => c.relatedServices.length > 0);
        if (svcClaim) {
            rootCauseService = svcClaim.relatedServices[0];
        }
    }

    // Identify impacted surfaces vs root cause service
    const impactedServices = new Set<string>();
    for (const node of synthesis.chain.nodes) {
        if (node.type === "SERVICE" && node.label !== rootCauseService) {
            impactedServices.add(node.label);
        }
    }

    // Check ownership context
    let ownerContext: RemediationOwnerContext | null = null;
    const ownershipClaim = synthesis.claims.find((c) => c.sourceTypes.includes("OWNERSHIP"));
    if (ownershipClaim && ownershipClaim.metadata?.ownershipRecord) {
        const rec = ownershipClaim.metadata.ownershipRecord as Record<string, unknown>;
        ownerContext = {
            declaredOwner: (rec.teamName as string) || (rec.ownerId as string) || "Team Core",
            source: (rec.source as string) || "SERVICE_CONFIG",
            confidence: (rec.confidence as string) || "HIGH",
            conflict: Boolean(rec.conflict),
            conflictDetails: rec.conflictDetails as string | undefined,
        };
    } else if (ownershipClaim) {
        ownerContext = {
            declaredOwner: ownershipClaim.statement.includes("Team")
                ? ownershipClaim.statement.split("Team")[1]?.trim()?.split(" ")[0]
                    ? `Team ${ownershipClaim.statement.split("Team")[1]?.trim()?.split(" ")[0]}`
                    : "Declared Owner"
                : "Declared Service Owner",
            source: "INFERRED",
            confidence: ownershipClaim.status === "ESTABLISHED" ? "HIGH" : "MEDIUM",
        };
    }

    // -------------------------------------------------------------------------
    // RULE A: OBSERVED CODE FAILURE (CODE_CHANGE)
    // -------------------------------------------------------------------------
    for (const claim of activeClaims) {
        const isCodeFailure =
            claim.sourceTypes.includes("STACK") ||
            claim.sourceTypes.includes("RUNTIME") ||
            claim.statement.toLowerCase().includes("threw") ||
            claim.statement.toLowerCase().includes("exception") ||
            claim.statement.toLowerCase().includes("error") ||
            claim.statement.toLowerCase().includes("fails at");

        if (isCodeFailure && claim.relatedCodePaths.length > 0) {
            for (const codePath of claim.relatedCodePaths) {
                const targetService = claim.relatedServices[0] || rootCauseService || "unknown-service";

                // Ensure impacted surfaces are not blindly treated as cause
                if (impactedServices.has(targetService) && rootCauseService && targetService !== rootCauseService) {
                    continue; // Skip recommending code change on impacted surface
                }

                const lineMatch = claim.statement.match(new RegExp(`(?:${codePath.replace(".", "\\.")}|at)\\s*:?(\\d+)`)) || claim.statement.match(/:(\d+)/);
                const lineNum = (claim.metadata?.lineNumber as number) || (lineMatch ? lineMatch[1] : undefined);
                const pathWithLine = lineNum ? `${codePath}:${lineNum}` : codePath;

                const recKey = computeRecommendationKey(
                    investigationId,
                    "CODE_CHANGE",
                    [targetService],
                    [pathWithLine],
                    "code-failure"
                );

                const evRefs = claim.evidenceReferences.map((r) => r.id);
                if (evRefs.length === 0) continue; // Non-negotiable: must have evidence references

                candidates.push({
                    id: "",
                    organizationId,
                    projectId,
                    investigationId,
                    recommendationKey: recKey,
                    type: "CODE_CHANGE",
                    status: "ACTIONABLE",
                    supportLevel: claim.status === "ESTABLISHED" ? "EVIDENCE_BACKED" : "PARTIALLY_SUPPORTED",
                    riskLevel: "MEDIUM",
                    title: `Inspect and review error handling at ${pathWithLine}`,
                    summary: `Reconstructed runtime execution encounters an unhandled failure boundary at ${pathWithLine}.`,
                    action: `Inspect the exception-handling and execution boundary at ${pathWithLine} within service ${targetService}, verifying defensive guards against the observed failure condition.`,
                    rationale: `The reconstructed failing execution reaches ${pathWithLine} and terminates abnormally with: "${claim.statement}".`,
                    expectedOutcome: `The reconstructed failure path at ${pathWithLine} no longer triggers an unhandled exception for matching requests.`,
                    validationMethod: `Replay the failing request shape or execute targeted unit/integration tests against ${pathWithLine} to verify defensive handling.`,
                    prerequisites: [
                        `Verify source checkout for ${targetService} matches the deployed production revision.`,
                    ],
                    evidenceReferences: evRefs,
                    supportingClaimIds: [claim.claimId],
                    affectedServices: [targetService],
                    affectedOperations: claim.relatedOperations,
                    affectedCodePaths: [pathWithLine],
                    ownerContext,
                    uncertainty:
                        "The investigation establishes runtime failure at this execution boundary; verify whether upstream input validation or defensive handling within this component is preferred.",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // RULE B: RELEVANT CHANGE & CODE INTERSECTION (CODE_CHANGE / DEPLOYMENT_REVIEW)
    // -------------------------------------------------------------------------
    const changeClaims = activeClaims.filter((c) => c.sourceTypes.includes("CHANGE"));
    for (const claim of changeClaims) {
        const changedFiles = claim.relatedCodePaths;
        const commitMatch = claim.statement.match(/(?:commit|commitSha)\s+([a-f0-9]+)/i);
        const commitSha = commitMatch ? commitMatch[1] : undefined;
        const targetService = claim.relatedServices[0] || rootCauseService || "core-service";

        if (changedFiles.length > 0) {
            for (const file of changedFiles) {
                const recKey = computeRecommendationKey(
                    investigationId,
                    "CODE_CHANGE",
                    [targetService],
                    [file],
                    commitSha || "intersecting-change"
                );

                const evRefs = claim.evidenceReferences.map((r) => r.id);
                if (evRefs.length === 0) continue;

                candidates.push({
                    id: "",
                    organizationId,
                    projectId,
                    investigationId,
                    recommendationKey: recKey,
                    type: "CODE_CHANGE",
                    status: "ACTIONABLE",
                    supportLevel: "EVIDENCE_BACKED",
                    riskLevel: "LOW",
                    title: `Review intersecting code changes in ${file}${commitSha ? ` (commit ${commitSha.slice(0, 7)})` : ""}`,
                    summary: `Change Intelligence establishes that changes in ${file} directly intersect the reconstructed failing execution path.`,
                    action: `Review the changes introduced in ${file}${commitSha ? ` (commit ${commitSha})` : ""} that intersect the failing execution path, checking for unexpected edge cases or contract regressions.`,
                    rationale: `Code path intersection identified between changed file ${file} and failing runtime stack traces.`,
                    expectedOutcome: `Identify whether specific line modifications in ${file} introduced the behavioral divergence observed during execution.`,
                    validationMethod: `Perform manual diff review of ${file} and cross-reference branch conditions with the observed failure payload.`,
                    prerequisites: [
                        `Inspect diff for commit ${commitSha || "recent change"} in repository.`,
                    ],
                    evidenceReferences: evRefs,
                    supportingClaimIds: [claim.claimId],
                    affectedServices: [targetService],
                    affectedOperations: claim.relatedOperations,
                    affectedCodePaths: [file],
                    ownerContext,
                    uncertainty:
                        "Code-path intersection is established; manual code inspection is required to confirm whether the altered logic or external input values caused the defect.",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // RULE C: DEPLOYMENT REVIEW & ROLLBACK REVIEW
    // -------------------------------------------------------------------------
    const deploymentClaims = activeClaims.filter((c) => c.sourceTypes.includes("DEPLOYMENT"));
    for (const claim of deploymentClaims) {
        const targetService = claim.relatedServices[0] || rootCauseService || "service";
        const evRefs = claim.evidenceReferences.map((r) => r.id);
        if (evRefs.length === 0) continue;

        const depMatch = claim.statement.match(/(?:deployment|release)\s+([a-zA-Z0-9_\-.]+)/i);
        const depId = depMatch ? depMatch[1] : "recent-deployment";

        // 1. DEPLOYMENT_REVIEW
        const depRecKey = computeRecommendationKey(
            investigationId,
            "DEPLOYMENT_REVIEW",
            [targetService],
            [],
            depId
        );

        candidates.push({
            id: "",
            organizationId,
            projectId,
            investigationId,
            recommendationKey: depRecKey,
            type: "DEPLOYMENT_REVIEW",
            status: "ACTIONABLE",
            supportLevel: "EVIDENCE_BACKED",
            riskLevel: "MEDIUM",
            title: `Review deployment ${depId} for service ${targetService}`,
            summary: `Deployment ${depId} correlates with failure onset in service ${targetService}.`,
            action: `Review the deployment containing ${depId} for service ${targetService} and verify whether the affected execution path was introduced or altered by that release.`,
            rationale: `Failure onset timestamp strictly followed deployment ${depId}, with associated code path linkages.`,
            expectedOutcome: `Confirm whether the deployment rollout directly introduced the failing behavioral regression.`,
            validationMethod: `Inspect service telemetry before and after deployment ${depId} to confirm failure rate onset alignment.`,
            prerequisites: [
                `Verify deployment logs and release manifest for ${depId}.`,
            ],
            evidenceReferences: evRefs,
            supportingClaimIds: [claim.claimId],
            affectedServices: [targetService],
            affectedOperations: claim.relatedOperations,
            affectedCodePaths: claim.relatedCodePaths,
            ownerContext,
            uncertainty:
                "Temporal correlation and linkage verified; verify that external upstream changes or migrations did not coincide with this release window.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // 2. ROLLBACK_REVIEW: Requires stronger evidence (verified deployment + relevant service + code path intersection)
        const hasCodeIntersection = claim.relatedCodePaths.length > 0 || changeClaims.length > 0;
        if (hasCodeIntersection && claim.status === "ESTABLISHED") {
            const rollbackRecKey = computeRecommendationKey(
                investigationId,
                "ROLLBACK_REVIEW",
                [targetService],
                [],
                `rollback-${depId}`
            );

            candidates.push({
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: rollbackRecKey,
                type: "ROLLBACK_REVIEW",
                status: "ACTIONABLE",
                supportLevel: "EVIDENCE_BACKED",
                riskLevel: "HIGH",
                title: `Review whether rollback of deployment ${depId} is appropriate`,
                summary: `High-risk operational review: evaluate whether rolling back deployment ${depId} safely restores baseline stability.`,
                action: `Review whether rollback is appropriate for deployment ${depId} on service ${targetService}. Manual evaluation of database schema migrations and forward-compatibility is strictly required before any action.`,
                rationale: `Strong evidence indicates deployment ${depId} introduced changed code intersecting the failure path, and failure onset occurred immediately post-deployment.`,
                expectedOutcome: `If manually executed, rolling back deployment ${depId} would revert the codebase to the verified pre-incident baseline state.`,
                validationMethod: `Audit database migration history and stateful dependencies to ensure backward compatibility prior to any manual rollback decision.`,
                prerequisites: [
                    `Verify that deployment ${depId} contains no irreversible database migrations or schema alterations.`,
                    `Confirm affected production traffic is currently routed to release ${depId}.`,
                ],
                evidenceReferences: evRefs,
                supportingClaimIds: [claim.claimId],
                affectedServices: [targetService],
                affectedOperations: claim.relatedOperations,
                affectedCodePaths: claim.relatedCodePaths,
                ownerContext,
                uncertainty:
                    "Rollback is high-impact and may break stateful dependencies or database schemas. Never execute rollback automatically. Backward compatibility must be manually confirmed.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // -------------------------------------------------------------------------
    // RULE D: CONFIGURATION CHANGE (CONFIGURATION_REVIEW)
    // -------------------------------------------------------------------------
    for (const claim of activeClaims) {
        if (
            claim.statement.toLowerCase().includes("configuration") ||
            claim.metadata?.changeType === "CONFIGURATION_CHANGE"
        ) {
            const evRefs = claim.evidenceReferences.map((r) => r.id);
            if (evRefs.length === 0) continue;
            const targetService = claim.relatedServices[0] || rootCauseService || "service";
            const configArea = (claim.metadata?.configArea as string) || "environment configuration";

            const recKey = computeRecommendationKey(
                investigationId,
                "CONFIGURATION_REVIEW",
                [targetService],
                [],
                configArea
            );

            candidates.push({
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: recKey,
                type: "CONFIGURATION_REVIEW",
                status: "ACTIONABLE",
                supportLevel: "EVIDENCE_BACKED",
                riskLevel: "MEDIUM",
                title: `Review configuration update in ${configArea} for ${targetService}`,
                summary: `Observed configuration changes intersect the failure window.`,
                action: `Review the observed configuration update in ${configArea} for service ${targetService} and evaluate if values or keys deviated from expected operational parameters.`,
                rationale: `Configuration change observed in temporal and service proximity to the failure: "${claim.statement}".`,
                expectedOutcome: `Identify whether configuration parameters or environment variables caused the execution anomaly.`,
                validationMethod: `Compare configuration values in the active deployment against the known stable environment configuration.`,
                prerequisites: [
                    `Retrieve active configuration snapshot for ${targetService}.`,
                ],
                evidenceReferences: evRefs,
                supportingClaimIds: [claim.claimId],
                affectedServices: [targetService],
                affectedOperations: claim.relatedOperations,
                affectedCodePaths: [],
                ownerContext,
                uncertainty:
                    "Configuration alteration verified; confirm whether runtime services reloaded the updated values properly.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // -------------------------------------------------------------------------
    // RULE E: FEATURE FLAG REVIEW (FEATURE_FLAG_REVIEW)
    // -------------------------------------------------------------------------
    for (const claim of activeClaims) {
        if (
            claim.statement.toLowerCase().includes("feature flag") ||
            claim.metadata?.changeType === "FEATURE_FLAG_CHANGE"
        ) {
            const evRefs = claim.evidenceReferences.map((r) => r.id);
            if (evRefs.length === 0) continue;
            const targetService = claim.relatedServices[0] || rootCauseService || "service";
            const flagMatch = claim.statement.match(/flag\s+([a-zA-Z0-9_\-.]+)/i);
            const flagId = flagMatch ? flagMatch[1] : (claim.metadata?.flagName as string) || "feature-flag";

            const recKey = computeRecommendationKey(
                investigationId,
                "FEATURE_FLAG_REVIEW",
                [targetService],
                [],
                flagId
            );

            candidates.push({
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: recKey,
                type: "FEATURE_FLAG_REVIEW",
                status: "ACTIONABLE",
                supportLevel: "EVIDENCE_BACKED",
                riskLevel: "MEDIUM",
                title: `Review feature flag transition: ${flagId}`,
                summary: `Feature flag transition observed intersecting the failure window.`,
                action: `Review the feature flag ${flagId} state transition and audit whether the enabled code path caused the observed failure in service ${targetService}.`,
                rationale: `Feature flag state change observed immediately prior to or during the failure window: "${claim.statement}".`,
                expectedOutcome: `Determine if disabling or adjusting targeting for flag ${flagId} mitigates the failure path.`,
                validationMethod: `Inspect evaluation logs for flag ${flagId} for affected user requests.`,
                prerequisites: [
                    `Access feature flag management console for ${flagId}.`,
                ],
                evidenceReferences: evRefs,
                supportingClaimIds: [claim.claimId],
                affectedServices: [targetService],
                affectedOperations: claim.relatedOperations,
                affectedCodePaths: claim.relatedCodePaths,
                ownerContext,
                uncertainty:
                    "Flag state transition observed; confirm whether all service replicas received the flag evaluation update uniformly.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // -------------------------------------------------------------------------
    // RULE F: DEPENDENCY REVIEW (DEPENDENCY_REVIEW)
    // -------------------------------------------------------------------------
    for (const claim of activeClaims) {
        if (
            claim.statement.toLowerCase().includes("dependency") ||
            claim.metadata?.changeType === "DEPENDENCY_CHANGE"
        ) {
            const evRefs = claim.evidenceReferences.map((r) => r.id);
            if (evRefs.length === 0) continue;
            const targetService = claim.relatedServices[0] || rootCauseService || "service";
            const depMatch = claim.statement.match(/(?:package|dependency|library)\s+([a-zA-Z0-9@/_\-.]+)/i);
            const depName = depMatch ? depMatch[1] : (claim.metadata?.packageName as string) || "dependency";

            const recKey = computeRecommendationKey(
                investigationId,
                "DEPENDENCY_REVIEW",
                [targetService],
                [],
                depName
            );

            candidates.push({
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: recKey,
                type: "DEPENDENCY_REVIEW",
                status: "ACTIONABLE",
                supportLevel: "EVIDENCE_BACKED",
                riskLevel: "MEDIUM",
                title: `Review dependency update: ${depName}`,
                summary: `Third-party package or dependency update intersects the failure.`,
                action: `Review dependency version change for ${depName} in service ${targetService} and audit breaking changes or API shifts in that version.`,
                rationale: `Dependency change detected in proximity to failure: "${claim.statement}".`,
                expectedOutcome: `Determine whether external library behavior in ${depName} diverged from previous expectations.`,
                validationMethod: `Review the changelog and release notes for ${depName} for breaking changes affecting the failed operation.`,
                prerequisites: [
                    `Inspect lockfile / package manifest for version pin of ${depName}.`,
                ],
                evidenceReferences: evRefs,
                supportingClaimIds: [claim.claimId],
                affectedServices: [targetService],
                affectedOperations: claim.relatedOperations,
                affectedCodePaths: claim.relatedCodePaths,
                ownerContext,
                uncertainty:
                    "Dependency version shift established; verify whether transitive dependencies also shifted.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // -------------------------------------------------------------------------
    // RULE G: DATA VALIDATION (DATA_VALIDATION)
    // -------------------------------------------------------------------------
    for (const claim of activeClaims) {
        const isDataBoundaryFailure =
            claim.statement.toLowerCase().includes("undefined") ||
            claim.statement.toLowerCase().includes("null") ||
            claim.statement.toLowerCase().includes("missing field") ||
            claim.statement.toLowerCase().includes("schema validation") ||
            claim.statement.toLowerCase().includes("invalid payload");

        if (isDataBoundaryFailure) {
            const evRefs = claim.evidenceReferences.map((r) => r.id);
            if (evRefs.length === 0) continue;
            const targetService = claim.relatedServices[0] || rootCauseService || "service";
            const targetPath = claim.relatedCodePaths[0] || "data-boundary";

            const recKey = computeRecommendationKey(
                investigationId,
                "DATA_VALIDATION",
                [targetService],
                [targetPath],
                "data-validation"
            );

            candidates.push({
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: recKey,
                type: "DATA_VALIDATION",
                status: "ACTIONABLE",
                supportLevel: claim.status === "ESTABLISHED" ? "EVIDENCE_BACKED" : "PARTIALLY_SUPPORTED",
                riskLevel: "LOW",
                title: `Validate data contract at ${targetPath}`,
                summary: `Runtime evidence demonstrates missing or invalid payload structure at data boundary.`,
                action: `Validate input data contract and add explicit schema validation with null/absent field checks at ${targetPath} before service ${targetService} processes the payload.`,
                rationale: `Observed runtime failure indicates an invalid or undefined data shape at execution boundary: "${claim.statement}".`,
                expectedOutcome: `Missing or malformed data shapes are safely rejected or handled with a graceful fallback rather than an unhandled exception.`,
                validationMethod: `Replay requests with missing or null attributes against the updated boundary to verify clean validation error responses.`,
                prerequisites: [
                    `Confirm expected schema contract between caller and ${targetService}.`,
                ],
                evidenceReferences: evRefs,
                supportingClaimIds: [claim.claimId],
                affectedServices: [targetService],
                affectedOperations: claim.relatedOperations,
                affectedCodePaths: [targetPath],
                ownerContext,
                uncertainty:
                    "Local data absence observed; telemetry does not definitively prove whether the upstream caller omitted the data or if transmission corrupted it.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // -------------------------------------------------------------------------
    // RULE H: OBSERVABILITY GAP (OBSERVABILITY_GAP)
    // -------------------------------------------------------------------------
    // Check unknown claims where upstream telemetry was unobserved in the failure chain
    if (activeClaims.length > 0) {
        const unknownClaims = synthesis.unknownClaims.filter(
            (c) =>
                c.status === "UNKNOWN" &&
                (c.sourceTypes.includes("RUNTIME") ||
                    c.sourceTypes.includes("TRACE") ||
                    c.statement.toLowerCase().includes("telemetry") ||
                    c.statement.toLowerCase().includes("unobserved execution"))
        );
        for (const claim of unknownClaims) {
            const evRefs = claim.evidenceReferences
                .map((r) => r.id)
                .filter(
                    (id) =>
                        !id.startsWith("ref-owner-none") &&
                        !id.startsWith("ref-memory-none") &&
                        !id.startsWith("ref-no-deployment") &&
                        !id.startsWith("ref-sourcemap-unavailable")
                );
            if (evRefs.length === 0) continue;
            const targetService = claim.relatedServices[0] || rootCauseService || "system";
            const boundary = claim.relatedOperations[0] || claim.relatedCodePaths[0] || "unobserved boundary";

            const recKey = computeRecommendationKey(
                investigationId,
                "OBSERVABILITY_GAP",
                [targetService],
                [],
                boundary
            );

            candidates.push({
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: recKey,
                type: "OBSERVABILITY_GAP",
                status: "ACTIONABLE",
                supportLevel: "PARTIALLY_SUPPORTED",
                riskLevel: "LOW",
                title: `Instrument observability for ${boundary} in ${targetService}`,
                summary: `Investigation encountered an unobserved execution or boundary gap preventing definitive causal attribution.`,
                action: `Add telemetry, structured logging, and distributed tracing for ${boundary} in service ${targetService} to capture inbound and outbound contracts.`,
                rationale: `Investigation established downstream failure but telemetry was absent to observe upstream responses: "${claim.statement}".`,
                expectedOutcome: `Future requests crossing ${boundary} will emit span contexts and attributes, eliminating the currently observed blind spot.`,
                validationMethod: `Deploy instrumentation in a non-production environment and verify span generation in tracing console.`,
                prerequisites: [
                    `Verify OpenTelemetry or Halo SDK integration in ${targetService}.`,
                ],
                evidenceReferences: evRefs,
                supportingClaimIds: [claim.claimId],
                affectedServices: [targetService],
                affectedOperations: claim.relatedOperations,
                affectedCodePaths: claim.relatedCodePaths,
                ownerContext,
                uncertainty:
                    "Telemetry is missing; this recommendation addresses the visibility gap and does not constitute proof of an application bug.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // -------------------------------------------------------------------------
    // RULE I: REGRESSION TEST RECOMMENDATION (REGRESSION_TEST)
    // -------------------------------------------------------------------------
    if (establishedClaims.length > 0) {
        const primaryCodeClaim = establishedClaims.find(
            (c) => c.relatedCodePaths.length > 0 || c.relatedOperations.length > 0
        );
        if (primaryCodeClaim) {
            const targetService = primaryCodeClaim.relatedServices[0] || rootCauseService || "core-service";
            const targetPath = primaryCodeClaim.relatedCodePaths[0] || primaryCodeClaim.relatedOperations[0] || "failure-path";
            const evRefs = primaryCodeClaim.evidenceReferences.map((r) => r.id);

            if (evRefs.length > 0) {
                const recKey = computeRecommendationKey(
                    investigationId,
                    "REGRESSION_TEST",
                    [targetService],
                    [targetPath],
                    "regression-test"
                );

                candidates.push({
                    id: "",
                    organizationId,
                    projectId,
                    investigationId,
                    recommendationKey: recKey,
                    type: "REGRESSION_TEST",
                    status: "ACTIONABLE",
                    supportLevel: "EVIDENCE_BACKED",
                    riskLevel: "LOW",
                    title: `Add regression test for ${targetPath} failure condition`,
                    summary: `Verified execution failure path established; regression test required to prevent recurrence.`,
                    action: `Add automated regression coverage targeting the specific failure condition observed at ${targetPath} in service ${targetService}.`,
                    rationale: `A concrete failure path was established by runtime evidence: "${primaryCodeClaim.statement}".`,
                    expectedOutcome: `Automated test suite will catch future regressions before deployment if the failure condition reoccurs.`,
                    validationMethod: `Execute the new regression test against the failing commit to verify it reproduces the defect, and against the patched branch to verify it passes.`,
                    prerequisites: [
                        `Identify test suite directory for ${targetService}.`,
                    ],
                    evidenceReferences: evRefs,
                    supportingClaimIds: [primaryCodeClaim.claimId],
                    affectedServices: [targetService],
                    affectedOperations: primaryCodeClaim.relatedOperations,
                    affectedCodePaths: primaryCodeClaim.relatedCodePaths,
                    ownerContext,
                    uncertainty:
                        "Test asserts behavior on observed execution path; ensure mock data reflects authentic production shapes.",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // RULE J: HISTORICAL REMEDIATION REUSE & MISMATCH
    // -------------------------------------------------------------------------
    if (investigation.incidentMemory) {
        const memRecs = investigation.incidentMemory.recommendations;
        const histList: Array<Record<string, unknown>> = Array.isArray(memRecs)
            ? (memRecs as Array<Record<string, unknown>>)
            : (memRecs as any)?.historicalIncidents || [];
        if (histList.length > 0) {
            const topHist = histList[0];
            const histRec = (topHist.recommendation || topHist.action || topHist.title) as string | undefined;
                if (histRec) {
                    // Check if current code path matches historical code path
                    const histPath = topHist.codePath as string | undefined;
                    const currentPaths = candidates.flatMap((c) => c.affectedCodePaths);
                    const isPathMismatch = histPath && currentPaths.length > 0 && !currentPaths.includes(histPath);

                    const histContext: HistoricalRemediationContext = {
                        historicalIncidentId: topHist.id as string | undefined,
                        historicalRecommendation: histRec,
                        similarity: (topHist.similarity as string) || "High structural similarity to historical incident.",
                        difference: isPathMismatch
                            ? `Current failure involves code path (${currentPaths.join(", ")}) whereas historical incident was at (${histPath}).`
                            : "Similar failure boundary and error signature.",
                        mismatchNote: isPathMismatch
                            ? "Historical remediation may not apply directly because the current failure involves a different observed change/code path."
                            : undefined,
                    };

                    // Attach historical context to candidates
                    for (const cand of candidates) {
                        if (!cand.historicalContext) {
                            cand.historicalContext = histContext;
                        }
                    }
                }
            }
        }

    // -------------------------------------------------------------------------
    // CONTRADICTION & MERGING HANDLING
    // -------------------------------------------------------------------------
    // Check for contradictory paths (e.g. Rollback Review vs Code Change forward fix)
    const hasRollback = candidates.some((c) => c.type === "ROLLBACK_REVIEW");
    const hasCodeFix = candidates.some((c) => c.type === "CODE_CHANGE");
    const contradictionsPresent = hasRollback && hasCodeFix;

    if (contradictionsPresent) {
        const note =
            "Two alternative remediation paths are supported by different evidence dimensions (Rollback Review vs Forward Code Fix). Decision requires engineer validation.";
        for (const cand of candidates) {
            if (cand.type === "ROLLBACK_REVIEW" || cand.type === "CODE_CHANGE") {
                cand.contradictionNotes = note;
            }
        }
    }

    // Deduplicate candidate recommendations by recommendationKey
    const mergedByKey = new Map<string, RemediationRecommendationDomain>();
    for (const cand of candidates) {
        if (!mergedByKey.has(cand.recommendationKey)) {
            mergedByKey.set(cand.recommendationKey, { ...cand });
        } else {
            // Merge evidenceReferences, supportingClaimIds, prerequisites
            const existing = mergedByKey.get(cand.recommendationKey)!;
            existing.evidenceReferences = Array.from(
                new Set([...existing.evidenceReferences, ...cand.evidenceReferences])
            );
            existing.supportingClaimIds = Array.from(
                new Set([...existing.supportingClaimIds, ...cand.supportingClaimIds])
            );
            existing.prerequisites = Array.from(
                new Set([...existing.prerequisites, ...cand.prerequisites])
            );
        }
    }

    let finalRecommendations = Array.from(mergedByKey.values());

    // Invariant: If evidenceReferences is empty, recommendation must NEVER be marked ACTIONABLE
    for (const rec of finalRecommendations) {
        if (rec.evidenceReferences.length === 0) {
            rec.status = "INSUFFICIENT_EVIDENCE";
            rec.supportLevel = "INSUFFICIENT_EVIDENCE";
        }
    }

    // -------------------------------------------------------------------------
    // RULE K: INSUFFICIENT EVIDENCE (NO FORCED RECOMMENDATIONS)
    // -------------------------------------------------------------------------
    let hasInsufficientEvidence = false;
    let insufficientEvidenceReason: string | undefined;

    const concreteRemediations = finalRecommendations.filter(
        (r) => r.type !== "OBSERVABILITY_GAP" && r.status === "ACTIONABLE"
    );

    if (concreteRemediations.length === 0) {
        hasInsufficientEvidence = true;
        insufficientEvidenceReason =
            "Available evidence does not support a specific remediation. Collect missing runtime context to distinguish hypotheses.";

        const recKey = computeRecommendationKey(
            investigationId,
            "OBSERVABILITY_GAP",
            ["system"],
            [],
            "insufficient-evidence"
        );

        finalRecommendations = [
            {
                id: "",
                organizationId,
                projectId,
                investigationId,
                recommendationKey: recKey,
                type: "OBSERVABILITY_GAP",
                status: "INSUFFICIENT_EVIDENCE",
                supportLevel: "INSUFFICIENT_EVIDENCE",
                riskLevel: "LOW",
                title: "Insufficient evidence for remediation",
                summary: "No evidence-backed remediation can be generated from the currently available telemetry.",
                action: "Collect the missing runtime context and trace data required to distinguish between currently observed hypotheses.",
                rationale: "Investigation lacks verified stack frames, code changes, or telemetry bindings to support an actionable fix.",
                expectedOutcome: "Ingestion of detailed runtime telemetry will enable deterministic evidence synthesis.",
                validationMethod: "Verify that subsequent requests emit structured telemetry and stack traces.",
                prerequisites: [
                    "Verify Halo SDK is enabled and telemetry ingestion endpoints are active.",
                ],
                evidenceReferences: [],
                supportingClaimIds: [],
                affectedServices: [],
                affectedOperations: [],
                affectedCodePaths: [],
                ownerContext: null,
                uncertainty: "Evidence is currently insufficient to determine root cause or recommended fix.",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];
    }

    // -------------------------------------------------------------------------
    // DETERMINISTIC ORDERING
    // -------------------------------------------------------------------------
    const typeOrder: Record<RemediationType, number> = {
        DEPLOYMENT_REVIEW: 1,
        ROLLBACK_REVIEW: 2,
        CONFIGURATION_REVIEW: 3,
        FEATURE_FLAG_REVIEW: 4,
        DEPENDENCY_REVIEW: 5,
        CODE_CHANGE: 6,
        DATA_VALIDATION: 7,
        REGRESSION_TEST: 8,
        OBSERVABILITY_GAP: 9,
        DOCUMENTATION_UPDATE: 10,
        RUNBOOK_REVIEW: 11,
    };

    finalRecommendations.sort((a, b) => {
        const orderA = typeOrder[a.type] ?? 99;
        const orderB = typeOrder[b.type] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
    });

    // -------------------------------------------------------------------------
    // PERSISTENCE & HUMAN STATE MERGING (IDEMPOTENCY)
    // -------------------------------------------------------------------------
    const persistedList: RemediationRecommendationDomain[] = [];

    for (const rec of finalRecommendations) {
        const existing = existingByKey.get(rec.recommendationKey);
        let finalStatus = rec.status;
        let completedAt = null;
        let completedBy = null;
        let dismissedAt = null;
        let dismissedBy = null;
        let dismissalReason = null;
        let existingNotes: RemediationNoteDomain[] = [];

        if (existing) {
            // Preserve human actions
            if (existing.status === "COMPLETED" || existing.status === "DISMISSED") {
                finalStatus = existing.status as RemediationStatus;
                completedAt = existing.completedAt ? existing.completedAt.toISOString() : null;
                completedBy = existing.completedBy;
                dismissedAt = existing.dismissedAt ? existing.dismissedAt.toISOString() : null;
                dismissedBy = existing.dismissedBy;
                dismissalReason = existing.dismissalReason;
            }
            existingNotes = (existing.notes || []).map((n) => ({
                id: n.id,
                recommendationId: n.recommendationId,
                userId: n.userId,
                userEmail: n.user?.email || null,
                userName: n.user?.name || null,
                content: n.content,
                createdAt: n.createdAt.toISOString(),
            }));
        }

        // Upsert into database idempotently
        const dbRec = await prisma.remediationRecommendation.upsert({
            where: {
                investigationId_recommendationKey: {
                    investigationId,
                    recommendationKey: rec.recommendationKey,
                },
            },
            create: {
                organizationId,
                projectId,
                investigationId,
                recommendationKey: rec.recommendationKey,
                type: rec.type,
                status: finalStatus,
                supportLevel: rec.supportLevel,
                riskLevel: rec.riskLevel,
                title: rec.title,
                summary: rec.summary,
                action: rec.action,
                rationale: rec.rationale,
                expectedOutcome: rec.expectedOutcome,
                validationMethod: rec.validationMethod,
                prerequisites: rec.prerequisites,
                evidenceReferences: rec.evidenceReferences,
                supportingClaimIds: rec.supportingClaimIds,
                affectedServices: rec.affectedServices,
                affectedOperations: rec.affectedOperations,
                affectedCodePaths: rec.affectedCodePaths,
                ownerContext: rec.ownerContext ? (rec.ownerContext as any) : undefined,
                uncertainty: rec.uncertainty,
                completedAt: completedAt ? new Date(completedAt) : undefined,
                completedBy: completedBy || undefined,
                dismissedAt: dismissedAt ? new Date(dismissedAt) : undefined,
                dismissedBy: dismissedBy || undefined,
                dismissalReason: dismissalReason || undefined,
                historicalContext: rec.historicalContext ? (rec.historicalContext as any) : undefined,
                contradictionNotes: rec.contradictionNotes || undefined,
            },
            update: {
                // Update generated attributes, leave human statuses intact
                supportLevel: rec.supportLevel,
                riskLevel: rec.riskLevel,
                title: rec.title,
                summary: rec.summary,
                action: rec.action,
                rationale: rec.rationale,
                expectedOutcome: rec.expectedOutcome,
                validationMethod: rec.validationMethod,
                prerequisites: rec.prerequisites,
                evidenceReferences: rec.evidenceReferences,
                supportingClaimIds: rec.supportingClaimIds,
                affectedServices: rec.affectedServices,
                affectedOperations: rec.affectedOperations,
                affectedCodePaths: rec.affectedCodePaths,
                ownerContext: rec.ownerContext ? (rec.ownerContext as any) : undefined,
                uncertainty: rec.uncertainty,
                historicalContext: rec.historicalContext ? (rec.historicalContext as any) : undefined,
                contradictionNotes: rec.contradictionNotes || undefined,
            },
        });

        persistedList.push({
            ...rec,
            id: dbRec.id,
            status: finalStatus,
            completedAt,
            completedBy,
            dismissedAt,
            dismissedBy,
            dismissalReason,
            notes: existingNotes,
            createdAt: dbRec.createdAt.toISOString(),
            updatedAt: dbRec.updatedAt.toISOString(),
        });
    }

    const result: RemediationPlanResult = {
        investigationId,
        projectId,
        organizationId,
        generatedAt: new Date().toISOString(),
        recommendations: persistedList,
        hasInsufficientEvidence,
        insufficientEvidenceReason,
        contradictionsPresent,
    };

    remediationCache.set(cacheKey, { result, cachedAt: Date.now() });
    return result;
}

/**
 * Retrieve stored recommendations for an investigation
 */
export async function getStoredRecommendations(
    investigationId: string,
    projectId: string,
    organizationId: string
): Promise<RemediationRecommendationDomain[]> {
    const records = await prisma.remediationRecommendation.findMany({
        where: {
            investigationId,
            projectId,
            organizationId,
        },
        include: {
            notes: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true, email: true } } },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    return records.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        projectId: r.projectId,
        investigationId: r.investigationId,
        recommendationKey: r.recommendationKey,
        type: r.type as RemediationType,
        status: r.status as RemediationStatus,
        supportLevel: r.supportLevel as RemediationSupportLevel,
        riskLevel: r.riskLevel as RemediationRiskLevel,
        title: r.title,
        summary: r.summary,
        action: r.action,
        rationale: r.rationale,
        expectedOutcome: r.expectedOutcome,
        validationMethod: r.validationMethod,
        prerequisites: r.prerequisites,
        evidenceReferences: r.evidenceReferences,
        supportingClaimIds: r.supportingClaimIds,
        affectedServices: r.affectedServices,
        affectedOperations: r.affectedOperations,
        affectedCodePaths: r.affectedCodePaths,
        ownerContext: r.ownerContext as unknown as RemediationOwnerContext | null,
        uncertainty: r.uncertainty,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        completedBy: r.completedBy,
        dismissedAt: r.dismissedAt ? r.dismissedAt.toISOString() : null,
        dismissedBy: r.dismissedBy,
        dismissalReason: r.dismissalReason,
        historicalContext: r.historicalContext as unknown as HistoricalRemediationContext | null,
        contradictionNotes: r.contradictionNotes,
        notes: (r.notes || []).map((n) => ({
            id: n.id,
            recommendationId: n.recommendationId,
            userId: n.userId,
            userEmail: n.user?.email || null,
            userName: n.user?.name || null,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
        })),
        metadata: r.metadata as Record<string, unknown> | null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }));
}

/**
 * Update recommendation status by human action (Completed, Dismissed, Reopened)
 */
export async function updateRecommendationStatus(params: {
    recommendationId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    status: RemediationStatus;
    dismissalReason?: string;
}): Promise<RemediationRecommendationDomain> {
    const { recommendationId, projectId, organizationId, userId, status, dismissalReason } = params;

    const existing = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
        include: {
            notes: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true, email: true } } },
            },
        },
    });

    if (!existing) {
        throw new Error(`Recommendation ${recommendationId} not found.`);
    }

    if (existing.organizationId !== organizationId || existing.projectId !== projectId) {
        throw new Error("Tenant isolation violation: Access denied.");
    }

    const isCompleted = status === "COMPLETED";
    const isDismissed = status === "DISMISSED";

    const updated = await prisma.remediationRecommendation.update({
        where: { id: recommendationId },
        data: {
            status,
            completedAt: isCompleted ? new Date() : null,
            completedBy: isCompleted ? userId : null,
            dismissedAt: isDismissed ? new Date() : null,
            dismissedBy: isDismissed ? userId : null,
            dismissalReason: isDismissed ? dismissalReason || "Explicitly dismissed by investigator" : null,
        },
        include: {
            notes: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true, email: true } } },
            },
        },
    });

    // Invalidate cache
    clearRemediationCache(organizationId, existing.investigationId);

    return {
        id: updated.id,
        organizationId: updated.organizationId,
        projectId: updated.projectId,
        investigationId: updated.investigationId,
        recommendationKey: updated.recommendationKey,
        type: updated.type as RemediationType,
        status: updated.status as RemediationStatus,
        supportLevel: updated.supportLevel as RemediationSupportLevel,
        riskLevel: updated.riskLevel as RemediationRiskLevel,
        title: updated.title,
        summary: updated.summary,
        action: updated.action,
        rationale: updated.rationale,
        expectedOutcome: updated.expectedOutcome,
        validationMethod: updated.validationMethod,
        prerequisites: updated.prerequisites,
        evidenceReferences: updated.evidenceReferences,
        supportingClaimIds: updated.supportingClaimIds,
        affectedServices: updated.affectedServices,
        affectedOperations: updated.affectedOperations,
        affectedCodePaths: updated.affectedCodePaths,
        ownerContext: updated.ownerContext as unknown as RemediationOwnerContext | null,
        uncertainty: updated.uncertainty,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
        completedBy: updated.completedBy,
        dismissedAt: updated.dismissedAt ? updated.dismissedAt.toISOString() : null,
        dismissedBy: updated.dismissedBy,
        dismissalReason: updated.dismissalReason,
        historicalContext: updated.historicalContext as unknown as HistoricalRemediationContext | null,
        contradictionNotes: updated.contradictionNotes,
        notes: (updated.notes || []).map((n) => ({
            id: n.id,
            recommendationId: n.recommendationId,
            userId: n.userId,
            userEmail: n.user?.email || null,
            userName: n.user?.name || null,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
        })),
        metadata: updated.metadata as Record<string, unknown> | null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
    };
}

/**
 * Add a human note to a recommendation
 */
export async function addRecommendationNote(params: {
    recommendationId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    content: string;
}): Promise<RemediationNoteDomain> {
    const { recommendationId, projectId, organizationId, userId, content } = params;

    const rec = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
    });

    if (!rec) {
        throw new Error(`Recommendation ${recommendationId} not found.`);
    }

    if (rec.organizationId !== organizationId || rec.projectId !== projectId) {
        throw new Error("Tenant isolation violation: Access denied.");
    }

    const note = await prisma.remediationNote.create({
        data: {
            recommendationId,
            userId,
            content,
        },
        include: {
            user: { select: { name: true, email: true } },
        },
    });

    // Invalidate cache
    clearRemediationCache(organizationId, rec.investigationId);

    return {
        id: note.id,
        recommendationId: note.recommendationId,
        userId: note.userId,
        userEmail: note.user?.email || null,
        userName: note.user?.name || null,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
    };
}
