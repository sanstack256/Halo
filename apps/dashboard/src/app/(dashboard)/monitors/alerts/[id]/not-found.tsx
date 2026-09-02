import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function AlertNotFound() {
    return (
        <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-zinc-500">
                <ShieldAlert size={32} />
            </div>
            <div className="space-y-1.5 max-w-sm">
                <h2 className="text-lg font-semibold text-white font-sans">Alert Not Found</h2>
                <p className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">
                    The requested alert record does not exist or has been removed.
                </p>
            </div>
            <Link
                href="/monitors/alerts"
                className="halo-btn halo-btn-secondary halo-btn-sm font-mono mt-2"
            >
                <ArrowLeft size={13} />
                <span>Return to Alert Rules</span>
            </Link>
        </div>
    );
}
