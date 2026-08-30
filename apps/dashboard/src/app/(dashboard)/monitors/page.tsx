import { getOrgMonitors } from "@/actions/monitor";
import { getProjects } from "@/actions/project";
import { getSession } from "@/lib/session";
import { MonitorsClient } from "@/components/monitors/monitors-client";
import type { MonitorType, MonitorStatus } from "@/generated/prisma/client";

interface MonitorsPageProps {
    searchParams: Promise<{
        projectId?: string;
        type?: string;
        status?: string;
        filter?: string;
        search?: string;
    }>;
}

export default async function MonitorsPage({ searchParams }: MonitorsPageProps) {
    const params = await searchParams;
    const session = await getSession();

    const isMine = params.filter === "mine";
    const typeFilter = params.type as MonitorType | undefined;
    const statusFilter = params.status as MonitorStatus | undefined;

    const [{ monitors, totalCount, counts }, rawProjects] = await Promise.all([
        getOrgMonitors({
            projectId: params.projectId,
            type: typeFilter,
            status: statusFilter,
            search: params.search,
            creatorId: isMine && session?.user?.id ? session.user.id : undefined,
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
            initialMonitors={monitors}
            projects={projects}
            totalCount={totalCount}
            initialCounts={counts}
            initialTypeFilter={params.type}
            initialStatusFilter={params.status}
            initialProjectFilter={params.projectId}
            initialMineFilter={isMine}
            currentUserId={session?.user?.id}
        />
    );
}
