import React from "react";

export default function AlertDetailLoading() {
    return (
        <div className="space-y-6 max-w-4xl animate-pulse font-mono">
            {/* Breadcrumb skeleton */}
            <div className="h-4 w-32 bg-white/5 rounded" />

            {/* Header skeleton */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="h-5 w-20 rounded-full bg-white/5" />
                    <div className="h-5 w-24 rounded-full bg-white/5" />
                </div>
                <div className="h-7 w-64 rounded bg-white/5" />
                <div className="h-4 w-96 rounded bg-white/5" />
            </div>

            {/* Metadata grid skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-20 rounded-lg border border-[var(--border)] bg-white/5 p-3 space-y-2" />
                ))}
            </div>

            {/* Source monitor card skeleton */}
            <div className="h-16 rounded-xl border border-[var(--border)] bg-white/5 p-4" />

            {/* Notification log skeleton */}
            <div className="h-48 rounded-xl border border-[var(--border)] bg-white/5 p-4" />
        </div>
    );
}
