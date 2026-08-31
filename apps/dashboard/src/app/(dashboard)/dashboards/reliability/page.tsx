import { getDashboardFilterContext, getReliabilityLabAnalytics } from "@/actions/analytics";
import { ReliabilityLabClient } from "@/components/dashboards/reliability-lab-client";

interface PageProps {
    searchParams: Promise<{
        projectId?: string;
        environment?: string;
        range?: string;
        compare?: string;
        service?: string;
    }>;
}

export default async function ReliabilityLabPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const projectId = sp.projectId || "ALL";
    const environment = sp.environment || "ALL";
    const range = sp.range || "24h";
    const compare = (sp.compare as any) || "PREVIOUS_PERIOD";
    const service = sp.service || "ALL";

    const [filterContext, analyticsData] = await Promise.all([
        getDashboardFilterContext(),
        getReliabilityLabAnalytics({
            projectId: projectId !== "ALL" ? projectId : undefined,
            environment: environment !== "ALL" ? environment : undefined,
            timeRangeKey: range,
            service: service !== "ALL" ? service : undefined,
        }),
    ]);

    return (
        <ReliabilityLabClient
            data={analyticsData}
            projects={filterContext.projects}
            environments={filterContext.environments}
            currentProjectId={projectId}
            currentEnvironment={environment}
            currentTimeRange={range}
            currentComparison={compare}
            currentService={service}
        />
    );
}
