/**
 * Investigation Evidence Availability Matrix (Phase 12 / Pillar K)
 *
 * SECTION 8, 50, 94: System-Level Availability Representation & Disclosure
 * Answers: "What does Halo actually have for this investigation?"
 *
 * Explicitly distinguishes:
 * - AVAILABLE: Authoritative observation present.
 * - PARTIAL: Sub-component observed, but incomplete coverage.
 * - UNAVAILABLE: Provider or service integration unreachable.
 * - NOT_CONFIGURED: Organization has not set up the required provider (e.g. GitHub).
 * - NOT_OBSERVED: Provider configured, but no relevant telemetry was generated.
 * - INSUFFICIENT_EVIDENCE / INSUFFICIENT_DATA: Observation volume inadequate for definitive conclusions.
 *
 * CRITICAL INVARIANT:
 * Never silently replace unavailable data with guessed data.
 */

import { prisma } from "@/lib/prisma";

export type AvailabilityStatus =
    | "AVAILABLE"
    | "PARTIAL"
    | "UNAVAILABLE"
    | "NOT_CONFIGURED"
    | "NOT_OBSERVED"
    | "INSUFFICIENT_EVIDENCE"
    | "INSUFFICIENT_DATA";

export interface DimensionAvailability {
    key: string;
    displayName: string;
    status: AvailabilityStatus;
    details: string;
    count?: number;
    evidenceReferences?: string[];
}

export interface InvestigationAvailabilityMatrix {
    investigationId: string;
    projectId: string;
    computedAt: string;
    isFullyObserved: boolean;
    dimensions: Record<string, DimensionAvailability>;
    missingIntegrations: string[];
    epistemicNotes: string[];
}

/**
 * Computes the authoritative availability matrix for an investigation.
 */
