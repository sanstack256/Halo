import { getRuntimeFingerprintData } from "@/actions/explore";
import { RuntimeFingerprintClient } from "@/components/explore/runtime-fingerprint-client";

interface PageProps {
    searchParams: Promise<{
        eventId?: string;
        referenceEventId?: string;
        projectId?: string;
    }>;
}

export default async function ExploreInfrastructurePage({ searchParams }: PageProps) {
    const params = await searchParams;

    const { fingerprint, recentErrors } = await getRuntimeFingerprintData(
        params.eventId,
        { projectId: params.projectId }
    );

    return (
        <RuntimeFingerprintClient
            fingerprint={fingerprint}
            recentErrors={recentErrors}
            currentEventId={params.eventId}
        />
    );
}
