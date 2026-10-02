/**
 * HALO TRACE — PILLAR E: OWNERSHIP INTELLIGENCE RESOLUTION ENGINE
 *
 * Core architectural guarantees:
 * 1. OWNERSHIP IS NOT BLAME:
 *    - Never infers developer fault or responsibility from commits, blame, or ownership.
 *    - Strictly uses "Declared Owner", "Code Owner", "Service Owner", "Relevant Team".
 * 2. DECLARED VS INFERRED VS HISTORICAL:
 *    - CODEOWNERS & Service Config -> DECLARED
 *    - Source path heuristic -> INFERRED
 *    - Incident participation -> HISTORICAL
 *    - User comments -> HUMAN ASSERTION
 * 3. ZERO SILENT RESOLUTION:
 *    - Disagreements between sources are surfaced explicitly as CONFLICTs.
 * 4. MULTIPLE OWNERS PRESERVED:
 *    - All declared owners from CODEOWNERS and configs are returned.
 * 5. ROOT CAUSE PROTECTION:
 *    - Ownership resolution NEVER alters rootCause or confidenceScore.
 */

import { prisma } from "@/lib/prisma";
import { resolveCodeownersForPath, sanitizeRepositoryPath, type ParsedCodeowners } from "./codeowners-parser";
import { loadProjectCodeowners } from "./codeowners-loader";

export type OwnershipStatus = "DECLARED" | "INFERRED" | "HISTORICAL" | "UNKNOWN" | "CONFLICT";

export interface OwnershipEvidenceItem {
    owner: string;
    ownerType: "TEAM" | "INDIVIDUAL" | "EXTERNAL_GROUP";
    source: "CODEOWNERS" | "SERVICE_CONFIG" | "HISTORICAL_INCIDENT" | "SOURCE_CORRELATION" | "HUMAN_ASSERTION";
    classification: "DECLARED" | "INFERRED" | "HISTORICAL" | "UNKNOWN" | "HUMAN_ASSERTION";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    scope: string;
    evidence: string;
    sourceLocation?: string;
    observedAt?: Date;
    commitSha?: string;
}

export interface OwnershipConflict {
    serviceName: string;
    sources: Array<{
        source: string;
        owner: string;
        classification: string;
        evidence: string;
        location?: string;
    }>;
    reason: string;
}

export interface ServiceOwnershipResult {
    serviceName: string;
    projectId?: string;
    organizationId: string;
    status: OwnershipStatus;
    declaredOwners: string[];
    owningTeam?: string | null;
    primarySource?: string;
    repository: string; // Exact repository or "Unknown"
    sourcePath?: string | null;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    evidence: OwnershipEvidenceItem[];
    conflict?: OwnershipConflict | null;
    humanAssertions: Array<{
        authorName: string;
        statement: string;
        proposedOwner: string;
        createdAt: Date;
    }>;
    historicalContext?: {
        previousOwners?: string[];
        incidentCount?: number;
        lastInvolvedAt?: Date;
    };
}

export interface ServiceRoleContext {
    serviceName: string;
    role: "ROOT_CAUSE_SERVICE" | "TRANSITIVE_PROPAGATOR" | "IMPACTED_SURFACE";
    ownership: ServiceOwnershipResult;
}

export interface CodePathOwnershipResult {
    filePath: string;
    lineNumber?: number;
    repository: string;
    codeOwners: string[];
    matchingRule?: string;
    source: "CODEOWNERS" | "SOURCE_NOT_AVAILABLE";
    confidence: "HIGH" | "LOW";
    recentAuthor?: {
        name: string;
        email?: string;
        commitSha?: string;
        note: string; // "Author of last modified commit (historical context only; does not imply fault)"
    };
}

