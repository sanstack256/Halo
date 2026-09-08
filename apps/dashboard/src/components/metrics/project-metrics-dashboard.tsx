"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RefreshCw, FilterX, Globe, Server, Tag, Calendar } from "lucide-react";
import type {
  RedesignedProjectMetricsIntelligence,
  TimeRangePreset,
} from "@/lib/metrics/types";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

import { PrimaryTelemetryOverview } from "./primary-telemetry-overview";
import { ObservedChangesView } from "./observed-changes-view";
import { FailureConcentrationView } from "./failure-concentration-view";
import { ServicePerformanceTable } from "./service-performance-table";
import { ReleaseBehaviorView } from "./release-behavior-view";
import { UserImpactView } from "./user-impact-view";
import { TelemetryCoverageMatrix } from "./telemetry-coverage-matrix";
import { ProjectTrendView } from "./project-trend-view";

interface ProjectMetricsDashboardProps {
  metrics: RedesignedProjectMetricsIntelligence;
}

const TIME_RANGE_OPTIONS: HaloSelectOption[] = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "custom", label: "Custom" },
];

export function ProjectMetricsDashboard({ metrics }: ProjectMetricsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange =
    (searchParams.get("range") as TimeRangePreset) ||
    metrics.filterApplied.timeRange ||
    "24h";
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
    currentEnv !== "ALL" ||
    currentService !== "ALL" ||
    currentRelease !== "ALL" ||
    currentRange !== "24h";

  const envOptions: HaloSelectOption[] = [
    { value: "ALL", label: "All Environments" },
    ...metrics.availableEnvironments.map((env) => ({
      value: env.id,
      label: env.name,
    })),
  ];

  const serviceOptions: HaloSelectOption[] = [
    { value: "ALL", label: "All Services" },
    ...metrics.availableServices.map((svc) => ({
      value: svc,
      label: svc,
    })),
  ];

  const releaseOptions: HaloSelectOption[] = [
    { value: "ALL", label: "All Releases" },
    ...metrics.availableReleases.map((rel) => ({
      value: rel,
      label: rel,
    })),
  ];

  // Truthful Empty State if project has literally zero telemetry ever recorded
  if (metrics.totalHistoricalEvents === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-6 space-y-6">
        {/* 1. Page Header */}
        <div className="flex h-14 items-center justify-between border-b border-border/50 pb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Metrics
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Quantitative telemetry for this project
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="halo-btn halo-btn-secondary halo-btn-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Clean Empty State */}
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            No telemetry observed
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            No project telemetry was captured for the selected interval. Send requests or instrument the Halo SDK to view operational telemetry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-6 space-y-5">
      {/* 1. Project Metrics Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/50 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-none">
            Metrics
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Quantitative telemetry for this project
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="halo-btn halo-btn-secondary halo-btn-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Global Filter Bar */}
      <div className="halo-filter-surface">
        <div className="halo-filter-group">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-muted shrink-0" />
            <HaloSelect
              value={currentRange}
              onChange={(val) => updateFilter({ range: val })}
              options={TIME_RANGE_OPTIONS}
              ariaLabel="Filter by time window"
            />
          </div>

          {/* Environment Filter */}
          {metrics.availableEnvironments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Globe size={13} className="text-muted shrink-0" />
              <HaloSelect
                value={currentEnv}
                onChange={(val) => updateFilter({ env: val })}
                options={envOptions}
                ariaLabel="Filter by environment"
              />
            </div>
          )}

          {/* Service Filter */}
          {metrics.availableServices.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Server size={13} className="text-muted shrink-0" />
              <HaloSelect
                value={currentService}
                onChange={(val) => updateFilter({ service: val })}
                options={serviceOptions}
                ariaLabel="Filter by service"
              />
            </div>
          )}

          {/* Release Filter */}
          {metrics.availableReleases.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag size={13} className="text-muted shrink-0" />
              <HaloSelect
                value={currentRelease}
                onChange={(val) => updateFilter({ release: val })}
                options={releaseOptions}
                ariaLabel="Filter by release"
              />
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveCustomFilters && (
            <>
              <div className="halo-filter-divider" />
              <button
                type="button"
                onClick={handleResetFilters}
                className="halo-filter-btn"
                title="Reset active filters"
              >
                <FilterX size={13} className="shrink-0" />
                <span>Reset</span>
              </button>
            </>
          )}
        </div>

        {isPending && (
          <span className="text-[11px] text-muted-foreground font-mono animate-pulse pr-2">
            Requerying telemetry...
          </span>
        )}
      </div>

      {/* 3. Primary Telemetry Overview (4 metrics + 300px switchable chart) */}
      <PrimaryTelemetryOverview
        overview={metrics.telemetryOverview}
        buckets={metrics.primaryChart.buckets}
        timeRangeLabel={metrics.timeWindow.label}
      />

      {/* 4. Observed Changes (Max 3 rows) */}
      <ObservedChangesView data={metrics.observedChanges} />

      {/* 5. Failure Concentration (Segmented control + ranked proportional bars) */}
      <FailureConcentrationView data={metrics.failureConcentration} />

      {/* 6. Service Performance (Dense table sorted by errors) */}
      <ServicePerformanceTable
        data={metrics.servicePerformance}
        onSelectService={(svc) => updateFilter({ service: svc })}
      />

      {/* 7. Release Behavior (Horizontal timeline + table) */}
      <ReleaseBehaviorView
        data={metrics.releaseBehavior}
        onSelectRelease={(rel) => updateFilter({ release: rel })}
      />

      {/* 8. User Impact (4 compact metrics + factual sentence) */}
      <UserImpactView data={metrics.userImpact} />

      {/* 9. Telemetry Coverage (Compact 2-column matrix) */}
      <TelemetryCoverageMatrix data={metrics.telemetryCoverage} />

      {/* 10. Long-Term Trend (3 rows: ERROR RATE, P95 LATENCY, REQUEST VOLUME) */}
      <ProjectTrendView data={metrics.longTermTrend} />
    </div>
  );
}
