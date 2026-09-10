import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { RelativeTime } from "@/components/ui/relative-time";
import {
    ArrowRight,
    CheckCircle2,
    Compass,
    GitBranch,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
} from "lucide-react";

export default async function OverviewPage() {
    const data = await getOverviewData();

    const hasProjects = data.projects.length > 0;
    const attentionItems = data.attentionItems || [];
    const hasAttentionItems = attentionItems.length > 0;
    const { observedState, serviceHealthSummary } = data;

    return (
        <div className="max-w-[1360px] mx-auto pb-24 space-y-12">
            {/* 1. PAGE HEADER — AUTHORITATIVE ORIENTATION */}
            <header className="pt-2 pb-6 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-text-muted uppercase">
                            System Overview
                        </div>
                        <h1 className="text-3xl font-bold text-text tracking-tight">
                            Overview
                        </h1>
                        <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
                            System orientation and attention — what deserves your attention right now and where to investigate.
                        </p>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-3">
                        <Link
                            href="/investigate"
                            className="halo-btn halo-btn-primary"
                        >
                            <Compass size={15} />
                            <span>New Investigation</span>
                        </Link>
                    </div>
                </div>
            </header>

            {!hasProjects ? (
                <div className="halo-empty-state">
                    <Sparkles className="halo-empty-state-icon text-accent" />
                    <h2 className="halo-empty-state-title">No projects initialized</h2>
                    <p className="halo-empty-state-description">
                        Create a project and install the Halo SDK to enable real-time telemetry streaming and automated causal investigation.
                    </p>
                    <Link href="/projects" className="halo-btn halo-btn-primary">
                        Configure Project & SDK
                    </Link>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* 2. NEEDS ATTENTION — THE CANONICAL ATTENTION LAYER */}
                    <section aria-labelledby="needs-attention-heading" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        hasAttentionItems
                                            ? data.attentionSummary.fatalCount > 0
                                                ? "bg-danger shadow-[0_0_8px_rgba(255,92,103,0.5)]"
                                                : "bg-warning"
                                            : "bg-success"
                                    }`}
                                />
                                <h2
                                    id="needs-attention-heading"
                                    className="text-lg font-semibold text-text tracking-tight"
                                >
                                    Needs Attention
                                </h2>
                            </div>

                            {hasAttentionItems && (
                                <Link
                                    href="/issues?status=OPEN"
                                    className="text-xs font-medium text-text-secondary hover:text-text transition-colors flex items-center gap-1 group"
                                >
                                    <span>View all active issues</span>
                                    <span className="text-text-muted group-hover:text-text-secondary transition-colors">&rarr;</span>
                                </Link>
                            )}
                        </div>

                        {hasAttentionItems ? (
                            <div className="space-y-3">
                                {attentionItems.map((item) => {
                                    const isFatal = item.severity === "FATAL";
                                    const isError = item.severity === "ERROR";
                                    const isWarning = item.severity === "WARNING";

                                    const badgeClasses = isFatal
                                        ? "bg-danger/10 text-danger border-danger/25"
                                        : isError
                                        ? "bg-danger/10 text-danger border-danger/20"
                                        : isWarning
                                        ? "bg-warning/10 text-warning border-warning/20"
                                        : "bg-accent/10 text-accent border-accent/20";

                                    const ctaLabel =
                                        item.type === "ISSUE"
                                            ? "Triage Issue"
                                            : item.type === "CHANGE"
                                            ? "Inspect Change"
                                            : item.type === "INVESTIGATION"
                                            ? "View Report"
                                            : "Configure SDK";

                                    return (
                                        <div
                                            key={item.id}
                                            className="p-5 sm:p-6 rounded-xl border border-border bg-surface hover:border-border-strong transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                                        >
                                            <div className="space-y-2 min-w-0 flex-1">
                                                {/* Metadata row */}
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${badgeClasses}`}>
                                                        {item.severity}
                                                    </span>

                                                    <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                                                        {item.type.replace("_", " ")}
                                                    </span>

                                                    <span className="text-text-muted">•</span>

                                                    <span className="font-mono text-xs text-text-secondary bg-surface-elevated px-2 py-0.5 rounded border border-border-subtle">
                                                        {item.source}
                                                    </span>

                                                    <span className="text-text-muted">•</span>

                                                    <span className="text-xs font-mono text-text-muted">
                                                        <RelativeTime date={item.timestamp} />
                                                    </span>
                                                </div>

                                                {/* Item Title */}
                                                <h3 className="text-base sm:text-lg font-bold text-text tracking-tight leading-snug">
                                                    {item.title}
                                                </h3>

                                                {/* Summary / Evidence context */}
                                                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-3xl">
                                                    {item.summary}
                                                </p>
                                            </div>

                                            {/* Canonical action link */}
                                            <div className="flex-shrink-0 flex items-center">
                                                <Link
                                                    href={item.destination}
                                                    className="halo-btn halo-btn-primary px-4 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5"
                                                >
                                                    <span>{ctaLabel}</span>
                                                    <ArrowRight size={14} />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border border-border bg-surface flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <CheckCircle2 className="text-success flex-shrink-0" size={20} />
                                    <div>
                                        <h3 className="text-sm font-semibold text-text">No active items requiring attention</h3>
                                        <p className="text-xs text-text-secondary mt-0.5">
                                            All monitored systems are currently operating within observed parameters.
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-success bg-success/10 px-2.5 py-1 rounded border border-success/20 font-medium">
                                    Operational
                                </span>
                            </div>
                        )}
                    </section>

                    {/* 3. SYSTEM ORIENTATION — OBSERVED SYSTEM SNAPSHOT */}
                    <section aria-labelledby="system-orientation-heading" className="pt-6 border-t border-border space-y-4">
                        <div>
                            <h2
                                id="system-orientation-heading"
                                className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-wider"
                            >
                                Observed System State
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                            {/* Active Issues */}
                            <Link
                                href="/issues?status=OPEN"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                                    <span className="font-mono uppercase tracking-wider text-[10px]">Active Issues</span>
                                    <ShieldAlert size={14} className="text-text-muted group-hover:text-text transition-colors" />
                                </div>
                                <div className="text-2xl font-bold text-text">
                                    {observedState.activeIssuesCount}
                                </div>
                                <div className="text-[11px] text-text-muted mt-1 truncate">
                                    {observedState.activeIssuesCount === 0 ? "No unresolved issues" : "Requiring triage"}
                                </div>
                            </Link>

                            {/* Monitored Services */}
                            <Link
                                href="/services"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                                    <span className="font-mono uppercase tracking-wider text-[10px]">Services</span>
                                    <Server size={14} className="text-text-muted group-hover:text-text transition-colors" />
                                </div>
                                <div className="text-2xl font-bold text-text">
                                    {observedState.observedServicesCount}
                                </div>
                                <div className="text-[11px] text-text-muted mt-1 truncate">
                                    {serviceHealthSummary.critical > 0 ? (
                                        <span className="text-danger font-medium">{serviceHealthSummary.critical} critical</span>
                                    ) : serviceHealthSummary.degraded > 0 ? (
                                        <span className="text-warning font-medium">{serviceHealthSummary.degraded} degraded</span>
                                    ) : (
                                        <span>{serviceHealthSummary.healthy} healthy</span>
                                    )}
                                </div>
                            </Link>

                            {/* Observed Deployments */}
                            <Link
                                href="/dashboards/changes"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                                    <span className="font-mono uppercase tracking-wider text-[10px]">Deployments</span>
                                    <GitBranch size={14} className="text-text-muted group-hover:text-text transition-colors" />
                                </div>
                                <div className="text-2xl font-bold text-text">
                                    {observedState.recentDeploymentsCount}
                                </div>
                                <div className="text-[11px] text-text-muted mt-1 truncate">
                                    {observedState.recentDeploymentsCount === 0 ? "No recent releases" : "Observed releases"}
                                </div>
                            </Link>

                            {/* Telemetry Status */}
                            <Link
                                href="/explore/errors"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
                                    <span className="font-mono uppercase tracking-wider text-[10px]">Telemetry</span>
                                    <Radio size={14} className="text-text-muted group-hover:text-text transition-colors" />
                                </div>
                                <div className="text-2xl font-bold text-text">
                                    {observedState.recentErrorEvents !== null ? observedState.recentErrorEvents : "—"}
                                </div>
                                <div className="text-[11px] text-text-muted mt-1 truncate">
                                    {observedState.recentErrorEvents !== null ? "24h error events" : "No telemetry observed"}
                                </div>
                            </Link>
                        </div>
                    </section>

                    {/* 4. CANONICAL PRODUCT WORKSPACES — CLEAR OWNERSHIP & ROUTING */}
                    <section aria-labelledby="workspaces-heading" className="pt-6 border-t border-border space-y-4">
                        <div>
                            <h2
                                id="workspaces-heading"
                                className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-wider"
                            >
                                Canonical Workspaces
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Link
                                href="/issues"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                                        Issue Triage
                                    </span>
                                    <ArrowRight size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Manage issue identities, grouping fingerprints, regressions, and impact assessments.
                                </p>
                            </Link>

                            <Link
                                href="/investigate"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                                        Autonomous Investigation
                                    </span>
                                    <ArrowRight size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Execute hypothesis trees, root cause verification, and causal evidence graphs.
                                </p>
                            </Link>

                            <Link
                                href="/dashboards/changes"
                                className="p-4 rounded-xl border border-border bg-surface hover:border-border-strong transition-colors group block"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                                        Change Intelligence
                                    </span>
                                    <ArrowRight size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Correlate releases, deployment versions, commit diffs, and unexpected error spikes.
                                </p>
                            </Link>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}