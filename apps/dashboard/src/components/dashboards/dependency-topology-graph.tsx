"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
    Activity,
    Clock,
    Database,
    Globe,
    Info,
    Layers,
    Maximize2,
    Minus,
    Network,
    Plus,
    RotateCcw,
    Server,
    ShieldAlert,
    Sparkles,
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
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState<"ALL" | "SERVICES" | "DATABASES" | "ERRORS">("ALL");
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
        return nodes;
    }, [nodes, filterCategory]);

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

    // Connected neighbors set when a node is selected or hovered
    const activeTarget = selectedNodeId || hoveredNodeId;
    const connectedEdges = useMemo(() => {
        if (!activeTarget) return new Set<string>();
        return new Set(
            filteredEdges
                .filter((e) => e.source === activeTarget || e.target === activeTarget)
                .map((e) => e.id)
        );
    }, [activeTarget, filteredEdges]);

    const connectedNodes = useMemo(() => {
        if (!activeTarget) return new Set<string>();
        const set = new Set<string>([activeTarget]);
        filteredEdges.forEach((e) => {
            if (e.source === activeTarget) set.add(e.target);
            if (e.target === activeTarget) set.add(e.source);
        });
        return set;
    }, [activeTarget, filteredEdges]);

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
            <div className="halo-panel">
                <div className="halo-panel-header">
                    <div className="halo-panel-title-group">
                        <Network size={15} className="text-accent" />
                        <h3 className="halo-panel-title">Observed Dependency Topology</h3>
                    </div>
                </div>
                <div className="h-56 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-8">
                    <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent mb-3">
                        <Network size={22} />
                    </div>
                    <p className="text-sm text-text font-semibold">No dependency relationships observed</p>
                    <p className="text-xs text-text-muted mt-1 max-w-md leading-relaxed">
                        As distributed traces and cross-service calls are ingested, Halo dynamically reconstructs the real topology graph without synthetic or speculative edges.
                    </p>
                </div>
            </div>
        );
    }

    // Canvas layout dimensions
    const isSingleNode = filteredNodes.length === 1;
    const NODE_WIDTH = isSingleNode ? 190 : 160;
    const NODE_HEIGHT = isSingleNode ? 60 : 52;
    const baseWidth = 960;
    const baseHeight = 440;

    return (
        <div className="space-y-4">
            <div className="halo-panel">
                {/* Header & Graph Controls */}
                <div className="halo-panel-header">
                    <div className="halo-panel-title-group">
                        <Network size={15} className="text-accent" />
                        <div>
                            <h3 className="halo-panel-title">Observed Dependency Topology</h3>
                            <span className="halo-panel-subtitle">
                                {filteredNodes.length} {filteredNodes.length === 1 ? "service node" : "service nodes"} · {filteredEdges.length} evidence {filteredEdges.length === 1 ? "link" : "links"} · {observedCallTotal.toLocaleString()} calls
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filter Tabs */}
                        <div className="halo-segment-control">
                            <button
                                type="button"
                                onClick={() => setFilterCategory("ALL")}
                                className={`halo-segment-btn ${filterCategory === "ALL" ? "is-active" : ""}`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterCategory("SERVICES")}
                                className={`halo-segment-btn ${filterCategory === "SERVICES" ? "is-active" : ""}`}
                            >
                                Services
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterCategory("DATABASES")}
                                className={`halo-segment-btn ${filterCategory === "DATABASES" ? "is-active" : ""}`}
                            >
                                Databases
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterCategory("ERRORS")}
                                className={`halo-segment-btn ${filterCategory === "ERRORS" ? "is-active-error" : ""}`}
                            >
                                Error Paths
                            </button>
                        </div>

                        {/* Zoom / Pan / Reset Controls Toolbar */}
                        <div className="halo-topology-toolbar">
                            <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
                                className="halo-topology-btn"
                                title="Zoom In"
                            >
                                <Plus size={13} />
                            </button>
                            <span className="text-[10px] font-mono text-text-muted px-1.5 select-none font-semibold">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
                                className="halo-topology-btn"
                                title="Zoom Out"
                            >
                                <Minus size={13} />
                            </button>
                            <div className="w-[1px] h-3.5 bg-border mx-0.5" />
                            <button
                                type="button"
                                onClick={handleFitToView}
                                className="halo-topology-btn"
                                title="Fit / Center View"
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SVG Topology Canvas Surface */}
                <div
                    className="halo-topology-surface cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Canvas Dot Grid Background */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)",
                            backgroundSize: "24px 24px",
                        }}
                    />

                    {/* Single Node Contextual Note */}
                    {isSingleNode && filteredEdges.length === 0 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#080c14]/90 border border-border px-4 py-2 rounded-full text-xs text-text-secondary flex items-center gap-2 pointer-events-none z-10 backdrop-blur-md shadow-xl">
                            <Info size={13} className="text-accent" />
                            <span>No observed dependency connections in the selected scope</span>
                        </div>
                    )}

                    <svg
                        viewBox={`0 0 ${baseWidth} ${baseHeight}`}
                        className="w-full h-full min-h-[440px] block"
                    >
                        <defs>
                            <marker
                                id="topo-arrow-default"
                                viewBox="0 0 10 10"
                                refX="16"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(255,255,255,0.3)" />
                            </marker>
                            <marker
                                id="topo-arrow-error"
                                viewBox="0 0 10 10"
                                refX="16"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
                            </marker>
                            <marker
                                id="topo-arrow-selected"
                                viewBox="0 0 10 10"
                                refX="16"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#5bb8ff" />
                            </marker>
                        </defs>

                        {/* Transform Group for Zoom and Pan */}
                        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                            {/* Directed Edges */}
                            {filteredEdges.map((e) => {
                                const srcNode = nodes.find((n) => n.name === e.source);
                                const dstNode = nodes.find((n) => n.name === e.target);

                                const x1 = (srcNode?.x || 120) + NODE_WIDTH / 2;
                                const y1 = srcNode?.y || 120;
                                const x2 = (dstNode?.x || 500) - NODE_WIDTH / 2;
                                const y2 = dstNode?.y || 120;

                                const isSelected = selectedEdgeId === e.id;
                                const isConnected = connectedEdges.has(e.id);
                                const isDimmed = activeTarget !== null && !isConnected && !isSelected;
                                const isError = e.errorRate > 0;

                                const markerId = isSelected
                                    ? "topo-arrow-selected"
                                    : isError
                                    ? "topo-arrow-error"
                                    : "topo-arrow-default";

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
                                        onMouseEnter={() => setHoveredEdgeId(e.id)}
                                        onMouseLeave={() => setHoveredEdgeId(null)}
                                        opacity={isDimmed ? 0.15 : 1}
                                        className="cursor-pointer transition-opacity duration-200"
                                    >
                                        {/* Wider invisible stroke for easier hover / clicking */}
                                        <path d={pathData} fill="none" stroke="transparent" strokeWidth="18" />
                                        <path
                                            d={pathData}
                                            fill="none"
                                            stroke={
                                                isSelected || isConnected
                                                    ? "#5bb8ff"
                                                    : isError
                                                    ? "rgba(239,68,68,0.8)"
                                                    : e.isCriticalPath
                                                    ? "#f59e0b"
                                                    : "rgba(255,255,255,0.22)"
                                            }
                                            strokeWidth={isSelected || isConnected ? 2.5 : e.isCriticalPath ? 2 : 1.5}
                                            strokeDasharray={e.evidence.type === "SERVICE_METADATA" ? "4 4" : undefined}
                                            markerEnd={`url(#${markerId})`}
                                        />
                                    </g>
                                );
                            })}

                            {/* Collision-Free Nodes */}
                            {filteredNodes.map((n) => {
                                // For single node scenario, center precisely in canvas
                                const x = isSingleNode ? (baseWidth - NODE_WIDTH) / 2 : (n.x || 120) - NODE_WIDTH / 2;
                                const y = isSingleNode ? (baseHeight - NODE_HEIGHT) / 2 : (n.y || 120) - NODE_HEIGHT / 2;

                                const isSelected = selectedNodeId === n.name;
                                const isHovered = hoveredNodeId === n.name;
                                const isConnected = connectedNodes.has(n.name);
                                const isDimmed = activeTarget !== null && !isConnected && !isSelected;

                                // Blast radius status check
                                const isDirect = blastRadius?.directlyAffected.some((x) => x.id === n.id);
                                const isObservedProp = blastRadius?.observedPropagation.some((x) => x.id === n.id);
                                const isPotentialExp = blastRadius?.potentialExposure.some((x) => x.id === n.id);

                                let strokeColor = "rgba(255,255,255,0.15)";
                                let fillColor = "#080c14";

                                if (isSelected || isDirect) {
                                    strokeColor = "#5bb8ff";
                                    fillColor = "#0b1424";
                                } else if (isObservedProp) {
                                    strokeColor = "#ef4444";
                                    fillColor = "#1a0c0e";
                                } else if (isPotentialExp) {
                                    strokeColor = "#f59e0b";
                                    fillColor = "#1a1208";
                                } else if (n.health === "Critical") {
                                    strokeColor = "#ef4444";
                                } else if (n.health === "Degraded") {
                                    strokeColor = "#f59e0b";
                                } else if (n.health === "Healthy") {
                                    strokeColor = "rgba(34,197,94,0.45)";
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
                                        onMouseEnter={() => setHoveredNodeId(n.name)}
                                        onMouseLeave={() => setHoveredNodeId(null)}
                                        opacity={isDimmed ? 0.2 : 1}
                                        className="cursor-pointer transition-opacity duration-200"
                                    >
                                        <rect
                                            width={NODE_WIDTH}
                                            height={NODE_HEIGHT}
                                            rx={10}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={isSelected || isHovered ? 2 : 1}
                                            className="transition-colors"
                                        />

                                        {/* Service Icon Box */}
                                        <rect
                                            x={10}
                                            y={10}
                                            width={30}
                                            height={30}
                                            rx={7}
                                            fill={n.type === "DATABASE" ? "rgba(245,158,11,0.12)" : "rgba(91,184,255,0.12)"}
                                            stroke={n.type === "DATABASE" ? "rgba(245,158,11,0.25)" : "rgba(91,184,255,0.25)"}
                                        />

                                        {/* Label */}
                                        <text
                                            x={48}
                                            y={24}
                                            fill="#ffffff"
                                            fontSize={isSingleNode ? "12.5" : "11.5"}
                                            fontFamily="var(--font-sans), sans-serif"
                                            fontWeight="600"
                                        >
                                            {n.name.length > 14 ? `${n.name.slice(0, 13)}…` : n.name}
                                        </text>

                                        {/* Telemetry Metrics Line */}
                                        <text
                                            x={48}
                                            y={isSingleNode ? 41 : 39}
                                            fill="var(--text-muted)"
                                            fontSize="10"
                                            fontFamily="var(--font-mono), monospace"
                                        >
                                            {n.totalCalls.toLocaleString()} calls · {n.errorRate}% err
                                        </text>

                                        {/* Health Status Dot */}
                                        <circle
                                            cx={NODE_WIDTH - 12}
                                            cy={14}
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
                        <div className="flex items-center justify-between border-b border-border pb-2.5">
                            <div className="flex items-center gap-2">
                                <Server size={15} className="text-accent" />
                                <span className="font-bold text-text text-sm font-sans">{selectedNode.name}</span>
                                <span
                                    className={`halo-badge ${
                                        selectedNode.health === "Healthy"
                                            ? "halo-badge-healthy"
                                            : selectedNode.health === "Degraded"
                                            ? "halo-badge-degraded"
                                            : "halo-badge-critical"
                                    }`}
                                >
                                    {selectedNode.health}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/projects/${projectId || "current"}/investigations/new?service=${encodeURIComponent(selectedNode.name)}`}
                                    className="halo-btn halo-btn-primary halo-btn-xs"
                                >
                                    <Sparkles size={11} />
                                    <span>Analyze Node</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setSelectedNodeId(null)}
                                    className="text-text-muted hover:text-text text-base leading-none px-1 cursor-pointer"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#06080d] p-3 rounded-lg border border-border font-mono">
                            <div>
                                <span className="text-[10px] font-sans uppercase font-semibold text-text-muted block">Error Rate</span>
                                <span className={selectedNode.errorRate >= 20 ? "font-bold text-error" : selectedNode.errorRate >= 5 ? "font-bold text-warning" : "font-bold text-text"}>
                                    {selectedNode.errorRate}%
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-sans uppercase font-semibold text-text-muted block">Call Volume</span>
                                <span className="font-bold text-text">{selectedNode.totalCalls.toLocaleString()} calls</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-sans uppercase font-semibold text-text-muted block">Avg Latency</span>
                                <span className="font-bold text-text">{selectedNode.avgLatencyMs ? `${selectedNode.avgLatencyMs}ms` : "—"}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-sans uppercase font-semibold text-text-muted block">Active Issues</span>
                                <span className="font-bold text-text">{selectedNode.recentIssueCount}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edge Evidence & Link Inspector */}
                {selectedEdge && (
                    <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-text font-semibold text-xs">
                                <Info size={14} className="text-accent" />
                                <span>
                                    Observed Link Evidence: {selectedEdge.source} &rarr; {selectedEdge.target}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEdgeId(null)}
                                className="text-text-muted hover:text-text text-base leading-none px-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>
                        <p className="text-text-secondary text-xs">
                            {selectedEdge.evidence.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs font-mono text-text-muted pt-1">
                            <span>Calls: {selectedEdge.callCount.toLocaleString()}</span>
                            <span>·</span>
                            <span>Errors: <strong className="text-error">{selectedEdge.errorCount}</strong> ({selectedEdge.errorRate}%)</span>
                            <span>·</span>
                            <span>Latency: {selectedEdge.avgLatencyMs ? `${selectedEdge.avgLatencyMs}ms` : "—"}</span>
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
