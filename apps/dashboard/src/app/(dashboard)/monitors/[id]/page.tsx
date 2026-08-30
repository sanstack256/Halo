import { getMonitorFullDetails } from "@/actions/monitor";
import { notFound } from "next/navigation";
import { MonitorDetailHeader } from "@/components/monitors/monitor-detail-header";
import { MonitorHealthSummary } from "@/components/monitors/monitor-health-summary";
import { MonitorEvaluationChart } from "@/components/monitors/monitor-evaluation-chart";
import { MonitorTriggerHistory } from "@/components/monitors/monitor-trigger-history";
import { MonitorRelatedItems } from "@/components/monitors/monitor-related-items";
import { MonitorConfigInspector } from "@/components/monitors/monitor-config-inspector";
import { MonitorActivityLog } from "@/components/monitors/monitor-activity-log";
import { MonitorFutureInvestigationSlot } from "@/components/monitors/monitor-future-investigation-slot";

export const dynamic = "force-dynamic";

interface MonitorDetailPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function MonitorDetailPage({ params }: MonitorDetailPageProps) {
    const { id } = await params;
    const data = await getMonitorFullDetails(id);

    if (!data) {
        notFound();
    }

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            {/* 1. Header with live status, edit, pause/resume, delete */}
            <MonitorDetailHeader monitor={data.monitor} />

            {/* 2. Compact Health Summary */}
            <MonitorHealthSummary data={data} />

            {/* 3. Real Evaluation & Health History Timeline */}
            <MonitorEvaluationChart data={data} />

            {/* 4. Triggered Alert History */}
            <MonitorTriggerHistory data={data} />

            {/* 5. Related Project Issues & Releases */}
            <MonitorRelatedItems data={data} />

            {/* 6. Configuration Inspector */}
            <MonitorConfigInspector data={data} />

            {/* 7. Real Lifecycle Activity Log */}
            <MonitorActivityLog data={data} />

            {/* 8. Diagnostic & Investigation Slot */}
            <MonitorFutureInvestigationSlot data={data} />
        </div>
    );
}
