import { notFound } from "next/navigation";
import { getProject } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";
import ApiKeysSection from "@/components/projects/api-keys-section";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ApiKeysPage({ params }: Props) {
    const { id } = await params;

    const project = await getProject(id);

    if (!project) {
        notFound();
    }

    const apiKeys = await getApiKeys(project.id);

    return (
        <div className="space-y-6">
            <ApiKeysSection
                projectId={project.id}
                apiKeys={apiKeys}
            />
        </div>
    );
}