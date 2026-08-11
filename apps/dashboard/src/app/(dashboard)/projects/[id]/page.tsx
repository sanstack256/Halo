import { notFound } from "next/navigation";

import { getProject } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";
import { getIssues } from "@/actions/issue";

import ProjectOverview from "@/components/projects/project-overview";
import ProjectQuickStart from "@/components/projects/project-quick-start";
import ApiKeysSection from "@/components/projects/api-keys-section";

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

    const [apiKeys, issues] = await Promise.all([
        getApiKeys(project.id),
        getIssues(project.id),
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

    return (
        <div className="space-y-10">

            <ProjectOverview
                projectId={project.id}
                eventCount={events.length}
                issueCount={issues.length}
                lastEvent={lastEvent}
                hasApiKey={apiKeys.length > 0}
                recentEvents={recentEvents}
            />

            <ProjectQuickStart
    projectId={project.id}
    hasApiKey={apiKeys.length > 0}
    hasEvents={events.length > 0}
/>

            <ApiKeysSection
                projectId={project.id}
                apiKeys={apiKeys}
            />

        </div>
    );
}