import Link from "next/link";
import { BarChart3, Database, FileWarning, Search, Terminal, Waypoints } from "lucide-react";
import { UniversalSearchClient } from "./universal-search-client";

export default function ExplorePage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Explore</h1>
                <p className="halo-page-description">
                    Universal telemetry search and deep query inspection across logs, traces, errors, requests, database queries, and system metrics.
                </p>
            </div>

            {/* Universal Search Bar */}
            <UniversalSearchClient />

            {/* Quick Explore Categories */}
            <div className="space-y-3 pt-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Telemetry Explorers
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/explore/logs" className="halo-card p-5 hover:border-accent/40 transition-colors block space-y-2">
                        <div className="flex items-center gap-2 text-accent">
                            <Terminal size={18} />
                            <span className="font-semibold text-sm text-white">Logs</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Search structured and raw console log streams correlated with trace context.
                        </p>
                    </Link>

                    <Link href="/explore/traces" className="halo-card p-5 hover:border-accent/40 transition-colors block space-y-2">
                        <div className="flex items-center gap-2 text-accent">
                            <Waypoints size={18} />
                            <span className="font-semibold text-sm text-white">Traces</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Distributed trace spans, span waterfall timing, and slow endpoint detection.
                        </p>
                    </Link>

                    <Link href="/explore/errors" className="halo-card p-5 hover:border-accent/40 transition-colors block space-y-2">
                        <div className="flex items-center gap-2 text-accent">
                            <FileWarning size={18} />
                            <span className="font-semibold text-sm text-white">Errors</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Raw runtime exception stream, stack traces, and correlated request payloads.
                        </p>
                    </Link>

                    <Link href="/explore/metrics" className="halo-card p-5 hover:border-accent/40 transition-colors block space-y-2">
                        <div className="flex items-center gap-2 text-accent">
                            <BarChart3 size={18} />
                            <span className="font-semibold text-sm text-white">Metrics</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Apdex ratings, latency percentiles, error rates, and system throughput.
                        </p>
                    </Link>

                    <Link href="/explore/requests" className="halo-card p-5 hover:border-accent/40 transition-colors block space-y-2">
                        <div className="flex items-center gap-2 text-accent">
                            <Search size={18} />
                            <span className="font-semibold text-sm text-white">Requests</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            HTTP request lifecycle, duration distributions, status codes, and headers.
                        </p>
                    </Link>

                    <Link href="/explore/database" className="halo-card p-5 hover:border-accent/40 transition-colors block space-y-2">
                        <div className="flex items-center gap-2 text-accent">
                            <Database size={18} />
                            <span className="font-semibold text-sm text-white">Database</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            SQL query duration, slow queries, database connection errors, and locks.
                        </p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
