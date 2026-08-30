import { getIssues } from "@/actions/issue";
import { IssueInventoryView } from "@/components/issues/issue-inventory-view";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function IssuesPage({ params }: Props) {
    const { id } = await params;
    const issues = await getIssues(id);

    return (
        <div className="space-y-8 pb-16">
            <IssueInventoryView projectId={id} issues={issues as any} />
        </div>
    );
}