import { notFound } from "next/navigation";
import { getIssue } from "@/actions/issue";
import { createOrGetRepairCase } from "@/actions/repair";
import { RepairWorkspaceView } from "@/components/repair/repair-workspace-view";

type Props = {
    params: Promise<{
        id: string;
        issueId: string;
    }>;
    searchParams: Promise<{
        eventId?: string;
        investigationId?: string;
    }>;
};

export default async function RepairPage({ params, searchParams }: Props) {
    const { id, issueId } = await params;
    const { eventId, investigationId } = await searchParams;

    const issue = await getIssue(issueId);
    if (!issue) {
        notFound();
    }

    const { repairCase } = await createOrGetRepairCase({
        projectId: id,
        issueId,
        investigationId,
        eventId,
    });

    return (
        <RepairWorkspaceView
            repairCase={repairCase}
            projectId={id}
            issueId={issueId}
        />
    );
}
