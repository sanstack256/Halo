"use client";

import type { UserImpactData } from "@/lib/metrics/types";

interface UserImpactViewProps {
  data: UserImpactData;
}

export function UserImpactView({ data }: UserImpactViewProps) {
  const {
    affectedUsersCount,
    affectedSessionsCount,
    sessionsWithErrorsCount,
    percentageOfSessionsWithErrors,
    errorsPerAffectedUser,
    summarySentence,
  } = data;

  const metrics = [
    {
      label: "AFFECTED USERS",
      value: affectedUsersCount !== null ? affectedUsersCount.toLocaleString() : "—",
      subtext: "Distinct user identities",
    },
    {
      label: "AFFECTED SESSIONS",
      value: affectedSessionsCount !== null ? affectedSessionsCount.toLocaleString() : "—",
      subtext: "Sessions with errors",
    },
    {
      label: "SESSIONS WITH ERRORS",
      value: percentageOfSessionsWithErrors !== null ? `${percentageOfSessionsWithErrors}%` : "—",
      subtext:
        sessionsWithErrorsCount !== null
          ? `${sessionsWithErrorsCount} failed sessions`
          : "Session telemetry",
    },
    {
      label: "ERRORS / AFFECTED USER",
      value: errorsPerAffectedUser !== null ? `${errorsPerAffectedUser}` : "—",
      subtext: "Mean errors per user",
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="border-b border-border/50 pb-2.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          USER IMPACT
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Failure impact on active users and sessions
        </p>
      </div>

      {/* Exactly 4 Compact Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
        {metrics.map((m, idx) => (
          <div key={m.label} className={idx > 0 ? "pt-3 lg:pt-0 lg:pl-4" : ""}>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {m.label}
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {m.value}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground/80">
              {m.subtext}
            </div>
          </div>
        ))}
      </div>

      {/* Factual Single Sentence with Provenance Denominator */}
      <div className="border-t border-border/40 pt-3 text-xs text-muted-foreground font-mono">
        {summarySentence}
      </div>
    </div>
  );
}
