"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
    Activity,
    ArrowRight,
    CheckCircle2,
    Clock,
    Database,
    Filter,
    Globe,
    Info,
    Layers,
    Maximize2,
    Minus,
    Network,
    Plus,
    Radio,
    RotateCcw,
    Search,
    Server,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";
import type { DependencyNode, DependencyEdge, BlastRadiusResult, CriticalPathItem } from "@/lib/analytics/types";
import { computeBlastRadius } from "@/lib/analytics/blast-radius";
import { BlastRadiusPanel } from "./blast-radius-panel";

interface DependencyTopologyGraphProps {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    criticalPaths?: CriticalPathItem[];
    observedCallTotal: number;
    projectId?: string;
}

export function DependencyTopologyGraph({
    nodes,
    edges,
    criticalPaths = [],
    observedCallTotal,
    projectId,
}: DependencyTopologyGraphProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState<"ALL" | "SERVICES" | "DATABASES" | "ERRORS" | "CRITICAL_PATHS">("ALL");
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const filteredNodes = useMemo(() => {
        if (filterCategory === "SERVICES") {
            return nodes.filter((n) => n.type === "SERVICE");
        }
        if (filterCategory === "DATABASES") {
            return nodes.filter((n) => n.type === "DATABASE" || n.type === "EXTERNAL");
        }
        if (filterCategory === "ERRORS") {
            return nodes.filter((n) => n.errorRate > 0);
        }
        if (filterCategory === "CRITICAL_PATHS" && criticalPaths.length > 0) {
            const criticalNodeNames = new Set(criticalPaths.flatMap((p) => p.nodes));
            return nodes.filter((n) => criticalNodeNames.has(n.name));
        }
        return nodes;
    }, [nodes, filterCategory, criticalPaths]);

    const activeNodeNames = useMemo(() => new Set(filteredNodes.map((n) => n.name)), [filteredNodes]);

    const filteredEdges = useMemo(() => {
        return edges.filter((e) => activeNodeNames.has(e.source) && activeNodeNames.has(e.target));
    }, [edges, activeNodeNames]);

    const blastRadius: BlastRadiusResult | null = useMemo(() => {
        if (!selectedNodeId) return null;
        return computeBlastRadius(selectedNodeId, nodes, edges);
    }, [selectedNodeId, nodes, edges]);

    const selectedNode = nodes.find((n) => n.name === selectedNodeId || n.id === selectedNodeId);
    const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPanOffset({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y,
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleFitToView = () => {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    if (nodes.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Network size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Observed Dependency Topology
                    </h3>
                </div>
                <div className="h-44 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={22} className="text-muted mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium font-sans">No dependency relationships observed</p>
                    <p className="text-[11px] text-muted mt-0.5 max-w-sm font-sans">
                        As distributed traces and cross-service calls are ingested, Halo will reconstruct the real live topology graph here without speculative edges.
                    </p>
                </div>
            </div>
        );
    }

    // Node dimension tokens
    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 48;

    // ViewBox dimensions
    const baseWidth = 880;
    const baseHeight = 440;

    return (
        <div className="space-y-4 font-mono text-xs">
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                {/* Header & Graph Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <Network size={14} className="text-accent" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Observed Dependency Topology
                        </h3>
                        <span className="text-[10px] text-muted">
                            ({filteredNodes.length} nodes · {filteredEdges.length} evidence edges)
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Filter Tabs */}
                        <div className="flex items-center bg-[#080b11] p-0.5 rounded-lg border border-border text-[11px]">
                            <button
                                type="button"
                                onClick={() => setFilterCategory("ALL")}
                                className={`px-2 py-1 rounded-md transition-colors ${
                                    filterCategory === "ALL" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-white"
                                }`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterCategory("SERVICES")}
                                className={`px-2 py-1 rounded-md transition-colors ${
                                    filterCategory === "SERVICES" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-white"
                                }`}
                            >
                                Services
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterCategory("DATABASES")}
                                className={`px-2 py-1 rounded-md transition-colors ${
                                    filterCategory === "DATABASES" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-white"
                                }`}
                            >
                                Databases
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterCategory("ERRORS")}
                                className={`px-2 py-1 rounded-md transition-colors ${
                                    filterCategory === "ERRORS" ? "bg-red-500/20 text-red-400 font-semibold" : "text-muted hover:text-white"
                                }`}
                            >
                                Error Paths
                            </button>
                        </div>

                        {/* Zoom / Pan Controls */}
                        <div className="flex items-center gap-1 bg-[#080b11] p-1 rounded-lg border border-border">
                            <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
                                className="p-1 rounded text-muted hover:text-white"
                                title="Zoom In"
                            >
                                <Plus size={13} />
                            </button>
                            <span className="text-[10px] text-muted px-1">{Math.round(zoomLevel * 100)}%</span>
                            <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
                                className="p-1 rounded text-muted hover:text-white"
                                title="Zoom Out"
                            >
                                <Minus size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={handleFitToView}
                                className="p-1 rounded text-muted hover:text-white ml-1 border-l border-border"
                                title="Fit to View"
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SVG Topology Canvas with Dynamic Positioning & Zoom/Pan */}
                <div
                    className="relative w-full h-96 overflow-hidden bg-[#06080d] rounded-xl border border-border/60 cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <svg
                        viewBox={`0 0 ${baseWidth} ${baseHeight}`}
                        className="w-full h-full"
                    >
                        <defs>
                            <marker
                                id="arrow-default"
                                viewBox="0 0 10 10"
                                refX="18"
                                refY="5"
                                markerWidth="5"
                                markerHeight="5"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#4b5563" />
                            </marker>
                            <marker
                                id="arrow-error"
                                viewBox="0 0 10 10"
                                refX="18"
                                refY="5"
                                markerWidth="5"
                                markerHeight="5"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                            </marker>
                            <marker
                                id="arrow-selected"
                                viewBox="0 0 10 10"
                                refX="18"
                                refY="5"
                                markerWidth="5"
                                markerHeight="5"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#5bb8ff" />
                            </marker>
                        </defs>

                        {/* Transform Group for Zoom and Pan */}
                        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                            {/* Directed Edges */}
                            {filteredEdges.map((e) => {
                                const srcNode = nodes.find((n) => n.name === e.source);
                                const dstNode = nodes.find((n) => n.name === e.target);

                                const x1 = (srcNode?.x || 100) + NODE_WIDTH / 2;
                                const y1 = srcNode?.y || 100;
                                const x2 = (dstNode?.x || 400) - NODE_WIDTH / 2;
                                const y2 = dstNode?.y || 100;

                                const isSelected = selectedEdgeId === e.id;
                                const isError = e.errorRate > 0;
                                const markerId = isSelected ? "arrow-selected" : isError ? "arrow-error" : "arrow-default";

                                const dx = Math.abs(x2 - x1) * 0.5;
                                const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                                return (
                                    <g
                                        key={e.id}
                                        onClick={(evt) => {
                                            evt.stopPropagation();
                                            setSelectedEdgeId(e.id);
                                            setSelectedNodeId(null);
                                        }}
                                        className="cursor-pointer group"
                                    >
                                        <path d={pathData} fill="none" stroke="transparent" strokeWidth="14" />
                                        <path
                                            d={pathData}
                                            fill="none"
                                            stroke={
                                                isSelected
                                                    ? "#5bb8ff"
                                                    : isError
                                                    ? "rgba(239,68,68,0.7)"
                                                    : e.isCriticalPath
                                                    ? "#fbbf24"
                                                    : "rgba(255,255,255,0.18)"
                                            }
                                            strokeWidth={isSelected ? 2.5 : e.isCriticalPath ? 2 : 1.5}
                                            strokeDasharray={e.evidence.type === "SERVICE_METADATA" ? "4 4" : undefined}
                                            markerEnd={`url(#${markerId})`}
                                        />
                                    </g>
                                );
                            })}

                            {/* Collision-Free Nodes */}
                            {filteredNodes.map((n) => {
                                const x = (n.x || 100) - NODE_WIDTH / 2;
                                const y = (n.y || 100) - NODE_HEIGHT / 2;
                                const isSelected = selectedNodeId === n.name;

                                // Blast radius status check
                                const isDirect = blastRadius?.directlyAffected.some((x) => x.id === n.id);
                                const isObservedProp = blastRadius?.observedPropagation.some((x) => x.id === n.id);
                                const isPotentialExp = blastRadius?.potentialExposure.some((x) => x.id === n.id);

                                let strokeColor = "rgba(255,255,255,0.15)";
                                let glowColor = "transparent";

                                if (isSelected || isDirect) {
                                    strokeColor = "#5bb8ff";
                                    glowColor = "rgba(91,184,255,0.25)";
                                } else if (isObservedProp) {
                                    strokeColor = "#ef4444";
                                    glowColor = "rgba(239,68,68,0.25)";
                                } else if (isPotentialExp) {
                                    strokeColor = "#f59e0b";
                                    glowColor = "rgba(245,158,11,0.2)";
                                } else if (n.health === "Critical") {
                                    strokeColor = "#ef4444";
                                } else if (n.health === "Degraded") {
                                    strokeColor = "#f59e0b";
                                } else if (n.health === "Healthy") {
                                    strokeColor = "rgba(34,197,94,0.4)";
                                }

                                return (
                                    <g
                                        key={n.id}
                                        transform={`translate(${x}, ${y})`}
                                        onClick={(evt) => {
                                            evt.stopPropagation();
                                            setSelectedNodeId(n.name === selectedNodeId ? null : n.name);
                                            setSelectedEdgeId(null);
                                        }}
                                        className="cursor-pointer group"
                                    >
                                        <rect
                                            width={NODE_WIDTH}
                                            height={NODE_HEIGHT}
                                            rx={10}
                                            fill="#080c12"
                                            stroke={strokeColor}
                                            strokeWidth={isSelected ? 2 : 1}
                                            style={{ filter: glowColor !== "transparent" ? `drop-shadow(0 0 10px ${glowColor})` : undefined }}
                                        />

                                        {/* Label */}
                                        <text
                                            x={12}
                                            y={21}
                                            fill="#ffffff"
                                            fontSize="11"
                                            fontFamily="monospace"
                                            fontWeight="600"
                                        >
                                            {n.name.length > 15 ? `${n.name.slice(0, 13)}…` : n.name}
                                        </text>

                                        {/* Telemetry metrics */}
                                        <text
                                            x={12}
                                            y={35}
                                            fill="#6d7b8c"
                                            fontSize="9.5"
                                            fontFamily="monospace"
                                        >
                                            {n.totalCalls} reqs · {n.errorRate}% err
                                        </text>

                                        {/* Status Dot */}
                                        <circle
                                            cx={NODE_WIDTH - 14}
                                            cy={16}
                                            r={3.5}
                                            fill={
                                                n.health === "Healthy"
                                                    ? "#22c55e"
                                                    : n.health === "Degraded"
                                                    ? "#f59e0b"
                                                    : n.health === "Critical"
                                                    ? "#ef4444"
                                                    : "#6d7b8c"
                                            }
                                        />
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                </div>

                {/* Node Detail Inspector */}
                {selectedNode && (
                    <div className="p-4 rounded-xl bg-surface border border-accent/40 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                            <div className="flex items-center gap-2">
                                <Server size={14} className="text-accent" />
                                <span className="font-bold text-white text-sm">{selectedNode.name}</span>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                        selectedNode.health === "Healthy"
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                            : selectedNode.health === "Degraded"
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                            : "bg-red-500/10 border-red-500/20 text-red-400"
                                    }`}
                                >
                                    {selectedNode.health}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/projects/${projectId || "current"}/investigations/new?service=${selectedNode.name}`}
                                    className="halo-btn halo-btn-primary halo-btn-xs"
                                >
                                    <Sparkles size={11} />
                                    <span>Analyze Node</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setSelectedNodeId(null)}
                                    className="text-muted hover:text-white"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                            <div>
                                <span className="text-muted block text-[10px]">Error Rate</span>
                                <span className="font-bold text-white">{selectedNode.errorRate}%</span>
                            </div>
                            <div>
                                <span className="text-muted block text-[10px]">Call Volume</span>
                                <span className="font-bold text-white">{selectedNode.totalCalls} calls</span>
                            </div>
                            <div>
                                <span className="text-muted block text-[10px]">Avg Latency</span>
                                <span className="font-bold text-white">{selectedNode.avgLatencyMs ? `${selectedNode.avgLatencyMs}ms` : "-"}</span>
                            </div>
                            <div>
                                <span className="text-muted block text-[10px]">Active Issues</span>
                                <span className="font-bold text-white">{selectedNode.recentIssueCount}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edge Evidence & Provenance Inspector */}
                {selectedEdge && (
                    <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-semibold">
                                <Info size={14} className="text-accent" />
                                <span>
                                    Observed Link Evidence: {selectedEdge.source} &rarr; {selectedEdge.target}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEdgeId(null)}
                                className="text-muted hover:text-white"
                            >
                                Close &times;
                            </button>
                        </div>
                        <p className="text-zinc-300 text-[11px] font-sans">
                            {selectedEdge.evidence.description}
                        </p>
                        <div className="flex items-center gap-4 text-[11px] text-muted pt-1">
                            <span>Total Calls: {selectedEdge.callCount}</span>
                            <span>·</span>
                            <span>Errors: {selectedEdge.errorCount} ({selectedEdge.errorRate}%)</span>
                            <span>·</span>
                            <span>
                                Avg Latency: {selectedEdge.avgLatencyMs ? `${selectedEdge.avgLatencyMs}ms` : "N/A"}
                            </span>
                            {selectedEdge.p95LatencyMs && (
                                <>
                                    <span>·</span>
                                    <span>P95: {selectedEdge.p95LatencyMs}ms</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Blast Radius Analysis Panel */}
            {blastRadius && (
                <BlastRadiusPanel
                    blastRadius={blastRadius}
                    projectId={projectId}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}
        </div>
    );
}
