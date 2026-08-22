import { getSession } from "@/lib/session";
import { Construction } from "lucide-react";

export default async function Page() {
    const session = await getSession();
    if (!session) return null;

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Autofix</h1>
                <p className="halo-page-description">Configure Halo AI Autofix — automated code fix suggestions for detected errors.</p>
            </div>

            <div className="halo-card p-12 flex flex-col items-center text-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-elevated border border-border">
                    <Construction size={18} className="text-muted" />
                </div>
                <h2 className="text-sm font-semibold text-white">Autofix</h2>
                <p className="text-xs text-secondary max-w-sm leading-relaxed">Autofix generates pull-request-ready code changes based on root cause analysis. Requires Developer plan.</p>
            </div>
        </div>
    );
}