export interface InvestigationOwnershipContext {
    investigationId: string;
    projectId: string;
    organizationId: string;
    affectedServices: ServiceRoleContext[];
    codeOwnership?: CodePathOwnershipResult | null;
    summary: {
        totalAffectedServices: number;
        declaredOwnerCount: number;
        conflictCount: number;
        unknownCount: number;
    };
}

/**
 * Resolves ownership for an individual service within tenant boundaries.
 * Deterministic pipeline:
 *   1. Explicit Service Config (Database)
 *   2. CODEOWNERS match (if path known or project configured)
 *   3. Human Assertions (tagged HUMAN ASSERTION)
 *   4. Historical Incidents (tagged HISTORICAL)
 *   5. Fallback: UNKNOWN (zero fabrication)
 */
export async function resolveServiceOwnership(params: {
    serviceName: string;
    projectId: string;
    organizationId: string;
    sourcePath?: string;
    parsedCodeowners?: ParsedCodeowners | null;
}): Promise<ServiceOwnershipResult> {
    const { serviceName, projectId, organizationId, sourcePath } = params;

    // 1. Fetch project repository metadata
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
        select: {
            id: true,
            organizationId: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubDefaultBranch: true,
        },
    });

    const repository = project?.githubRepoOwner && project?.githubRepoName
        ? `${project.githubRepoOwner}/${project.githubRepoName}`
        : "Unknown";

    const evidenceList: OwnershipEvidenceItem[] = [];

    // 2. Query configured service ownership records
    const configuredOwnerships = await prisma.serviceOwnership.findMany({
        where: {
            organizationId,
            serviceName,
            OR: [{ projectId }, { projectId: null }],
        },
        orderBy: { updatedAt: "desc" },
    });

    // 3. Query human assertions
    const assertions = await prisma.serviceOwnershipAssertion.findMany({
        where: {
            organizationId,
            serviceName,
            OR: [{ projectId }, { projectId: null }],
        },
        orderBy: { createdAt: "desc" },
    });

    // 4. Query historical incidents involving this service
    const historicalMemories = await prisma.incidentMemory.findMany({
        where: {
            organizationId,
            OR: [
                { primaryService: serviceName },
                { affectedServices: { has: serviceName } },
            ],
            status: "COMPLETED",
        },
        select: {
            id: true,
            createdAt: true,
            humanVerdicts: true,
        },
        take: 5,
        orderBy: { createdAt: "desc" },
    });

    // Collect candidates from sources
    let serviceConfigOwner: string | undefined = undefined;
    let codeownersOwners: string[] = [];

    // Evaluate Service Config
    const configRecord = configuredOwnerships.find((c) => c.source === "SERVICE_CONFIG");
    if (configRecord && configRecord.declaredOwner) {
        serviceConfigOwner = configRecord.declaredOwner;
        evidenceList.push({
            owner: configRecord.declaredOwner,
            ownerType: (configRecord.ownerType as any) || "TEAM",
            source: "SERVICE_CONFIG",
            classification: "DECLARED",
            confidence: "HIGH",
            scope: `service: ${serviceName}`,
            evidence: `Explicit service configuration defines owner as "${configRecord.declaredOwner}".`,
            sourceLocation: "Service Registry Configuration",
            observedAt: configRecord.updatedAt,
            commitSha: configRecord.commitSha || undefined,
        });
    }

    // Evaluate CODEOWNERS
    let codeownersObj = params.parsedCodeowners;
    if (codeownersObj === undefined) {
        codeownersObj = await loadProjectCodeowners(projectId, organizationId);
    }

    if (codeownersObj && codeownersObj.rules.length > 0) {
        const pathToTest = sourcePath || `services/${serviceName}` || `${serviceName}/`;
        const match = resolveCodeownersForPath(codeownersObj, pathToTest);
        if (match.isDeclared && match.owners.length > 0) {
            codeownersOwners = match.owners;
            for (const owner of match.owners) {
                evidenceList.push({
                    owner,
                    ownerType: owner.startsWith("@") ? "EXTERNAL_GROUP" : "TEAM",
                    source: "CODEOWNERS",
                    classification: "DECLARED",
                    confidence: "HIGH",
                    scope: `path: ${match.matchingRule?.pattern || pathToTest}`,
                    evidence: `CODEOWNERS rule "${match.matchingRule?.pattern}" assigns path to ${owner}.`,
                    sourceLocation: match.location || ".github/CODEOWNERS",
                    observedAt: new Date(),
                    commitSha: match.commitSha,
                });
            }
        }
    }

    // Also check if any stored CODEOWNERS record exists in DB
    const dbCodeownersRecord = configuredOwnerships.find((c) => c.source === "CODEOWNERS");
    if (dbCodeownersRecord && codeownersOwners.length === 0) {
        codeownersOwners = [dbCodeownersRecord.declaredOwner];
        evidenceList.push({
            owner: dbCodeownersRecord.declaredOwner,
            ownerType: (dbCodeownersRecord.ownerType as any) || "TEAM",
            source: "CODEOWNERS",
            classification: "DECLARED",
            confidence: "HIGH",
            scope: `service: ${serviceName}`,
            evidence: `Stored CODEOWNERS record assigns ownership to ${dbCodeownersRecord.declaredOwner}.`,
            sourceLocation: dbCodeownersRecord.sourcePath || "CODEOWNERS",
            observedAt: dbCodeownersRecord.updatedAt,
            commitSha: dbCodeownersRecord.commitSha || undefined,
        });
    }

    // 5. Evaluate Conflicts (e.g. Service Config says Team A, CODEOWNERS says Team B)
    let conflict: OwnershipConflict | null = null;
    let status: OwnershipStatus = "UNKNOWN";
    const declaredOwnersSet = new Set<string>();

    if (serviceConfigOwner && codeownersOwners.length > 0) {
        const normalizedConfig = serviceConfigOwner.toLowerCase().replace(/^@/, "").trim();
        const normalizedCodeowners = codeownersOwners.map((o) => o.toLowerCase().replace(/^@/, "").trim());

        const matches = normalizedCodeowners.includes(normalizedConfig);
        if (!matches) {
            // CONFLICT DETECTED
            conflict = {
                serviceName,
                sources: [
                    {
                        source: "SERVICE_CONFIG",
                        owner: serviceConfigOwner,
                        classification: "DECLARED",
                        evidence: `Service Registry declares "${serviceConfigOwner}"`,
                        location: "Service Configuration",
                    },
                    {
                        source: "CODEOWNERS",
                        owner: codeownersOwners.join(", "),
                        classification: "DECLARED",
                        evidence: `CODEOWNERS file declares "${codeownersOwners.join(", ")}"`,
                        location: "CODEOWNERS",
                    },
                ],
                reason: `Declared sources disagree: Service configuration specifies "${serviceConfigOwner}", whereas repository CODEOWNERS specifies "${codeownersOwners.join(", ")}". Neither is silently discarded.`,
            };
            status = "CONFLICT";
            declaredOwnersSet.add(serviceConfigOwner);
            for (const o of codeownersOwners) declaredOwnersSet.add(o);
        } else {
            status = "DECLARED";
            declaredOwnersSet.add(serviceConfigOwner);
            for (const o of codeownersOwners) declaredOwnersSet.add(o);
        }
    } else if (serviceConfigOwner) {
        status = "DECLARED";
        declaredOwnersSet.add(serviceConfigOwner);
    } else if (codeownersOwners.length > 0) {
        status = "DECLARED";
        for (const o of codeownersOwners) declaredOwnersSet.add(o);
    }

    // 6. Include Historical Evidence (Never overrides DECLARED)
    if (historicalMemories.length > 0) {
        evidenceList.push({
            owner: `Historical Participant(s) (${historicalMemories.length} past incident(s))`,
            ownerType: "TEAM",
            source: "HISTORICAL_INCIDENT",
            classification: "HISTORICAL",
            confidence: "LOW",
            scope: `service: ${serviceName}`,
            evidence: `Service was involved in ${historicalMemories.length} historical investigation(s). Historical context only; does not establish current ownership.`,
            observedAt: historicalMemories[0].createdAt,
        });

        if (status === "UNKNOWN") {
            status = "HISTORICAL";
        }
    }

    // 7. Human assertions (Tagged strictly HUMAN ASSERTION)
    const formattedAssertions = assertions.map((a) => ({
        authorName: a.authorName,
        statement: a.statement,
        proposedOwner: a.proposedOwner,
        createdAt: a.createdAt,
    }));

    for (const a of assertions) {
        evidenceList.push({
            owner: a.proposedOwner,
            ownerType: "TEAM",
            source: "HUMAN_ASSERTION",
            classification: "HUMAN_ASSERTION",
            confidence: "LOW",
            scope: a.scope || `service: ${serviceName}`,
            evidence: `Human proposal recorded by ${a.authorName}: "${a.statement}". This is human context, not declared configuration.`,
            observedAt: a.createdAt,
        });
    }

    // Query historical ownership changes
    const historyRecords = await prisma.serviceOwnershipHistory.findMany({
        where: {
            organizationId,
            serviceName,
            OR: [{ projectId }, { projectId: null }],
        },
        orderBy: { changedAt: "desc" },
        take: 5,
    });

    const previousOwners = historyRecords
        .map((h) => h.previousOwner)
        .filter((o): o is string => Boolean(o));

    const declaredOwners = Array.from(declaredOwnersSet);
    const primarySource = status === "CONFLICT"
        ? "MULTIPLE_CONFLICTING_SOURCES"
        : serviceConfigOwner
            ? "SERVICE_CONFIG"
            : codeownersOwners.length > 0
                ? "CODEOWNERS"
                : status === "HISTORICAL"
                    ? "HISTORICAL_INCIDENT"
                    : undefined;

    return {
        serviceName,
        projectId,
        organizationId,
        status,
        declaredOwners,
        owningTeam: declaredOwners[0] || null,
        primarySource,
        repository,
        sourcePath,
        confidence: status === "DECLARED" ? "HIGH" : status === "CONFLICT" ? "MEDIUM" : status === "HISTORICAL" ? "LOW" : "LOW",
        evidence: evidenceList,
        conflict,
        humanAssertions: formattedAssertions,
        historicalContext: {
            previousOwners: previousOwners.length > 0 ? previousOwners : undefined,
            incidentCount: historicalMemories.length,
            lastInvolvedAt: historicalMemories[0]?.createdAt,
        },
    };
}

