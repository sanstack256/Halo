import { Suspense } from "react";
import { getServiceHealthView } from "@/actions/services";
import { ServiceHealthClient } from "@/components/services/service-health-client";

export default async function ServiceHealthPage(props: {
    searchParams: Promise<{
        search?: string;
        health?: string;
        environment?: string;
        timeRange?: string;
        timeRangeKey?: string;
    }>;
}) {
    const searchParams = await props.searchParams;
    const timeRangeKey = searchParams.timeRange || searchParams.timeRangeKey || "24h";

    const data = await getServiceHealthView({
        search: searchParams.search,
        health: searchParams.health as any,
        environment: searchParams.environment,
        timeRangeKey,
    });

    const environments = Array.from(new Set(data.services.map((s) => s.environment))).filter(Boolean);

    return (
        <Suspense fallback={<div className="p-12 text-center text-xs font-mono text-zinc-500">Loading service health...</div>}>
            <ServiceHealthClient
                initialServices={data.services}
                summary={data.summary}
                timeRangeKey={data.timeRange.key}
                environments={environments}
            />
        </Suspense>
    );
}
