import { notFound } from "next/navigation";
import { getIssue } from "@/actions/issue";
import { IssueDetailView } from "@/components/issues/issue-detail-view";

type Props = {
    params: Promise<{
        id: string;
        issueId: string;
    }>;
};

export default async function IssuePage({ params }: Props) {
    const { issueId } = await params;
    const issue = await getIssue(issueId);

    if (!issue) {
        notFound();
    }

    return (
        <IssueDetailView
            issue={{
                id: issue.id,
                title: issue.title,
                status: issue.status,
                severity: issue.severity,
                eventCount: issue.eventCount,
                firstSeen: issue.firstSeen,
                lastSeen: issue.lastSeen,
                projectId: issue.projectId,
                events: issue.events.map((e) => ({
                    id: e.id,
                    title: e.title,
                    type: e.type,
                    severity: e.severity,
                    timestamp: e.timestamp,
                    message: e.message,
                    sdkName: e.sdkName,
                    service: e.service,
                    requestId: e.requestId,
                    traceId: e.traceId,
                    resource: e.resource,
                    release: e.release,
                    environment: e.environment,
                })),
            }}
        />
    );
}