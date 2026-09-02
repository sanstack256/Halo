import React from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MonitorDetailLoading() {
    return (
        <div className="space-y-8 pb-16 animate-pulse font-mono">
            {/* Breadcrumb skeleton */}
            <div className="h-4 w-36 bg-white/5 rounded" />

            {/* Header skeleton */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5" />
                        <div className="h-7 w-64 rounded bg-white/5" />
                        <div className="h-5 w-24 rounded-full bg-white/5" />
                    </div>
                    <div className="h-4 w-96 rounded bg-white/5" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-8 w-24 rounded-lg bg-white/5" />
                    <div className="h-8 w-24 rounded-lg bg-white/5" />
                </div>
            </div>

            {/* Health Summary Grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-xl border border-[var(--border)] bg-white/5 p-4 space-y-2" />
                ))}
            </div>

            {/* Timeline chart skeleton */}
            <div className="h-44 rounded-xl border border-[var(--border)] bg-white/5 p-6" />

            {/* Trigger history skeleton */}
            <div className="h-56 rounded-xl border border-[var(--border)] bg-white/5 p-6" />

            {/* Config inspector skeleton */}
            <div className="h-64 rounded-xl border border-[var(--border)] bg-white/5 p-6" />
        </div>
    );
}
