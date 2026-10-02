import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { planHasCapability } from "@/lib/capabilities";
import { CrossServiceTopologyView } from "@/components/topology/cross-service-topology-view";
import { FailureHeatmapView } from "@/components/topology/failure-heatmap-view";

type Props = {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        timeRange?: string;
        env?: string;
        service?: string;
    }>;
};

export default async function ProjectTopologyPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    const { timeRange, env, service } = await searchParams;

    const project = await prisma.project.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            organization: {
                select: {
                    id: true,
                    plan: true,
                },
            },
        },
    });

    if (!project) {
        notFound();
    }

    const isTeamPlan = planHasCapability(
        (project.organization?.plan as any) || "FREE",
        "TEAM_CROSS_SERVICE_TOPOLOGY"
    );

    return (
        <div className="space-y-8">
            <Suspense fallback={<div className="p-12 text-center text-xs text-zinc-500 font-mono">Loading topology...</div>}>
                <CrossServiceTopologyView
                    projectId={id}
                    isTeamPlan={isTeamPlan}
                    initialTimeRangeKey={timeRange || "24h"}
                    environment={env || "ALL"}
                    highlightService={service}
                />
            </Suspense>

            <Suspense fallback={<div className="p-12 text-center text-xs text-zinc-500 font-mono">Loading failure heatmap...</div>}>
                <FailureHeatmapView
                    projectId={id}
                    isTeamPlan={isTeamPlan}
                    initialTimeRangeKey={timeRange || "24h"}
                    environment={env || "ALL"}
                />
            </Suspense>
        </div>
    );
}
