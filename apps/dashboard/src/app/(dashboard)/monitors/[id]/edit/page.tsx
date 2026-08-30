import { getMonitorById } from "@/actions/monitor";
import { getProjects } from "@/actions/project";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { notFound } from "next/navigation";

interface EditMonitorPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditMonitorPage({ params }: EditMonitorPageProps) {
    const { id } = await params;
    const [monitor, rawProjects] = await Promise.all([
        getMonitorById(id),
        getProjects(),
    ]);

    if (!monitor) {
        notFound();
    }

    const projects = rawProjects.map((p) => ({
        id: p.id,
        name: p.name,
    }));

    return (
        <div className="pb-16">
            <MonitorForm projects={projects} initialData={monitor} />
        </div>
    );
}
