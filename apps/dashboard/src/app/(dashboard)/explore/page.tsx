import Link from "next/link";
import { BarChart3, Cpu, Database, FileWarning, Search, Terminal, Waypoints } from "lucide-react";

export default function ExplorePage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Explore</h1>
                <p className="halo-page-description">
                    Deep query search across logs, traces, errors, requests, database queries, and system metrics.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Link href="/explore/logs" className="halo-stat-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <Terminal size={18} />
                        <span className="font-semibold text-sm">Logs</span>
                    </div>
                    <p className="text-xs text-secondary">Search raw console and structured log events</p>
                </Link>

                <Link href="/explore/traces" className="halo-stat-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <Waypoints size={18} />
                        <span className="font-semibold text-sm">Traces</span>
                    </div>
                    <p className="text-xs text-secondary">Distributed trace spans & waterfall analysis</p>
                </Link>

                <Link href="/explore/errors" className="halo-stat-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <FileWarning size={18} />
                        <span className="font-semibold text-sm">Errors</span>
                    </div>
                    <p className="text-xs text-secondary">Exceptions, stacktraces, and fatal panics</p>
                </Link>

                <Link href="/explore/metrics" className="halo-stat-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <BarChart3 size={18} />
                        <span className="font-semibold text-sm">Metrics</span>
                    </div>
                    <p className="text-xs text-secondary">Apdex scores, latency percentiles & session health</p>
                </Link>

                <Link href="/explore/requests" className="halo-stat-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <Search size={18} />
                        <span className="font-semibold text-sm">Requests</span>
                    </div>
                    <p className="text-xs text-secondary">HTTP request lifecycle and correlated logs</p>
                </Link>

                <Link href="/explore/database" className="halo-stat-card hover:border-accent/40 transition-colors">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <Database size={18} />
                        <span className="font-semibold text-sm">Database</span>
                    </div>
                    <p className="text-xs text-secondary">Database queries, slow queries, and connection errors</p>
                </Link>
            </div>
        </div>
    );
}
