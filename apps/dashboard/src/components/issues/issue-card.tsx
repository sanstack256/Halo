import Link from "next/link";
import { Issue } from "@/generated/prisma/client";

import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { RelativeTime } from "@/components/ui/relative-time";

type Props = {
    projectId: string;
    issue: Issue;
    isLast?: boolean;
};

export default function IssueCard({
    projectId,
    issue,
    isLast = false,
}: Props) {
    return (
        <Link
            href={`/projects/${projectId}/issues/${issue.id}`}
            className={`
                group
                block
                transition-colors
                hover:bg-surface-interactive
                ${!isLast ? "border-b border-border" : ""}
            `}
        >
            <div className="grid grid-cols-[minmax(0,1fr)_120px_170px_170px] items-center gap-8 px-6 py-5">

                {/* Issue */}

                <div className="min-w-0">

                    <div className="mb-2 flex items-center gap-2">

                        <Badge>
                            {issue.status}
                        </Badge>

                        <SeverityBadge
                            severity={issue.severity}
                        />

                    </div>

                    <h3 className="truncate text-[15px] font-medium transition-colors group-hover:text-accent">

                        {issue.title}

                    </h3>

                </div>

                {/* Events */}

                <div>

                    <p className="text-xs text-muted">
                        Events
                    </p>

                    <p className="mt-1 font-medium">
                        {issue.eventCount}
                    </p>

                </div>

                {/* First Seen */}

                <div>

                    <p className="text-xs text-muted">
                        First Seen
                    </p>

                    <p className="mt-1 text-secondary">
                        <RelativeTime
                            date={issue.firstSeen}
                        />
                    </p>

                </div>

                {/* Last Seen */}

                <div>

                    <p className="text-xs text-muted">
                        Last Seen
                    </p>

                    <p className="mt-1 text-secondary">
                        <RelativeTime
                            date={issue.lastSeen}
                        />
                    </p>

                </div>

            </div>
        </Link>
    );
}