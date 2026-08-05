import { notFound } from "next/navigation";
import { getProject } from "@/actions/project";
import ProjectOverview from "@/components/projects/project-overview";
import ProjectHeader from "@/components/projects/project-header";
import ProjectQuickStart from "@/components/projects/project-quick-start";
import CreateApiKeyDialog from "@/components/projects/create-api-key-dialog";
import { getApiKeys } from "@/actions/api-key";
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
    const apiKeys = await getApiKeys(project.id);

    return (
        <>
            <ProjectOverview />

            <ProjectQuickStart
                hasApiKey={apiKeys.length > 0}
                hasEvents={project.events.length > 0}
            />

            <ApiKeysSection
                projectId={project.id}
                apiKeys={apiKeys}
            />

        </>
    );
}