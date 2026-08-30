import { notFound } from "next/navigation";

import { getProject } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";
import { getIssues } from "@/actions/issue";
import { getProjectMetrics } from "@/actions/project-metrics";

import ProjectOverview from "@/components/projects/project-overview";
import ProjectQuickStart from "@/components/projects/project-quick-start";
import { getReleaseCount } from "@/actions/release";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectPage({
    params,
}: Props) {
    const { id } = await params;

    const project = await getProject(id);

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

    const sortedEvents = [...events].sort(
        (a, b) =>
            b.timestamp.getTime() -
            a.timestamp.getTime(),
    );

    const recentEvents = sortedEvents
        .slice(0, 5)
        .map((event) => ({
            id: event.id,
            title: event.title,
            type: event.type,
            severity: event.severity,
            timestamp: event.timestamp,
            message: event.message ?? null,
        }));

    const lastEvent =
        sortedEvents.length > 0
            ? sortedEvents[0].timestamp
            : null;

    const hasApiKey = apiKeys.length > 0;
    const hasEvents = events.length > 0;

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
                    eventCount={events.length}
                    issueCount={issues.length}
                    lastEvent={lastEvent}
                    hasApiKey={apiKeys.length > 0}
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