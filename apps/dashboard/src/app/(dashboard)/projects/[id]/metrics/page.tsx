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
    const metrics = await getProjectMetricsIntelligence(id, {
      timeRange,
      environment: search.env,
      service: search.service,
      release: search.release,
      from: search.from,
      to: search.to,
    });

    return <ProjectMetricsDashboard metrics={metrics} />;
  } catch (error: any) {
    if (error?.message?.includes("Unauthorized") || error?.message?.includes("not found")) {
      notFound();
    }
    throw error;
  }
}
