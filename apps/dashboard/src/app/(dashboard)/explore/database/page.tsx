import { getDatabaseWaitAttributionData } from "@/actions/explore";
import { DatabaseAttributionClient } from "@/components/explore/database-attribution-client";

interface PageProps {
    searchParams: Promise<{
        projectId?: string;
        service?: string;
        requestId?: string;
    }>;
}

export default async function ExploreDatabasePage({ searchParams }: PageProps) {
    const params = await searchParams;

    const data = await getDatabaseWaitAttributionData({
        projectId: params.projectId,
        service: params.service,
        requestId: params.requestId,
    });

    return (
        <DatabaseAttributionClient
            data={data}
            currentRequestId={params.requestId}
            currentService={params.service}
        />
    );
}