export async function computeInvestigationAvailability(
    investigationId: string,
    projectId: string
): Promise<InvestigationAvailabilityMatrix> {
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        include: {
            issue: true,
            project: {
                include: {
                    serviceOwnerships: true,
                },
            },
            remediationRecommendations: {
                include: {
                    verifications: true,
                },
            },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found`);
    }

    const dimensions: Record<string, DimensionAvailability> = {};
    const missingIntegrations: string[] = [];
    const epistemicNotes: string[] = [];

    // 1. Runtime Telemetry Evidence
    const eventCount = await prisma.event.count({
        where: {
            projectId,
            issueId: investigation.issueId ?? undefined,
        },
    });

    if (eventCount >= 3) {
        dimensions.RUNTIME_EVIDENCE = {
            key: "RUNTIME_EVIDENCE",
            displayName: "Runtime Telemetry",
            status: "AVAILABLE",
            details: `Observed ${eventCount} canonical telemetry events for failing execution.`,
            count: eventCount,
        };
    } else if (eventCount > 0) {
        dimensions.RUNTIME_EVIDENCE = {
            key: "RUNTIME_EVIDENCE",
            displayName: "Runtime Telemetry",
            status: "PARTIAL",
            details: `Observed ${eventCount} events; sample volume minimal for deep execution tracing.`,
            count: eventCount,
        };
        epistemicNotes.push("Runtime telemetry is low-volume; execution path reconstructed with partial fidelity.");
    } else {
        dimensions.RUNTIME_EVIDENCE = {
            key: "RUNTIME_EVIDENCE",
            displayName: "Runtime Telemetry",
            status: "NOT_OBSERVED",
            details: "No direct events attached to target issue.",
            count: 0,
        };
        epistemicNotes.push("No direct runtime events recorded for this investigation.");
    }

    // 2. Browser Replay Session
    const replaySession = await prisma.replaySession.findFirst({
        where: {
            projectId,
            issueId: investigation.issueId ?? undefined,
        },
    });

    if (replaySession) {
        dimensions.REPLAY = {
            key: "REPLAY",
            displayName: "Browser Replay",
            status: "AVAILABLE",
            details: `Replay session ${replaySession.id} captured with ${replaySession.chunkCount} recorded chunks.`,
            count: replaySession.chunkCount,
        };
    } else {
        dimensions.REPLAY = {
            key: "REPLAY",
            displayName: "Browser Replay",
            status: "NOT_OBSERVED",
            details: "No browser session replay captured for this incident.",
            count: 0,
        };
    }

    // 3. Git Change Intelligence
    const hasRepoConfig = Boolean(
        investigation.project.githubRepoOwner && investigation.project.githubRepoName
    );
    const changeCount = await prisma.changeObservation.count({
        where: { projectId },
    });

    if (!hasRepoConfig) {
        dimensions.GIT_CHANGES = {
            key: "GIT_CHANGES",
            displayName: "Git & Deployment Changes",
            status: "NOT_CONFIGURED",
            details: "Repository integration not configured for this project.",
            count: 0,
        };
        missingIntegrations.push("Repository (Git) integration not configured.");
    } else if (changeCount > 0) {
        dimensions.GIT_CHANGES = {
            key: "GIT_CHANGES",
            displayName: "Git & Deployment Changes",
            status: "AVAILABLE",
            details: `Observed ${changeCount} change observations in repository commit history.`,
            count: changeCount,
        };
    } else {
        dimensions.GIT_CHANGES = {
            key: "GIT_CHANGES",
            displayName: "Git & Deployment Changes",
            status: "NOT_OBSERVED",
            details: "Repository configured but zero recent changes observed prior to incident.",
            count: 0,
        };
    }

    // 4. Cross-Service Topology
    // Topology is derived from traces
    const hasTraces = await prisma.event.count({
        where: {
            projectId,
            type: "TRACE",
        },
    });

    if (hasTraces > 0) {
        dimensions.TOPOLOGY = {
            key: "TOPOLOGY",
            displayName: "Cross-Service Topology",
            status: "AVAILABLE",
            details: `Constructed directed graph from ${hasTraces} distributed trace spans.`,
            count: hasTraces,
        };
    } else {
        dimensions.TOPOLOGY = {
            key: "TOPOLOGY",
            displayName: "Cross-Service Topology",
            status: "NOT_OBSERVED",
            details: "No distributed trace spans recorded; topology graph represents single service only.",
            count: 0,
        };
    }

    // 5. Engineering Ownership
    const declaredOwners = investigation.project.serviceOwnerships.length;
    if (declaredOwners > 0) {
        dimensions.OWNERSHIP = {
            key: "OWNERSHIP",
            displayName: "Service Ownership",
            status: "AVAILABLE",
            details: `Declared ownership configured for ${declaredOwners} services.`,
            count: declaredOwners,
        };
    } else {
        dimensions.OWNERSHIP = {
            key: "OWNERSHIP",
            displayName: "Service Ownership",
            status: "NOT_CONFIGURED",
            details: "No service ownership or CODEOWNERS rules configured for this project.",
            count: 0,
        };
    }

    // 6. Historical Failure Memory
    const historicalMemoryCount = await prisma.incidentMemory.count({
        where: {
            organizationId: investigation.project.organizationId,
            investigationId: { not: investigationId },
        },
    });

    if (historicalMemoryCount > 0) {
        dimensions.HISTORICAL_MEMORY = {
            key: "HISTORICAL_MEMORY",
            displayName: "Historical Memory",
            status: "AVAILABLE",
            details: `${historicalMemoryCount} historical incident memories available for structural matching.`,
            count: historicalMemoryCount,
        };
    } else {
        dimensions.HISTORICAL_MEMORY = {
            key: "HISTORICAL_MEMORY",
            displayName: "Historical Memory",
            status: "NOT_OBSERVED",
            details: "Zero prior completed incidents recorded in organization memory.",
            count: 0,
        };
    }

    // 7. Remediation Intelligence
    const recs = investigation.remediationRecommendations;
    if (recs.length > 0) {
        const actionableRecs = recs.filter((r) => r.status === "ACTIONABLE");
        dimensions.REMEDIATION = {
            key: "REMEDIATION",
            displayName: "Remediation Intelligence",
            status: actionableRecs.length > 0 ? "AVAILABLE" : "PARTIAL",
            details: `${recs.length} recommendations generated (${actionableRecs.length} actionable).`,
            count: recs.length,
        };
    } else {
        dimensions.REMEDIATION = {
            key: "REMEDIATION",
            displayName: "Remediation Intelligence",
            status: "INSUFFICIENT_EVIDENCE",
            details: "Insufficient evidence to formulate deterministic remediation recommendations.",
            count: 0,
        };
    }

    // 8. Remediation Verification
    const verifications = recs.flatMap((r) => r.verifications);
    if (verifications.length > 0) {
        const hasAuthoritative = verifications.some((v) => v.result !== "INSUFFICIENT_DATA");
        dimensions.VERIFICATION = {
            key: "VERIFICATION",
            displayName: "Remediation Verification",
            status: hasAuthoritative ? "AVAILABLE" : "PARTIAL",
            details: `${verifications.length} verification observations recorded.`,
            count: verifications.length,
        };
    } else {
        dimensions.VERIFICATION = {
            key: "VERIFICATION",
            displayName: "Remediation Verification",
            status: "INSUFFICIENT_DATA",
            details: "No post-change telemetry verification runs recorded.",
            count: 0,
        };
    }

    const isFullyObserved = Object.values(dimensions).every(
        (d) => d.status === "AVAILABLE"
    );

    return {
        investigationId,
        projectId,
        computedAt: new Date().toISOString(),
        isFullyObserved,
        dimensions,
        missingIntegrations,
        epistemicNotes,
    };
}
