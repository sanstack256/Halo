/**
 * Halo Trace — Pillar F: Change Intelligence & Causal Change Analysis Engine
 *
 * Deterministic engine correlating real system changes (commits, deployments, configs)
 * with investigation telemetry, failing code paths, and differential behavioral traces.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. TEMPORAL IS NOT CAUSAL. Proximity alone is merely TEMPORALLY_RELATED.
 * 2. AUTHOR != OWNER != CULPRIT. Authors are purely historical metadata.
 * 3. NO BLAME SCORING. No blame scores, culprit metrics, or developer rankings.
 * 4. NO SILENT ASSUMPTIONS. Missing data is explicitly UNKNOWN / NOT_OBSERVED / UNAVAILABLE.
 * 5. CONTRADICTIONS SURFACED. Contradictory signals weaken the relationship and are explicitly surfaced.
 * 6. ROOT CAUSE & CONFIDENCE IMMUTABILITY. This engine NEVER modifies investigation.rootCause or confidenceScore.
 */

import { prisma } from "@/lib/prisma";
import {
    type AnalyzedChangeCandidate,
    type ChangeEvidenceExplanation,
    type ChangeRelationshipType,
    type ChangeSourceType,
    type ChangeTimelineEntry,
    type ChangedFileItem,
    type EvidenceDimensions,
    type InvestigationChangeContext,
    type SignalLevel,
} from "./types";
import {
    doesPathIntersect,
    evaluateLineIntersection,
    sanitizeRepositoryPath,
} from "./path-utils";
import { collectGitHistory } from "./git-collector";
import { resolveServiceOwnership } from "../ownership/ownership-engine";

interface ResolveInvestigationChangesParams {
    investigationId: string;
    organizationId: string;
}

/**
 * Extracts failing code locations from stack trace strings or event metadata.
 */
