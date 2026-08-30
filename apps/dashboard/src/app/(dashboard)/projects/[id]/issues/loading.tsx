import React from "react";

export default function IssuesLoading() {
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

            {/* 4 Summary Cards Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3.5 px-4 rounded-xl border border-border bg-surface/30 space-y-1.5">
                        <div className="h-3 w-20 bg-surface/60 rounded" />
                        <div className="h-6 w-12 bg-surface rounded" />
                    </div>
                ))}
            </div>

            {/* Filter Toolbar Skeleton */}
            <div className="p-2.5 rounded-xl bg-surface/60 border border-border flex items-center gap-2">
                <div className="h-8.5 flex-1 min-w-[200px] bg-surface rounded-lg" />
                <div className="h-8.5 w-28 bg-surface rounded-lg" />
                <div className="h-8.5 w-28 bg-surface rounded-lg" />
                <div className="h-8.5 w-28 bg-surface rounded-lg" />
                <div className="h-8.5 w-28 bg-surface rounded-lg" />
            </div>

            {/* Table Skeleton */}
            <div className="rounded-xl border border-border bg-[#080b11] overflow-hidden">
                <div className="h-9 bg-surface/40 border-b border-border" />
                <div className="divide-y divide-white/5">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 grid grid-cols-[minmax(0,1fr)_100px_120px_120px_150px] gap-4 items-center">
                            <div className="space-y-2">
                                <div className="h-4 w-16 bg-surface rounded" />
                                <div className="h-4 w-72 bg-surface rounded" />
                                <div className="h-3 w-48 bg-surface/60 rounded" />
                            </div>
                            <div className="h-4 w-12 bg-surface rounded mx-auto" />
                            <div className="h-4 w-20 bg-surface rounded" />
                            <div className="h-4 w-20 bg-surface rounded" />
                            <div className="h-6 w-28 bg-surface rounded ml-auto" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
