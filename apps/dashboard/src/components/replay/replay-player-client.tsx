"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ChevronLeft,
    Compass,
    Copy,
    MonitorPlay,
    MousePointer,
    Move,
    Navigation,
    Pause,
    Play,
    RotateCcw,
    Sparkles,
    Terminal,
    Type,
    X,
    Zap,
} from "lucide-react";
import { getReplayEvents } from "@/actions/replay";
import { ReplayStatus } from "./replay-status";
import "rrweb-player/dist/style.css";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4] as const;

const MARKER_TYPE_STYLES: Record<string, string> = {
    navigation: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    click: "bg-violet-500/10 border-violet-500/30 text-violet-300",
    input: "bg-teal-500/10 border-teal-500/30 text-teal-300",
    scroll: "bg-zinc-800 border-border text-zinc-400",
    resize: "bg-zinc-800 border-border text-zinc-400",
    error: "bg-red-500/10 border-red-500/30 text-red-300",
    custom: "bg-amber-500/10 border-amber-500/30 text-amber-300",
};

type ReplayPlayerClientProps = {
    replaySession: {
        id: string;
        sessionId: string;
        projectId: string;
        environmentId?: string;
        url?: string | null;
        browser?: string | null;
        os?: string | null;
        startedAt: Date;
        endedAt?: Date | null;
        errorAt?: Date | null;
        totalDurationMs?: number | null;
        status: string;
        issueId?: string | null;
        traceId?: string | null;
        requestId?: string | null;
        viewportWidth?: number | null;
        viewportHeight?: number | null;
    };
    issueTitle?: string;
};

type TimelineMarker = {
    timeMs: number;
    label: string;
    type: "navigation" | "click" | "input" | "scroll" | "resize" | "error" | "custom";
    icon: React.ComponentType<{ size?: number; className?: string }>;
    detail: string;
    traceId?: string | null;
    /** Raw rrweb event data for inspector panel */
    rawData?: Record<string, unknown>;
};

