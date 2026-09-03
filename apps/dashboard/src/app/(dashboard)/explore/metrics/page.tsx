import { getMetricShapeTwinData } from "@/actions/explore";
import { MetricTwinClient } from "@/components/explore/metric-twin-client";
import type { MetricKey } from "@/lib/explore/metric-twin";

interface PageProps {
    searchParams: Promise<{
        metric?: string;
        timeRange?: string;
        projectId?: string;
    }>;
}

export default async function ExploreMetricsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const metric = (params.metric as MetricKey) || "errors";
    const timeRange = params.timeRange || "24h";

    const data = await getMetricShapeTwinData(metric, timeRange, {
        projectId: params.projectId,
    });

    return (
        <MetricTwinClient
            data={data}
            currentMetric={metric}
            currentTimeRange={timeRange}
        />
    );
}
