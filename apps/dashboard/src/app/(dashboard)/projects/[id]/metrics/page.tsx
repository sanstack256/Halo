import { notFound } from "next/navigation";
import { getProjectMetricsIntelligence } from "@/lib/metrics/project-metrics-engine";
import { ProjectMetricsDashboard } from "@/components/metrics/project-metrics-dashboard";
import type { TimeRangePreset } from "@/lib/metrics/types";

interface MetricsPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    range?: string;
    env?: string;
    service?: string;
    release?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function ProjectMetricsPage({
  params,
  searchParams,
}: MetricsPageProps) {
  const { id } = await params;
  const search = await searchParams;

  const timeRange = (search.range as TimeRangePreset) || "24h";

  try {
    let metrics = await getProjectMetricsIntelligence(id, {
      timeRange,
      environment: search.env,
      service: search.service,
      release: search.release,
      from: search.from,
      to: search.to,
    });

    // If no explicit range was provided in URL and the default 24h window has zero events,
    // but the project contains historical events, automatically load 30d so the user
    // immediately sees the project's real telemetry
    if (
      !search.range &&
      metrics.healthSnapshot.totalEventsObserved === 0 &&
      metrics.totalHistoricalEvents > 0
    ) {
      metrics = await getProjectMetricsIntelligence(id, {
        timeRange: "30d",
        environment: search.env,
        service: search.service,
        release: search.release,
        from: search.from,
        to: search.to,
      });
    }

    return <ProjectMetricsDashboard metrics={metrics} />;
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err?.message?.includes("Unauthorized") || err?.message?.includes("not found")) {
      notFound();
    }
    throw error;
  }
}
