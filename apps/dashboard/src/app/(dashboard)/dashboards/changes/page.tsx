import { getDashboardFilterContext, getChangeIntelligenceAnalytics } from "@/actions/analytics";
import { ChangeIntelligenceClient } from "@/components/dashboards/change-intelligence-client";

interface PageProps {
    searchParams: Promise<{
        projectId?: string;
        environment?: string;
        range?: string;
        service?: string;
    }>;
}

export default async function ChangeIntelligencePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const projectId = sp.projectId || "ALL";
    const environment = sp.environment || "ALL";
    const range = sp.range || "24h";
    const service = sp.service || "ALL";

    const [filterContext, analyticsData] = await Promise.all([
        getDashboardFilterContext(),
        getChangeIntelligenceAnalytics({
            projectId: projectId !== "ALL" ? projectId : undefined,
            environment: environment !== "ALL" ? environment : undefined,
            timeRangeKey: range,
            service: service !== "ALL" ? service : undefined,
        }),
    ]);

    return (
        <ChangeIntelligenceClient
            data={analyticsData}
            projects={filterContext.projects}
            environments={filterContext.environments}
            currentProjectId={projectId}
            currentEnvironment={environment}
            currentTimeRange={range}
            currentService={service}
        />
    );
}
