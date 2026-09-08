"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RefreshCw, FilterX, Globe, Server, Tag } from "lucide-react";
import type { ProjectMetricsIntelligence, TimeRangePreset } from "@/lib/metrics/types";

import { EmptyMetricsState } from "./empty-metrics-state";
import { ProjectHealthSnapshotView } from "./project-health-snapshot";
import { ErrorBehaviorView } from "./error-behavior-view";
import { RequestPerformanceView } from "./request-performance-view";
import { ServiceHealthDistributionView } from "./service-health-distribution";
import { ReleaseImpactView } from "./release-impact-view";
import { ErrorConcentrationView } from "./error-concentration-view";
import { UserImpactView } from "./user-impact-view";
import { TelemetryCoverageView } from "./telemetry-coverage-view";
import { TemporalAnomaliesView } from "./temporal-anomalies-view";
import { ProjectTrendsView } from "./project-trends-view";

interface ProjectMetricsDashboardProps {
  metrics: ProjectMetricsIntelligence;
}

const TIME_RANGES: { key: TimeRangePreset; label: string }[] = [
  { key: "1h", label: "1 Hour" },
  { key: "6h", label: "6 Hours" },
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

export function ProjectMetricsDashboard({ metrics }: ProjectMetricsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange = (searchParams.get("range") as TimeRangePreset) || metrics.filterApplied.timeRange || "24h";
  const currentEnv = searchParams.get("env") || metrics.filterApplied.environment || "ALL";
  const currentService = searchParams.get("service") || metrics.filterApplied.service || "ALL";
  const currentRelease = searchParams.get("release") || metrics.filterApplied.release || "ALL";

  function updateFilter(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleResetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  const hasActiveCustomFilters =
    currentEnv !== "ALL" || currentService !== "ALL" || currentRelease !== "ALL" || currentRange !== "24h";

  if (!metrics.hasTelemetry && metrics.healthSnapshot.totalEventsObserved === 0) {
    return <EmptyMetricsState projectId={metrics.projectId} />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Filter Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center rounded-lg border border-border bg-background p-1 text-xs">
            {TIME_RANGES.map((r) => {
              const isActive = currentRange === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => updateFilter({ range: r.key })}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Environment Filter Dropdown */}
          {metrics.availableEnvironments.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={currentEnv}
                onChange={(e) => updateFilter({ env: e.target.value })}
                className="bg-transparent text-foreground focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Environments</option>
                {metrics.availableEnvironments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Service Filter Dropdown */}
          {metrics.availableServices.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={currentService}
                onChange={(e) => updateFilter({ service: e.target.value })}
                className="bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="ALL">All Services</option>
                {metrics.availableServices.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Release Filter Dropdown */}
          {metrics.availableReleases.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={currentRelease}
                onChange={(e) => updateFilter({ release: e.target.value })}
                className="bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="ALL">All Releases</option>
                {metrics.availableReleases.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters Button */}
          {hasActiveCustomFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/30 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Refresh & status */}
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="text-[11px] text-muted-foreground animate-pulse">
              Recalculating...
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/20 transition-colors disabled:opacity-50"
            title="Refresh Metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* A. Project Health Snapshot */}
      <ProjectHealthSnapshotView
        snapshot={metrics.healthSnapshot}
        timeRangeLabel={currentRange}
      />

      {/* B. Error Behavior */}
      <ErrorBehaviorView
        projectId={metrics.projectId}
        data={metrics.errorBehavior}
      />

      {/* C. Request Performance */}
      <RequestPerformanceView
        data={metrics.requestPerformance}
      />

      {/* D. Service Health Distribution */}
      <ServiceHealthDistributionView
        data={metrics.serviceDistribution}
        selectedService={currentService}
        onSelectService={(svc) => updateFilter({ service: svc })}
      />

      {/* E. Release / Change Impact */}
      <ReleaseImpactView
        data={metrics.releaseImpact}
        selectedRelease={currentRelease}
        onSelectRelease={(rel) => updateFilter({ release: rel })}
      />

      {/* F. Error Concentration */}
      <ErrorConcentrationView
        data={metrics.errorConcentration}
      />

      {/* G. User Impact */}
      <UserImpactView
        data={metrics.userImpact}
      />

      {/* H. Telemetry Coverage / Evidence Quality */}
      <TelemetryCoverageView
        data={metrics.telemetryCoverage}
      />

      {/* I. Temporal Anomalies */}
      <TemporalAnomaliesView
        data={metrics.temporalAnomalies}
      />

      {/* J. Project Trends */}
      <ProjectTrendsView
        data={metrics.projectTrends}
      />
    </div>
  );
}
