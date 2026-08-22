import { BellRing, Mail, MessageSquare } from "lucide-react";

export default function AlertSettingsPage() {
    return (
        <div className="space-y-8 pb-16 max-w-3xl">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Alert Settings</h1>
                <p className="halo-page-description">
                    Configure issue notification triggers, error spike alerts, and delivery channels.
                </p>
            </div>

            <div className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Notification Channels
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-elevated">
                        <div className="flex items-center gap-3">
                            <Mail size={18} className="text-accent" />
                            <div>
                                <p className="text-sm font-medium text-white">Email Digest & Instant Alerts</p>
                                <p className="text-xs text-secondary">Send instant email when a FATAL issue or new regression occurs.</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Enabled
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-elevated">
                        <div className="flex items-center gap-3">
                            <MessageSquare size={18} className="text-accent" />
                            <div>
                                <p className="text-sm font-medium text-white">Slack Incident Channel Webhook</p>
                                <p className="text-xs text-secondary">Stream proactive Halo root cause findings into #incident-triage.</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-muted bg-surface px-2.5 py-1 rounded-full border border-border">
                            Connected (#halo-alerts)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
