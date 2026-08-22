import { getSession } from "@/lib/session";
import { Construction } from "lucide-react";

export default async function Page() {
    const session = await getSession();
    if (!session) return null;

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Email Addresses</h1>
                <p className="halo-page-description">Manage your verified email addresses.</p>
            </div>

            <div className="halo-card p-12 flex flex-col items-center text-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-elevated border border-border">
                    <Construction size={18} className="text-muted" />
                </div>
                <h2 className="text-sm font-semibold text-white">Email Addresses</h2>
                <p className="text-xs text-secondary max-w-sm leading-relaxed">Add, verify, or remove email addresses associated with your account.</p>
            </div>
        </div>
    );
}
