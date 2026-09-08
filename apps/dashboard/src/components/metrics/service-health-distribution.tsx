"use client";

import { Server, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import type { ServiceHealthDistribution } from "@/lib/metrics/types";

interface ServiceHealthDistributionProps {
  data: ServiceHealthDistribution;
  selectedService?: string;
  onSelectService: (serviceName: string) => void;
}

export function ServiceHealthDistributionView({
  data,
  selectedService,
  onSelectService,
}: ServiceHealthDistributionProps) {
  const { services, hasTelemetry } = data;

  if (!hasTelemetry || services.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Server className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No Services Detected</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Telemetry has not yet recorded distinct service namespaces in this window.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Service Health & Impact Distribution
            </h3>
            <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {services.length} services ranked
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked by observed failure impact (errors observed, failure rate, tail latency)
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/20 border border-border/40 rounded-md px-2.5 py-1">
          <HelpCircle className="h-3 w-3" />
          <span>Ranking Formula: (Errors × 3) + (P95 &gt; 1s ? 5 : 0) + (Fail Rate &gt; 5% ? 10 : 0)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const isSelected = selectedService === svc.serviceName;
          const hasErrors = svc.errorCount > 0;

          return (
            <div
              key={svc.serviceName}
              onClick={() => onSelectService(isSelected ? "ALL" : svc.serviceName)}
              className={`group relative flex flex-col justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                  : "border-border bg-background/50 hover:border-border/80 hover:bg-secondary/15"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground truncate max-w-[160px]">
                      {svc.serviceName}
                    </span>
                  </div>
                  {hasErrors ? (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                      Impact Rank #{svc.impactRank}
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Operational
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-snug">
                  {svc.impactScoreReason}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center text-xs font-mono">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Requests</div>
                  <div className="font-medium text-foreground">{svc.requestVolume.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Error Rate</div>
                  <div className={`font-medium ${hasErrors ? "text-rose-400" : "text-emerald-400"}`}>
                    {svc.errorRate !== null ? `${svc.errorRate}%` : "0%"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">P95 Tail</div>
                  <div className="font-medium text-foreground">
                    {svc.p95LatencyMs !== null ? `${svc.p95LatencyMs}ms` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-primary group-hover:underline pt-1">
                <span>{isSelected ? "Clear service filter" : "Filter metrics by service"}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
