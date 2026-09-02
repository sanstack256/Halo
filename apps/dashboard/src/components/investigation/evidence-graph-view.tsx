"use client";

import React, { useState, useMemo, useRef } from "react";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Code2,
    Compass,
    Copy,
    Database,
    ExternalLink,
    Eye,
    FileCode,
    Filter,
    GitBranch,
    GitCommit,
    HelpCircle,
    Layers,
    ListTree,
    Maximize2,
    Minimize2,
    MousePointer,
    Move,
    Network,
    Plus,
    RefreshCw,
    Search,
    Server,
    ShieldAlert,
    Terminal,
    User,
    X,
    Zap,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import type {
    ComprehensiveEvidenceGraph,
    InvestigationEntityNode,
    InvestigationEntityEdge,
    EntityNodeType,
} from "@halo/investigation-engine";

interface Props {
    graph?: ComprehensiveEvidenceGraph;
    title?: string;
    onJumpToEvidence?: (evidenceId: string) => void;
}

const ENTITY_ICONS: Record<EntityNodeType, React.ComponentType<{ size?: number; className?: string }>> = {
    EXCEPTION: AlertCircle,
    STACK_FRAME: Code2,
    FUNCTION: Terminal,
    SOURCE_FILE: FileCode,
    REQUEST: Server,
    TRACE: Network,
    SPAN: Activity,
    LOG: Terminal,
    DATABASE_OPERATION: Database,
    DEPLOYMENT: Zap,
    COMMIT: GitCommit,
    RELEASE: GitBranch,
    USER_SESSION: User,
    SERVICE: Layers,
    FEATURE_FLAG: Compass,
    EVENT: Activity,
};

