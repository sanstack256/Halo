import React from "react";
import Link from "next/link";
import { ArrowLeft, BellOff, ShieldAlert } from "lucide-react";

export default function MonitorNotFound() {
    return (
        <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] text-zinc-500">
                <BellOff size={32} />
            </div>
            <div className="space-y-1.5 max-w-sm">
                <h2 className="text-lg font-semibold text-white font-sans">Monitor Not Found</h2>
                <p className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">
                    The requested monitor does not exist, has been deleted, or you do not have permission to view it.
                </p>
            </div>
            <Link
                href="/monitors"
                className="halo-btn halo-btn-secondary halo-btn-sm font-mono mt-2"
            >
                <ArrowLeft size={13} />
                <span>Return to All Monitors</span>
            </Link>
        </div>
    );
}
