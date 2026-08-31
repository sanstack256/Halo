"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    ArrowRight,
    CheckCircle2,
    Clock,
    Database,
    Globe,
    Info,
    Layers,
    Network,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";
import type { DependencyNode, DependencyEdge, BlastRadiusResult } from "@/lib/analytics/types";
import { computeBlastRadius } from "@/lib/analytics/blast-radius";
import { BlastRadiusPanel } from "./blast-radius-panel";

interface DependencyTopologyGraphProps {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    observedCallTotal: number;
    projectId?: string;
}

export function DependencyTopologyGraph({
    nodes,
    edges,
    observedCallTotal,
    projectId,
}: DependencyTopologyGraphProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    const blastRadius: BlastRadiusResult | null = useMemo(() => {
        if (!selectedNodeId) return null;
        return computeBlastRadius(selectedNodeId, nodes, edges);
    }, [selectedNodeId, nodes, edges]);

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

    // SVG Layout Calculations
    const width = 850;
    const height = 360;

    // Distribute nodes across columns: Client/Entry -> Internal Services -> Databases/Resources
    const entryNodes = nodes.filter((n) => n.name.includes("client") || n.name.includes("gateway") || n.name.includes("frontend"));
    const dbNodes = nodes.filter((n) => n.type === "DATABASE" || n.type === "EXTERNAL" || n.name.includes("db") || n.name.includes("cache"));
    const serviceNodes = nodes.filter((n) => !entryNodes.includes(n) && !dbNodes.includes(n));

    // Fallback if not partitioned
    let col1 = entryNodes;
    let col2 = serviceNodes;
    let col3 = dbNodes;

    if (col1.length === 0 && col2.length === 0 && col3.length > 0) {
        col1 = col3.slice(0, Math.ceil(col3.length / 2));
        col3 = col3.slice(Math.ceil(col3.length / 2));
    } else if (col1.length === 0) {
        col1 = col2.slice(0, Math.ceil(col2.length / 2));
        col2 = col2.slice(Math.ceil(col2.length / 2));
    }

    // Node Positions map: nodeName -> { x, y }
    const positions = new Map<string, { x: number; y: number }>();

    const placeColumn = (colNodes: DependencyNode[], colX: number) => {
        const count = colNodes.length;
        if (count === 0) return;
        const spacing = (height - 80) / Math.max(1, count);
        colNodes.forEach((n, idx) => {
            const y = 50 + idx * spacing + spacing / 2;
            positions.set(n.name, { x: colX, y });
        });
    };

    placeColumn(col1, 140);
    placeColumn(col2, 425);
    placeColumn(col3, 710);

    const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

    return (
        <div className="space-y-4 font-mono text-xs">
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <Network size={14} className="text-accent" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Observed Dependency Topology
                        </h3>
                        <span className="text-[10px] text-muted">
                            ({nodes.length} nodes · {edges.length} evidence-backed edges)
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Healthy
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400" /> Degraded
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-400" /> Critical
                        </span>
                    </div>
                </div>

                {/* SVG Topology Canvas */}
                <div className="relative w-full overflow-hidden bg-[#06080d] rounded-xl border border-border/60">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-80 select-none">
                        <defs>
                            <marker
                                id="arrow-default"
                                viewBox="0 0 10 10"
                                refX="28"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#4b5563" />
                            </marker>
                            <marker
                                id="arrow-error"
                                viewBox="0 0 10 10"
                                refX="28"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                            </marker>
                            <marker
                                id="arrow-selected"
                                viewBox="0 0 10 10"
                                refX="28"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 1 L 10 5 L 0 9 z" fill="#5bb8ff" />
                            </marker>
                        </defs>

                        {/* Directed Edges */}
                        {edges.map((e) => {
                            const p1 = positions.get(e.source) || { x: 100, y: 100 };
                            const p2 = positions.get(e.target) || { x: 400, y: 100 };

                            const isSelected = selectedEdgeId === e.id;
                            const isError = e.errorRate > 0;
                            const markerId = isSelected ? "arrow-selected" : isError ? "arrow-error" : "arrow-default";

                            const dx = (p2.x - p1.x) * 0.5;
                            const pathData = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

                            return (
                                <g
                                    key={e.id}
                                    onClick={() => setSelectedEdgeId(e.id)}
                                    className="cursor-pointer group"
                                >
                                    {/* Transparent fat hover line */}
                                    <path d={pathData} fill="none" stroke="transparent" strokeWidth="12" />

                                    {/* Visual edge curve */}
                                    <path
                                        d={pathData}
                                        fill="none"
                                        stroke={
                                            isSelected
                                                ? "#5bb8ff"
                                                : isError
                                                ? "rgba(239,68,68,0.7)"
                                                : "rgba(255,255,255,0.15)"
                                        }
                                        strokeWidth={isSelected ? "2.5" : isError ? "2" : "1.5"}
                                        strokeDasharray={e.evidence.type === "SERVICE_METADATA" ? "4 4" : undefined}
                                        markerEnd={`url(#${markerId})`}
                                    />
                                </g>
                            );
                        })}

                        {/* Topology Nodes */}
                        {nodes.map((n) => {
                            const pos = positions.get(n.name) || { x: 100, y: 100 };
                            const isSelected = selectedNodeId === n.name;

                            // Blast radius status check
                            const isDirect = blastRadius?.directlyAffected.some((x) => x.id === n.id);
                            const isDownstream = blastRadius?.downstreamImpact.some((x) => x.id === n.id);
                            const isExposed = blastRadius?.potentiallyExposed.some((x) => x.id === n.id);

                            let strokeColor = "rgba(255,255,255,0.15)";
                            let glowColor = "transparent";

                            if (isSelected || isDirect) {
                                strokeColor = "#5bb8ff";
                                glowColor = "rgba(91,184,255,0.2)";
                            } else if (isDownstream) {
                                strokeColor = "#ef4444";
                                glowColor = "rgba(239,68,68,0.2)";
                            } else if (isExposed) {
                                strokeColor = "#f59e0b";
                                glowColor = "rgba(245,158,11,0.2)";
                            } else if (n.health === "Critical") {
                                strokeColor = "#ef4444";
                            } else if (n.health === "Degraded") {
                                strokeColor = "#f59e0b";
                            } else if (n.health === "Healthy") {
                                strokeColor = "rgba(34,197,94,0.4)";
                            }

                            const nodeWidth = 130;
                            const nodeHeight = 44;

                            return (
                                <g
                                    key={n.id}
                                    transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}
                                    onClick={() => {
                                        setSelectedNodeId(n.name === selectedNodeId ? null : n.name);
                                        setSelectedEdgeId(null);
                                    }}
                                    className="cursor-pointer group"
                                >
                                    {/* Node Box */}
                                    <rect
                                        width={nodeWidth}
                                        height={nodeHeight}
                                        rx={10}
                                        fill="#080c12"
                                        stroke={strokeColor}
                                        strokeWidth={isSelected ? 2 : 1}
                                        style={{ filter: glowColor !== "transparent" ? `drop-shadow(0 0 8px ${glowColor})` : undefined }}
                                    />

                                    {/* Icon & Label */}
                                    <text
                                        x={12}
                                        y={20}
                                        fill="#ffffff"
                                        fontSize="11"
                                        fontFamily="monospace"
                                        fontWeight="600"
                                    >
                                        {n.name.length > 14 ? `${n.name.slice(0, 12)}…` : n.name}
                                    </text>

                                    {/* Subtitle / Telemetry Stats */}
                                    <text
                                        x={12}
                                        y={33}
                                        fill="#6d7b8c"
                                        fontSize="9"
                                        fontFamily="monospace"
                                    >
                                        {n.totalCalls} calls · {n.errorRate}% err
                                    </text>

                                    {/* Status Dot */}
                                    <circle
                                        cx={nodeWidth - 14}
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
                    </svg>
                </div>

                {/* Edge Evidence & Provenance Inspector */}
                {selectedEdge && (
                    <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-semibold">
                                <Info size={14} className="text-accent" />
                                <span>
                                    Edge Evidence: {selectedEdge.source} &rarr; {selectedEdge.target}
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
                            <span>Calls: {selectedEdge.callCount}</span>
                            <span>·</span>
                            <span>Error Rate: {selectedEdge.errorRate}%</span>
                            <span>·</span>
                            <span>
                                Latency: {selectedEdge.avgLatencyMs ? `${selectedEdge.avgLatencyMs}ms` : "N/A"}
                            </span>
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
