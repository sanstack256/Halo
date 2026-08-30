import React from "react";
import Link from "next/link";
import {
    AlertOctagon,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    FolderKanban,
    GitCommit,
    Layers,
    Package,
    ShieldAlert,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime } from "@/lib/date-format";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorRelatedItemsProps {
    data: MonitorFullDetails;
}

export function MonitorRelatedItems({ data }: MonitorRelatedItemsProps) {
    const { monitor, relatedIssues, relatedReleases } = data;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Related Issues Section */}
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertOctagon size={14} className="text-[var(--accent)]" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                            Related Project Issues
                        </h3>
                    </div>
                    <Link
                        href={`/projects/${monitor.projectId}`}
                        className="text-xs text-[var(--accent)] hover:underline font-mono"
                    >
                        Project issues &rarr;
                    </Link>
                </div>

                {relatedIssues.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-xl">
                        <CheckCircle2 size={20} className="text-zinc-500 mb-1.5" />
                        <p className="text-xs text-white font-medium">No related issues</p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-xs">
                            No issues matching this monitor's project or query expression.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border)]/60 border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
                        {relatedIssues.map((issue) => (
                            <Link
                                key={issue.id}
                                href={`/issues/${issue.id}`}
                                className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--surface-interactive)] transition-colors group"
                            >
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`halo-severity halo-severity-${issue.severity.toLowerCase()}`}>
                                            {issue.severity}
                                        </span>
                                        <span className="text-xs text-white font-medium group-hover:text-[var(--accent)] transition-colors truncate font-sans">
                                            {issue.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
                                        <span>{issue.eventCount} occurrences</span>
                                        <span>&bull;</span>
                                        <span>
                                            Last seen <RelativeTime date={issue.lastSeen} />
                                        </span>
                                    </div>
                                </div>
                                <ArrowUpRight
                                    size={13}
                                    className="text-[var(--text-muted)] group-hover:text-white shrink-0 transition-colors"
                                />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Related Releases / Deployments Section */}
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package size={14} className="text-purple-400" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                            Recent Releases &amp; Builds
                        </h3>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {relatedReleases.length} active versions
                    </span>
                </div>

                {relatedReleases.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-xl">
                        <Layers size={20} className="text-zinc-500 mb-1.5" />
                        <p className="text-xs text-white font-medium">No releases recorded</p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-xs">
                            Releases tagged in this project will appear here for correlation.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border)]/60 border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
                        {relatedReleases.map((release) => (
                            <div
                                key={release.id}
                                className="p-3 flex items-center justify-between gap-3 text-xs font-mono"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <GitCommit size={12} className="text-purple-400" />
                                        <span className="text-white font-semibold">{release.version}</span>
                                    </div>
                                    <div className="text-[10px] text-[var(--text-muted)]">
                                        Last active <RelativeTime date={release.lastSeen} />
                                    </div>
                                </div>
                                <div className="text-right space-y-0.5">
                                    <div className="text-red-400 font-semibold">{release.errorCount} errors</div>
                                    <div className="text-[10px] text-[var(--text-muted)]">{release.eventCount} events</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
