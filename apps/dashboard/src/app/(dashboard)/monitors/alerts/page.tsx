import { getOrgAlerts } from "@/actions/alert";
import { getOrgMonitors } from "@/actions/monitor";
import { AlertsClient } from "@/components/alerts/alerts-client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization, ensureOrganization } from "@/lib/organization";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
    searchParams,
}: {
    searchParams: Promise<{ project?: string; status?: string }>;
}) {
    const sp = await searchParams;
    const projectFilter = sp?.project;
    const statusFilter = sp?.status;

    const session = await getSession();
    let projects: { id: string; name: string }[] = [];

    if (session) {
        let org = await getOrganization(session.user.id);
        if (!org) org = await ensureOrganization(session.user.id);
        if (org) {
            projects = await prisma.project.findMany({
                where: { organizationId: org.id },
                select: { id: true, name: true },
                orderBy: { name: "asc" },
            });
        }
    }

    const result = await getOrgAlerts({
        projectId: projectFilter,
        status: statusFilter as any,
        pageSize: 100, // load full list for client-side filter
    });

    return (
        <AlertsClient
            initialAlerts={result.alerts}
            projects={projects}
            totalCount={result.totalCount}
            initialCounts={result.counts}
            initialProjectFilter={projectFilter}
            initialStatusFilter={statusFilter}
        />
    );
}
