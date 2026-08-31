import { getDashboardFilterContext, getDependencyIntelligenceAnalytics } from "@/actions/analytics";
import { DependencyIntelligenceClient } from "@/components/dashboards/dependency-intelligence-client";

interface PageProps {
    searchParams: Promise<{
        projectId?: string;
        environment?: string;
        range?: string;
    }>;
}

export default async function DependencyIntelligencePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const projectId = sp.projectId || "ALL";
    const environment = sp.environment || "ALL";
    const range = sp.range || "24h";

    const [filterContext, analyticsData] = await Promise.all([
        getDashboardFilterContext(),
        getDependencyIntelligenceAnalytics({
            projectId: projectId !== "ALL" ? projectId : undefined,
            environment: environment !== "ALL" ? environment : undefined,
            timeRangeKey: range,
        }),
    ]);

    return (
        <DependencyIntelligenceClient
            data={analyticsData}
            projects={filterContext.projects}
            environments={filterContext.environments}
            currentProjectId={projectId}
            currentEnvironment={environment}
            currentTimeRange={range}
        />
    );
}
