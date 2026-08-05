import { getIssues } from "@/actions/issue";
import IssueCard from "@/components/issues/issue-card";

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
        <div className="space-y-6">

            <div>
                <h1 className="text-3xl font-bold">
                    Issues
                </h1>

                <p className="text-muted-foreground">
                    Grouped production issues.
                </p>
            </div>

            <div className="space-y-3">

                {issues.map((issue) => (
                    <IssueCard
                        key={issue.id}
                        projectId={id}
                        issue={issue}
                    />
                ))}

            </div>

        </div>
    );
}