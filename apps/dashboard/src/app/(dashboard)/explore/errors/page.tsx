import { getErrorReproductionData } from "@/actions/explore";
import { ErrorRecipeClient } from "@/components/explore/error-recipe-client";

interface PageProps {
    searchParams: Promise<{
        fingerprint?: string;
        eventId?: string;
        issueId?: string;
        projectId?: string;
    }>;
}

export default async function ExploreErrorsPage({ searchParams }: PageProps) {
    const params = await searchParams;

    const { recipe, recentErrors } = await getErrorReproductionData(
        {
            fingerprint: params.fingerprint,
            eventId: params.eventId,
            issueId: params.issueId,
        },
        { projectId: params.projectId }
    );

    return (
        <ErrorRecipeClient
            recipe={recipe}
            recentErrors={recentErrors}
            currentFingerprint={params.fingerprint}
            currentEventId={params.eventId}
        />
    );
}