const ENTITY_COLORS: Record<EntityNodeType, { bg: string; border: string; text: string; ring: string }> = {
    EXCEPTION: { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-400", ring: "ring-red-500/30" },
    STACK_FRAME: { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-400", ring: "ring-blue-500/30" },
    FUNCTION: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400", ring: "ring-emerald-500/30" },
    SOURCE_FILE: { bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-400", ring: "ring-cyan-500/30" },
    REQUEST: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", ring: "ring-amber-500/30" },
    TRACE: { bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-400", ring: "ring-purple-500/30" },
    SPAN: { bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-400", ring: "ring-violet-500/30" },
    LOG: { bg: "bg-zinc-800", border: "border-zinc-700", text: "text-zinc-300", ring: "ring-zinc-600" },
    DATABASE_OPERATION: { bg: "bg-yellow-500/15", border: "border-yellow-500/40", text: "text-yellow-400", ring: "ring-yellow-500/30" },
    DEPLOYMENT: { bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", text: "text-fuchsia-400", ring: "ring-fuchsia-500/30" },
    COMMIT: { bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-400", ring: "ring-pink-500/30" },
    RELEASE: { bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-400", ring: "ring-indigo-500/30" },
    USER_SESSION: { bg: "bg-teal-500/15", border: "border-teal-500/40", text: "text-teal-400", ring: "ring-teal-500/30" },
    SERVICE: { bg: "bg-sky-500/15", border: "border-sky-500/40", text: "text-sky-400", ring: "ring-sky-500/30" },
    FEATURE_FLAG: { bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-400", ring: "ring-orange-500/30" },
    EVENT: { bg: "bg-zinc-800", border: "border-zinc-700", text: "text-zinc-300", ring: "ring-zinc-600" },
};

export function EvidenceGraphView({ graph, title = "Interactive Evidence Graph", onJumpToEvidence }: Props) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [filterQuery, setFilterQuery] = useState("");
    const [focusAnchorOnly, setFocusAnchorOnly] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];

    // Filter nodes if search query or focus is active
    const filteredNodes = useMemo(() => {
        let list = nodes;
        if (focusAnchorOnly && graph?.anchorNodeId) {
            const connectedIds = new Set<string>([graph.anchorNodeId]);
            for (const edge of edges) {
                if (edge.from === graph.anchorNodeId) connectedIds.add(edge.to);
                if (edge.to === graph.anchorNodeId) connectedIds.add(edge.from);
            }
            list = list.filter((n) => connectedIds.has(n.id));
        }
        if (filterQuery.trim()) {
            const q = filterQuery.toLowerCase();
            list = list.filter(
                (n) =>
                    n.label.toLowerCase().includes(q) ||
                    n.type.toLowerCase().includes(q) ||
                    n.service?.toLowerCase().includes(q) ||
                    n.location?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [nodes, edges, focusAnchorOnly, filterQuery, graph?.anchorNodeId]);

    const activeNode = nodes.find((n) => n.id === selectedNodeId) || null;
    const activeEdge = edges.find((e) => e.id === selectedEdgeId) || null;

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    if (nodes.length === 0) {
        return (
            <section className="halo-card p-6 border-border space-y-3 text-center">
                <div className="flex items-center justify-center gap-2 text-muted">
                    <Network className="w-5 h-5" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                        {title}
                    </h3>
                </div>
                <p className="text-xs text-secondary max-w-md mx-auto">
                    Evidence graph is empty. Telemetry records lack correlated entities for this occurrence.
                </p>
            </section>
        );
    }

    return (
        <section className="halo-card p-6 border-border space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-accent" />
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            {title}
                        </h2>
                        <p className="text-xs text-secondary">
                            Occurrence-specific entity graph connecting exception, stack frames, requests, trace, and release provenance.
                        </p>
                    </div>
                </div>

                {/* Graph Summary Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border text-zinc-300">
                        {nodes.length} Entities
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border text-zinc-300">
                        {edges.length} Relationships
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        {graph?.summary.observedCount || 0} Observed
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-surface/50 p-2.5 rounded-xl border border-border/80 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search size={14} className="text-muted" />
                    <input
                        type="text"
                        placeholder="Search entities, files, functions, services..."
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        className="bg-transparent border-none text-xs text-white placeholder-zinc-500 focus:outline-none w-full"
                    />
                    {filterQuery && (
                        <button
                            type="button"
                            onClick={() => setFilterQuery("")}
                            className="text-muted hover:text-white p-1"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setFocusAnchorOnly(!focusAnchorOnly)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-colors flex items-center gap-1.5 border ${
                            focusAnchorOnly
                                ? "bg-accent text-white border-accent font-semibold"
                                : "bg-surface text-secondary hover:text-white border-border"
                        }`}
                    >
                        <Eye size={12} />
                        {focusAnchorOnly ? "Show All Entities" : "Focus Primary Failure"}
                    </button>

                    <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 font-mono text-[11px]">
                        <button
                            type="button"
                            onClick={() => setZoomLevel(Math.max(0.7, zoomLevel - 0.15))}
                            className="p-1 text-muted hover:text-white"
                            title="Zoom Out"
                        >
                            <ZoomOut size={13} />
                        </button>
                        <span className="px-1.5 text-zinc-400">{Math.round(zoomLevel * 100)}%</span>
                        <button
                            type="button"
                            onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.15))}
                            className="p-1 text-muted hover:text-white"
                            title="Zoom In"
                        >
                            <ZoomIn size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setZoomLevel(1)}
                            className="p-1 text-muted hover:text-white border-l border-border ml-1 pl-1"
                            title="Reset Zoom"
                        >
                            <RefreshCw size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Interactive Graph Canvas Area */}
            <div className="relative rounded-xl bg-[#080b11] border border-border-default overflow-hidden p-6 min-h-[420px] flex flex-col justify-center">
                {/* Node Grid Layout */}
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
                >
                    {filteredNodes.map((node) => {
                        const Icon = ENTITY_ICONS[node.type] || Activity;
                        const colors = ENTITY_COLORS[node.type] || ENTITY_COLORS.EVENT;
                        const isSelected = selectedNodeId === node.id;
                        const isAnchor = node.isAnchor;

                        return (
                            <div
                                key={node.id}
                                onClick={() => {
                                    setSelectedNodeId(isSelected ? null : node.id);
                                    setSelectedEdgeId(null);
                                }}
                                className={`p-3.5 rounded-xl border cursor-pointer transition-colors space-y-2 select-none relative ${
                                    isSelected
                                        ? "bg-accent/15 border-accent text-white ring-1 ring-accent"
                                        : isAnchor
                                        ? `${colors.bg} ${colors.border} ring-1 ${colors.ring} hover:border-accent/60`
                                        : `${colors.bg} ${colors.border} hover:border-white/30`
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text}`}>
                                            <Icon size={13} />
                                        </div>
                                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${colors.text}`}>
                                            {node.type.replace("_", " ")}
                                        </span>
                                    </div>
                                    {isAnchor && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold animate-pulse">
                                            ANCHOR
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold text-white font-mono truncate" title={node.label}>
                                        {node.label}
                                    </h4>
                                    {node.subtitle && (
                                        <p className="text-[11px] text-zinc-400 truncate mt-0.5" title={node.subtitle}>
                                            {node.subtitle}
                                        </p>
                                    )}
                                </div>

                                {node.location && (
                                    <div className="text-[10px] font-mono text-zinc-500 truncate pt-1 border-t border-white/5">
                                        {node.location}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Direct Relationships / Edges Strip */}
                <div className="mt-8 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                        <span className="uppercase tracking-wider font-semibold">Evidence-Backed Relationships</span>
                        <span>Click edge to explain causal connection</span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {edges.map((edge) => {
                            const isEdgeSelected = selectedEdgeId === edge.id;
                            const isObserved = edge.classification === "Observed";

                            return (
                                <button
                                    key={edge.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedEdgeId(isEdgeSelected ? null : edge.id);
                                        setSelectedNodeId(null);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono shrink-0 transition-all flex items-center gap-2 ${
                                        isEdgeSelected
                                            ? "bg-accent text-white border-accent shadow font-semibold"
                                            : isObserved
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                                            : "bg-surface border-border text-zinc-400 hover:text-white"
                                    }`}
                                >
                                    <span>{edge.from.split("-")[0]}</span>
                                    <ArrowRight size={12} className="text-accent" />
                                    <span className="font-semibold text-accent">{edge.relationship}</span>
                                    <ArrowRight size={12} className="text-accent" />
                                    <span>{edge.to.split("-")[0]}</span>
                                    <span className="text-[10px] opacity-75">
                                        ({Math.round(edge.strength * 100)}%)
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Selected Node Details Drawer */}
            {activeNode && (
                <div className="p-5 rounded-xl bg-[#080b11] border border-white/15 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5">
                            {React.createElement(ENTITY_ICONS[activeNode.type] || Activity, {
                                size: 16,
                                className: ENTITY_COLORS[activeNode.type]?.text || "text-accent",
                            })}
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-sm">{activeNode.label}</span>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${ENTITY_COLORS[activeNode.type]?.bg} ${ENTITY_COLORS[activeNode.type]?.text} ${ENTITY_COLORS[activeNode.type]?.border} font-bold`}>
                                        {activeNode.type}
                                    </span>
                                </div>
                                <span className="text-[11px] text-zinc-400">{activeNode.subtitle}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedNodeId(null)}
                            className="text-zinc-500 hover:text-white p-1"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-mono">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block">Entity ID</span>
                            <span className="text-zinc-300 font-semibold">{activeNode.id}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block">Provenance Source</span>
                            <span className="text-blue-400">{activeNode.provenance}</span>
                        </div>
                        {activeNode.service && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block">Service Context</span>
                                <span className="text-accent">{activeNode.service}</span>
                            </div>
                        )}
                        {activeNode.location && (
                            <div className="col-span-2">
                                <span className="text-[10px] text-zinc-500 uppercase block">Source Location</span>
                                <span className="text-emerald-400">{activeNode.location}</span>
                            </div>
                        )}
                        {activeNode.timestamp && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block">Timestamp</span>
                                <span className="text-zinc-300">{new Date(activeNode.timestamp).toISOString()}</span>
                            </div>
                        )}
                    </div>

                    {/* Metadata Dump */}
                    {activeNode.metadata && Object.keys(activeNode.metadata).length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-white/5 font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase block">Correlated Telemetry Metadata</span>
                            <div className="p-3 rounded-lg bg-surface/40 border border-border/50 text-[11px] space-y-1 text-zinc-300 overflow-x-auto">
                                {Object.entries(activeNode.metadata).map(([k, v]) => (
                                    <div key={k} className="flex items-start gap-2">
                                        <span className="text-muted">{k}:</span>
                                        <span className="text-zinc-200">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Selected Edge Explanation Drawer ("Why does Halo believe these two entities are related?") */}
            {activeEdge && (
                <div className="p-5 rounded-xl bg-accent/5 border border-accent/30 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-accent/20 pb-3">
                        <div className="flex items-center gap-2">
                            <Network size={16} className="text-accent" />
                            <span className="font-bold text-white text-sm">
                                Why does Halo believe these two entities are related?
                            </span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                activeEdge.classification === "Observed"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}>
                                {activeEdge.classification}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedEdgeId(null)}
                            className="text-zinc-500 hover:text-white p-1"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-3 rounded-lg bg-[#080b11] border border-white/10 text-xs text-zinc-200 leading-relaxed font-sans">
                        <strong className="text-accent">{activeEdge.relationship}:</strong> {activeEdge.explanation}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-mono text-[11px]">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block">Source Entity (From)</span>
                            <span className="text-white font-semibold">{activeEdge.from}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block">Target Entity (To)</span>
                            <span className="text-white font-semibold">{activeEdge.to}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block">Evidence Strength</span>
                            <span className="text-emerald-400 font-bold">{Math.round(activeEdge.strength * 100)}%</span>
                        </div>
                        {activeEdge.correlationKeys && activeEdge.correlationKeys.length > 0 && (
                            <div className="col-span-2">
                                <span className="text-[10px] text-zinc-500 uppercase block">Correlation Keys Used</span>
                                <span className="text-cyan-400">{activeEdge.correlationKeys.join(", ")}</span>
                            </div>
                        )}
                        {activeEdge.timestamps?.deltaMs != null && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block">Temporal Distance</span>
                                <span className="text-zinc-300">{activeEdge.timestamps.deltaMs} ms</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
