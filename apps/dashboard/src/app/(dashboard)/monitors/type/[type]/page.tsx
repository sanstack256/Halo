import { getOrgMonitors } from "@/actions/monitor";
import { getProjects } from "@/actions/project";
import { getSession } from "@/lib/session";
import { MonitorsClient } from "@/components/monitors/monitors-client";
import { notFound } from "next/navigation";
import type { MonitorType, MonitorStatus } from "@/generated/prisma/client";

interface MonitorTypePageProps {
    params: Promise<{
        type: string;
    }>;
    searchParams: Promise<{
        projectId?: string;
        status?: string;
        search?: string;
    }>;
}

const TYPE_MAP: Record<string, MonitorType> = {
    error: "ERROR",
    metric: "METRIC",
    cron: "CRON",
    uptime: "UPTIME",
    "mobile-build": "MOBILE_BUILD",
    mobile_build: "MOBILE_BUILD",
    ERROR: "ERROR",
    METRIC: "METRIC",
    CRON: "CRON",
    UPTIME: "UPTIME",
    MOBILE_BUILD: "MOBILE_BUILD",
};

export default async function MonitorTypePage({ params, searchParams }: MonitorTypePageProps) {
    const { type } = await params;
    const monitorType = TYPE_MAP[type];

    if (!monitorType) {
        notFound();
    }

    const queryParams = await searchParams;
    const session = await getSession();

    const [{ monitors, totalCount, counts }, rawProjects] = await Promise.all([
        getOrgMonitors({
            projectId: queryParams.projectId,
            type: monitorType,
            status: queryParams.status as MonitorStatus | undefined,
            search: queryParams.search,
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
            initialTypeFilter={monitorType}
            initialStatusFilter={queryParams.status}
            initialProjectFilter={queryParams.projectId}
            currentUserId={session?.user?.id}
        />
    );
}