export function ReplayPlayerClient({
    replaySession,
    issueTitle,
}: ReplayPlayerClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerInstanceRef = useRef<any>(null);
    const animFrameRef = useRef<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<any[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
    const [selectedMarker, setSelectedMarker] = useState<TimelineMarker | null>(null);

    // Fetch real rrweb chunks from server
    useEffect(() => {
        let isMounted = true;

        async function fetchEvents() {
            setLoading(true);
            try {
                const fetchedEvents = await getReplayEvents(replaySession.id);
                if (isMounted) {
                    setEvents(fetchedEvents);
                }
            } catch (err) {
                console.error("Failed to load replay events:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchEvents();

        return () => {
            isMounted = false;
        };
    }, [replaySession.id]);

    // Keyboard shortcuts: Space = play/pause, Arrow keys = ±5s seek
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === "Space") {
                e.preventDefault();
                const player = playerInstanceRef.current;
                if (!player) return;
                if (isPlaying) { player.pause(); setIsPlaying(false); }
                else { player.play(); setIsPlaying(true); }
            }
            if (e.code === "ArrowLeft") {
                e.preventDefault();
                const player = playerInstanceRef.current;
                if (player) { const t = Math.max(0, currentMs - 5000); player.goto(t, true); setCurrentMs(t); }
            }
            if (e.code === "ArrowRight") {
                e.preventDefault();
                const player = playerInstanceRef.current;
                if (player) { const t = Math.min(durationMs, currentMs + 5000); player.goto(t, true); setCurrentMs(t); }
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [currentMs, durationMs, isPlaying]);

    // Extract dynamic timeline milestones from real rrweb events array
    const timelineMarkers = useMemo<TimelineMarker[]>(() => {
        if (!events || events.length === 0) return [];

        const startTimestamp = events[0]?.timestamp || 0;
        const markers: TimelineMarker[] = [];

        // 1. Initial Page Load
        markers.push({
            timeMs: 0,
            label: "Page Load",
            type: "navigation",
            icon: Compass,
            detail: replaySession.url || "DOM Initialized",
            rawData: { url: replaySession.url, offsetMs: 0 },
        });

        // 2. Parse real user interaction events from rrweb event stream
        let lastInteractionTime = -500;

        for (const ev of events) {
            const offsetMs = Math.max(0, ev.timestamp - startTimestamp);

            // FullSnapshot (DOM re-render or route change)
            if (ev.type === 2 && offsetMs > 1000) {
                markers.push({
                    timeMs: offsetMs,
                    label: "DOM Snapshot",
                    type: "navigation",
                    icon: Navigation,
                    detail: "Full DOM snapshot captured",
                    rawData: { rrwebType: ev.type, offsetMs },
                });
            }

            // IncrementalSnapshot
            if (ev.type === 3 && ev.data) {
                const source = ev.data.source;

                // Mouse interaction (Click = 2, TouchStart = 4)
                if (source === 1 && (ev.data.type === 2 || ev.data.type === 4)) {
                    if (offsetMs - lastInteractionTime > 300) {
                        markers.push({
                            timeMs: offsetMs,
                            label: "User Click",
                            type: "click",
                            icon: MousePointer,
                            detail: `Click at (${ev.data.x ?? 0}, ${ev.data.y ?? 0})`,
                            rawData: {
                                rrwebType: ev.type,
                                source,
                                interactionType: ev.data.type === 4 ? "touch" : "click",
                                x: ev.data.x,
                                y: ev.data.y,
                                id: ev.data.id,
                                offsetMs,
                            },
                        });
                        lastInteractionTime = offsetMs;
                    }
                }

                // Form Input / Typing
                if (source === 5 && offsetMs - lastInteractionTime > 800) {
                    markers.push({
                        timeMs: offsetMs,
                        label: "Form Input",
                        type: "input",
                        icon: Type,
                        detail: "User entered text (masked for privacy)",
                        rawData: { rrwebType: ev.type, source, id: ev.data.id, offsetMs },
                    });
                    lastInteractionTime = offsetMs;
                }

                // Viewport Resize
                if (source === 3 && offsetMs - lastInteractionTime > 1500) {
                    markers.push({
                        timeMs: offsetMs,
                        label: "Viewport Resize",
                        type: "resize",
                        icon: Move,
                        detail: `${ev.data.width ?? 0}×${ev.data.height ?? 0}`,
                        rawData: { rrwebType: ev.type, source, width: ev.data.width, height: ev.data.height, offsetMs },
                    });
                    lastInteractionTime = offsetMs;
                }
            }

            // Custom error or console event
            if (ev.type === 5 && ev.data?.tag === "error") {
                markers.push({
                    timeMs: offsetMs,
                    label: "Console Error",
                    type: "error",
                    icon: Terminal,
                    detail: ev.data.payload?.message || "Client console exception",
                    rawData: { rrwebType: ev.type, tag: ev.data.tag, message: ev.data.payload?.message, offsetMs },
                });
            }
        }

        // 3. Error snap moment — anchored from real replaySession.errorAt
        if (replaySession.errorAt) {
            const errorTime = new Date(replaySession.errorAt).getTime();
            const errorOffsetMs = Math.max(0, errorTime - startTimestamp);

            markers.push({
                timeMs: errorOffsetMs,
                label: "Exception Captured",
                type: "error",
                icon: AlertCircle,
                detail: issueTitle || "Unhandled Application Error",
                traceId: replaySession.traceId,
                rawData: {
                    errorAt: replaySession.errorAt.toISOString(),
                    traceId: replaySession.traceId,
                    requestId: replaySession.requestId,
                    sessionId: replaySession.sessionId,
                    offsetMs: errorOffsetMs,
                },
            });
        }

        return markers.sort((a, b) => a.timeMs - b.timeMs);
    }, [events, replaySession, issueTitle]);

    // Initialize rrweb-player with mouseTail: false to remove red trailing lines
    useEffect(() => {
        if (loading || events.length === 0 || !containerRef.current) return;

        let player: any = null;

        async function initPlayer() {
            try {
                const RRWebPlayer = (await import("rrweb-player")).default;

                if (!containerRef.current) return;

                containerRef.current.innerHTML = "";

                const start = events[0]?.timestamp || 0;
                const end = events[events.length - 1]?.timestamp || start;
                const total = Math.max(1000, end - start);
                setDurationMs(total);

                player = new RRWebPlayer({
                    target: containerRef.current,
                    props: {
                        events,
                        width: containerRef.current.clientWidth || 800,
                        height: 480,
                        autoPlay: false,
                        showController: false,
                        mouseTail: false, // Disables the red line cursor trail!
                        speed: playbackSpeed,
                    },
                });

                playerInstanceRef.current = player;

                const replayer = player.getReplayer();
                if (replayer) {
                    replayer.on("start", () => setIsPlaying(true));
                    replayer.on("pause", () => setIsPlaying(false));
                    replayer.on("finish", () => {
                        setIsPlaying(false);
                        setCurrentMs(total);
                    });
                    replayer.on("statechange", () => {
                        const current = replayer.getCurrentTime();
                        setCurrentMs(current);
                    });
                }
            } catch (err) {
                console.error("Failed to initialize rrweb-player:", err);
            }
        }

        initPlayer();

        return () => {
            if (player) {
                try {
                    player.pause();
                } catch {}
            }
        };
    }, [events, loading]);

    // Smooth real-time timer sync during active playback
    useEffect(() => {
        if (!isPlaying) {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
            return;
        }

        function updateProgress() {
            const player = playerInstanceRef.current;
            if (player) {
                const replayer = player.getReplayer();
                if (replayer) {
                    const time = replayer.getCurrentTime();
                    setCurrentMs(time);
                }
            }
            animFrameRef.current = requestAnimationFrame(updateProgress);
        }

        animFrameRef.current = requestAnimationFrame(updateProgress);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [isPlaying]);

    const togglePlay = useCallback(() => {
        const player = playerInstanceRef.current;
        if (!player) return;
        if (isPlaying) {
            player.pause();
            setIsPlaying(false);
        } else {
            // If ended, restart from 0
            if (currentMs >= durationMs - 100) {
                player.goto(0);
                setCurrentMs(0);
            }
            player.play();
            setIsPlaying(true);
        }
    }, [isPlaying, currentMs, durationMs]);

    const seekTo = useCallback((ms: number) => {
        const player = playerInstanceRef.current;
        if (!player) return;
        player.goto(ms, true);
        setCurrentMs(ms);
    }, []);

    const setSpeed = useCallback((speed: number) => {
        setPlaybackSpeed(speed);
        const player = playerInstanceRef.current;
        if (!player) return;
        player.setSpeed(speed);
    }, []);

    const jumpToError = useCallback(() => {
        if (!replaySession.errorAt || events.length === 0) return;
        const start = events[0].timestamp;
        const errorTime = new Date(replaySession.errorAt).getTime();
        const errorOffset = Math.max(0, errorTime - start);
        seekTo(errorOffset);
    }, [replaySession.errorAt, events, seekTo]);

    const jumpBeforeError = useCallback(() => {
        if (!replaySession.errorAt || events.length === 0) return;
        const start = events[0].timestamp;
        const errorTime = new Date(replaySession.errorAt).getTime();
        const errorOffset = Math.max(0, errorTime - start - 5000);
        seekTo(errorOffset);
    }, [replaySession.errorAt, events, seekTo]);

    if (loading) {
        return <ReplayStatus status="PROCESSING" message="Loading replay chunks from storage..." />;
    }

    if (events.length < 2) {
        return (
            <ReplayStatus
                status="NO_REPLAY"
                message="This session contains insufficient DOM snapshots to reconstruct playback."
                projectId={replaySession.projectId}
            />
        );
    }

    const startTimestamp = events[0]?.timestamp || 0;
    const errorOffsetMs = replaySession.errorAt
        ? Math.max(0, new Date(replaySession.errorAt).getTime() - startTimestamp)
        : null;

    const currentFormatted = formatMs(currentMs);
    const totalFormatted = formatMs(durationMs);

    return (
        <div className="halo-card p-5 space-y-4 overflow-hidden">
            {/* Header / Session Metadata Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <MonitorPlay size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">Session Replay</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                Reconstructed DOM Stream
                            </span>
                        </div>
                        <p className="text-xs text-secondary truncate max-w-sm">
                            {replaySession.url || "Web Application"}
                            {replaySession.browser ? ` · ${replaySession.browser}` : ""}
                            {replaySession.os ? ` (${replaySession.os})` : ""}
                            {replaySession.viewportWidth && replaySession.viewportHeight
                                ? ` · ${replaySession.viewportWidth}×${replaySession.viewportHeight}`
                                : ""}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {errorOffsetMs !== null && (
                        <>
                            <button
                                type="button"
                                onClick={jumpBeforeError}
                                className="halo-btn halo-btn-sm halo-btn-secondary text-xs gap-1.5"
                                title="Jump to 5 seconds before the error"
                            >
                                <ChevronLeft size={12} />
                                5s before error
                            </button>
                            <button
                                type="button"
                                onClick={jumpToError}
                                className="halo-btn halo-btn-sm halo-btn-secondary text-xs gap-1.5"
                                title="Jump to exact error timestamp"
                            >
                                <Zap size={12} className="text-red-400" />
                                At error
                            </button>
                        </>
                    )}

                    <Link
                        href={`/projects/${replaySession.projectId}/investigations/new?issueId=${replaySession.issueId || ""}`}
                        className="halo-btn halo-btn-sm halo-btn-primary text-xs gap-1.5"
                    >
                        <Sparkles size={12} />
                        Investigate
                    </Link>
                </div>
            </div>

            {/* RRWeb Canvas Viewport — real application DOM, no fake browser chrome */}
            <div className="relative rounded-2xl bg-[#080b11] border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center">
                {/* Minimal honest session info strip — only real data from recording */}
                <div className="w-full h-7 bg-[#0d1117] border-b border-white/[0.06] flex items-center justify-between px-3 gap-2 text-[11px] font-mono text-zinc-500">
                    <span className="truncate max-w-xs text-zinc-400">
                        {replaySession.url || "Session recording"}
                    </span>
                    <span className="shrink-0">{events.length} DOM events</span>
                </div>

                {/* Player Target — rrweb reconstructs the actual recorded application here */}
                <div
                    ref={containerRef}
                    onClick={togglePlay}
                    className="w-full min-h-[480px] bg-white flex items-center justify-center overflow-auto cursor-pointer"
                />

                {/* Center Play/Pause Overlay — fades when playing */}
                <div className="absolute inset-0 top-7 bottom-14 flex items-center justify-center pointer-events-none">
                    <button
                        type="button"
                        onClick={togglePlay}
                        aria-label={isPlaying ? "Pause" : "Play"}
                        className={`pointer-events-auto w-16 h-16 rounded-full bg-black/75 hover:bg-black/90 text-white border border-white/20 shadow-2xl backdrop-blur-md flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"}`}
                    >
                        {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1 text-accent" />}
                    </button>
                </div>

                {/* Controls & Scrubber */}
                <div className="w-full bg-[#0f141f] border-t border-white/10 p-3 space-y-2 z-10">
                    {/* Scrubber with Error Marker */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-400 w-12 text-right">
                            {currentFormatted}
                        </span>

                        <div className="relative flex-1 flex items-center">
                            {/* Error pin on timeline — from real errorAt timestamp */}
                            {errorOffsetMs !== null && durationMs > 0 && (
                                <div
                                    className="absolute -top-1.5 -bottom-1.5 w-1.5 bg-red-500 z-20 rounded-full cursor-pointer hover:scale-125 transition-transform"
                                    style={{
                                        left: `${Math.min(100, Math.max(0, (errorOffsetMs / durationMs) * 100))}%`,
                                    }}
                                    onClick={() => seekTo(errorOffsetMs)}
                                    title={`Exception at ${formatMs(errorOffsetMs)}`}
                                />
                            )}

                            <input
                                type="range"
                                min="0"
                                max={durationMs || 100}
                                step="50"
                                value={currentMs}
                                onChange={(e) => seekTo(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none"
                            />
                        </div>

                        <span className="text-[11px] font-mono text-zinc-500 w-12">
                            {totalFormatted}
                        </span>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={togglePlay}
                                className="halo-btn halo-btn-sm halo-btn-primary gap-1.5"
                                title="Space"
                            >
                                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                                {isPlaying ? "Pause" : "Play"}
                            </button>

                            <button
                                type="button"
                                onClick={() => seekTo(0)}
                                className="halo-btn halo-btn-sm halo-btn-secondary p-1.5"
                                title="Restart"
                            >
                                <RotateCcw size={13} />
                            </button>

                            <div className="flex items-center rounded-lg bg-surface border border-border p-0.5 text-xs font-mono">
                                {SPEED_OPTIONS.map((spd) => (
                                    <button
                                        key={spd}
                                        type="button"
                                        onClick={() => setSpeed(spd)}
                                        className={`px-2 py-0.5 rounded transition-colors ${
                                            playbackSpeed === spd
                                                ? "bg-accent text-white font-bold"
                                                : "text-muted hover:text-white"
                                        }`}
                                    >
                                        {spd}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        <span className="text-[11px] font-mono text-zinc-600 hidden sm:block">
                            Space = play/pause · ←/→ = ±5s
                        </span>
                    </div>
                </div>
            </div>

            {/* Session Timeline */}
            <div className="pt-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                        Session Timeline
                    </span>
                    <span className="text-[11px] font-mono text-muted">
                        {timelineMarkers.length} events · click to inspect
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {timelineMarkers.map((marker, idx) => {
                        const Icon = marker.icon;
                        const isCurrent = Math.abs(currentMs - marker.timeMs) < 1000;
                        const isSelected = selectedMarker === marker;
                        const isError = marker.type === "error";
                        const baseStyle = isSelected
                            ? "bg-accent/10 border-accent text-white ring-1 ring-accent/40 shadow"
                            : isCurrent && !isError
                            ? "bg-accent/10 border-accent/50 text-white"
                            : isError
                            ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                            : "bg-surface border-border text-secondary hover:bg-surface-hover hover:text-white";

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    seekTo(marker.timeMs);
                                    setSelectedMarker(isSelected ? null : marker);
                                }}
                                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all text-left ${baseStyle}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <Icon
                                            size={13}
                                            className={
                                                isError ? "text-red-400" :
                                                isSelected || isCurrent ? "text-accent" :
                                                "text-muted"
                                            }
                                        />
                                        <span>{marker.label}</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-muted">
                                        {formatMs(marker.timeMs)}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted truncate mt-1">
                                    {marker.detail}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Event Inspector Panel — shown on marker selection */}
                {selectedMarker && (
                    <EventInspector
                        marker={selectedMarker}
                        replaySession={replaySession}
                        sessionStartTimestamp={startTimestamp}
                        onClose={() => setSelectedMarker(null)}
                    />
                )}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Event Inspector Panel                                                       */
/* -------------------------------------------------------------------------- */

function EventInspector({
    marker,
    replaySession,
    sessionStartTimestamp,
    onClose,
}: {
    marker: TimelineMarker;
    replaySession: ReplayPlayerClientProps["replaySession"];
    sessionStartTimestamp: number;
    onClose: () => void;
}) {
    const absoluteTimestamp = sessionStartTimestamp
        ? new Date(sessionStartTimestamp + marker.timeMs).toISOString()
        : null;

    return (
        <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                    <marker.icon size={14} className="text-accent" />
                    <span className="font-semibold text-white">{marker.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${MARKER_TYPE_STYLES[marker.type] ?? "bg-zinc-800 border-border text-zinc-400"}`}>
                        {marker.type}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-zinc-500 hover:text-white transition-colors p-1"
                    title="Close inspector"
                    aria-label="Close event inspector"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <InspectorRow label="Relative timestamp" value={formatMs(marker.timeMs)} mono />
                {absoluteTimestamp && (
                    <InspectorRow label="Absolute timestamp" value={absoluteTimestamp} mono />
                )}
                <InspectorRow label="Detail" value={marker.detail} />
                <InspectorRow
                    label="Page URL"
                    value={replaySession.url ?? undefined}
                    mono
                    unavailableReason="URL was not captured in this recording"
                />

                {/* Click coordinates — only from real rrweb data */}
                {marker.rawData?.x != null && marker.rawData?.y != null && (
                    <InspectorRow
                        label="Click position"
                        value={`(${marker.rawData.x}, ${marker.rawData.y})`}
                        mono
                    />
                )}

                {/* Telemetry correlation — all from real session fields */}
                <InspectorRow
                    label="Session ID"
                    value={replaySession.sessionId}
                    mono
                    copyable
                />
                <InspectorRow
                    label="Trace ID"
                    value={replaySession.traceId ?? undefined}
                    mono
                    copyable
                    unavailableReason="No trace ID was associated with this replay session"
                />
                <InspectorRow
                    label="Request ID"
                    value={replaySession.requestId ?? undefined}
                    mono
                    copyable
                    unavailableReason="No request ID was associated with this replay session"
                />

                {/* Event-specific traceId on the marker (e.g. from error event) */}
                {marker.traceId && marker.traceId !== replaySession.traceId && (
                    <InspectorRow label="Event trace ID" value={marker.traceId} mono copyable />
                )}
            </div>

            <p className="text-[11px] text-zinc-600 italic border-t border-white/[0.04] pt-3">
                All fields are derived from real captured telemetry. Fields marked "Not available" were absent from the recording.
            </p>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Inspector Row                                                               */
/* -------------------------------------------------------------------------- */

function InspectorRow({
    label,
    value,
    mono = false,
    copyable = false,
    unavailableReason,
}: {
    label: string;
    value?: string;
    mono?: boolean;
    copyable?: boolean;
    unavailableReason?: string;
}) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!value) return;
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold block">
                {label}
            </span>
            {value ? (
                <div className="flex items-center gap-1.5 group">
                    <span className={`text-zinc-200 break-all ${mono ? "font-mono text-[11px]" : ""}`}>
                        {value}
                    </span>
                    {copyable && (
                        <button
                            type="button"
                            onClick={copy}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-white shrink-0"
                            title="Copy to clipboard"
                        >
                            {copied ? (
                                <span className="text-[10px] text-emerald-400">Copied</span>
                            ) : (
                                <Copy size={11} />
                            )}
                        </button>
                    )}
                </div>
            ) : (
                <span className="text-zinc-600 italic text-[11px]">
                    {unavailableReason || "Not available"}
                </span>
            )}
        </div>
    );
}

function formatMs(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

