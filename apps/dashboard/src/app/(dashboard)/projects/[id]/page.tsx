import { notFound } from "next/navigation";

import { getProject } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";
import { getIssues } from "@/actions/issue";
import { getProjectMetrics } from "@/actions/project-metrics";
import { getReleaseCount } from "@/actions/release";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { prisma } from "@/lib/prisma";

import ProjectOverview from "@/components/projects/project-overview";
import ProjectQuickStart from "@/components/projects/project-quick-start";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectPage({
    params,
}: Props) {
    const { id } = await params;

    let targetId = id;
    if (id === "current" || id === "ALL") {
        const session = await getSession();
        if (session) {
            const org = await getOrganization(session.user.id);
            if (org) {
                const firstProj = await prisma.project.findFirst({
                    where: { organizationId: org.id },
                    orderBy: { createdAt: "asc" },
                });
                if (firstProj) targetId = firstProj.id;
            }
        }
    }

    const project = await getProject(targetId);

    if (!project) {
        notFound();
    }

    const [
        apiKeys,
        issues,
        metrics,
        releaseCount,
    ] = await Promise.all([
        getApiKeys(project.id),
        getIssues(project.id),
        getProjectMetrics(project.id),
        getReleaseCount(project.id),
    ]);

    const events = project.events ?? [];

    const sortedEvents = [...events].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    const recentEvents = sortedEvents
        .slice(0, 5)
        .map((event) => ({
            id: event.id,
            title: event.title,
            type: event.type,
            severity: event.severity,
            timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
            message: event.message ?? null,
        }));

    const lastEvent =
        sortedEvents.length > 0 && sortedEvents[0].timestamp
            ? new Date(sortedEvents[0].timestamp)
            : null;

    const eventCount = (project as any)._count?.events ?? events.length;
    const hasApiKey = apiKeys.length > 0;
    const hasEvents = eventCount > 0;

    return (
        <div className="space-y-8">
            {/* Main overview + Quick Start */}
            <div
                className="
                    grid
                    grid-cols-1
                    gap-6
                    lg:grid-cols-[minmax(0,1fr)_280px]
                    lg:items-start
                "
            >
                {/* Main content */}
                <ProjectOverview
                    projectId={project.id}
                    eventCount={eventCount}
                    issueCount={issues.length}
                    lastEvent={lastEvent}
                    hasApiKey={hasApiKey}
                    recentEvents={recentEvents}
                    metrics={metrics}
                    releaseCount={releaseCount}
                />

                {/* Secondary project setup */}
                <ProjectQuickStart
                    projectId={project.id}
                    hasApiKey={hasApiKey}
                    hasEvents={hasEvents}
                />
            </div>
        </div>
    );
}