import { getOrgMonitors } from "@/actions/monitor";
import { getProjects } from "@/actions/project";
import { getSession } from "@/lib/session";
import { MonitorsClient } from "@/components/monitors/monitors-client";
import type { MonitorType, MonitorStatus } from "@/generated/prisma/client";

interface MyMonitorsPageProps {
    searchParams: Promise<{
        projectId?: string;
        type?: string;
        status?: string;
        search?: string;
    }>;
}

export default async function MyMonitorsPage({ searchParams }: MyMonitorsPageProps) {
    const params = await searchParams;
    const session = await getSession();

    const typeFilter = params.type as MonitorType | undefined;
    const statusFilter = params.status as MonitorStatus | undefined;

    const [{ monitors, totalCount, counts }, rawProjects] = await Promise.all([
        getOrgMonitors({
            projectId: params.projectId,
            type: typeFilter,
            status: statusFilter,
            search: params.search,
            creatorId: session?.user?.id || undefined,
            pageSize: 100,
        }),
        getProjects(),
    ]);

    const projects = rawProjects.map((p) => ({
        id: p.id,
        name: p.name,
    }));

    return (
        <MonitorsClient
            title="My Monitors"
            description="Monitors created and managed by you across your workspace projects."
            isMineView={true}
            initialMonitors={monitors}
            projects={projects}
            totalCount={totalCount}
            initialCounts={counts}
            initialTypeFilter={params.type}
            initialStatusFilter={params.status}
            initialProjectFilter={params.projectId}
            initialMineFilter={true}
            currentUserId={session?.user?.id}
        />
    );
}