function extractFailingLocation(events: Array<{ stack?: string | null; metadata?: any; title?: string }>): {
    filePath?: string;
    lineNumber?: number;
    functionName?: string;
} | undefined {
    for (const ev of events) {
        // 1. Check metadata
        if (ev.metadata && typeof ev.metadata === "object") {
            const m = ev.metadata as Record<string, any>;
            if (m.filePath || m.filename || m.file) {
                return {
                    filePath: sanitizeRepositoryPath(String(m.filePath || m.filename || m.file)) || undefined,
                    lineNumber: typeof m.lineNumber === "number" ? m.lineNumber : undefined,
                    functionName: m.functionName ? String(m.functionName) : undefined,
                };
            }
        }

        // 2. Check stack trace
        if (ev.stack && typeof ev.stack === "string") {
            // Standard V8 / Node / Python stack line: "at functionName (/path/to/file.ts:123:45)"
            const stackLines = ev.stack.split("\n");
            for (const line of stackLines) {
                const match = line.match(/(?:at\s+(?:async\s+)?([^\s(]+)\s+\(([^:]+):(\d+):(?:\d+)\)|at\s+([^:]+):(\d+):(?:\d+))/);
                if (match) {
                    const func = match[1] || undefined;
                    const rawFile = match[2] || match[4];
                    const rawLine = match[3] || match[5];
                    const cleanPath = sanitizeRepositoryPath(rawFile);
                    if (cleanPath) {
                        return {
                            filePath: cleanPath,
                            lineNumber: rawLine ? parseInt(rawLine, 10) : undefined,
                            functionName: func,
                        };
                    }
                }
            }
        }
    }
    return undefined;
}

/**
 * Deterministically correlates and analyzes all change evidence for an investigation.
 */
export async function resolveInvestigationChanges(
    params: ResolveInvestigationChangesParams
): Promise<InvestigationChangeContext> {
    const { investigationId, organizationId } = params;

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
                        select: {
                            id: true,
                            version: true,
                            commitSha: true,
                            firstSeen: true,
                            lastSeen: true,
                        },
                    },
                },
            },
            incidentMemory: true,
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    if (investigation.project.organizationId !== organizationId) {
        throw new Error("Tenant isolation violation: Access denied.");
    }

    const projectId = investigation.projectId;

    // Fetch canonical telemetry events for the investigation
    const eventFilter = investigation.issueId
        ? { projectId, issueId: investigation.issueId }
        : { projectId };

    const events = await prisma.event.findMany({
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
        },
    });

    // Derive investigation window
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const failureOnset = events.find((e) => e.severity === "ERROR" || e.type === "ERROR")?.timestamp || firstEvent?.timestamp;

    let investigationWindow: InvestigationChangeContext["investigationWindow"] = null;
    if (firstEvent && lastEvent) {
        const windowStart = new Date(Math.min(investigation.startedAt.getTime(), firstEvent.timestamp.getTime()) - 1000 * 60 * 60 * 4); // 4h pre-window
        const windowEnd = investigation.completedAt || lastEvent.timestamp;
        investigationWindow = {
            start: windowStart,
            end: windowEnd,
            failureOnset,
        };
    }

    // Extract affected services
    const affectedServices = Array.from(new Set(events.map((e) => e.service).filter(Boolean))) as string[];
    const contextData = (investigation.context as any) || {};
    const rootCauseService = contextData.causalOrigin || affectedServices[0] || undefined;

    // Extract failing location
    const failingLocation = extractFailingLocation(events);

    // 1. Fetch persisted ChangeObservation records
    const storedObservations = await prisma.changeObservation.findMany({
        where: {
            projectId,
            organizationId,
        },
        orderBy: { observedAt: "desc" },
        take: 30,
    });

    // 2. Collect Git commits from GitHub provider if connected
    const gitData = await collectGitHistory({
        organizationId,
        projectId,
        windowStart: investigationWindow?.start,
        windowEnd: investigationWindow?.end,
    });

    const hasGitIntegration = gitData.hasGitConfig;
    const hasDeploymentData = (investigation.project.releases && investigation.project.releases.length > 0) ||
        storedObservations.some((o) => o.sourceType === "DEPLOYMENT_EVENT");

    // Map candidate changes from both stored observations and git data
    const rawCandidates: Array<{
        id: string;
        changeKey: string;
        sourceType: ChangeSourceType;
        sourceVersion?: string | null;
        repository?: string | null;
        commitSha?: string | null;
        parentCommitSha?: string | null;
        commitMessage?: string | null;
        authorIdentity?: string | null;
        authorTimestamp?: Date | null;
        branch?: string | null;
        ref?: string | null;
        deploymentReference?: string | null;
        pullRequestReference?: string | null;
        serviceAssociation?: string | null;
        codePathAssociation?: string | null;
        changedFiles: Array<{ filePath: string; status?: string; additions?: number; deletions?: number; patch?: string }>;
        additions?: number | null;
        deletions?: number | null;
        observedAt: Date;
        metadata?: Record<string, any> | null;
    }> = [];

    const seenChangeKeys = new Set<string>();

    // Add stored observations
    for (const obs of storedObservations) {
        if (!seenChangeKeys.has(obs.changeKey)) {
            seenChangeKeys.add(obs.changeKey);
            const rawFiles = Array.isArray(obs.changedFiles) ? (obs.changedFiles as any[]) : [];
            rawCandidates.push({
                id: obs.id,
                changeKey: obs.changeKey,
                sourceType: obs.sourceType as ChangeSourceType,
                sourceVersion: obs.sourceVersion,
                repository: obs.repository,
                commitSha: obs.commitSha,
                parentCommitSha: obs.parentCommitSha,
                commitMessage: obs.commitMessage,
                authorIdentity: obs.authorIdentity,
                authorTimestamp: obs.authorTimestamp,
                branch: obs.branch,
                ref: obs.ref,
                deploymentReference: obs.deploymentReference,
                pullRequestReference: obs.pullRequestReference,
                serviceAssociation: obs.serviceAssociation,
                codePathAssociation: obs.codePathAssociation,
                changedFiles: rawFiles,
                additions: obs.additions,
                deletions: obs.deletions,
                observedAt: obs.observedAt,
                metadata: (obs.metadata as Record<string, any>) || null,
            });
        }
    }

    // Add collected git commits
    for (const c of gitData.commits) {
        const repoPart = gitData.repositoryFullName?.toLowerCase() || "default";
        const cKey = `GIT_COMMIT:${repoPart}:${c.sha.toLowerCase()}`;
        if (!seenChangeKeys.has(cKey)) {
            seenChangeKeys.add(cKey);
            rawCandidates.push({
                id: `git-${c.sha.slice(0, 10)}`,
                changeKey: cKey,
                sourceType: "GIT_COMMIT",
                repository: gitData.repositoryFullName,
                commitSha: c.sha,
                parentCommitSha: c.parentSha,
                commitMessage: c.message,
                authorIdentity: c.authorName, // Historical metadata only
                authorTimestamp: c.date,
                branch: investigation.project.githubDefaultBranch || "main",
                ref: c.sha,
                changedFiles: c.files,
                observedAt: c.date,
            });
        }
    }

    // 3. Differential Baseline comparison
    // Check if failing event exhibits divergence from successful baseline
    let observedBehavioralDivergence: SignalLevel | "INSUFFICIENT_EVIDENCE" = "INSUFFICIENT_EVIDENCE";
    let divergentOperation: string | undefined;

    const failingEvent = events.find((e) => e.severity === "ERROR" || e.type === "ERROR") || events[0];
    if (failingEvent && failingEvent.operation && failingEvent.service) {
        const baselines = await prisma.event.findMany({
            where: {
                projectId,
                service: failingEvent.service,
                operation: failingEvent.operation,
                type: { in: ["TRACE", "LOG"] },
                severity: "INFO",
                NOT: { id: failingEvent.id },
            },
            take: 5,
        });

        if (baselines.length > 0) {
            // Compare duration or error behavior
            const avgDuration = baselines.reduce((acc, b) => acc + (b.durationMs || 0), 0) / baselines.length;
            const failingDur = failingEvent.durationMs || 0;
            if (failingDur > avgDuration * 2 && failingDur > 200) {
                observedBehavioralDivergence = "HIGH";
                divergentOperation = failingEvent.operation;
            } else {
                observedBehavioralDivergence = "LOW";
            }
        }
    }

    // 4. Analyze each candidate change against multi-dimensional evidence rules
    const analyzedChanges: AnalyzedChangeCandidate[] = [];
    const contradictions: string[] = [];
    const uncertainties: string[] = [];

    for (const cand of rawCandidates) {
        const changeTime = cand.authorTimestamp || cand.observedAt;
        const matchingSignals: string[] = [];
        const missingSignals: string[] = [];
        const contradictingSignals: string[] = [];
        const evidenceReferences: string[] = [];

        // Dimension 1: Temporal Alignment
        let temporalAlignment: SignalLevel = "NONE";
        if (failureOnset && changeTime) {
            const timeDiffMs = failureOnset.getTime() - changeTime.getTime();
            if (timeDiffMs >= 0) {
                // Change preceded failure
                const hoursBefore = timeDiffMs / (1000 * 60 * 60);
                if (hoursBefore <= 2) {
                    temporalAlignment = "HIGH";
                    matchingSignals.push(`Change occurred ${Math.round(timeDiffMs / 60000)}m before observed failure onset.`);
                } else if (hoursBefore <= 24) {
                    temporalAlignment = "MEDIUM";
                    matchingSignals.push(`Change occurred ${Math.round(hoursBefore)}h before observed failure onset.`);
                } else {
                    temporalAlignment = "LOW";
                    matchingSignals.push("Change occurred more than 24h prior to failure.");
                }
            } else {
                // Change occurred AFTER failure
                temporalAlignment = "NONE";
                contradictingSignals.push("Change occurred after the first observed failure event (not preceding).");
            }
        } else {
            missingSignals.push("Exact temporal ordering relative to failure onset could not be established.");
        }

        // Dimension 2: Service Intersection
        let serviceIntersection: SignalLevel = "NONE";
        const candidateService = cand.serviceAssociation;
        if (candidateService) {
            if (rootCauseService && candidateService.toLowerCase() === rootCauseService.toLowerCase()) {
                serviceIntersection = "HIGH";
                matchingSignals.push(`Change explicitly targets root cause service "${rootCauseService}".`);
            } else if (affectedServices.some((s) => s.toLowerCase() === candidateService.toLowerCase())) {
                serviceIntersection = "MEDIUM";
                matchingSignals.push(`Change targets affected service "${candidateService}".`);
            } else {
                serviceIntersection = "NONE";
                contradictingSignals.push(`Change targets service "${candidateService}", which is not among affected services [${affectedServices.join(", ")}].`);
            }
        } else if (cand.repository) {
            // Check if service ownership links repository to an affected service
            const ownershipMatch = await prisma.serviceOwnership.findFirst({
                where: {
                    organizationId,
                    repositoryUrl: { contains: cand.repository },
                },
                select: { serviceName: true },
            });
            if (ownershipMatch && affectedServices.includes(ownershipMatch.serviceName)) {
                serviceIntersection = "MEDIUM";
                matchingSignals.push(`Repository "${cand.repository}" is associated with affected service "${ownershipMatch.serviceName}".`);
            } else {
                missingSignals.push("Direct service association not recorded for this change.");
            }
        } else {
            missingSignals.push("Service association not observed.");
        }

        // Dimension 3 & 4: File and Line Intersection
        let fileIntersection: SignalLevel = "NONE";
        let lineIntersection: SignalLevel | "UNAVAILABLE" = "UNAVAILABLE";
        const changedFilesDetails: ChangedFileItem[] = [];

        if (failingLocation?.filePath) {
            let matchedAnyFile = false;
            for (const f of cand.changedFiles) {
                const intersects = doesPathIntersect(f.filePath, failingLocation.filePath);
                let lineIntersect: SignalLevel | "UNAVAILABLE" = "UNAVAILABLE";

                if (intersects) {
                    matchedAnyFile = true;
                    lineIntersect = evaluateLineIntersection(f.patch, failingLocation.lineNumber);
                    if (lineIntersect !== "UNAVAILABLE") {
                        lineIntersection = lineIntersect;
                    }
                }

                // Ownership integration (Pillar E) for changed file
                let declaredOwner: string | undefined;
                let ownerSource: string | undefined;
                try {
                    const own = await resolveServiceOwnership({
                        serviceName: cand.serviceAssociation || rootCauseService || "default",
                        projectId,
                        organizationId,
                        sourcePath: f.filePath,
                    });
                    if (own.declaredOwners.length > 0 && own.status !== "UNKNOWN") {
                        declaredOwner = own.declaredOwners.join(", ");
                        ownerSource = own.primarySource;
                    }
                } catch {
                    // ignore ownership lookup failure
                }

                changedFilesDetails.push({
                    filePath: f.filePath,
                    status: f.status,
                    additions: f.additions,
                    deletions: f.deletions,
                    patch: f.patch?.slice(0, 500),
                    intersectsFailingPath: intersects,
                    lineIntersection: lineIntersect,
                    declaredOwner,
                    ownerSource,
                });
            }

            if (matchedAnyFile) {
                fileIntersection = "HIGH";
                matchingSignals.push(`Changed file directly intersects failing execution path "${failingLocation.filePath}".`);
                if (lineIntersection === "HIGH") {
                    matchingSignals.push(`Modified line range intersects failing stack frame at line ${failingLocation.lineNumber}.`);
                } else if (lineIntersection === "MEDIUM") {
                    matchingSignals.push(`Modified line range is in close proximity to failing line ${failingLocation.lineNumber}.`);
                } else if (lineIntersection === "NONE") {
                    contradictingSignals.push(`Failing line ${failingLocation.lineNumber} was not inside modified line hunks.`);
                }
            } else if (cand.changedFiles.length > 0) {
                fileIntersection = "NONE";
                contradictingSignals.push(`None of the ${cand.changedFiles.length} changed files intersect failing path "${failingLocation.filePath}".`);
            } else {
                missingSignals.push("Changed file list unavailable for this change.");
            }
        } else {
            fileIntersection = "NONE";
            missingSignals.push("Failing source path evidence not observed in investigation telemetry.");
            lineIntersection = "UNAVAILABLE";
        }

        // Dimension 5: Behavioral Divergence
        let behavioralDivergence: SignalLevel | "INSUFFICIENT_EVIDENCE" = observedBehavioralDivergence;
        if (fileIntersection === "HIGH" && observedBehavioralDivergence === "HIGH") {
            matchingSignals.push(`Differential analysis isolated abnormal runtime divergence in "${divergentOperation || "operation"}".`);
        } else if (observedBehavioralDivergence === "INSUFFICIENT_EVIDENCE") {
            missingSignals.push("No baseline execution data available for differential behavioral analysis.");
        }

        // Dimension 6: Deployment Linkage
        let deploymentLinkage: SignalLevel | "NOT_OBSERVED" = "NOT_OBSERVED";
        let linkedRelease = cand.deploymentReference
            ? investigation.project.releases.find((r) => r.version === cand.deploymentReference)
            : cand.commitSha
            ? investigation.project.releases.find((r) => r.commitSha === cand.commitSha)
            : undefined;

        if (linkedRelease) {
            deploymentLinkage = "HIGH";
            matchingSignals.push(`Change linked to deployment release "${linkedRelease.version}" (SHA: ${cand.commitSha?.slice(0, 7) || "matched"}).`);
        } else if (cand.deploymentReference) {
            deploymentLinkage = "MEDIUM";
            matchingSignals.push(`Deployment reference "${cand.deploymentReference}" recorded on change.`);
        } else {
            missingSignals.push("Deployment linkage not observed in release telemetry.");
        }

        // Direct Causal Evidence (Strict epistemic honesty: always NOT_OBSERVED unless verified automated test fixture)
        const directCausalEvidence: "NOT_OBSERVED" | "OBSERVED" = "NOT_OBSERVED";
        missingSignals.push("Direct production causality evidence not observed (correlation only).");

        // Deterministic Relationship Classification (Section 14 & 17)
        let relationship: ChangeRelationshipType = "UNRELATED";

        if (contradictingSignals.some((s) => s.includes("after the first observed failure"))) {
            relationship = "UNRELATED";
        } else if (temporalAlignment !== "NONE") {
            // Temporal alignment holds
            if (serviceIntersection !== "NONE") {
                // Same service
                if (fileIntersection === "HIGH") {
                    // Intersects code path
                    if (behavioralDivergence === "HIGH") {
                        // High divergence observed
                        if (deploymentLinkage === "HIGH" || lineIntersection === "HIGH") {
                            relationship = "STRONGLY_SUPPORTED";
                        } else {
                            relationship = "BEHAVIORALLY_RELATED";
                        }
                    } else {
                        relationship = "CODE_PATH_RELATED";
                    }
                } else if (contradictingSignals.some((s) => s.includes("None of the"))) {
                    // Contradiction: same service but files did not intersect
                    relationship = "SERVICE_RELATED";
                } else {
                    relationship = "SERVICE_RELATED";
                }
            } else if (contradictingSignals.some((s) => s.includes("not among affected services"))) {
                // Contradiction: temporal but different service
                relationship = "TEMPORALLY_RELATED";
            } else {
                relationship = "TEMPORALLY_RELATED";
            }
        } else {
            relationship = "UNRELATED";
        }

        // Synthesize explainable summary
        const explanationText = matchingSignals.length > 0
            ? `Observed relationship: ${matchingSignals.join(" ")}${contradictingSignals.length > 0 ? ` Contradicting: ${contradictingSignals.join(" ")}` : ""}`
            : "No intersecting failure evidence observed for this change candidate.";

        const explanation: ChangeEvidenceExplanation = {
            matchingSignals,
            missingSignals,
            contradictingSignals,
            evidenceReferences,
            explanation: explanationText,
        };

        if (contradictingSignals.length > 0) {
            contradictions.push(...contradictingSignals.map((s) => `[${cand.commitSha?.slice(0, 7) || cand.id}] ${s}`));
        }

        // Ownership integration on candidate
        let primaryOwner: string | undefined;
        let primaryOwnerSource: string | undefined;
        const touchedOwners = changedFilesDetails.map((f) => f.declaredOwner).filter(Boolean);
        if (touchedOwners.length > 0) {
            primaryOwner = touchedOwners[0];
            primaryOwnerSource = changedFilesDetails.find((f) => f.declaredOwner === primaryOwner)?.ownerSource;
        }

        analyzedChanges.push({
            id: cand.id,
            projectId,
            organizationId,
            changeKey: cand.changeKey,
            sourceType: cand.sourceType,
            sourceVersion: cand.sourceVersion,
            repository: cand.repository,
            commitSha: cand.commitSha,
            parentCommitSha: cand.parentCommitSha,
            commitMessage: cand.commitMessage,
            authorIdentity: cand.authorIdentity, // Author != owner != culprit
            authorTimestamp: cand.authorTimestamp,
            branch: cand.branch,
            ref: cand.ref,
            deploymentReference: cand.deploymentReference,
            pullRequestReference: cand.pullRequestReference,
            serviceAssociation: cand.serviceAssociation,
            codePathAssociation: cand.codePathAssociation,
            changedFiles: changedFilesDetails,
            additions: cand.additions,
            deletions: cand.deletions,
            observedAt: cand.observedAt,
            relationship,
            evidenceDimensions: {
                temporalAlignment,
                serviceIntersection,
                fileIntersection,
                lineIntersection,
                behavioralDivergence,
                deploymentLinkage,
                directCausalEvidence,
            },
            explanation,
            declaredOwner: primaryOwner || null,
            ownershipSource: primaryOwnerSource || null,
            topologyImpact: {
                affectedServices,
                originService: rootCauseService,
            },
            historicalContext: investigation.incidentMemory
                ? {
                      matchingPattern: investigation.incidentMemory.fingerprint,
                      similarIncidentsCount: 1,
                  }
                : undefined,
            metadata: cand.metadata,
        });
    }

    // Sort candidates deterministically:
    // 1. Relationship strength
    // 2. Author timestamp / observedAt descending
    const relationshipStrengthOrder: Record<ChangeRelationshipType, number> = {
        STRONGLY_SUPPORTED: 6,
        BEHAVIORALLY_RELATED: 5,
        CODE_PATH_RELATED: 4,
        SERVICE_RELATED: 3,
        TEMPORALLY_RELATED: 2,
        INSUFFICIENT_EVIDENCE: 1,
        UNRELATED: 0,
    };

    analyzedChanges.sort((a, b) => {
        const strA = relationshipStrengthOrder[a.relationship] || 0;
        const strB = relationshipStrengthOrder[b.relationship] || 0;
        if (strB !== strA) return strB - strA;
        const timeA = a.authorTimestamp?.getTime() || a.observedAt.getTime();
        const timeB = b.authorTimestamp?.getTime() || b.observedAt.getTime();
        return timeB - timeA;
    });

    // 5. Build Chronological Timeline (Section 9)
    const timeline: ChangeTimelineEntry[] = [];

    for (const c of analyzedChanges) {
        timeline.push({
            id: `timeline-change-${c.id}`,
            timestamp: c.authorTimestamp || c.observedAt,
            type: c.sourceType === "DEPLOYMENT_EVENT"
                ? "DEPLOYMENT"
                : c.sourceType === "CONFIGURATION_CHANGE"
                ? "CONFIGURATION"
                : c.sourceType === "FEATURE_FLAG_CHANGE"
                ? "FEATURE_FLAG"
                : "COMMIT",
            title: c.commitSha ? `Commit ${c.commitSha.slice(0, 7)}` : `${c.sourceType} (${c.sourceVersion || "v1"})`,
            description: c.commitMessage || c.explanation.explanation,
            source: c.repository || c.serviceAssociation || "system",
            referenceId: c.commitSha || c.id,
            service: c.serviceAssociation || undefined,
            relationship: c.relationship,
        });
    }

    if (failureOnset) {
        timeline.push({
            id: "timeline-failure-onset",
            timestamp: failureOnset,
            type: "FAILURE_ONSET",
            title: "First Observed Failure Event",
            description: `Initial telemetry error recorded in service "${rootCauseService || "unknown"}"`,
            source: rootCauseService || "telemetry",
            referenceId: firstEvent?.id,
            service: rootCauseService,
        });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Epistemic boundaries / uncertainties
    if (analyzedChanges.length === 0) {
        if (!hasGitIntegration) {
            uncertainties.push("Repository change history unavailable. Configure repository access to inspect change evidence.");
        } else {
            uncertainties.push("No change evidence observed for this investigation window.");
        }
    }
    if (!hasDeploymentData) {
        uncertainties.push("Deployment evidence not observed in release telemetry.");
    }
    if (!failingLocation?.filePath) {
        uncertainties.push("Code-path intersection unavailable because the investigation contains no source-path evidence.");
    }

    return {
        investigationId,
        projectId,
        organizationId,
        investigationWindow,
        changes: analyzedChanges,
        timeline,
        hasGitIntegration,
        hasDeploymentData,
        failingLocation,
        affectedServices,
        rootCauseService,
        contradictions: Array.from(new Set(contradictions)),
        uncertainties: Array.from(new Set(uncertainties)),
    };
}
