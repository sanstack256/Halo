import { getTraceDivergenceData } from "@/actions/explore";
import { TraceDivergenceClient } from "@/components/explore/trace-divergence-client";

interface PageProps {
    searchParams: Promise<{
        traceId?: string;
        referenceTraceId?: string;
        refTraceId?: string;
        projectId?: string;
    }>;
}

export default async function ExploreTracesPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const refId = params.referenceTraceId || params.refTraceId;

    const { divergence, recentTraces } = await getTraceDivergenceData(
        params.traceId,
        refId,
        { projectId: params.projectId }
    );

    return (
        <TraceDivergenceClient
            divergence={divergence}
            recentTraces={recentTraces}
            currentTraceId={params.traceId}
            currentReferenceId={refId}
        />
    );
}
