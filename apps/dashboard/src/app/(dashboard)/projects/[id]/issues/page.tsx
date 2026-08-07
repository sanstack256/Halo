import { getIssues } from "@/actions/issue";

import IssueCard from "@/components/issues/issue-card";
import { PageHeader } from "@/components/ui/page-header";

import { Search } from "lucide-react";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function IssuesPage({
    params,
}: Props) {
    const { id } = await params;

    const issues = await getIssues(id);

    return (
        <div className="space-y-10">

            <PageHeader
                title="Issues"
                description="Production issues grouped by fingerprint."
            />

            <div className="flex items-center justify-between">

                <div className="relative w-full max-w-md">

                    <Search
                        className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    />

                    <input
                        placeholder="Search issues..."
                        className="
                            h-11
                            w-full
                            rounded-xl
                            border
                            border-border
                            bg-surface
                            pl-11
                            pr-4
                            text-sm
                            outline-none
                            transition
                            placeholder:text-muted
                            focus:border-accent/30
                            focus:ring-2
                            focus:ring-accent/10
                        "
                    />

                </div>

                <p className="text-sm text-secondary">
                    {issues.length} issue{issues.length !== 1 ? "s" : ""}
                </p>

            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface">

                {/* Header */}

                <div className="grid grid-cols-[minmax(0,1fr)_120px_170px_170px] gap-8 border-b border-border px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted">

                    <span>Issue</span>

                    <span>Events</span>

                    <span>First Seen</span>

                    <span>Last Seen</span>

                </div>

                {issues.length === 0 ? (

                    <div className="py-20 text-center text-secondary">

                        No issues found.

                    </div>

                ) : (

                    issues.map((issue, index) => (

                        <IssueCard
                            key={issue.id}
                            projectId={id}
                            issue={issue}
                            isLast={index === issues.length - 1}
                        />

                    ))

                )}

            </div>

        </div>
    );
}