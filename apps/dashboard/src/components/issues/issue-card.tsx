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
                px-6
                py-5
                transition-colors
                hover:bg-white/[0.02]
                ${!isLast ? "border-b border-border" : ""}
            `}
        >
            <div className="grid grid-cols-[1.8fr_120px_140px_180px] items-center gap-6">

                {/* Left */}

                <div className="min-w-0">

                    <div className="mb-2 flex items-center gap-2">

                        <Badge>
                            {issue.status}
                        </Badge>

                        <SeverityBadge severity={issue.severity} />

                    </div>

                    <h3 className="truncate text-[15px] font-medium transition-colors group-hover:text-accent">
                        {issue.title}
                    </h3>

                </div>

                {/* Events */}

                <div className="text-sm text-secondary">
                    {issue.eventCount} events
                </div>

                {/* First Seen */}

                <div className="text-sm text-secondary">
                    <RelativeTime date={issue.firstSeen} />
                </div>

                {/* Last Seen */}

                <div className="text-right text-sm text-muted">
                    <RelativeTime date={issue.lastSeen} />
                </div>

            </div>
        </Link>
    );
}