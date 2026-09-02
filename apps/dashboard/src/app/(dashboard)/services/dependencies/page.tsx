import { Suspense } from "react";
import { getServiceDependenciesView } from "@/actions/services";
import { ServiceDependenciesClient } from "@/components/services/service-dependencies-client";

export default async function ServiceDependenciesPage(props: {
    searchParams: Promise<{
        environment?: string;
        timeRange?: string;
        timeRangeKey?: string;
        search?: string;
    }>;
}) {
    const searchParams = await props.searchParams;
    const timeRangeKey = searchParams.timeRange || searchParams.timeRangeKey || "30d"; // Default to 30d for dependency topology if unspecified

    const data = await getServiceDependenciesView({
        environment: searchParams.environment,
        timeRangeKey,
        search: searchParams.search,
    });

    const environments = Array.from(new Set(data.nodes.map((n) => n.environment))).filter(Boolean);

    return (
        <Suspense fallback={<div className="p-12 text-center text-xs font-mono text-zinc-500">Loading service dependencies...</div>}>
            <ServiceDependenciesClient
                initialNodes={data.nodes}
                initialEdges={data.edges}
                timeRangeKey={data.timeRange.key}
                environments={environments}
            />
        </Suspense>
    );
}
