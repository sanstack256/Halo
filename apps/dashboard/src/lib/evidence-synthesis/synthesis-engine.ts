/**
 * HALO TRACE — PILLAR G SYNTHESIS ENGINE
 * Evidence Synthesis & Investigation Reasoning
 *
 * Deterministic cross-pillar evidence synthesis layer.
 * Transforms existing evidence from Pillars 1-F into:
 * - Deterministic, inspectable evidence claims
 * - Explicit evidence statuses: ESTABLISHED | SUPPORTED | CONTRADICTED | UNKNOWN | UNAVAILABLE
 * - Multi-source independent verification without raw record inflation
 * - Minimum sufficient evidence chains
 * - Structured 9-part investigation narratives
 * - Canonical root cause preservation (zero recalculation / zero mutation)
 * - Zero developer blame attribution
 * - Tenant isolation and authorization safety
 */

import { prisma } from "@/lib/prisma";
import { parseStackTrace } from "@/lib/investigation/runtime/stack-parser";
import { doesPathIntersect } from "@/lib/change-intelligence/path-utils";
import type {
    EvidenceStatus,
    EvidenceSourceType,
    EvidenceReference,
    EvidenceClaim,
    EvidenceChainNode,
    EvidenceChainEdge,
    EvidenceChain,
    InvestigationNarrativeSection,
    InvestigationNarrative,
    RootCauseEvidenceMap,
    InvestigationSynthesis,
} from "./types";

// In-memory tenant-isolated synthesis cache (60s TTL)
interface CacheEntry {
    synthesis: InvestigationSynthesis;
    cachedAt: number;
}
const synthesisCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export function getSynthesisCacheKey(orgId: string, projectId: string, invId: string): string {
    return `${orgId}::${projectId}::${invId}`;
}

export function clearSynthesisCache(): void {
    synthesisCache.clear();
}

/**
 * Strips any sensitive credentials, tokens, or private secrets from strings and metadata.
 */
