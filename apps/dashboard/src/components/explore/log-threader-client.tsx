"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Terminal, GitCommit, ChevronDown, ChevronRight, Layers, ArrowUpRight, AlertTriangle, FileWarning, Clock } from "lucide-react";
import type { LogThread, CompressedLogCluster, LogThreadNode } from "@/lib/explore/log-threader";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";
import { ExploreHeader } from "./explore-header";
import { ExploreContextBar } from "./explore-context-bar";
import { DetailDrawer } from "./detail-drawer";
import { ExploreEmptyState } from "./empty-state";
import { RelativeTime } from "@/components/ui/relative-time";

interface LogThreaderClientProps {
    threads: LogThread[];
    unthreadedCount: number;
    contextOptions: {
        projects: Array<{ id: string; name: string }>;
        environments: Array<{ id: string; name: string; projectId: string }>;
        services: string[];
        releases: string[];
    };
}

export function LogThreaderClient({
    threads,
    unthreadedCount,
    contextOptions,
}: LogThreaderClientProps) {
    const [selectedRecord, setSelectedRecord] = useState<CanonicalEvidenceRecord | null>(null);
    const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

    const toggleCluster = (clusterId: string) => {
        setExpandedClusters((prev) => {
            const next = new Set(prev);
            if (next.has(clusterId)) {
                next.delete(clusterId);
            } else {
                next.add(clusterId);
            }
            return next;
        });
    };

    const totalEvents = threads.reduce((sum, t) => sum + t.totalEventCount, 0);

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Logs"
                subtitle="Reconstruct the execution thread hidden inside unstructured logs by correlation priority."
                icon={Terminal}
                badgeText={`${threads.length} threads (${totalEvents} events)`}
            />

            {/* Context Filters */}
            <ExploreContextBar
                contextOptions={contextOptions}
                searchPlaceholder="Search log message, traceId, requestId, or session..."
            />

            {/* Main Thread Reconstructions */}
            {threads.length === 0 ? (
                <ExploreEmptyState
                    type="NO_DATA"
                    title="No log threads found"
                    description="No log events matching the selected filters were captured in the current time window."
                />
            ) : (
                <div className="space-y-4">
                    {threads.map((thread) => {
                        const isDirect = thread.strength === "DIRECT";
                        const isLinked = thread.strength === "LINKED";

                        return (
                            <div
                                key={thread.threadId}
                                className="rounded-xl bg-surface border border-border overflow-hidden divide-y divide-border/60"
                            >
                                {/* Thread Header Banner */}
                                <div className="p-3.5 bg-[#06080e] flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                                                isDirect
                                                    ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                                    : isLinked
                                                    ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                                    : "bg-zinc-800 text-zinc-300 border-zinc-700"
                                            }`}
                                        >
                                            {thread.strength} THREAD ({thread.threadType})
                                        </span>
                                        <span className="font-mono text-white font-semibold">
                                            {thread.threadKey}
                                        </span>
                                        <span>•</span>
                                        <span className="text-secondary font-mono">
                                            Service: <strong className="text-zinc-200">{thread.service}</strong>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
                                        <span>Duration: {thread.durationMs}ms</span>
                                        <span>•</span>
                                        <span>{thread.totalEventCount} events</span>
                                        {thread.errorCount > 0 && (
                                            <span className="px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                                                {thread.errorCount} error(s)
                                            </span>
                                        )}
                                        <span className="text-secondary">
                                            <RelativeTime date={thread.startTime} />
                                        </span>
                                    </div>
                                </div>

                                {/* Thread Execution Nodes / Compressed Clusters */}
                                <div className="p-3 divide-y divide-border/40 font-mono text-xs">
                                    {/* Render telemetry gaps if any */}
                                    {thread.gaps.length > 0 && (
                                        <div className="py-1.5">
                                            {thread.gaps.map((gap, gIdx) => (
                                                <div
                                                    key={gIdx}
                                                    className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2 mb-1.5"
                                                >
                                                    <Clock size={13} className="shrink-0" />
                                                    <span>{gap.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {thread.clusters.map((cluster) => {
                                        if (cluster.isCompressed) {
                                            const isExpanded = expandedClusters.has(cluster.id);
                                            return (
                                                <div key={cluster.id} className="py-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCluster(cluster.id)}
                                                        className="w-full text-left p-2 rounded bg-[#04060a] border border-border/70 hover:border-border text-zinc-400 hover:text-zinc-200 flex items-center justify-between text-[11px] transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Layers size={13} className="text-muted" />
                                                            <span>
                                                                {cluster.count} repeated observations collapsed ({cluster.firstTimestamp.toLocaleTimeString()} – {cluster.lastTimestamp.toLocaleTimeString()})
                                                            </span>
                                                        </div>
                                                        <span className="text-accent underline font-mono">
                                                            {isExpanded ? "Collapse" : `Expand ${cluster.count} observations`}
                                                        </span>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="mt-1.5 space-y-1 pl-4 border-l-2 border-border/60">
                                                            {cluster.nodes.map((node) => (
                                                                <ThreadNodeRow
                                                                    key={node.id}
                                                                    node={node}
                                                                    onSelect={() => setSelectedRecord(node.record)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={cluster.id} className="py-1">
                                                {cluster.nodes.map((node) => (
                                                    <ThreadNodeRow
                                                        key={node.id}
                                                        node={node}
                                                        onSelect={() => setSelectedRecord(node.record)}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail Drawer */}
            <DetailDrawer
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
            />
        </div>
    );
}

function ThreadNodeRow({
    node,
    onSelect,
}: {
    node: LogThreadNode;
    onSelect: () => void;
}) {
    const isError =
        node.record.type === "ERROR" ||
        node.record.severity === "ERROR" ||
        node.record.severity === "FATAL";
    const isWarning = node.record.severity === "WARNING";

    return (
        <div
            onClick={onSelect}
            className={`p-2 rounded hover:bg-surface-elevated cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs ${
                isError ? "bg-red-500/5 text-red-300" : isWarning ? "text-amber-300" : "text-zinc-300"
            }`}
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] text-muted shrink-0 w-16">
                    {node.record.timestamp.toLocaleTimeString()}
                </span>
                <span
                    className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${
                        isError
                            ? "bg-red-500/20 text-red-400"
                            : isWarning
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-zinc-800 text-zinc-400"
                    }`}
                >
                    {node.record.severity}
                </span>
                <span className="truncate font-mono text-[11px] text-white">
                    {node.record.message || node.record.title}
                </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted shrink-0">
                <span className="text-secondary">{node.record.service}</span>
                <ArrowUpRight size={11} className="opacity-60" />
            </div>
        </div>
    );
}
