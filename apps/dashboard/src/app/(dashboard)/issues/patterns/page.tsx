import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { getPatternsProjection } from "@/lib/issues/issue-intelligence";
import { PatternsView } from "@/components/issues/patterns-view";

interface Props {
    searchParams: Promise<{
        project?: string;
        service?: string;
        environment?: string;
        timeRange?: string;
        search?: string;
    }>;
}

export default async function IssuesPatternsPage({ searchParams }: Props) {
    const session = await getSession();
    const params = await searchParams;

    let orgId: string | undefined = undefined;
    if (session) {
        const organization = await getOrganization(session.user.id);
        if (organization) orgId = organization.id;
    }

    const data = await getPatternsProjection({
        organizationId: orgId,
        projectId: params.project,
        service: params.service,
        environment: params.environment,
        timeRangeKey: params.timeRange || "30d",
        search: params.search,
    });

    return <PatternsView data={data} />;
}