function sanitizeProvenance(text: string): string {
    if (!text) return "";
    return text
        .replace(/ghp_[A-Za-z0-9_]{30,}/g, "[REDACTED_GITHUB_TOKEN]")
        .replace(/github_pat_[A-Za-z0-9_]{50,}/g, "[REDACTED_GITHUB_PAT]")
        .replace(/bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
        .replace(/secret[_-]?[0-9a-zA-Z]{16,}/gi, "[REDACTED_SECRET]")
        .replace(/api[_-]?key[_-]?[0-9a-zA-Z]{16,}/gi, "[REDACTED_KEY]");
}

/**
 * Validates and creates a deterministic claim.
 * SECTION 8: Claims must NEVER float free without evidence references!
 */
export function buildClaim(params: {
    claimId: string;
    investigationId: string;
    statement: string;
    status: EvidenceStatus;
    evidenceReferences: EvidenceReference[];
    supportingClaims?: string[];
    contradictingClaims?: string[];
    relatedServices?: string[];
    relatedOperations?: string[];
    relatedCodePaths?: string[];
    metadata?: Record<string, unknown>;
    firstObservedAt?: string | Date;
    lastObservedAt?: string | Date;
}): EvidenceClaim | null {
    // A synthesized claim without evidence references is invalid. Reject or omit.
    if (!params.evidenceReferences || params.evidenceReferences.length === 0) {
        return null;
    }

    const cleanedReferences = params.evidenceReferences.map((ref) => ({
        ...ref,
        label: sanitizeProvenance(ref.label),
    }));

    // Independent source count counts unique source categories, NOT raw record count (Section 10)
    const uniqueSourceCategories = new Set<EvidenceSourceType>();
    for (const ref of cleanedReferences) {
        uniqueSourceCategories.add(ref.sourceType);
    }

    return {
        claimId: params.claimId,
        investigationId: params.investigationId,
        statement: sanitizeProvenance(params.statement),
        status: params.status,
        sourceTypes: Array.from(uniqueSourceCategories),
        evidenceReferences: cleanedReferences,
        supportingClaims: params.supportingClaims || [],
        contradictingClaims: params.contradictingClaims || [],
        independentSourceCount: uniqueSourceCategories.size,
        firstObservedAt: params.firstObservedAt,
        lastObservedAt: params.lastObservedAt,
        relatedServices: params.relatedServices || [],
        relatedOperations: params.relatedOperations || [],
        relatedCodePaths: params.relatedCodePaths || [],
        metadata: params.metadata,
    };
}

/**
 * Deduplicates and merges equivalent claims.
 * Preserves all supporting sources.
 */
export function deduplicateClaims(rawClaims: EvidenceClaim[]): EvidenceClaim[] {
    const claimMap = new Map<string, EvidenceClaim>();

    for (const claim of rawClaims) {
        const key = `${claim.statement.toLowerCase().trim()}::${claim.relatedServices.sort().join(",")}`;
        const existing = claimMap.get(key);

        if (!existing) {
            claimMap.set(key, { ...claim });
        } else {
            // Merge references avoiding duplicate targets
            const existingTargets = new Set(existing.evidenceReferences.map((r) => `${r.sourceType}::${r.targetId}`));
            for (const ref of claim.evidenceReferences) {
                const refKey = `${ref.sourceType}::${ref.targetId}`;
                if (!existingTargets.has(refKey)) {
                    existing.evidenceReferences.push(ref);
                    existingTargets.add(refKey);
                }
            }

            // Recalculate unique source categories
            const mergedSources = new Set<EvidenceSourceType>();
            for (const r of existing.evidenceReferences) {
                mergedSources.add(r.sourceType);
            }
            existing.sourceTypes = Array.from(mergedSources);
            existing.independentSourceCount = mergedSources.size;

            // Upgrade status if new independent evidence strengthens it
            if (existing.status === "ESTABLISHED" || claim.status === "ESTABLISHED") {
                existing.status = "ESTABLISHED";
            } else if (existing.status === "CONTRADICTED" || claim.status === "CONTRADICTED") {
                existing.status = "CONTRADICTED";
            } else if (existing.independentSourceCount >= 2) {
                existing.status = "SUPPORTED";
            }
        }
    }

    return Array.from(claimMap.values());
}

export interface SynthesizeInvestigationEvidenceParams {
    investigationId: string;
    organizationId: string;
    forceFresh?: boolean;
}

/**
 * Primary Evidence Synthesis Engine.
 * Purely derived and rebuildable on demand.
 */
export async function synthesizeInvestigationEvidence(
    params: SynthesizeInvestigationEvidenceParams
): Promise<InvestigationSynthesis> {
    const { investigationId, organizationId, forceFresh = false } = params;

    // 1. Check in-memory cache
    for (const [key, entry] of synthesisCache.entries()) {
        if (key.startsWith(`${organizationId}::`) && key.endsWith(`::${investigationId}`)) {
            if (!forceFresh && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
                return entry.synthesis;
            }
        }
    }

    // 2. Fetch canonical Investigation record
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        include: {
            project: {
                select: {
                    id: true,
                    organizationId: true,
                    githubRepoOwner: true,
                    githubRepoName: true,
                    githubDefaultBranch: true,
                    releases: {
                        orderBy: { firstSeen: "desc" },
                        take: 10,
                    },
                },
            },
            issue: true,
            incidentMemory: true,
            comments: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true, email: true } } },
            },
            verdicts: {
                orderBy: { createdAt: "desc" },
                include: { user: { select: { name: true, email: true } } },
            },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    if (investigation.project.organizationId !== organizationId) {
        throw new Error("Tenant isolation violation: Access denied.");
    }

    const projectId = investigation.projectId;

    // 3. Batch retrieve existing pillar evidence
    const eventFilter = investigation.issueId
        ? { projectId, issueId: investigation.issueId }
        : { projectId };

    const [events, ownerships, changeObservations, replaySession] = await Promise.all([
        prisma.event.findMany({
            where: eventFilter,
            orderBy: { timestamp: "asc" },
            take: 100,
            select: {
                id: true,
                title: true,
                service: true,
                operation: true,
                severity: true,
                type: true,
                timestamp: true,
                stack: true,
                metadata: true,
                durationMs: true,
                status: true,
                requestId: true,
                traceId: true,
            },
        }),
        prisma.serviceOwnership.findMany({
            where: { projectId },
        }),
        prisma.changeObservation.findMany({
            where: { projectId, organizationId },
            orderBy: { observedAt: "desc" },
            take: 20,
        }),
        prisma.replaySession.findFirst({
            where: {
                projectId,
                ...(investigation.issueId ? { issueId: investigation.issueId } : {}),
            },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    const errorEvents = events.filter((e) => e.severity === "ERROR" || e.type === "ERROR");
    const anchorError = errorEvents[0] || events[0];

    // Parse stack frames from the primary anchor error
    const parsedFrames = anchorError?.stack ? parseStackTrace(anchorError.stack) : [];
    const primaryAppFrame = parsedFrames.find((f) => !f.isInternal) || parsedFrames[0];

    const affectedServices = Array.from(new Set(events.map((e) => e.service).filter(Boolean))) as string[];
    if (affectedServices.length === 0 && anchorError?.service) {
        affectedServices.push(anchorError.service);
    }
    const primaryService = anchorError?.service || affectedServices[0] || "unknown-service";

    // 4. Construct Deterministic Claims
    const rawClaims: (EvidenceClaim | null)[] = [];

    // --- CLAIM 1: Runtime Error Event (ESTABLISHED) ---
    if (anchorError) {
        rawClaims.push(
            buildClaim({
                claimId: `claim-runtime-${anchorError.id}`,
                investigationId,
                statement: `Failing execution triggered an ERROR in ${primaryService}: ${anchorError.title}`,
                status: "ESTABLISHED",
                evidenceReferences: [
                    {
                        id: `ref-event-${anchorError.id}`,
                        sourceType: "RUNTIME",
                        label: `Error Event ${anchorError.id}`,
                        targetId: anchorError.id,
                        timestamp: anchorError.timestamp,
                        metadata: {
                            service: primaryService,
                            operation: anchorError.operation,
                            severity: anchorError.severity,
                        },
                    },
                ],
                firstObservedAt: anchorError.timestamp,
                lastObservedAt: anchorError.timestamp,
                relatedServices: [primaryService],
                relatedOperations: anchorError.operation ? [anchorError.operation] : [],
            })
        );
    }

    // --- CLAIM 2: Code Path Execution (ESTABLISHED if stack present, else UNAVAILABLE) ---
    if (primaryAppFrame) {
        rawClaims.push(
            buildClaim({
                claimId: `claim-stack-${primaryAppFrame.filePath}-${primaryAppFrame.lineNumber || 0}`,
                investigationId,
                statement: `Execution reached ${primaryAppFrame.filePath}${primaryAppFrame.lineNumber ? `:${primaryAppFrame.lineNumber}` : ""} in ${primaryAppFrame.functionName || "anonymous"}`,
                status: "ESTABLISHED",
                evidenceReferences: [
                    {
                        id: `ref-stack-${anchorError?.id || "unknown"}`,
                        sourceType: "STACK",
                        label: `Stack frame ${primaryAppFrame.filePath}:${primaryAppFrame.lineNumber || 0}`,
                        targetId: anchorError?.id || "unknown",
                        metadata: {
                            filePath: primaryAppFrame.filePath,
                            lineNumber: primaryAppFrame.lineNumber,
                            functionName: primaryAppFrame.functionName,
                        },
                    },
                ],
                relatedServices: [primaryService],
                relatedCodePaths: [primaryAppFrame.filePath],
            })
        );
    } else {
        rawClaims.push(
            buildClaim({
                claimId: `claim-stack-unavailable`,
                investigationId,
                statement: `Application stack frame execution path is unavailable (missing source maps or truncated stack trace).`,
                status: "UNAVAILABLE",
                evidenceReferences: [
                    {
                        id: `ref-stack-missing`,
                        sourceType: "STACK",
                        label: `Stack Trace Metadata`,
                        targetId: anchorError?.id || "missing",
                    },
                ],
                relatedServices: [primaryService],
            })
        );
    }

    // --- CLAIM: Service Topology Boundary (ESTABLISHED) ---
    rawClaims.push(
        buildClaim({
            claimId: `claim-topology-${primaryService}`,
            investigationId,
            statement: `Failure localized to service boundary ${primaryService}${affectedServices.length > 1 ? ` with cross-service propagation involving ${affectedServices.filter((s) => s !== primaryService).join(", ")}` : ""}`,
            status: "ESTABLISHED",
            evidenceReferences: [
                {
                    id: `ref-topo-${primaryService}`,
                    sourceType: "TOPOLOGY",
                    label: `Service Topology Node (${primaryService})`,
                    targetId: primaryService,
                    metadata: {
                        primaryService,
                        affectedServices,
                    },
                },
            ],
            relatedServices: affectedServices,
        })
    );

    // --- CLAIM 3: Change Intelligence Intersection & Commits ---
    let relevantChangeFound = false;
    let contradictingChangeFound = false;
    let suspectCommitSha: string | null = null;
    let suspectChangedFile: string | null = null;

    for (const change of changeObservations) {
        const changedFiles = Array.isArray(change.changedFiles) ? (change.changedFiles as any[]) : [];
        const commitSha = change.commitSha || "";
        const changeTime = change.authorTimestamp || change.observedAt;
        const changeService = change.serviceAssociation || change.repository;

        if (!commitSha) continue;

        // Check if change intersects stack file
        let fileIntersects = false;
        let matchedFilePath = "";
        if (primaryAppFrame?.filePath) {
            for (const f of changedFiles) {
                const p = typeof f === "string" ? f : f.filePath || "";
                if (p && doesPathIntersect(p, primaryAppFrame.filePath)) {
                    fileIntersects = true;
                    matchedFilePath = p;
                    break;
                }
            }
        }

        const isSameService = Boolean(changeService && primaryService.toLowerCase().includes(changeService.toLowerCase()));

        if (fileIntersects && isSameService) {
            relevantChangeFound = true;
            suspectCommitSha = commitSha;
            suspectChangedFile = matchedFilePath;

            // Supported by multiple independent source dimensions (RUNTIME stack + CHANGE git)
            rawClaims.push(
                buildClaim({
                    claimId: `claim-change-intersect-${commitSha.slice(0, 8)}`,
                    investigationId,
                    statement: `Commit ${commitSha.slice(0, 8)} modified ${matchedFilePath} which intersects the failing execution path in ${primaryService}`,
                    status: "SUPPORTED",
                    evidenceReferences: [
                        {
                            id: `ref-change-${change.id}`,
                            sourceType: "CHANGE",
                            label: `Commit ${commitSha.slice(0, 8)} (${change.commitMessage?.slice(0, 40) || "Git Commit"})`,
                            targetId: commitSha,
                            timestamp: changeTime,
                            metadata: {
                                author: change.authorIdentity,
                                repository: change.repository,
                                changedFile: matchedFilePath,
                            },
                        },
                        {
                            id: `ref-runtime-intersect-${anchorError?.id || "stack"}`,
                            sourceType: "RUNTIME",
                            label: `Failing stack frame ${primaryAppFrame.filePath}`,
                            targetId: anchorError?.id || "unknown",
                        },
                    ],
                    firstObservedAt: changeTime,
                    relatedServices: [primaryService],
                    relatedCodePaths: [matchedFilePath],
                })
            );
        } else if (changeTime < (anchorError?.timestamp || new Date()) && !isSameService && changeService) {
            // Contradiction: Commit occurred before failure, but repository/service does not match failing service
            contradictingChangeFound = true;
            rawClaims.push(
                buildClaim({
                    claimId: `claim-change-contradiction-${commitSha.slice(0, 8)}`,
                    investigationId,
                    statement: `Commit ${commitSha.slice(0, 8)} was authored before failure onset, but changed repository (${changeService}) does not intersect failing service ${primaryService}`,
                    status: "CONTRADICTED",
                    evidenceReferences: [
                        {
                            id: `ref-change-contra-${change.id}`,
                            sourceType: "CHANGE",
                            label: `Commit ${commitSha.slice(0, 8)}`,
                            targetId: commitSha,
                            timestamp: changeTime,
                            metadata: {
                                changeService,
                                primaryService,
                            },
                        },
                    ],
                    relatedServices: [changeService, primaryService],
                })
            );
        } else if (changeTime < (anchorError?.timestamp || new Date())) {
            // Temporal relationship only (Chronology does not mean causality)
            rawClaims.push(
                buildClaim({
                    claimId: `claim-change-temporal-${commitSha.slice(0, 8)}`,
                    investigationId,
                    statement: `Commit ${commitSha.slice(0, 8)} occurred chronologically before failure onset, but code path intersection was not observed`,
                    status: "SUPPORTED", // Temporally supported, not causally proven
                    evidenceReferences: [
                        {
                            id: `ref-change-temp-${change.id}`,
                            sourceType: "CHANGE",
                            label: `Commit ${commitSha.slice(0, 8)}`,
                            targetId: commitSha,
                            timestamp: changeTime,
                        },
                        {
                            id: `ref-runtime-temp-${anchorError?.id || "runtime"}`,
                            sourceType: "RUNTIME",
                            label: `Failure onset timestamp`,
                            targetId: anchorError?.id || "unknown",
                            timestamp: anchorError?.timestamp,
                        },
                    ],
                    firstObservedAt: changeTime,
                    relatedServices: changeService ? [changeService] : [primaryService],
                })
            );
        }
    }

    // --- CLAIM 4: Deployment & Releases ---
    const latestRelease = investigation.project.releases[0];
    if (latestRelease && suspectCommitSha && latestRelease.commitSha === suspectCommitSha) {
        rawClaims.push(
            buildClaim({
                claimId: `claim-deploy-${latestRelease.id}`,
                investigationId,
                statement: `Release ${latestRelease.version} containing commit ${suspectCommitSha.slice(0, 8)} was deployed prior to failure onset`,
                status: "ESTABLISHED",
                evidenceReferences: [
                    {
                        id: `ref-deploy-${latestRelease.id}`,
                        sourceType: "DEPLOYMENT",
                        label: `Release ${latestRelease.version}`,
                        targetId: latestRelease.id,
                        timestamp: latestRelease.firstSeen,
                        metadata: {
                            commitSha: latestRelease.commitSha,
                            version: latestRelease.version,
                        },
                    },
                ],
                firstObservedAt: latestRelease.firstSeen,
                relatedServices: [primaryService],
            })
        );
    } else if (latestRelease) {
        rawClaims.push(
            buildClaim({
                claimId: `claim-deploy-available`,
                investigationId,
                statement: `Active deployment ${latestRelease.version} observed in environment; direct causal linkage to incident onset is unverified`,
                status: "ESTABLISHED",
                evidenceReferences: [
                    {
                        id: `ref-deploy-active-${latestRelease.id}`,
                        sourceType: "DEPLOYMENT",
                        label: `Active Release ${latestRelease.version}`,
                        targetId: latestRelease.id,
                        timestamp: latestRelease.firstSeen,
                    },
                ],
                relatedServices: [primaryService],
            })
        );
    } else {
        // Explicitly UNAVAILABLE (Section 19: UNKNOWN ≠ FAILURE, UNAVAILABLE ≠ FALSE)
        rawClaims.push(
            buildClaim({
                claimId: `claim-deploy-unavailable`,
                investigationId,
                statement: `Production deployment timestamp and release pipeline telemetry are unavailable for this service.`,
                status: "UNAVAILABLE",
                evidenceReferences: [
                    {
                        id: `ref-deploy-missing`,
                        sourceType: "DEPLOYMENT",
                        label: `Deployment Registry`,
                        targetId: "missing-deployment-telemetry",
                    },
                ],
                relatedServices: [primaryService],
            })
        );
    }

    // --- CLAIM 5: Ownership Intelligence (Pillar E) ---
    const matchedOwnership = ownerships.find(
        (o) => o.serviceName.toLowerCase() === primaryService.toLowerCase()
    );
    if (matchedOwnership) {
        const teamOwner = matchedOwnership.declaredTeam || matchedOwnership.declaredOwner;
        const hasConflict = Boolean((matchedOwnership.metadata as any)?.hasConflict);

        rawClaims.push(
            buildClaim({
                claimId: `claim-ownership-${matchedOwnership.serviceName}`,
                statement: hasConflict
                    ? `Service ${matchedOwnership.serviceName} has conflicting ownership declarations between ${matchedOwnership.source} (${teamOwner || "Unassigned"}) and manual configuration`
                    : `Service ${matchedOwnership.serviceName} is owned by ${teamOwner || "Team Unassigned"} (Source: ${matchedOwnership.source})`,
                status: hasConflict ? "CONTRADICTED" : "ESTABLISHED",
                investigationId,
                evidenceReferences: [
                    {
                        id: `ref-owner-${matchedOwnership.id}`,
                        sourceType: "OWNERSHIP",
                        label: `Ownership Mapping for ${matchedOwnership.serviceName}`,
                        targetId: matchedOwnership.id,
                        metadata: {
                            declaredOwner: matchedOwnership.declaredOwner,
                            declaredTeam: matchedOwnership.declaredTeam,
                            source: matchedOwnership.source,
                            hasConflict,
                        },
                    },
                ],
                relatedServices: [matchedOwnership.serviceName],
            })
        );
    } else {
        rawClaims.push(
            buildClaim({
                claimId: `claim-ownership-unassigned`,
                statement: `Service ${primaryService} has no declared team owner in CODEOWNERS or service catalog.`,
                status: "UNKNOWN",
                investigationId,
                evidenceReferences: [
                    {
                        id: `ref-owner-none`,
                        sourceType: "OWNERSHIP",
                        label: `Service Ownership Catalog`,
                        targetId: `service-${primaryService}`,
                    },
                ],
                relatedServices: [primaryService],
            })
        );
    }

    // --- CLAIM 6: Collaborative Notes & Peer Verdicts (Pillar C) ---
    // SECTION 36: Human notes remain human assertions, never converted into system facts!
    for (const verdict of investigation.verdicts) {
        rawClaims.push(
            buildClaim({
                claimId: `claim-verdict-${verdict.id}`,
                investigationId,
                statement: `Investigator peer verdict submitted by ${verdict.user?.name || verdict.user?.email || "peer"}: ${verdict.verdict}`,
                status: "ESTABLISHED",
                evidenceReferences: [
                    {
                        id: `ref-collab-verdict-${verdict.id}`,
                        sourceType: "COLLABORATION",
                        label: `Peer Verdict (${verdict.verdict})`,
                        targetId: verdict.id,
                        timestamp: verdict.createdAt,
                        metadata: {
                            verdict: verdict.verdict,
                            reasoning: verdict.reasoning,
                            author: verdict.user?.name || verdict.user?.email,
                        },
                    },
                ],
                firstObservedAt: verdict.createdAt,
                relatedServices: [primaryService],
            })
        );
    }

    for (const comment of investigation.comments) {
        if (comment.evidenceId) {
            rawClaims.push(
                buildClaim({
                    claimId: `claim-comment-${comment.id}`,
                    investigationId,
                    statement: `Investigator note: "${comment.content.slice(0, 100)}" referencing evidence ${comment.evidenceId}`,
                    status: "ESTABLISHED",
                    evidenceReferences: [
                        {
                            id: `ref-collab-comment-${comment.id}`,
                            sourceType: "COLLABORATION",
                            label: `Investigation Note by ${comment.user?.name || "Investigator"}`,
                            targetId: comment.id,
                            timestamp: comment.createdAt,
                            metadata: {
                                isHumanAssertion: true,
                                referencedEvidenceId: comment.evidenceId,
                            },
                        },
                    ],
                    firstObservedAt: comment.createdAt,
                    relatedServices: [primaryService],
                })
            );
        }
    }

    // --- CLAIM 7: Historical Memory & Incident Matching (Pillar D) ---
    // SECTION 34: Historical incidents appear as context, not current cause!
    if (investigation.incidentMemory) {
        const signature = investigation.incidentMemory.fingerprint || investigation.incidentMemory.normalizedTitle;
        rawClaims.push(
            buildClaim({
                claimId: `claim-memory-${investigation.incidentMemory.id}`,
                investigationId,
                statement: `Historical precedent identified: Incident matches recurring pattern ${signature} (Historical context only)`,
                status: "SUPPORTED",
                evidenceReferences: [
                    {
                        id: `ref-memory-${investigation.incidentMemory.id}`,
                        sourceType: "MEMORY",
                        label: `Incident Memory ${signature}`,
                        targetId: investigation.incidentMemory.id,
                        timestamp: investigation.incidentMemory.createdAt,
                        metadata: {
                            isHistoricalContext: true,
                            signature,
                        },
                    },
                ],
                firstObservedAt: investigation.incidentMemory.createdAt,
                relatedServices: [primaryService],
            })
        );
    } else {
        rawClaims.push(
            buildClaim({
                claimId: `claim-memory-none`,
                investigationId,
                statement: `No historical incident pattern match was observed for this failure signature.`,
                status: "UNKNOWN",
                evidenceReferences: [
                    {
                        id: `ref-memory-none`,
                        sourceType: "MEMORY",
                        label: `Incident Memory Catalog`,
                        targetId: `incident-memory-search`,
                    },
                ],
                relatedServices: [primaryService],
            })
        );
    }

    // --- CLAIM 8: Replay Observational Telemetry ---
    if (replaySession) {
        rawClaims.push(
            buildClaim({
                claimId: `claim-replay-${replaySession.id}`,
                investigationId,
                statement: `User session replay recorded ${replaySession.chunkCount} DOM/network chunks leading to failure at ${replaySession.errorAt ? new Date(replaySession.errorAt).toISOString() : "terminal step"}`,
                status: "ESTABLISHED",
                evidenceReferences: [
                    {
                        id: `ref-replay-${replaySession.id}`,
                        sourceType: "REPLAY",
                        label: `Replay Session ${replaySession.sessionId}`,
                        targetId: replaySession.id,
                        timestamp: replaySession.createdAt,
                    },
                ],
                firstObservedAt: replaySession.createdAt,
                relatedServices: [primaryService],
            })
        );
    }

    // --- CLAIM 9: Direct Production Causality Uncertainty (UNKNOWN) ---
    // Prompt Section 5 & 31: Direct causal proof was not observed.
    rawClaims.push(
        buildClaim({
            claimId: `claim-causal-uncertainty`,
            investigationId,
            statement: `Direct production causal proof linking suspect changes to runtime execution failure was not observed.`,
            status: "UNKNOWN",
            evidenceReferences: [
                {
                    id: `ref-causal-inferred`,
                    sourceType: "RUNTIME",
                    label: `Causal Engine Observation Limit`,
                    targetId: anchorError?.id || "unknown",
                },
            ],
            relatedServices: [primaryService],
        })
    );

    // Filter valid claims and deduplicate
    const nonNullClaims = rawClaims.filter((c): c is EvidenceClaim => c !== null);
    const deduplicatedClaims = deduplicateClaims(nonNullClaims);

    // Group claims by status
    const establishedClaims = deduplicatedClaims.filter((c) => c.status === "ESTABLISHED");
    const supportedClaims = deduplicatedClaims.filter((c) => c.status === "SUPPORTED");
    const contradictedClaims = deduplicatedClaims.filter((c) => c.status === "CONTRADICTED");
    const unknownClaims = deduplicatedClaims.filter((c) => c.status === "UNKNOWN" || c.status === "UNAVAILABLE");

    // 5. Construct Minimum Sufficient Evidence Chain (Sections 11, 13, 25, 26)
    const chainNodes: EvidenceChainNode[] = [];
    const chainEdges: EvidenceChainEdge[] = [];
    const minimumChainNodeIds: string[] = [];
    const supportingNodeIds: string[] = [];

    // Node: FAILURE
    const failureNodeId = `node-failure-${investigation.id}`;
    chainNodes.push({
        id: failureNodeId,
        type: "FAILURE",
        label: investigation.title,
        status: "ESTABLISHED",
        timestamp: anchorError?.timestamp || investigation.startedAt,
        source: "RUNTIME",
        evidenceReferences: anchorError
            ? [
                  {
                      id: `ref-fail-${anchorError.id}`,
                      sourceType: "RUNTIME",
                      label: `Failure Anchor`,
                      targetId: anchorError.id,
                  },
              ]
            : [
                  {
                      id: `ref-fail-inv`,
                      sourceType: "RUNTIME",
                      label: `Investigation Record`,
                      targetId: investigation.id,
                  },
              ],
    });
    minimumChainNodeIds.push(failureNodeId);

    // Node: SERVICE
    const serviceNodeId = `node-service-${primaryService}`;
    chainNodes.push({
        id: serviceNodeId,
        type: "SERVICE",
        label: primaryService,
        status: "ESTABLISHED",
        timestamp: anchorError?.timestamp,
        source: "TOPOLOGY",
        evidenceReferences: [
            {
                id: `ref-svc-${primaryService}`,
                sourceType: "TOPOLOGY",
                label: `Service Boundary`,
                targetId: primaryService,
            },
        ],
    });
    minimumChainNodeIds.push(serviceNodeId);

    // Edge: FAILURE -> SERVICE
    chainEdges.push({
        id: `edge-${failureNodeId}-${serviceNodeId}`,
        from: failureNodeId,
        to: serviceNodeId,
        relationship: "OBSERVED_IN",
        status: "OBSERVED",
        evidenceCount: 1,
        evidenceReferences: [
            {
                id: `ref-edge-obs`,
                sourceType: "RUNTIME",
                label: `Runtime Failure in ${primaryService}`,
                targetId: anchorError?.id || "unknown",
            },
        ],
        explanation: `Failure occurred directly within the ${primaryService} execution boundary.`,
    });

    // Node: STACK FRAME
    if (primaryAppFrame) {
        const stackNodeId = `node-stack-${primaryAppFrame.filePath}:${primaryAppFrame.lineNumber || 0}`;
        chainNodes.push({
            id: stackNodeId,
            type: "STACK_FRAME",
            label: `${primaryAppFrame.filePath}:${primaryAppFrame.lineNumber || 0}`,
            status: "ESTABLISHED",
            source: "STACK",
            evidenceReferences: [
                {
                    id: `ref-stack-node`,
                    sourceType: "STACK",
                    label: `Stack frame`,
                    targetId: anchorError?.id || "unknown",
                },
            ],
            metadata: {
                functionName: primaryAppFrame.functionName,
            },
        });
        minimumChainNodeIds.push(stackNodeId);

        // Edge: SERVICE -> STACK FRAME
        chainEdges.push({
            id: `edge-${serviceNodeId}-${stackNodeId}`,
            from: serviceNodeId,
            to: stackNodeId,
            relationship: "PROPAGATED_TO",
            status: "OBSERVED",
            evidenceCount: 1,
            evidenceReferences: [
                {
                    id: `ref-edge-prop`,
                    sourceType: "STACK",
                    label: `Exception Stack Trace`,
                    targetId: anchorError?.id || "unknown",
                },
            ],
            explanation: `Execution reached stack location ${primaryAppFrame.filePath}:${primaryAppFrame.lineNumber || 0}.`,
        });

        // Node & Edge: CHANGED FILE (if intersecting)
        if (suspectChangedFile && suspectCommitSha) {
            const changedFileNodeId = `node-file-${suspectChangedFile}`;
            chainNodes.push({
                id: changedFileNodeId,
                type: "CHANGED_FILE",
                label: suspectChangedFile,
                status: "SUPPORTED",
                source: "CHANGE",
                evidenceReferences: [
                    {
                        id: `ref-file-node`,
                        sourceType: "CHANGE",
                        label: `Changed File in Commit ${suspectCommitSha.slice(0, 8)}`,
                        targetId: suspectCommitSha,
                    },
                ],
            });
            minimumChainNodeIds.push(changedFileNodeId);

            chainEdges.push({
                id: `edge-${stackNodeId}-${changedFileNodeId}`,
                from: stackNodeId,
                to: changedFileNodeId,
                relationship: "INTERSECTS",
                status: "SUPPORTED",
                evidenceCount: 2,
                evidenceReferences: [
                    {
                        id: `ref-edge-file-change`,
                        sourceType: "CHANGE",
                        label: `Git modified file`,
                        targetId: suspectCommitSha,
                    },
                    {
                        id: `ref-edge-file-stack`,
                        sourceType: "STACK",
                        label: `Stack path`,
                        targetId: anchorError?.id || "unknown",
                    },
                ],
                explanation: `Modified file intersects failing stack frame path.`,
            });

            // Node: COMMIT
            const commitNodeId = `node-commit-${suspectCommitSha.slice(0, 8)}`;
            chainNodes.push({
                id: commitNodeId,
                type: "COMMIT",
                label: `Commit ${suspectCommitSha.slice(0, 8)}`,
                status: "ESTABLISHED",
                source: "CHANGE",
                evidenceReferences: [
                    {
                        id: `ref-node-commit`,
                        sourceType: "CHANGE",
                        label: `Git Commit`,
                        targetId: suspectCommitSha,
                    },
                ],
            });
            minimumChainNodeIds.push(commitNodeId);

            // SECTION 12: Chronology does not create causality!
            chainEdges.push({
                id: `edge-${changedFileNodeId}-${commitNodeId}`,
                from: changedFileNodeId,
                to: commitNodeId,
                relationship: "CORRELATED_WITH",
                status: "OBSERVED",
                evidenceCount: 1,
                evidenceReferences: [
                    {
                        id: `ref-edge-commit`,
                        sourceType: "CHANGE",
                        label: `Git Commit File Association`,
                        targetId: suspectCommitSha,
                    },
                ],
                explanation: `File was modified in commit ${suspectCommitSha.slice(0, 8)}.`,
            });

            // Node: DEPLOYMENT (if release matches)
            if (latestRelease && latestRelease.commitSha === suspectCommitSha) {
                const deployNodeId = `node-deploy-${latestRelease.id}`;
                chainNodes.push({
                    id: deployNodeId,
                    type: "DEPLOYMENT",
                    label: `Release ${latestRelease.version}`,
                    status: "ESTABLISHED",
                    source: "DEPLOYMENT",
                    timestamp: latestRelease.firstSeen,
                    evidenceReferences: [
                        {
                            id: `ref-node-deploy`,
                            sourceType: "DEPLOYMENT",
                            label: `Release Record`,
                            targetId: latestRelease.id,
                        },
                    ],
                });
                minimumChainNodeIds.push(deployNodeId);

                chainEdges.push({
                    id: `edge-${commitNodeId}-${deployNodeId}`,
                    from: commitNodeId,
                    to: deployNodeId,
                    relationship: "DEPLOYED_AS",
                    status: "OBSERVED",
                    evidenceCount: 1,
                    evidenceReferences: [
                        {
                            id: `ref-edge-deploy`,
                            sourceType: "DEPLOYMENT",
                            label: `Release Commit Match`,
                            targetId: latestRelease.id,
                        },
                    ],
                    explanation: `Commit ${suspectCommitSha.slice(0, 8)} was bundled and deployed in release ${latestRelease.version}.`,
                });
            }
        }
    }

    // Add supporting nodes (e.g. secondary error events, replay, owners)
    if (matchedOwnership) {
        const teamOwner = matchedOwnership.declaredTeam || matchedOwnership.declaredOwner;
        const hasConflict = Boolean((matchedOwnership.metadata as any)?.hasConflict);

        const ownerNodeId = `node-owner-${matchedOwnership.serviceName}`;
        chainNodes.push({
            id: ownerNodeId,
            type: "OWNER",
            label: teamOwner || "Team Unassigned",
            status: hasConflict ? "CONTRADICTED" : "ESTABLISHED",
            source: "OWNERSHIP",
            evidenceReferences: [
                {
                    id: `ref-owner-chain`,
                    sourceType: "OWNERSHIP",
                    label: `CODEOWNERS / Service Catalog`,
                    targetId: matchedOwnership.id,
                },
            ],
        });
        supportingNodeIds.push(ownerNodeId);

        chainEdges.push({
            id: `edge-${serviceNodeId}-${ownerNodeId}`,
            from: serviceNodeId,
            to: ownerNodeId,
            relationship: "OWNED_BY",
            status: hasConflict ? "CONTRADICTED" : "OBSERVED",
            evidenceCount: 1,
            evidenceReferences: [
                {
                    id: `ref-edge-owner`,
                    sourceType: "OWNERSHIP",
                    label: `Service Ownership Mapping`,
                    targetId: matchedOwnership.id,
                },
            ],
            explanation: `Service ${matchedOwnership.serviceName} ownership declared to ${teamOwner || "Unassigned"}.`,
        });
    }

    const evidenceChain: EvidenceChain = {
        nodes: chainNodes,
        edges: chainEdges,
        minimumChainNodeIds,
        supportingNodeIds,
    };

    // 6. Canonical Root Cause Presentation (Authoritative & Immutable - Sections 2.3, 2.4, 23, 24)
    const observedCategories = new Set<EvidenceSourceType>();
    for (const claim of deduplicatedClaims) {
        for (const s of claim.sourceTypes) {
            observedCategories.add(s);
        }
    }

    const supportedDimensions: string[] = [];
    if (observedCategories.has("RUNTIME")) supportedDimensions.push("Runtime Telemetry");
    if (observedCategories.has("STACK")) supportedDimensions.push("Stack Execution");
    if (observedCategories.has("CHANGE")) supportedDimensions.push("Change Intelligence");
    if (observedCategories.has("DEPLOYMENT")) supportedDimensions.push("Deployment Telemetry");
    if (observedCategories.has("OWNERSHIP")) supportedDimensions.push("Service Ownership");
    if (observedCategories.has("MEMORY")) supportedDimensions.push("Historical Precedent");
    if (observedCategories.has("COLLABORATION")) supportedDimensions.push("Investigator Verification");

    const contradictedDimensions: string[] = [];
    if (contradictingChangeFound) contradictedDimensions.push("Unrelated Repository Commit");
    if (Boolean((matchedOwnership?.metadata as any)?.hasConflict)) {
        contradictedDimensions.push("Conflicting Ownership Declaration");
    }

    const unknownDimensions: string[] = [];
    if (!latestRelease) unknownDimensions.push("Production Deployment Telemetry");
    if (!primaryAppFrame) unknownDimensions.push("Application Stack Trace");
    unknownDimensions.push("Direct Production Causal Proof");

    const rootCauseMap: RootCauseEvidenceMap = {
        canonicalRootCause: investigation.rootCause || investigation.title,
        confidenceScore: investigation.confidenceScore ?? 0.85,
        confidenceLevel: (investigation.context as any)?.confidenceLevel || "HIGH",
        observedSources: Array.from(observedCategories),
        supportedDimensions,
        contradictedDimensions,
        unknownDimensions,
        explanation: investigation.summary || "Canonical investigation root cause derived from authoritative evidence graph.",
    };

    // 7. Structured 9-Part Investigation Narrative (Section 27-36)
    const sections: InvestigationNarrativeSection[] = [
        // 1. What happened (Section 28: only established facts)
        {
            id: "what-happened",
            title: "1. What Happened",
            summary: "Authoritative telemetry recorded during failure onset.",
            claims: establishedClaims.filter((c) => c.sourceTypes.includes("RUNTIME")),
            bulletPoints: establishedClaims
                .filter((c) => c.sourceTypes.includes("RUNTIME"))
                .map((c) => ({
                    text: c.statement,
                    references: c.evidenceReferences,
                    status: c.status,
                })),
        },
        // 2. Where it happened
        {
            id: "where-it-happened",
            title: "2. Where It Happened",
            summary: `Failure isolated to service ${primaryService}${primaryAppFrame ? ` at ${primaryAppFrame.filePath}:${primaryAppFrame.lineNumber || 0}` : ""}.`,
            claims: establishedClaims.filter((c) => c.sourceTypes.includes("STACK") || c.sourceTypes.includes("TOPOLOGY")),
            bulletPoints: [
                {
                    text: `Service boundary: ${primaryService}`,
                    references: [
                        {
                            id: `ref-where-svc`,
                            sourceType: "TOPOLOGY",
                            label: `Service ${primaryService}`,
                            targetId: primaryService,
                        },
                    ],
                    status: "ESTABLISHED",
                },
                ...(primaryAppFrame
                    ? [
                          {
                              text: `Stack execution location: ${primaryAppFrame.filePath}:${primaryAppFrame.lineNumber || 0} (${primaryAppFrame.functionName || "anonymous"})`,
                              references: [
                                  {
                                      id: `ref-where-stack`,
                                      sourceType: "STACK" as EvidenceSourceType,
                                      label: `Stack Frame`,
                                      targetId: anchorError?.id || "unknown",
                                  },
                              ],
                              status: "ESTABLISHED" as EvidenceStatus,
                          },
                      ]
                    : []),
            ],
        },
        // 3. How the failure propagated (Section 29)
        {
            id: "how-it-propagated",
            title: "3. How the Failure Propagated",
            summary: `Propagation path traced through service ${primaryService} to execution boundary.`,
            claims: establishedClaims.filter((c) => c.sourceTypes.includes("RUNTIME") || c.sourceTypes.includes("STACK")),
            bulletPoints: [
                {
                    text: `Request entered ${primaryService} -> Exception triggered in ${primaryAppFrame?.filePath || primaryService} -> Propagated to boundary.`,
                    references: anchorError
                        ? [
                              {
                                  id: `ref-prop-anchor`,
                                  sourceType: "RUNTIME",
                                  label: `Error Event ${anchorError.id}`,
                                  targetId: anchorError.id,
                              },
                          ]
                        : [],
                    status: "ESTABLISHED",
                },
            ],
        },
        // 4. What changed (Section 30)
        {
            id: "what-changed",
            title: "4. What Changed",
            summary: relevantChangeFound
                ? `Correlated Git changes detected intersecting execution paths prior to failure onset.`
                : `No intersecting code path changes detected within the pre-incident observation window.`,
            claims: deduplicatedClaims.filter((c) => c.sourceTypes.includes("CHANGE") || c.sourceTypes.includes("DEPLOYMENT")),
            bulletPoints: deduplicatedClaims
                .filter((c) => c.sourceTypes.includes("CHANGE") || c.sourceTypes.includes("DEPLOYMENT"))
                .map((c) => ({
                    text: c.statement,
                    references: c.evidenceReferences,
                    status: c.status,
                })),
        },
        // 5. Why Halo supports the conclusion (Section 31: independent evidence chain)
        {
            id: "why-halo-supports",
            title: "5. Why Halo Supports the Investigation Conclusion",
            summary: `Convergence of ${supportedDimensions.length} independent evidence dimensions supporting the canonical conclusion.`,
            claims: supportedClaims,
            bulletPoints: supportedClaims.map((c) => ({
                text: `${c.statement} [Supported by ${c.independentSourceCount} independent source dimensions: ${c.sourceTypes.join(", ")}]`,
                references: c.evidenceReferences,
                status: c.status,
            })),
        },
        // 6. What contradicts it (Section 32)
        {
            id: "what-contradicts",
            title: "6. What Contradicts It",
            summary: contradictedClaims.length > 0
                ? `${contradictedClaims.length} evidence contradiction(s) observed across telemetry dimensions.`
                : "No contradicting evidence observed.",
            claims: contradictedClaims,
            bulletPoints: contradictedClaims.length > 0
                ? contradictedClaims.map((c) => ({
                      text: c.statement,
                      references: c.evidenceReferences,
                      status: c.status,
                  }))
                : [
                      {
                          text: "No contradicting evidence observed across telemetry, change, or topology streams.",
                          references: [
                              {
                                  id: "ref-no-contra",
                                  sourceType: "RUNTIME",
                                  label: "Evidence Consistency Verification",
                                  targetId: investigation.id,
                              },
                          ],
                          status: "ESTABLISHED",
                      },
                  ],
        },
        // 7. Historical context (Section 34: historical context not current cause)
        {
            id: "historical-context",
            title: "7. Historical Context",
            summary: investigation.incidentMemory
                ? "Historical incident memory patterns for comparative organizational context."
                : "No matching historical failure patterns observed.",
            claims: deduplicatedClaims.filter((c) => c.sourceTypes.includes("MEMORY")),
            bulletPoints: deduplicatedClaims
                .filter((c) => c.sourceTypes.includes("MEMORY"))
                .map((c) => ({
                    text: `${c.statement} (Explicitly designated as historical context; not current cause)`,
                    references: c.evidenceReferences,
                    status: c.status,
                })),
        },
        // 8. Ownership context (Section 35: no blame language)
        {
            id: "ownership-context",
            title: "8. Ownership Context",
            summary: matchedOwnership
                ? `Service ownership for ${primaryService} resolved via ${matchedOwnership.source}.`
                : `Service ${primaryService} is unassigned in the ownership catalog.`,
            claims: deduplicatedClaims.filter((c) => c.sourceTypes.includes("OWNERSHIP")),
            bulletPoints: deduplicatedClaims
                .filter((c) => c.sourceTypes.includes("OWNERSHIP"))
                .map((c) => ({
                    text: c.statement,
                    references: c.evidenceReferences,
                    status: c.status,
                })),
        },
        // 9. What remains unknown (Section 33: explicit unknowns)
        {
            id: "what-remains-unknown",
            title: "9. What Remains Unknown",
            summary: "Explicit unknowns and unavailable telemetry streams identified during synthesis.",
            claims: unknownClaims,
            bulletPoints: unknownClaims.map((c) => ({
                text: `${c.statement} [Status: ${c.status}]`,
                references: c.evidenceReferences,
                status: c.status,
            })),
        },
    ];

    const narrative: InvestigationNarrative = {
        sections,
        generatedAt: new Date().toISOString(),
    };

    const synthesis: InvestigationSynthesis = {
        investigationId,
        projectId,
        organizationId,
        generatedAt: new Date().toISOString(),
        version: `syn-v1-${investigation.updatedAt.getTime()}`,
        rootCauseMap,
        claims: deduplicatedClaims,
        establishedClaims,
        supportedClaims,
        contradictedClaims,
        unknownClaims,
        chain: evidenceChain,
        narrative,
        statistics: {
            totalClaims: deduplicatedClaims.length,
            establishedCount: establishedClaims.length,
            supportedCount: supportedClaims.length,
            contradictedCount: contradictedClaims.length,
            unknownCount: unknownClaims.length,
            independentSourceCategories: observedCategories.size,
        },
    };

    // Store in tenant-isolated cache
    const cacheKey = getSynthesisCacheKey(organizationId, projectId, investigationId);
    synthesisCache.set(cacheKey, {
        synthesis,
        cachedAt: Date.now(),
    });

    return synthesis;
}
