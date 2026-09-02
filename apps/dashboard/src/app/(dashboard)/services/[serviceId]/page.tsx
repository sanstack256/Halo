import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getServiceDetail } from "@/actions/services";
import { ServiceDetailClient } from "@/components/services/service-detail-client";

export default async function ServiceDetailPage(props: {
    params: Promise<{ serviceId: string }>;
    searchParams: Promise<{
        timeRange?: string;
        timeRangeKey?: string;
        environment?: string;
    }>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const timeRangeKey = searchParams.timeRange || searchParams.timeRangeKey || "30d";

    const data = await getServiceDetail(params.serviceId, {
        timeRangeKey,
        environment: searchParams.environment,
    });

    if (!data) {
        notFound();
    }

    return (
        <Suspense fallback={<div className="p-12 text-center text-xs font-mono text-zinc-500">Loading service detail...</div>}>
            <ServiceDetailClient
                service={data.service}
                upstreamDependencies={data.upstreamDependencies}
                downstreamDependencies={data.downstreamDependencies}
                recentReleases={data.recentReleases}
                recentIssues={data.recentIssues}
            />
        </Suspense>
    );
}
