"use client";

import { Smartphone, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { UserImpactData } from "@/lib/metrics/types";

interface UserImpactViewProps {
  data: UserImpactData;
}

export function UserImpactView({ data }: UserImpactViewProps) {
  const {
    affectedUsersCount,
    affectedSessionsCount,
    totalCapturedSessionsCount,
    percentageOfObservedSessionsWithErrors,
    errorOccurrencesPerAffectedUser,
    userTelemetryQuality,
    qualityMessage,
  } = data;

  const hasSessions = totalCapturedSessionsCount > 0;
  const hasUsers = affectedUsersCount > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            User Experience & Session Failure Impact
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Measured impact on real users and active sessions with explicit denominators
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/20 px-2.5 py-1 text-xs text-muted-foreground">
          {userTelemetryQuality === "identified_users_observed" ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Identified Users Resolved</span>
            </>
          ) : userTelemetryQuality === "anonymous_sessions_only" ? (
            <>
              <Smartphone className="h-3.5 w-3.5 text-blue-400" />
              <span>Anonymous Sessions Only</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              <span>Identity Not Captured</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Affected Users */}
        <div className="rounded-lg border border-border/60 bg-background/50 p-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Affected Users
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-foreground">
            {hasUsers ? affectedUsersCount.toLocaleString() : "—"}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {hasUsers
              ? "Distinct authenticated user keys affected"
              : "User impact unavailable from captured telemetry."}
          </div>
        </div>

        {/* Card 2: Affected Sessions */}
        <div className="rounded-lg border border-border/60 bg-background/50 p-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Affected Sessions
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-foreground">
            {hasSessions ? affectedSessionsCount.toLocaleString() : "—"}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {hasSessions
              ? `Out of ${totalCapturedSessionsCount} total observed sessions`
              : "No telemetry sessions tracked in window"}
          </div>
        </div>

        {/* Card 3: Session Error Rate */}
        <div className="rounded-lg border border-border/60 bg-background/50 p-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sessions with Errors
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-foreground">
            {percentageOfObservedSessionsWithErrors !== null
              ? `${percentageOfObservedSessionsWithErrors}%`
              : "—"}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {percentageOfObservedSessionsWithErrors !== null
              ? `${affectedSessionsCount} affected / ${totalCapturedSessionsCount} sessions`
              : "Denominator undefined (0 sessions recorded)"}
          </div>
        </div>

        {/* Card 4: Error Frequency per User */}
        <div className="rounded-lg border border-border/60 bg-background/50 p-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Errors per Affected User
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-foreground">
            {errorOccurrencesPerAffectedUser !== null
              ? `${errorOccurrencesPerAffectedUser}`
              : "—"}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {errorOccurrencesPerAffectedUser !== null
              ? "Mean error events experienced per impacted user"
              : "Requires identified user telemetry"}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-secondary/10 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Data Provenance: </span>
        {qualityMessage}
      </div>
    </div>
  );
}
