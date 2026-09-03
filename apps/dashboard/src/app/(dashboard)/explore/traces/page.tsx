import { getTraceDivergenceData } from "@/actions/explore";
import { TraceDivergenceClient } from "@/components/explore/trace-divergence-client";

interface PageProps {
    searchParams: Promise<{
        traceId?: string;
        referenceTraceId?: string;
        projectId?: string;
    }>;
}

export default async function ExploreTracesPage({ searchParams }: PageProps) {
    const params = await searchParams;

    const { divergence, recentTraces } = await getTraceDivergenceData(
        params.traceId,
        params.referenceTraceId,
        { projectId: params.projectId }
    );

    return (
        <TraceDivergenceClient
            divergence={divergence}
            recentTraces={recentTraces}
            currentTraceId={params.traceId}
            currentReferenceId={params.referenceTraceId}
        />
    );
}
