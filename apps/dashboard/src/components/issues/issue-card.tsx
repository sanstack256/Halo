import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Issue } from "@/generated/prisma/client";

type Props = {
    projectId: string;
    issue: Issue;
};

export default function IssueCard({
    projectId,
    issue,
}: Props) {
    return (
        <Link
            href={`/projects/${projectId}/issues/${issue.id}`}
        >
            <div className="rounded-xl border p-5 transition-all hover:border-primary/50 hover:bg-muted/30">

                <div className="flex items-start justify-between">

                    <div className="space-y-3">

                        <div className="flex items-center gap-3">

                            <Badge>
                                {issue.status}
                            </Badge>

                            <span className="text-sm text-muted-foreground">
                                {issue.severity}
                            </span>

                        </div>

                        <h2 className="text-lg font-semibold">
                            {issue.title}
                        </h2>

                        <div className="flex gap-6 text-sm text-muted-foreground">

                            <span>
                                {issue.eventCount} events
                            </span>

                            <span>
                                First seen{" "}
                                {issue.firstSeen.toLocaleString()}
                            </span>

                            <span>
                                Last seen{" "}
                                {issue.lastSeen.toLocaleString()}
                            </span>

                        </div>

                    </div>

                </div>

            </div>
        </Link>
    );
}