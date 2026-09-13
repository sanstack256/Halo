import { notFound } from "next/navigation";
import { getProject } from "@/actions/project";
import { getProjectSdkStatus } from "@/actions/project-sdk";
import { SdkClientView } from "./sdk-client-view";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectSdkPage({ params }: Props) {
    const { id } = await params;

    let project;
    try {
        project = await getProject(id);
    } catch {
        notFound();
    }

    if (!project) {
        notFound();
    }

    const initialStatus = await getProjectSdkStatus(project.id).catch(() => ({
        hasApiKey: false,
        apiKeys: [],
        hasTelemetry: false,
        latestEvent: null,
        hasReplay: false,
        latestReplay: null,
        totalEvents: 0,
        totalReplays: 0,
    }));

    return (
        <SdkClientView
            project={{
                id: project.id,
                name: project.name,
                slug: project.slug,
                description: project.description,
            }}
            initialStatus={initialStatus}
        />
    );
}