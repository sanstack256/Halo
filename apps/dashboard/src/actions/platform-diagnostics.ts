"use server";

/**
 * Server Actions for Platform Diagnostics & System Hardening (Phase 12 / Pillar K)
 *
 * SECTION 52, 92, 94: System Health, Read-only Diagnostics, and Availability Matrix
 */

import { getPlatformHealthSummary, type PlatformHealthSummary } from "@/lib/observability/platform-health";
import { runDataIntegrityDiagnostic, type DiagnosticReport } from "@/lib/integrity/diagnostic-engine";
import { computeInvestigationAvailability, type InvestigationAvailabilityMatrix } from "@/lib/investigation/availability-matrix";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireOrganizationRole,
    requireCapability,
} from "@/lib/authorization";
import { OrganizationRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Retrieves the current internal platform health summary.
 */
export async function getPlatformHealthAction(): Promise<PlatformHealthSummary> {
    await requireAuthenticatedUser();
    return getPlatformHealthSummary();
}

/**
 * Runs a strictly read-only data integrity diagnostic for an organization.
 */
export async function runDataIntegrityDiagnosticAction(
    organizationId: string
): Promise<DiagnosticReport> {
    await requireAuthenticatedUser();
    await requireOrganizationRole(organizationId, [
        OrganizationRole.OWNER,
        OrganizationRole.ADMIN,
    ]);
    await requireCapability(organizationId, "TEAM_PRODUCTION_HARDENING");

    return runDataIntegrityDiagnostic(organizationId);
}

/**
 * Retrieves the evidence availability matrix for an investigation.
 */
export async function getInvestigationAvailabilityMatrixAction(
    investigationId: string
): Promise<InvestigationAvailabilityMatrix> {
    await requireAuthenticatedUser();

    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        select: {
            id: true,
            projectId: true,
            project: {
                select: {
                    organizationId: true,
                },
            },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found`);
    }

    await requireProjectAccess(investigation.projectId);

    return computeInvestigationAvailability(investigation.id, investigation.projectId);
}
