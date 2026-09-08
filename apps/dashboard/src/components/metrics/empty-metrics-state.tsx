"use client";

import Link from "next/link";
import { Activity, KeyRound, Terminal, ArrowRight, ShieldAlert } from "lucide-react";

interface EmptyMetricsStateProps {
  projectId: string;
}

export function EmptyMetricsState({ projectId }: EmptyMetricsStateProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10 text-muted-foreground">
        <Activity className="h-7 w-7 text-primary/70" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          <ShieldAlert className="h-3.5 w-3.5" />
          No Telemetry Observed
        </div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight sm:text-2xl">
          No Telemetry Recorded Yet
        </h2>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground leading-relaxed">
          Halo has not captured any requests, errors, traces, or sessions for this project.
          Metrics will compute strictly from real telemetry once the Halo SDK or OpenTelemetry exporter sends events.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
        <Link
          href={`/projects/${projectId}/api-keys`}
          className="group flex flex-col justify-between rounded-lg border border-border bg-background/50 p-5 transition-colors hover:border-primary/50 hover:bg-secondary/20"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <KeyRound className="h-4 w-4" />
              <span className="text-sm font-semibold">1. Create an API Key</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate an ingestion token with proper environment binding to authorize your telemetry stream.
            </p>
          </div>
          <div className="mt-4 flex items-center text-xs font-medium text-primary group-hover:underline">
            Manage API Keys <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </Link>

        <div className="flex flex-col justify-between rounded-lg border border-border bg-background/50 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Terminal className="h-4 w-4" />
              <span className="text-sm font-semibold">2. Initialize SDK</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Install <code>@halo/node</code> or <code>@halo/browser</code> in your application:
            </p>
            <div className="rounded bg-black/40 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
              npm install @halo/node
            </div>
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground">
            Halo never fabricates placeholder data.
          </div>
        </div>
      </div>
    </div>
  );
}
