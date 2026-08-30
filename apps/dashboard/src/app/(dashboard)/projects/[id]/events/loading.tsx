import React from "react";

export default function EventsLoading() {
    return (
        <div className="space-y-5 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="space-y-1.5">
                    <div className="h-6 w-24 bg-surface rounded-lg" />
                    <div className="h-3.5 w-64 bg-surface/60 rounded" />
                </div>
                <div className="h-7 w-20 bg-surface rounded-lg" />
            </div>

            {/* 4 Summary Metrics Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-1">
                        <div className="h-3 w-16 bg-surface/60 rounded" />
                        <div className="h-5 w-10 bg-surface rounded" />
                    </div>
                ))}
            </div>

            {/* Filter Toolbar Skeleton */}
            <div className="p-2.5 rounded-xl bg-surface/60 border border-border flex items-center gap-2 flex-wrap">
                <div className="h-8.5 flex-1 min-w-[240px] bg-surface rounded-lg" />
                <div className="h-8.5 w-24 bg-surface rounded-lg" />
                <div className="h-8.5 w-24 bg-surface rounded-lg" />
                <div className="h-8.5 w-24 bg-surface rounded-lg" />
                <div className="h-8.5 w-24 bg-surface rounded-lg" />
            </div>

            {/* Stream Table Skeleton */}
            <div className="rounded-xl border border-border bg-[#080b11] overflow-hidden">
                <div className="h-9 bg-surface/40 border-b border-border" />
                <div className="divide-y divide-white/5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="p-3.5 grid grid-cols-[130px_90px_minmax(0,1fr)_100px_130px_100px_90px] gap-3 items-center"
                        >
                            <div className="space-y-1">
                                <div className="h-3.5 w-16 bg-surface rounded" />
                                <div className="h-2.5 w-12 bg-surface/60 rounded" />
                            </div>
                            <div className="h-5 w-14 bg-surface rounded" />
                            <div className="space-y-1">
                                <div className="h-3.5 w-48 bg-surface rounded" />
                                <div className="h-2.5 w-32 bg-surface/60 rounded" />
                            </div>
                            <div className="h-5 w-16 bg-surface rounded" />
                            <div className="h-3.5 w-20 bg-surface rounded" />
                            <div className="h-3.5 w-16 bg-surface rounded" />
                            <div className="h-3.5 w-14 bg-surface rounded ml-auto" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
