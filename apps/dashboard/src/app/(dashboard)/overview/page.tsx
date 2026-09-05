import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { RelativeTime } from "@/components/ui/relative-time";
import {
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    Compass,
    FileText,
    GitBranch,
    HelpCircle,
    Layers,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
} from "lucide-react";

export default async function OverviewPage() {
    const data = await getOverviewData();

    const hasProjects = data.projects.length > 0;
    const hasActiveIncidents = data.activeIncidents.length > 0;
    const alert = data.needsAttention.primaryAlert;
    const secondaryIssues = data.activeIncidents.slice(1, 5);

    return (
        <div className="max-w-[1360px] mx-auto pb-24">
            {/* 1. PAGE HEADER — AUTHORITATIVE OPENING WITH DISCIPLINED RHYTHM */}
            <header className="pt-2 pb-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="font-mono text-[11px] font-semibold tracking-[0.1em] text-zinc-500 uppercase">
                            System Overview
                        </div>
                        <h1 className="text-3xl sm:text-[34px] font-bold text-white tracking-tight leading-tight">
                            Overview
                        </h1>
                        <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed pt-0.5">
                            Your system at a glance — what needs attention, what changed, and where to investigate.
                        </p>
                    </div>

                    <div className="flex-shrink-0">
                        <Link
                            href="/investigate"
                            className="halo-btn halo-btn-primary shadow-sm"
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
                        Install the SDK in your application to enable real-time telemetry streaming and automated root cause analysis.
                    </p>
                    <Link href="/projects" className="halo-btn halo-btn-primary">
                        Configure SDK & Project
                    </Link>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* 2. TIER 1 (PRIMARY): NEEDS ATTENTION — THE VISUAL ANCHOR */}
                    <section aria-labelledby="needs-attention-heading">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full ${hasActiveIncidents ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-emerald-500"}`} />
                                <h2 id="needs-attention-heading" className="text-lg font-semibold text-white tracking-tight">
                                    Needs attention
                                </h2>
                            </div>
                            {hasActiveIncidents && (
                                <Link
                                    href="/issues"
                                    className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group"
                                >
                                    <span>View all issues</span>
                                    <span className="text-zinc-600 group-hover:text-zinc-300 transition-colors">&rarr;</span>
                                </Link>
                            )}
                        </div>

                        {hasActiveIncidents && alert ? (
                            <div className="rounded-xl border border-white/[0.08] bg-[#0c1017] shadow-lg overflow-hidden">
                                {/* Dominant Hero Issue Block */}
                                <div className="p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="space-y-2.5 min-w-0 flex-1">
                                        {/* Metadata Row: Red Severity Badge + Service Attribution + Count */}
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                                {alert.severity}
                                            </span>

                                            {alert.service && (
                                                <span className="font-mono text-xs text-zinc-300 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                                                    {alert.service}
                                                </span>
                                            )}

                                            <span className="text-xs font-mono text-zinc-400">
                                                {data.needsAttention.openIssuesCount} active {data.needsAttention.openIssuesCount === 1 ? "issue" : "issues"}
                                            </span>
                                        </div>

                                        {/* Strongest Text: Hero Issue Title */}
                                        <h3 className="text-xl sm:text-[22px] font-bold text-white tracking-tight leading-snug">
                                            {alert.title}
                                        </h3>

                                        {/* Evidence / Occurrence Description */}
                                        <p className="text-xs sm:text-[13px] text-zinc-400 leading-relaxed max-w-3xl">
                                            {alert.occurrenceDescription} &bull; {alert.suspectedCause}
                                        </p>
                                    </div>

                                    {/* Action CTA: Dominant filled button */}
                                    <div className="flex-shrink-0 flex items-center">
                                        <Link
                                            href={`/projects/${alert.projectId}/investigations/new?issueId=${alert.issueId}`}
                                            className="halo-btn halo-btn-primary px-5 py-2.5 text-sm font-semibold shadow-md flex items-center gap-2"
                                        >
                                            <span>Investigate</span>
                                            <ArrowRight size={15} />
                                        </Link>
                                    </div>
                                </div>

                                {/* Secondary Issues: Subdued List (Not a heavy card inside card) */}
                                {secondaryIssues.length > 0 && (
                                    <div className="border-t border-white/[0.06] bg-black/20">
                                        <div className="divide-y divide-white/[0.04]">
                                            {secondaryIssues.map((issue) => (
                                                <div
                                                    key={issue.id}
                                                    className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 flex-shrink-0" />
                                                        <Link
                                                            href={`/projects/${issue.projectId}/issues/${issue.id}`}
                                                            className="text-xs sm:text-[13px] font-medium text-zinc-200 hover:text-white transition-colors truncate"
                                                        >
                                                            {issue.title}
                                                        </Link>
                                                        <span className="text-[11px] font-mono text-zinc-500 flex-shrink-0 hidden md:inline">
                                                            {issue.service || issue.projectName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-4 flex-shrink-0 text-xs text-zinc-400 justify-between sm:justify-end">
                                                        <span className="font-mono text-[11px] text-zinc-400">
                                                            {issue.eventCount} recorded
                                                        </span>
                                                        <span className="text-zinc-500 font-mono text-[11px]">
                                                            <RelativeTime date={issue.lastSeen} />
                                                        </span>
                                                        <Link
                                                            href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}`}
                                                            className="text-xs text-zinc-400 hover:text-accent transition-colors font-medium ml-1"
                                                        >
                                                            Investigate &rarr;
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border border-white/[0.08] bg-[#0c1017] flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={20} />
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">No active issues requiring attention</h3>
                                        <p className="text-xs text-zinc-400 mt-0.5">All monitored systems are currently operating within normal parameters.</p>
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-medium">
                                    Operational
                                </span>
                            </div>
                        )}
                    </section>

                    {/* 3. TIER 2 (IMPORTANT CONTEXT): RECENT CHANGES */}
                    <section aria-labelledby="recent-changes-heading">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <GitBranch size={16} className="text-zinc-400" />
                                <h2 id="recent-changes-heading" className="text-base font-semibold text-white tracking-tight">
                                    Recent changes
                                </h2>
                            </div>
                            <Link
                                href="/explore/errors"
                                className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group"
                            >
                                <span>View all changes</span>
                                <span className="text-zinc-600 group-hover:text-zinc-300 transition-colors">&rarr;</span>
                            </Link>
                        </div>

                        {data.recentChanges.length > 0 ? (
                            <div className="rounded-xl border border-white/[0.06] bg-[#0a0d13] overflow-hidden">
                                <div className="divide-y divide-white/[0.04]">
                                    {data.recentChanges.slice(0, 4).map((change) => {
                                        const isSuspicious = change.status === "suspicious";
                                        return (
                                            <div
                                                key={change.id}
                                                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="font-mono text-xs font-bold text-white px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
                                                        {change.version}
                                                    </span>
                                                    <span className="text-xs text-zinc-400 capitalize">
                                                        {change.type}
                                                    </span>
                                                    <span className="text-zinc-600">•</span>
                                                    <span className="font-mono text-xs text-zinc-400 truncate">
                                                        {change.projectName}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-4 text-xs">
                                                    {isSuspicious ? (
                                                        <span className="text-[11px] font-mono font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                            {change.correlatedErrors} correlated errors
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-mono font-medium text-zinc-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.06]">
                                                            Stable
                                                        </span>
                                                    )}

                                                    <span className="text-zinc-500 font-mono text-[11px] whitespace-nowrap">
                                                        <RelativeTime date={change.timestamp} />
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border border-white/[0.06] bg-[#0a0d13] text-center">
                                <p className="text-xs text-zinc-500">No observed release deployments in recorded history.</p>
                            </div>
                        )}
                    </section>

                    {/* 4. TIER 2 (IMPORTANT CONTEXT): HALO INTELLIGENCE */}
                    <section aria-labelledby="halo-intelligence-heading">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-accent" />
                                <h2 id="halo-intelligence-heading" className="text-base font-semibold text-white tracking-tight">
                                    Halo Intelligence
                                </h2>
                            </div>
                            <Link
                                href="/investigate"
                                className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group"
                            >
                                <span>View all investigations</span>
                                <span className="text-zinc-600 group-hover:text-zinc-300 transition-colors">&rarr;</span>
                            </Link>
                        </div>

                        {data.discoveries.length > 0 ? (
                            <div className="space-y-3">
                                {data.discoveries.map((disc) => {
                                    const hasValidRootCause = disc.suspectedRootCause !== null;
                                    return (
                                        <div
                                            key={disc.id}
                                            className="p-5 rounded-xl border border-white/[0.07] bg-[#0a0d14] hover:border-white/[0.12] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                                        >
                                            <div className="space-y-2 min-w-0 flex-1">
                                                {/* Compact qualitative confidence & context */}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                                                        Investigation
                                                    </span>
                                                    <span className="text-zinc-700">•</span>
                                                    <span className="text-xs font-mono text-zinc-400">
                                                        {disc.projectName}
                                                    </span>
                                                </div>

                                                {/* Investigation Title as Strongest Element */}
                                                <h3 className="text-base font-semibold text-white tracking-tight">
                                                    {disc.title}
                                                </h3>

                                                {/* What was observed */}
                                                <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
                                                    <strong className="text-zinc-300 font-normal">Observed: </strong>
                                                    {disc.summary}
                                                </p>

                                                {/* Evidence State & Verdict Metadata */}
                                                <div className="pt-1 flex items-center gap-2 text-xs flex-wrap">
                                                    {hasValidRootCause ? (
                                                        <>
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-accent/10 text-accent border border-accent/25">
                                                                {disc.confidence}
                                                            </span>
                                                            <span className="text-zinc-400">
                                                                Verdict: <span className="text-zinc-200 font-medium">{disc.suspectedRootCause}</span>
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-zinc-500 text-[11px] italic">
                                                            Insufficient evidence to validate a root cause.
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action entrypoint */}
                                            <div className="flex-shrink-0 flex items-center">
                                                <Link
                                                    href={disc.issueId
                                                        ? `/projects/${disc.projectId}/investigations/new?issueId=${disc.issueId}`
                                                        : `/projects/${disc.projectId}/investigations/new`}
                                                    className="halo-btn halo-btn-sm halo-btn-secondary"
                                                >
                                                    <span>Investigate</span>
                                                    <ArrowRight size={13} />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border border-white/[0.06] bg-[#0a0d14] text-center">
                                <p className="text-xs text-zinc-500">No autonomous investigations or discoveries completed yet.</p>
                            </div>
                        )}
                    </section>

                    {/* 5. TIER 3 (SUPPORTING CONTEXT): RECENT ACTIVITY — OPEN TIMELINE TREATMENT */}
                    <section aria-labelledby="recent-activity-heading">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={16} className="text-zinc-400" />
                            <h2 id="recent-activity-heading" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                                Recent activity
                            </h2>
                        </div>

                        {data.recentActivity.length > 0 ? (
                            <div className="divide-y divide-white/[0.04]">
                                {data.recentActivity.map((activity) => (
                                    <div
                                        key={activity.id}
                                        className="py-3 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {activity.type === "issue_opened" ? (
                                                <span className="text-red-400/80 font-mono text-xs flex-shrink-0">△</span>
                                            ) : activity.type === "deployment" ? (
                                                <span className="text-zinc-400 font-mono text-xs flex-shrink-0">⬡</span>
                                            ) : (
                                                <span className="text-accent font-mono text-xs flex-shrink-0">◉</span>
                                            )}

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={activity.link}
                                                        className="text-xs font-medium text-zinc-300 hover:text-white transition-colors truncate"
                                                    >
                                                        {activity.title}
                                                    </Link>
                                                </div>
                                                <p className="text-[11px] text-zinc-500 truncate">
                                                    {activity.subtitle}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-[11px] font-mono text-zinc-500 flex-shrink-0">
                                            <RelativeTime date={activity.timestamp} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-500 py-2">No observed recent system events.</p>
                        )}
                    </section>

                    {/* 6. TIER 4 (REFERENCE INFORMATION): SYSTEM STATE — DELIBERATELY QUIET */}
                    <section aria-labelledby="system-state-heading" className="pt-4 border-t border-white/[0.05]">
                        <div className="mb-3">
                            <h2 id="system-state-heading" className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
                                System State
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-2">
                            <div>
                                <div className="text-xl font-bold text-zinc-200 font-sans">
                                    {data.systemState.activeIssuesCount}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    Active issues
                                </div>
                            </div>

                            <div>
                                <div className="text-xl font-bold text-zinc-200 font-sans">
                                    {data.systemState.affectedServicesCount}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    Observed services
                                </div>
                            </div>

                            <div>
                                <div className="text-xl font-bold text-zinc-200 font-sans">
                                    {data.systemState.recentErrors24h !== null
                                        ? data.systemState.recentErrors24h
                                        : "—"}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    {data.systemState.recentErrors24h !== null ? "24h errors" : "No error telemetry"}
                                </div>
                            </div>

                            <div>
                                <div className="text-xl font-bold text-zinc-200 font-sans">
                                    {data.systemState.recentDeploymentsCount}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    Deployments
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}