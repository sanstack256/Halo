import { ListFilter, Shield } from "lucide-react";

export default function InboundFiltersPage() {
    return (
        <div className="space-y-8 pb-16 max-w-3xl">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Inbound Filters & Privacy</h1>
                <p className="halo-page-description">
                    Filter noisy events, block web crawlers, and sanitize sensitive data before storage.
                </p>
            </div>

            <div className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Active Filters
                </h2>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-elevated">
                        <div>
                            <p className="text-sm font-medium text-white">Filter Localhost Events</p>
                            <p className="text-xs text-secondary">Drop events coming from localhost or 127.0.0.1 in Production environments.</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Active
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-elevated">
                        <div>
                            <p className="text-sm font-medium text-white">Scrub PII & Credit Card Patterns</p>
                            <p className="text-xs text-secondary">Sanitize auth tokens, passwords, and credit card numbers from stack traces.</p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Active
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
