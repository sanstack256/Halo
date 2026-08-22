import { getLogs } from "@/actions/explore";
import { RelativeTime } from "@/components/ui/relative-time";
import { Terminal } from "lucide-react";

export default async function LogsPage() {
    const logs = await getLogs();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Logs</h1>
                <p className="halo-page-description">Real-time stream of application log messages and console output.</p>
            </div>

            {logs.length === 0 ? (
                <div className="halo-empty-state">
                    <Terminal className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No log events recorded</h3>
                    <p className="halo-empty-state-description">Log events captured by the SDK will appear here in real time.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[140px_120px_100px_1fr_140px]">
                        <div className="halo-table-col-label">Timestamp</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Level</div>
                        <div className="halo-table-col-label">Message</div>
                        <div className="halo-table-col-label">Service</div>
                    </div>

                    {logs.map((log) => (
                        <div key={log.id} className="halo-table-row grid-cols-[140px_120px_100px_1fr_140px]">
                            <div className="halo-table-cell">
                                <RelativeTime date={log.timestamp} />
                            </div>
                            <div className="halo-table-cell">{log.projectName}</div>
                            <div>
                                <span className={`halo-severity halo-severity-${log.severity.toLowerCase()}`}>
                                    {log.severity}
                                </span>
                            </div>
                            <div className="halo-table-row-title font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                                {log.title || log.message || "Log event"}
                            </div>
                            <div className="halo-table-cell-mono">{log.service ?? "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
