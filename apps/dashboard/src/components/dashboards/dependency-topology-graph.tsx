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
                <div className="h-44 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-6">
                    <Clock size={22} className="text-text-muted mb-2 opacity-50" />
                    <p className="text-xs text-text font-medium">No dependency relationships observed</p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-sm">
                        As distributed traces and cross-service calls are ingested, Halo will reconstruct the real live topology graph here without speculative edges.
                    </p>
                </div>
            </div>
        );
    }

    // Node dimension tokens
    const isSingleNode = filteredNodes.length === 1;
    const NODE_WIDTH = isSingleNode ? 180 : 150;
    const NODE_HEIGHT = isSingleNode ? 56 : 50;

    // ViewBox dimensions
    const baseWidth = 880;
    const baseHeight = 380;

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
                                {filteredNodes.length} {filteredNodes.length === 1 ? "node" : "nodes"} · {filteredEdges.length} evidence {filteredEdges.length === 1 ? "edge" : "edges"}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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

                        {/* Zoom / Pan Controls Toolbar */}
                        <div className="flex items-center gap-1 bg-[#080b11] p-1 rounded-lg border border-border">
                            <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.min(2, z + 0.15))}
                                className="p-1 rounded text-text-muted hover:text-text cursor-pointer transition-colors"
                                title="Zoom In"
                            >
                                <Plus size={13} />
                            </button>
                            <span className="text-[10px] font-mono text-text-muted px-1 select-none">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
                                className="p-1 rounded text-text-muted hover:text-text cursor-pointer transition-colors"
                                title="Zoom Out"
                            >
                                <Minus size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={handleFitToView}
                                className="p-1 rounded text-text-muted hover:text-text ml-1 border-l border-border cursor-pointer transition-colors"
                                title="Fit to View"
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SVG Topology Canvas */}
                <div
                    className="relative w-full h-[360px] overflow-hidden bg-[#05080e] rounded-xl border border-border cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Subtle Canvas Dot Grid Background */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)",
                            backgroundSize: "24px 24px",
                        }}
                    />

                    {/* Single Node Contextual Note (When only 1 node is observed) */}
                    {isSingleNode && filteredEdges.length === 0 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#080c14]/90 border border-border px-3.5 py-1.5 rounded-full text-[11px] text-text-muted flex items-center gap-2 pointer-events-none z-10 backdrop-blur-sm">
                            <Info size={12} className="text-accent" />
                            <span>No observed downstream connections in the selected scope</span>
                        </div>
                    )}

                    <svg
                        viewBox={`0 0 ${baseWidth} ${baseHeight}`}
                        className="w-full h-full"
                    >
                        <defs>
                            <marker
                                id="arrow-default"
                                viewBox="0 0 10 10"
                                refX="16"
                                refY="5"
                                markerWidth="5"
                                markerHeight="5"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(255,255,255,0.3)" />
                            </marker>
                            <marker
                                id="arrow-error"
                                viewBox="0 0 10 10"
                                refX="16"
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
                                refX="16"
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
                                        <path d={pathData} fill="none" stroke="transparent" strokeWidth="16" />
                                        <path
                                            d={pathData}
                                            fill="none"
                                            stroke={
                                                isSelected
                                                    ? "#5bb8ff"
                                                    : isError
                                                    ? "rgba(239,68,68,0.75)"
                                                    : e.isCriticalPath
                                                    ? "#fbbf24"
                                                    : "rgba(255,255,255,0.2)"
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
                                // For single node scenario, center precisely in canvas
                                const x = isSingleNode ? (baseWidth - NODE_WIDTH) / 2 : (n.x || 100) - NODE_WIDTH / 2;
                                const y = isSingleNode ? (baseHeight - NODE_HEIGHT) / 2 : (n.y || 100) - NODE_HEIGHT / 2;
                                const isSelected = selectedNodeId === n.name;

                                // Blast radius status check
                                const isDirect = blastRadius?.directlyAffected.some((x) => x.id === n.id);
                                const isObservedProp = blastRadius?.observedPropagation.some((x) => x.id === n.id);
                                const isPotentialExp = blastRadius?.potentialExposure.some((x) => x.id === n.id);

                                let strokeColor = "rgba(255,255,255,0.14)";
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
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={isSelected ? 2 : 1}
                                            className="transition-colors"
                                        />

                                        {/* Service Icon Box */}
                                        <rect
                                            x={10}
                                            y={10}
                                            width={28}
                                            height={28}
                                            rx={6}
                                            fill="rgba(91,184,255,0.1)"
                                            stroke="rgba(91,184,255,0.2)"
                                        />

                                        {/* Label */}
                                        <text
                                            x={46}
                                            y={23}
                                            fill="#ffffff"
                                            fontSize={isSingleNode ? "12" : "11"}
                                            fontFamily="sans-serif"
                                            fontWeight="600"
                                        >
                                            {n.name.length > 14 ? `${n.name.slice(0, 12)}…` : n.name}
                                        </text>

                                        {/* Telemetry Metrics */}
                                        <text
                                            x={46}
                                            y={isSingleNode ? 39 : 37}
                                            fill="#8c9baa"
                                            fontSize="9.5"
                                            fontFamily="monospace"
                                        >
                                            {n.totalCalls} calls · {n.errorRate}% err
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
                                <Server size={14} className="text-accent" />
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
                                <span className="font-bold text-text">{selectedNode.totalCalls} calls</span>
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

                {/* Edge Evidence & Provenance Inspector */}
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
                            <span>Calls: {selectedEdge.callCount}</span>
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
