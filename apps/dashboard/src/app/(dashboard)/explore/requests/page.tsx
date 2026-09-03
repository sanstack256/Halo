import { getRequestReconstructionData } from "@/actions/explore";
import { RequestReconstructionClient } from "@/components/explore/request-reconstruction-client";

interface PageProps {
    searchParams: Promise<{
        requestId?: string;
        compareRequestId?: string;
        projectId?: string;
        service?: string;
    }>;
}

export default async function ExploreRequestsPage({ searchParams }: PageProps) {
    const params = await searchParams;

    const { reconstruction, diff, recentRequests } = await getRequestReconstructionData(
        params.requestId,
        params.compareRequestId,
        { projectId: params.projectId, service: params.service }
    );

    return (
        <RequestReconstructionClient
            reconstruction={reconstruction}
            diff={diff}
            recentRequests={recentRequests}
            currentRequestId={params.requestId}
            compareRequestId={params.compareRequestId}
        />
    );
}
