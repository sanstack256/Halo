import { getIssues } from "@/actions/issue";
import IssueCard from "@/components/issues/issue-card";
import { PageHeader } from "@/components/ui/page-header";

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
                description="Grouped production issues."
            />

            <div className="overflow-hidden rounded-2xl border border-border bg-surface">

                {issues.map((issue, index) => (

                    <IssueCard
                        key={issue.id}
                        projectId={id}
                        issue={issue}
                        isLast={index === issues.length - 1}
                    />

                ))}

            </div>

        </div>
    );
}