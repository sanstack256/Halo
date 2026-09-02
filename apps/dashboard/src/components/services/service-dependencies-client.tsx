"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Network,
    Database,
    HardDrive,
    Server,
    ExternalLink,
    Search,
    Filter,
    Layers,
    ArrowRight,
    ArrowUpRight,
    Sparkles,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    HelpCircle,
    Cpu,
    Calendar,
} from "lucide-react";
import type {
    ServiceDependencyNode,
    ServiceDependencyEdge,
    HealthStatus,
} from "@/lib/services/service-registry";

interface ServiceDependenciesClientProps {
    initialNodes: ServiceDependencyNode[];
    initialEdges: ServiceDependencyEdge[];
    timeRangeKey: string;
    environments: string[];
}

export function ServiceDependenciesClient({
    initialNodes,
    initialEdges,
    timeRangeKey,
    environments,
}: ServiceDependenciesClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
    const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
    const [selectedEnv, setSelectedEnv] = useState(searchParams.get("environment") || "ALL");
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>(timeRangeKey || "24h");
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
        initialNodes.length > 0 ? initialNodes[0].id : null
    );

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || !value) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.replace(`/services/dependencies?${params.toString()}`);
    };

    // Node classification counts
    const internalServicesCount = useMemo(() => initialNodes.filter((n) => !n.isExternal).length, [initialNodes]);
    const externalResourcesCount = useMemo(() => initialNodes.filter((n) => n.isExternal).length, [initialNodes]);

    const filteredNodes = useMemo(() => {
        return initialNodes.filter((n) => {
            if (selectedEnv !== "ALL" && n.environment.toLowerCase() !== selectedEnv.toLowerCase()) return false;
            if (selectedType === "services_only" && n.isExternal) return false;
            if (selectedType === "external_only" && !n.isExternal) return false;
            if (selectedType !== "ALL" && selectedType !== "services_only" && selectedType !== "external_only" && n.type !== selectedType) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                return n.name.toLowerCase().includes(q) || n.type.toLowerCase().includes(q);
            }
            return true;
        });
    }, [initialNodes, selectedEnv, selectedType, searchQuery]);

    const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

    const filteredEdges = useMemo(() => {
        return initialEdges.filter(
            (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
        );
    }, [initialEdges, filteredNodeIds]);

    const selectedNode = useMemo(() => {
        return initialNodes.find((n) => n.id === selectedNodeId) || filteredNodes[0] || null;
    }, [initialNodes, filteredNodes, selectedNodeId]);

    const selectedNodeIncoming = useMemo(() => {
        if (!selectedNode) return [];
        return initialEdges.filter((e) => e.target.toLowerCase() === selectedNode.name.toLowerCase());
    }, [initialEdges, selectedNode]);

    const selectedNodeOutgoing = useMemo(() => {
        if (!selectedNode) return [];
        return initialEdges.filter((e) => e.source.toLowerCase() === selectedNode.name.toLowerCase());
    }, [initialEdges, selectedNode]);

    const getTypeIcon = (type: ServiceDependencyNode["type"]) => {
        switch (type) {
            case "database":
                return <Database size={13} className="text-emerald-400" />;
            case "cache":
                return <HardDrive size={13} className="text-amber-400" />;
            case "queue":
                return <Cpu size={13} className="text-purple-400" />;
            case "external_api":
                return <ExternalLink size={13} className="text-blue-400" />;
            case "service":
            default:
                return <Server size={13} className="text-accent" />;
        }
    };

    const getHealthBadge = (health: HealthStatus) => {
        switch (health) {
            case "Healthy":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Healthy
                    </span>
                );
            case "Degraded":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Degraded
                    </span>
                );
            case "Critical":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Critical
                    </span>
                );
            case "Unknown":
            default:
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        Unknown
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Dependencies</h1>
                    <p className="text-sm text-secondary mt-1">
                        Service-to-service calls and external resource topologies derived from distributed traces.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Time Range Selector */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-mono">
                        <Calendar size={13} className="text-muted" />
                        <span className="text-zinc-400">Window:</span>
                        <select
                            value={selectedTimeRange}
                            onChange={(e) => {
                                setSelectedTimeRange(e.target.value);
                                updateFilter("timeRange", e.target.value);
                            }}
                            className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                        >
                            <option value="1h" className="bg-[#0b1018]">Last 1 hour</option>
                            <option value="6h" className="bg-[#0b1018]">Last 6 hours</option>
                            <option value="24h" className="bg-[#0b1018]">Last 24 hours</option>
                            <option value="7d" className="bg-[#0b1018]">Last 7 days</option>
                            <option value="30d" className="bg-[#0b1018]">Last 30 days</option>
                        </select>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="inline-flex p-1 rounded-xl bg-surface border border-border">
                        <button
                            onClick={() => setViewMode("graph")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                viewMode === "graph"
                                    ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                    : "text-zinc-400 hover:text-white"
                            }`}
                        >
                            Graph View
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                                viewMode === "table"
                                    ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                    : "text-zinc-400 hover:text-white"
                            }`}
                        >
                            Table View
                        </button>
                    </div>
                </div>
            </div>

            {/* Topology Taxonomy Strip */}
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-surface/60 border border-border px-4 py-2.5 rounded-xl">
                <span className="text-white font-semibold">{internalServicesCount}</span>
                <span>Internal Services</span>
                <span>•</span>
                <span className="text-white font-semibold">{externalResourcesCount}</span>
                <span>External Resources</span>
                <span>•</span>
                <span className="text-accent font-semibold">{initialEdges.length}</span>
                <span>Observed Call Relationships</span>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search service or dependency node..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-zinc-300 focus:outline-none focus:border-accent font-mono"
                    >
                        <option value="ALL">All Nodes ({initialNodes.length})</option>
                        <option value="services_only">Internal Services ({internalServicesCount})</option>
                        <option value="external_only">External Resources ({externalResourcesCount})</option>
                        <option value="database">Databases</option>
                        <option value="cache">Caches</option>
                        <option value="queue">Queues</option>
                        <option value="external_api">External APIs</option>
                    </select>

                    <select
                        value={selectedEnv}
                        onChange={(e) => {
                            setSelectedEnv(e.target.value);
                            updateFilter("environment", e.target.value);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-zinc-300 focus:outline-none focus:border-accent font-mono"
                    >
                        <option value="ALL">All Environments</option>
                        {environments.map((env) => (
                            <option key={env} value={env}>
                                {env}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {initialNodes.length === 0 ? (
                <div className="p-12 rounded-2xl bg-surface border border-border text-center space-y-3">
                    <Network className="w-10 h-10 text-muted mx-auto" />
                    <h3 className="text-base font-semibold text-white">No services discovered</h3>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        Dependency relationships are automatically discovered as distributed traces and downstream database/API calls are recorded by the Halo SDK.
                    </p>
                </div>
            ) : viewMode === "graph" ? (
                /* Interactive Graph & Side Panel */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SVG Graph Canvas */}
                    <div className="lg:col-span-2 p-6 rounded-2xl bg-[#080c12] border border-border min-h-[500px] flex flex-col justify-between relative overflow-hidden">
                        <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-border/60 pb-3">
                            <span>Observed Dependency Topology ({selectedTimeRange})</span>
                            <span>{filteredNodes.length} nodes • {filteredEdges.length} edges</span>
                        </div>

                        {/* If no edges in selected window */}
                        {filteredEdges.length === 0 && (
                            <div className="my-auto p-6 rounded-xl bg-surface/80 border border-border text-center space-y-2">
                                <Network className="w-6 h-6 text-muted mx-auto" />
                                <p className="text-xs font-mono text-zinc-300">
                                    No trace calls observed in the last {selectedTimeRange === "24h" ? "24 hours" : selectedTimeRange}.
                                </p>
                                <p className="text-[11px] text-secondary">
                                    Switch to a larger window (e.g. 7 days or 30 days) to view observed dependency topology.
                                </p>
                                <button
                                    onClick={() => {
                                        setSelectedTimeRange("30d");
                                        updateFilter("timeRange", "30d");
                                    }}
                                    className="halo-btn halo-btn-secondary halo-btn-xs inline-flex mt-2"
                                >
                                    <span>Switch to 30d window</span>
                                </button>
                            </div>
                        )}

                        {/* Visual Nodes Grid */}
                        {filteredEdges.length > 0 && (
                            <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {filteredNodes.map((node) => {
                                    const isSelected = selectedNode?.id === node.id;
                                    const isCritical = node.health === "Critical";
                                    const isDegraded = node.health === "Degraded";

                                    return (
                                        <div
                                            key={node.id}
                                            onClick={() => setSelectedNodeId(node.id)}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                                                isSelected
                                                    ? "bg-surface-elevated border-accent shadow-md ring-1 ring-accent/30"
                                                    : isCritical
                                                    ? "bg-red-500/5 border-red-500/30 hover:border-red-500/50"
                                                    : isDegraded
                                                    ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                                                    : "bg-surface border-border hover:border-border-strong"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(node.type)}
                                                    <span className="font-bold text-white font-mono text-xs truncate">
                                                        {node.name}
                                                    </span>
                                                </div>
                                                {getHealthBadge(node.health)}
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-border/50">
                                                <span>
                                                    In: <strong className="text-zinc-200">{node.incomingCount}</strong> | Out: <strong className="text-zinc-200">{node.outgoingCount}</strong>
                                                </span>
                                                {node.errorRate !== null ? (
                                                    <span className={node.errorRate >= 5 ? "text-amber-400 font-semibold" : "text-zinc-300"}>
                                                        {node.errorRate}% err
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-600">—</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="text-[11px] font-mono text-zinc-500 pt-2 border-t border-border/60">
                            Click any node to inspect blast radius, incoming callers, and outgoing dependencies.
                        </div>
                    </div>

                    {/* Side Panel: Blast Radius & Node Context */}
                    <div className="p-6 rounded-2xl bg-surface border border-border space-y-5">
                        {selectedNode ? (
                            <>
                                <div className="space-y-2 border-b border-border pb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400 font-semibold">
                                            {selectedNode.isExternal ? `External ${selectedNode.type}` : "Internal Service"} Node
                                        </span>
                                        {getHealthBadge(selectedNode.health)}
                                    </div>
                                    <h3 className="text-lg font-bold text-white font-mono truncate">
                                        {selectedNode.name}
                                    </h3>
                                    <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                                        <span>Owner: {selectedNode.owner}</span>
                                        <span>•</span>
                                        <span>{selectedNode.environment}</span>
                                    </div>
                                </div>

                                {/* Node Health & Metrics (Zero vs No Data) */}
                                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                    <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                        <span className="text-[10px] text-zinc-500 uppercase block">Volume</span>
                                        <span className="text-sm font-bold text-white block mt-0.5">
                                            {selectedNode.requestVolume > 0 ? selectedNode.requestVolume.toLocaleString() : "No data"}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                        <span className="text-[10px] text-zinc-500 uppercase block">Error Rate</span>
                                        <span className="text-sm font-bold text-white block mt-0.5">
                                            {selectedNode.errorRate !== null ? `${selectedNode.errorRate.toFixed(1)}%` : "—"}
                                        </span>
                                    </div>
                                </div>

                                {/* Incoming Callers (Upstream) */}
                                <div className="space-y-2">
                                    <div className="text-xs font-mono font-semibold text-zinc-300 flex items-center justify-between">
                                        <span>Called By / Upstream ({selectedNodeIncoming.length})</span>
                                        <span className="text-[10px] text-zinc-500">Callers</span>
                                    </div>
                                    {selectedNodeIncoming.length === 0 ? (
                                        <div className="p-2.5 rounded-lg bg-surface-elevated text-xs font-mono text-zinc-500">
                                            No upstream callers observed in traces
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {selectedNodeIncoming.map((edge) => (
                                                <div
                                                    key={`${edge.source}->${edge.target}`}
                                                    className="p-2 rounded-lg bg-surface-elevated border border-border/80 text-xs font-mono flex items-center justify-between"
                                                >
                                                    <span className="text-white font-semibold truncate">
                                                        {edge.source}
                                                    </span>
                                                    <span className="text-zinc-400 text-[11px]">
                                                        {edge.callCount} calls ({edge.evidenceSource.replace("_", " ")})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Outgoing Dependencies (Downstream) */}
                                <div className="space-y-2">
                                    <div className="text-xs font-mono font-semibold text-zinc-300 flex items-center justify-between">
                                        <span>Depends On / Downstream ({selectedNodeOutgoing.length})</span>
                                        <span className="text-[10px] text-zinc-500">Targets</span>
                                    </div>
                                    {selectedNodeOutgoing.length === 0 ? (
                                        <div className="p-2.5 rounded-lg bg-surface-elevated text-xs font-mono text-zinc-500">
                                            No downstream targets observed in traces
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {selectedNodeOutgoing.map((edge) => (
                                                <div
                                                    key={`${edge.source}->${edge.target}`}
                                                    className="p-2 rounded-lg bg-surface-elevated border border-border/80 text-xs font-mono flex items-center justify-between"
                                                >
                                                    <span className="text-white font-semibold truncate">
                                                        {edge.target}
                                                    </span>
                                                    <span className="text-zinc-400 text-[11px]">
                                                        {edge.relationship} ({edge.callCount} calls)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pt-3 border-t border-border space-y-2">
                                    {!selectedNode.isExternal && (
                                        <Link
                                            href={`/services/${encodeURIComponent(selectedNode.name)}`}
                                            className="halo-btn halo-btn-primary w-full justify-center text-xs"
                                        >
                                            <Server size={12} />
                                            <span>Open Service Detail</span>
                                        </Link>
                                    )}
                                    <Link
                                        href={`/explore?service=${encodeURIComponent(selectedNode.name)}`}
                                        className="halo-btn halo-btn-secondary w-full justify-center text-xs"
                                    >
                                        <ExternalLink size={12} />
                                        <span>Explore Telemetry</span>
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <div className="p-8 text-center text-xs font-mono text-zinc-500">
                                Select a node to view dependency details
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Accessible Dense Table View (Exact Parity with Graph) */
                <div className="halo-table rounded-xl overflow-hidden border border-border">
                    <div className="halo-table-header grid-cols-[1.5fr_1.5fr_100px_100px_90px_100px_120px] px-4 py-3 bg-[#080c12] text-[11px] font-mono font-semibold text-zinc-400 border-b border-border">
                        <div>Source Service (Caller)</div>
                        <div>Target Dependency (Callee)</div>
                        <div>Relationship</div>
                        <div className="text-right">Call Volume</div>
                        <div className="text-right">Error Rate</div>
                        <div className="text-right">p95 Latency</div>
                        <div className="text-right">Action</div>
                    </div>

                    {filteredEdges.length === 0 ? (
                        <div className="p-12 text-center text-xs font-mono text-zinc-500">
                            No dependency edges observed in the current window ({selectedTimeRange}).
                        </div>
                    ) : (
                        <div className="divide-y divide-border/60">
                            {filteredEdges.map((edge) => (
                                <div
                                    key={`${edge.source}->${edge.target}`}
                                    className="halo-table-row grid-cols-[1.5fr_1.5fr_100px_100px_90px_100px_120px] px-4 py-3 items-center hover:bg-surface-elevated transition-colors text-xs font-mono"
                                >
                                    <div className="text-white font-semibold truncate">{edge.source}</div>
                                    <div className="text-accent truncate flex items-center gap-1.5">
                                        <ArrowRight size={11} className="text-muted" />
                                        <span>{edge.target}</span>
                                    </div>
                                    <div className="text-zinc-400 text-[11px]">{edge.relationship}</div>
                                    <div className="text-right text-zinc-200">{edge.callCount.toLocaleString()}</div>
                                    <div className="text-right">
                                        {edge.errorRate !== null ? (
                                            <span className={edge.errorRate >= 5 ? "text-amber-400 font-semibold" : "text-zinc-300"}>
                                                {edge.errorRate.toFixed(1)}%
                                            </span>
                                        ) : (
                                            <span className="text-zinc-600">—</span>
                                        )}
                                    </div>
                                    <div className="text-right text-zinc-300">
                                        {edge.p95LatencyMs !== null ? `${edge.p95LatencyMs}ms` : "—"}
                                    </div>
                                    <div className="text-right">
                                        <Link
                                            href={`/services/${encodeURIComponent(edge.source)}`}
                                            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                                        >
                                            <span>View</span>
                                            <ArrowUpRight size={11} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
