import { getEvidenceNeedleData, getExploreContextOptions } from "@/actions/explore";
import { SearchNeedleClient } from "@/components/explore/search-needle-client";

interface PageProps {
    searchParams: Promise<{
        q?: string;
        anchorId?: string;
        timeRange?: string;
        projectId?: string;
    }>;
}

export default async function ExploreSearchPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const query = params.q || "";
    const anchorId = params.anchorId;
    const timeRange = params.timeRange || "24h";
    const projectId = params.projectId;
    const environment = params.environment;
    const service = params.service;
    const release = params.release;

    const [{ searchResults, needle }, contextOptions] = await Promise.all([
        getEvidenceNeedleData(query, anchorId, timeRange, projectId, {
            environment,
            service,
            release,
        }),
        getExploreContextOptions(),
    ]);

    return (
        <SearchNeedleClient
            initialQuery={query}
            initialAnchorId={anchorId}
            searchResults={searchResults}
            needle={needle}
            contextOptions={contextOptions}
        />
    );
}