/**
 * Resolves complete ownership context for an investigation.
 * Respects causal role: ROOT_CAUSE_SERVICE vs TRANSITIVE_PROPAGATOR vs IMPACTED_SURFACE.
 * Strictly preserves rootCause and confidenceScore immutability.
 */
export async function resolveInvestigationOwnership(params: {
    investigationId: string;
    organizationId: string;
}): Promise<InvestigationOwnershipContext> {
    const { investigationId, organizationId } = params;

    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        select: {
            id: true,
            projectId: true,
            issueId: true,
            rootCause: true,
            confidenceScore: true,
            project: {
                select: {
                    id: true,
                    organizationId: true,
                    githubRepoOwner: true,
                    githubRepoName: true,
                },
            },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    if (investigation.project.organizationId !== organizationId) {
        throw new Error("Tenant isolation violation: Investigation belongs to a different organization.");
    }

    // 1. Gather all events for this investigation to discover participating services and roles
    const events = await prisma.event.findMany({
        where: {
            projectId: investigation.projectId,
            ...(investigation.issueId ? { issueId: investigation.issueId } : {}),
            service: { not: null },
        },
        select: {
            id: true,
            service: true,
            type: true,
            timestamp: true,
            traceId: true,
            stack: true,
            metadata: true,
        },
        take: 100,
        orderBy: { timestamp: "asc" },
    });

    // Determine root cause service and impacted services
    const serviceSet = new Set<string>();
    let rootService: string | undefined = undefined;

    // Scan for first error event or span origin
    for (const evt of events) {
        if (evt.service) {
            serviceSet.add(evt.service);
            const errType = (evt.metadata as any)?.errorType;
            if (!rootService && (evt.type === "ERROR" || errType)) {
                rootService = evt.service;
            }
        }
    }

    if (!rootService && serviceSet.size > 0) {
        rootService = Array.from(serviceSet)[0];
    }

    // 2. Load project CODEOWNERS once for batch efficiency
    const parsedCodeowners = await loadProjectCodeowners(investigation.projectId, organizationId);

    // 3. Resolve ownership for each service with designated causal role
    const affectedServices: ServiceRoleContext[] = [];
    const serviceList = Array.from(serviceSet);

    for (let i = 0; i < serviceList.length; i++) {
        const sName = serviceList[i];
        let role: ServiceRoleContext["role"] = "IMPACTED_SURFACE";

        if (sName === rootService) {
            role = "ROOT_CAUSE_SERVICE";
        } else if (i < serviceList.length - 1) {
            role = "TRANSITIVE_PROPAGATOR";
        }

        const ownership = await resolveServiceOwnership({
            serviceName: sName,
            projectId: investigation.projectId,
            organizationId,
            parsedCodeowners,
        });

        affectedServices.push({
            serviceName: sName,
            role,
            ownership,
        });
    }

    // 4. Resolve code path ownership if stack frame / file path is present in telemetry
    let codeOwnership: CodePathOwnershipResult | null = null;
    let targetFilePath: string | undefined = undefined;

    for (const evt of events) {
        if (evt.metadata && typeof evt.metadata === "object") {
            const raw = (evt.metadata as any).rawFilePath || (evt.metadata as any).filePath;
            if (raw) {
                targetFilePath = String(raw);
                break;
            }
        }
        if (evt.stack && typeof evt.stack === "string") {
            const match = evt.stack.match(/\(?([a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+):(\d+):(\d+)\)?/);
            if (match && match[1]) {
                targetFilePath = match[1];
                break;
            }
        }
    }

    const repoName = investigation.project.githubRepoOwner && investigation.project.githubRepoName
        ? `${investigation.project.githubRepoOwner}/${investigation.project.githubRepoName}`
        : "Unknown";

    if (targetFilePath && parsedCodeowners) {
        const sanitized = sanitizeRepositoryPath(targetFilePath);
        if (sanitized) {
            const match = resolveCodeownersForPath(parsedCodeowners, sanitized);
            codeOwnership = {
                filePath: sanitized,
                repository: repoName,
                codeOwners: match.owners,
                matchingRule: match.matchingRule?.pattern,
                source: "CODEOWNERS",
                confidence: match.owners.length > 0 ? "HIGH" : "LOW",
            };
        }
    } else if (targetFilePath) {
        codeOwnership = {
            filePath: targetFilePath,
            repository: repoName,
            codeOwners: [],
            source: "SOURCE_NOT_AVAILABLE",
            confidence: "LOW",
        };
    }

    const declaredOwnerCount = affectedServices.filter((s) => s.ownership.status === "DECLARED").length;
    const conflictCount = affectedServices.filter((s) => s.ownership.status === "CONFLICT").length;
    const unknownCount = affectedServices.filter((s) => s.ownership.status === "UNKNOWN").length;

    return {
        investigationId,
        projectId: investigation.projectId,
        organizationId,
        affectedServices,
        codeOwnership,
        summary: {
            totalAffectedServices: affectedServices.length,
            declaredOwnerCount,
            conflictCount,
            unknownCount,
        },
    };
}
