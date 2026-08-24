"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Filter, Search, ShieldAlert } from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { updateIssueStatus } from "@/actions/issue";
import { useRouter } from "next/navigation";

export type OrgIssue = {
    id: string;
    title: string;
    status: "OPEN" | "RESOLVED" | "IGNORED";
    severity: string;
    eventCount: number;
    lastSeen: Date;
    projectId: string;
    projectName: string;
};

export function IssuesListClient({ issues }: { issues: OrgIssue[] }) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [projectFilter, setProjectFilter] = useState("ALL");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const projectNames = Array.from(new Set(issues.map((i) => i.projectName)));

    const filtered = issues.filter((i) => {
        if (search.trim() && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
        if (severityFilter !== "ALL" && i.severity !== severityFilter) return false;
        if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
        if (projectFilter !== "ALL" && i.projectName !== projectFilter) return false;
        return true;
    });

    async function toggleResolve(issueId: string, currentStatus: "OPEN" | "RESOLVED" | "IGNORED") {
        setUpdatingId(issueId);
        const newStatus = currentStatus === "RESOLVED" ? "OPEN" : "RESOLVED";
        try {
            await updateIssueStatus(issueId, newStatus);
            router.refresh();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingId(null);
        }
    }

    return (
        <div className="space-y-5">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search issues by title or error message..."
                        className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-border-strong bg-surface-elevated text-sm text-white placeholder:text-muted outline-none focus:border-accent transition-colors"
                    />
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Severity */}
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-border-strong bg-surface-elevated text-xs text-white outline-none focus:border-accent"
                    >
                        <option value="ALL">All Severities</option>
                        <option value="FATAL">Fatal</option>
                        <option value="ERROR">Error</option>
                        <option value="WARNING">Warning</option>
                        <option value="INFO">Info</option>
                    </select>

                    {/* Status */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-border-strong bg-surface-elevated text-xs text-white outline-none focus:border-accent"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="OPEN">Open</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="IGNORED">Ignored</option>
                    </select>

                    {/* Projects */}
                    {projectNames.length > 1 && (
                        <select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-border-strong bg-surface-elevated text-xs text-white outline-none focus:border-accent"
                        >
                            <option value="ALL">All Projects</option>
                            {projectNames.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="halo-empty-state">
                    <ShieldAlert className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">
                        {issues.length === 0 ? "No issues detected" : "No issues match your filters"}
                    </h3>
                    <p className="halo-empty-state-description">
                        {issues.length === 0
                            ? "Halo hasn't recorded any issues yet. Check your SDK installation."
                            : "Try clearing your search query or selecting 'All Severities'."}
                    </p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_130px_100px_100px_130px_180px]">
                        <div className="halo-table-col-label">Title</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Severity</div>
                        <div className="halo-table-col-label">Events</div>
                        <div className="halo-table-col-label">Last Seen</div>
                        <div className="halo-table-col-label">Actions</div>
                    </div>

                    {filtered.map((issue) => (
                        <div
                            key={issue.id}
                            className={`halo-table-row grid-cols-[1fr_130px_100px_100px_130px_180px] ${
                                issue.status === "RESOLVED" ? "opacity-60" : ""
                            }`}
                        >
                            <div>
                                <Link
                                    href={`/projects/${issue.projectId}/issues/${issue.id}`}
                                    className="halo-table-row-title hover:text-accent transition-colors"
                                >
                                    {issue.title}
                                </Link>
                                <div className="halo-table-row-meta flex items-center gap-2 mt-0.5">
                                    <span className={issue.status === "RESOLVED" ? "text-emerald-400" : "text-muted"}>
                                        {issue.status}
                                    </span>
                                </div>
                            </div>

                            <div className="halo-table-cell">{issue.projectName}</div>

                            <div>
                                <span className={`halo-severity halo-severity-${issue.severity.toLowerCase()}`}>
                                    {issue.severity}
                                </span>
                            </div>

                            <div className="halo-table-cell-mono">{issue.eventCount}</div>

                            <div className="halo-table-cell">
                                <RelativeTime date={issue.lastSeen} />
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}`}
                                    className="halo-btn halo-btn-sm halo-btn-primary"
                                    title="Start root cause investigation"
                                >
                                    Investigate <ArrowUpRight size={12} />
                                </Link>

                                <button
                                    type="button"
                                    onClick={() => toggleResolve(issue.id, issue.status)}
                                    disabled={updatingId === issue.id}
                                    className="halo-btn halo-btn-sm halo-btn-secondary"
                                    title={issue.status === "RESOLVED" ? "Reopen issue" : "Mark as resolved"}
                                >
                                    <Check size={12} className={issue.status === "RESOLVED" ? "text-emerald-400" : ""} />
                                    {issue.status === "RESOLVED" ? "Reopen" : "Resolve"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
