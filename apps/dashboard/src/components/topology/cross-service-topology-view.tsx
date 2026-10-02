"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Network,
    Server,
    Activity,
    AlertTriangle,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Search,
    Filter,
    ArrowRight,
    ArrowUpRight,
    Layers,
    GitCompare,
    RefreshCw,
    X,
    Maximize2,
    ZoomIn,
    ZoomOut,
    Eye,
    Flame,
    BarChart3,
} from "lucide-react";
import {
    getServiceTopology,
    type TopologyNode,
    type TopologyEdge,
    type ServiceTopologyResponse,
} from "@/actions/topology";
import Link from "next/link";

interface Props {
    projectId: string;
    isTeamPlan: boolean;
    initialTimeRangeKey?: string;
    environment?: string;
    highlightService?: string;
}

export function CrossServiceTopologyView({
    projectId,
    isTeamPlan,
    initialTimeRangeKey = "24h",
    environment = "ALL",
    highlightService,
}: Props) {
    const [timeRangeKey, setTimeRangeKey] = useState(initialTimeRangeKey);
    const [topology, setTopology] = useState<ServiceTopologyResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [filterBottlenecksOnly, setFilterBottlenecksOnly] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(highlightService || null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    const fetchTopology = React.useCallback(async () => {
        if (!isTeamPlan) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getServiceTopology({
                projectId,
                timeRangeKey,
                environment,
            });
            setTopology(data);
            if (highlightService && data.nodes.some((n) => n.id === highlightService)) {
                setSelectedNodeId(highlightService);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load service topology");
        } finally {
            setLoading(false);
        }
    }, [projectId, timeRangeKey, environment, isTeamPlan, highlightService]);

    useEffect(() => {
        fetchTopology();
    }, [fetchTopology]);

    // Filter nodes
    const filteredNodes = useMemo(() => {
        if (!topology) return [];
        return topology.nodes.filter((node) => {
            if (filterBottlenecksOnly && !node.isBottleneck) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                return node.name.toLowerCase().includes(q) || node.operations.some((op) => op.toLowerCase().includes(q));
            }
            return true;
        });
    }, [topology, filterBottlenecksOnly, searchQuery]);

    const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

    // Filter edges
    const filteredEdges = useMemo(() => {
        if (!topology) return [];
        return topology.edges.filter((edge) => {
            if (edge.isSelfCall) return false;
            return filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target);
        });
    }, [topology, filteredNodeIds]);

    const selectedNode = useMemo(() => {
        if (!selectedNodeId || !topology) return null;
        return topology.nodes.find((n) => n.id === selectedNodeId) || null;
    }, [selectedNodeId, topology]);

    const selectedEdge = useMemo(() => {
        if (!selectedEdgeId || !topology) return null;
        return topology.edges.find((e) => e.id === selectedEdgeId) || null;
    }, [selectedEdgeId, topology]);

    // Incoming and outgoing edges for selected node
    const selectedNodeEdges = useMemo(() => {
        if (!selectedNodeId || !topology) return { incoming: [], outgoing: [] };
        return {
            incoming: topology.edges.filter((e) => e.target === selectedNodeId && !e.isSelfCall),
            outgoing: topology.edges.filter((e) => e.source === selectedNodeId && !e.isSelfCall),
        };
    }, [selectedNodeId, topology]);

    if (!isTeamPlan) {
        return (
            <div className="bg-[#121316] border border-amber-800/40 rounded-xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-950/40 border border-amber-700/50 flex items-center justify-center mx-auto text-amber-400">
                    <Network size={24} />
                </div>
                <h3 className="text-base font-semibold text-white">Cross-Service Dependency Topology</h3>
                <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                    Map distributed microservices, request flows, cross-service failure propagation, and latency bottlenecks derived from actual W3C trace spans. Available exclusively on the <strong>Team Plan</strong>.
                </p>
                <div className="pt-2">
                    <Link
                        href="/settings/billing"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition"
                    >
                        Upgrade to Team Plan
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#121316] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
            {/* Top Toolbar */}
            <div className="p-4 border-b border-[#27272a] flex flex-wrap items-center justify-between gap-3 bg-[#18191d]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                        <Network size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            Cross-Service Topology & Dependencies
                            {topology && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {topology.totalServices} services • {topology.totalDependencies} dependencies
                                </span>
                            )}
                        </h3>
                        <p className="text-[11px] text-zinc-400">
                            Derived from authoritative distributed trace spans (parent-child causality).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Time Range Selector */}
                    <div className="flex items-center bg-[#0d0e11] border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
                        {(["1h", "6h", "24h", "7d", "30d"] as const).map((key) => (
                            <button
                                key={key}
                                onClick={() => setTimeRangeKey(key)}
                                className={`px-2.5 py-1 rounded text-xs transition ${
                                    timeRangeKey === key
                                        ? "bg-indigo-600 text-white font-medium shadow-sm"
                                        : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                {key}
                            </button>
                        ))}
                    </div>

                    {/* Bottlenecks filter */}
                    <button
                        onClick={() => setFilterBottlenecksOnly(!filterBottlenecksOnly)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                            filterBottlenecksOnly
                                ? "bg-amber-950/40 border-amber-600/60 text-amber-300"
                                : "bg-[#0d0e11] border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                    >
                        <Flame size={13} className={filterBottlenecksOnly ? "text-amber-400" : "text-zinc-500"} />
                        Bottlenecks ({topology?.bottlenecksCount || 0})
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={fetchTopology}
                        disabled={loading}
                        className="p-1.5 rounded-lg border border-zinc-800 bg-[#0d0e11] text-zinc-400 hover:text-white transition disabled:opacity-50"
                        title="Refresh Topology"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Search and Secondary Filter Bar */}
            <div className="px-4 py-2.5 border-b border-[#27272a] bg-[#141519] flex items-center justify-between gap-3 text-xs">
                <div className="relative flex-1 max-w-xs">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search services or endpoints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 bg-[#0d0e11] border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">Zoom:</span>
                    <button
                        onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                        className="p-1 rounded bg-[#0d0e11] border border-zinc-800 text-zinc-400 hover:text-white"
                    >
                        <ZoomOut size={12} />
                    </button>
                    <span className="text-[11px] font-mono text-zinc-400 min-w-8 text-center">
                        {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                        onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                        className="p-1 rounded bg-[#0d0e11] border border-zinc-800 text-zinc-400 hover:text-white"
                    >
                        <ZoomIn size={12} />
                    </button>
                    <button
                        onClick={() => setZoomLevel(1)}
                        className="px-2 py-0.5 rounded bg-[#0d0e11] border border-zinc-800 text-[10px] text-zinc-400 hover:text-white"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Error or Loading State */}
            {loading && (
                <div className="p-16 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Reconstructing cross-service topology from distributed traces...
                </div>
            )}

            {error && (
                <div className="p-6 m-4 bg-rose-950/20 border border-rose-800/40 rounded-xl flex items-center gap-3 text-xs text-rose-300">
                    <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Main Interactive Canvas & Detail Panel */}
            {!loading && !error && topology && (
                <div className="relative flex flex-col lg:flex-row min-h-[480px]">
                    {/* Visual Topology Canvas */}
                    <div className="flex-1 p-6 overflow-auto bg-[#0a0b0d] relative" style={{ minHeight: 450 }}>
                        {filteredNodes.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
                                No service dependencies observed in the selected {timeRangeKey} window.
                            </div>
                        ) : (
                            <div
                                className="flex flex-wrap gap-5 justify-center items-start transition-transform origin-top"
                                style={{ transform: `scale(${zoomLevel})` }}
                            >
                                {filteredNodes.map((node) => {
                                    const isSelected = selectedNodeId === node.id;
                                    const hasErrors = (node.errorRate || 0) > 0;

                                    return (
                                        <div
                                            key={node.id}
                                            onClick={() => {
                                                setSelectedNodeId(node.id);
                                                setSelectedEdgeId(null);
                                            }}
                                            className={`cursor-pointer rounded-xl p-4 border transition w-64 shadow-lg ${
                                                isSelected
                                                    ? "bg-[#181a20] border-indigo-500 ring-2 ring-indigo-500/30"
                                                    : node.isBottleneck
                                                    ? "bg-[#151212] border-amber-600/50 hover:border-amber-500"
                                                    : "bg-[#121316] border-[#27272a] hover:border-zinc-600"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]/60">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Server size={14} className={node.isBottleneck ? "text-amber-400" : "text-indigo-400"} />
                                                    <span className="text-xs font-semibold text-white truncate" title={node.name}>
                                                        {node.name}
                                                    </span>
                                                </div>
                                                {node.isBottleneck && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-950/60 text-amber-300 border border-amber-700/50 flex items-center gap-1">
                                                        <Flame size={10} /> Bottleneck
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-3 text-[11px] font-mono">
                                                <div>
                                                    <span className="text-zinc-500 block text-[10px]">Requests</span>
                                                    <span className="text-zinc-200 font-semibold">{node.requestVolume.toLocaleString()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-zinc-500 block text-[10px]">Error Rate</span>
                                                    <span className={hasErrors ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                                                        {node.errorRate !== null ? `${Math.round(node.errorRate * 100)}%` : "0%"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-zinc-500 block text-[10px]">Avg Latency</span>
                                                    <span className="text-zinc-300">
                                                        {node.avgLatencyMs !== null ? `${node.avgLatencyMs}ms` : "N/A"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-zinc-500 block text-[10px]">p95 Latency</span>
                                                    <span className="text-zinc-300">
                                                        {node.p95LatencyMs !== null ? `${node.p95LatencyMs}ms` : "N/A"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-2 border-t border-[#27272a]/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                                                <span>In: {node.incomingDependenciesCount}</span>
                                                <span>Out: {node.outgoingDependenciesCount}</span>
                                                <span>Sample: {node.sampleSizeAssessment}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Edge List Summary Under Graph */}
                        {filteredEdges.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-zinc-800">
                                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                                    Observed Directed Dependencies ({filteredEdges.length})
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {filteredEdges.map((edge) => {
                                        const isSelected = selectedEdgeId === edge.id;
                                        return (
                                            <div
                                                key={edge.id}
                                                onClick={() => {
                                                    setSelectedEdgeId(edge.id);
                                                    setSelectedNodeId(null);
                                                }}
                                                className={`cursor-pointer p-2.5 rounded-lg border text-xs font-mono transition flex items-center justify-between gap-2 ${
                                                    isSelected
                                                        ? "bg-[#181a20] border-indigo-500 text-white"
                                                        : edge.isBottleneck
                                                        ? "bg-[#151212] border-amber-800/40 text-amber-200 hover:border-amber-600"
                                                        : "bg-[#121316] border-zinc-800 text-zinc-300 hover:border-zinc-700"
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="text-indigo-400 truncate">{edge.source}</span>
                                                    <ArrowRight size={11} className="text-zinc-500 shrink-0" />
                                                    <span className="text-indigo-300 truncate">{edge.target}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                                                    <span className="text-zinc-400">{edge.callCount} calls</span>
                                                    {edge.errorCount > 0 && (
                                                        <span className="text-rose-400">{edge.errorCount} err</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Detail Inspection Drawer */}
                    {(selectedNode || selectedEdge) && (
                        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#27272a] bg-[#141519] p-5 space-y-5 overflow-auto">
                            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                                    <Eye size={13} className="text-indigo-400" />
                                    {selectedNode ? "Service Detail" : "Dependency Edge Detail"}
                                </h4>
                                <button
                                    onClick={() => {
                                        setSelectedNodeId(null);
                                        setSelectedEdgeId(null);
                                    }}
                                    className="p-1 rounded text-zinc-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Node Detail */}
                            {selectedNode && (
                                <div className="space-y-4 text-xs">
                                    <div>
                                        <div className="text-[10px] text-zinc-500 uppercase font-mono">Service Name</div>
                                        <div className="text-sm font-semibold text-white font-mono">{selectedNode.name}</div>
                                    </div>

                                    {selectedNode.isBottleneck && (
                                        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-700/40 text-amber-300 text-xs space-y-1">
                                            <div className="font-semibold flex items-center gap-1.5">
                                                <Flame size={13} className="text-amber-400" />
                                                Bottleneck Identified
                                            </div>
                                            <div className="text-[11px] leading-relaxed text-amber-200/90 font-mono">
                                                {selectedNode.bottleneckReason}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 bg-[#0d0e11] p-3 rounded-lg border border-zinc-800/80 font-mono text-[11px]">
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">Requests</span>
                                            <span className="text-white font-bold">{selectedNode.requestVolume.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">Failures</span>
                                            <span className="text-rose-400 font-bold">{selectedNode.errorCount.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">Avg Duration</span>
                                            <span className="text-zinc-300">{selectedNode.avgLatencyMs !== null ? `${selectedNode.avgLatencyMs}ms` : "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">p95 Duration</span>
                                            <span className="text-zinc-300">{selectedNode.p95LatencyMs !== null ? `${selectedNode.p95LatencyMs}ms` : "N/A"}</span>
                                        </div>
                                    </div>

                                    {/* Incoming Callers */}
                                    <div>
                                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                                            Incoming Callers ({selectedNodeEdges.incoming.length})
                                        </div>
                                        {selectedNodeEdges.incoming.length === 0 ? (
                                            <div className="text-[11px] text-zinc-500 font-mono italic">No upstream callers recorded.</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {selectedNodeEdges.incoming.map((e) => (
                                                    <div key={e.id} className="p-2 rounded bg-[#0d0e11] border border-zinc-800 flex justify-between items-center text-[11px] font-mono">
                                                        <span className="text-indigo-400">{e.source}</span>
                                                        <span className="text-zinc-400">{e.callCount} calls</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Outgoing Dependencies */}
                                    <div>
                                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                                            Outgoing Dependencies ({selectedNodeEdges.outgoing.length})
                                        </div>
                                        {selectedNodeEdges.outgoing.length === 0 ? (
                                            <div className="text-[11px] text-zinc-500 font-mono italic">No downstream dependencies called.</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {selectedNodeEdges.outgoing.map((e) => (
                                                    <div key={e.id} className="p-2 rounded bg-[#0d0e11] border border-zinc-800 flex justify-between items-center text-[11px] font-mono">
                                                        <span className="text-indigo-300">{e.target}</span>
                                                        <span className="text-zinc-400">{e.callCount} calls</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-2 border-t border-[#27272a] space-y-2">
                                        <Link
                                            href={`/projects/${projectId}/investigations/new?service=${encodeURIComponent(selectedNode.name)}`}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                                        >
                                            <Search size={13} />
                                            Investigate {selectedNode.name}
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Edge Detail */}
                            {selectedEdge && (
                                <div className="space-y-4 text-xs">
                                    <div className="p-3 rounded-lg bg-[#0d0e11] border border-zinc-800 space-y-1">
                                        <div className="text-[10px] text-zinc-500 uppercase font-mono">Dependency Relationship</div>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white font-mono">
                                            <span className="text-indigo-400">{selectedEdge.source}</span>
                                            <ArrowRight size={13} className="text-zinc-500" />
                                            <span className="text-indigo-300">{selectedEdge.target}</span>
                                        </div>
                                        <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 pt-1">
                                            <ShieldCheck size={11} /> Provenance: {selectedEdge.classification} (Distributed Trace)
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 bg-[#0d0e11] p-3 rounded-lg border border-zinc-800/80 font-mono text-[11px]">
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">Calls</span>
                                            <span className="text-white font-bold">{selectedEdge.callCount.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">Failures</span>
                                            <span className="text-rose-400 font-bold">{selectedEdge.errorCount.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">p50 Latency</span>
                                            <span className="text-zinc-300">{selectedEdge.p50LatencyMs !== null ? `${selectedEdge.p50LatencyMs}ms` : "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="text-zinc-500 block text-[10px]">p95 Latency</span>
                                            <span className="text-zinc-300">{selectedEdge.p95LatencyMs !== null ? `${selectedEdge.p95LatencyMs}ms` : "N/A"}</span>
                                        </div>
                                    </div>

                                    {/* Operations Breakdown */}
                                    <div>
                                        <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                                            Observed Operations ({selectedEdge.operations.length})
                                        </div>
                                        <div className="space-y-1">
                                            {selectedEdge.operations.map((op) => (
                                                <div key={op.operation} className="p-2 rounded bg-[#0d0e11] border border-zinc-800 flex justify-between items-center text-[11px] font-mono">
                                                    <span className="text-zinc-300 truncate max-w-[180px]" title={op.operation}>{op.operation}</span>
                                                    <span className="text-zinc-400">{op.callCount} calls</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Supporting Traces */}
                                    {selectedEdge.supportingTraces.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                                                Supporting Traces ({selectedEdge.supportingTraces.length})
                                            </div>
                                            <div className="space-y-1 max-h-36 overflow-auto">
                                                {selectedEdge.supportingTraces.map((traceId) => (
                                                    <div key={traceId} className="p-1.5 rounded bg-[#0d0e11] border border-zinc-800 text-[10px] font-mono text-zinc-400 truncate">
                                                        {traceId}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
