import { getLogThreadsData, getExploreContextOptions } from "@/actions/explore";
import { LogThreaderClient } from "@/components/explore/log-threader-client";

interface PageProps {
    searchParams: Promise<{
        projectId?: string;
        environment?: string;
        service?: string;
        release?: string;
        timeRange?: string;
        search?: string;
    }>;
}

export default async function ExploreLogsPage({ searchParams }: PageProps) {
    const params = await searchParams;

    const [{ threads, unthreadedCount }, contextOptions] = await Promise.all([
        getLogThreadsData({
            projectId: params.projectId,
            environment: params.environment,
            service: params.service,
            release: params.release,
            timeRange: params.timeRange || "24h",
            search: params.search,
        }),
        getExploreContextOptions(),
    ]);

    return (
        <LogThreaderClient
            threads={threads}
            unthreadedCount={unthreadedCount}
            contextOptions={contextOptions}
        />
    );
}
