import { getProjects } from "@/actions/project";
import { MonitorForm } from "@/components/monitors/monitor-form";
import type { MonitorType } from "@/generated/prisma/client";

interface NewMonitorPageProps {
    searchParams: Promise<{
        projectId?: string;
        type?: string;
    }>;
}

export default async function NewMonitorPage({ searchParams }: NewMonitorPageProps) {
    const params = await searchParams;
    const rawProjects = await getProjects();

    const projects = rawProjects.map((p) => ({
        id: p.id,
        name: p.name,
    }));

    return (
        <div className="pb-16">
            <MonitorForm
                projects={projects}
                initialProjectId={params.projectId}
                initialType={params.type as MonitorType | undefined}
            />
        </div>
    );
}
