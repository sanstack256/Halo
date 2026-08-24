"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowUpRight,
    Compass,
    ExternalLink,
    FastForward,
    Layers,
    Maximize2,
    MousePointer,
    Move,
    Navigation,
    Pause,
    Play,
    RotateCcw,
    Sparkles,
    Terminal,
    Type,
    Zap,
} from "lucide-react";
import { getReplayEvents } from "@/actions/replay";
import { ReplayStatus } from "./replay-status";
import "rrweb-player/dist/style.css";

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
};

export function ReplayPlayerClient({
    replaySession,
    issueTitle,
}: ReplayPlayerClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerInstanceRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<any[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

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

    // Extract dynamic timeline milestones from the real rrweb events array
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
        });

        // 2. Parse real user interaction events from rrweb event stream
        let lastInteractionTime = -500; // debounce threshold for micro-events

        for (const ev of events) {
            const offsetMs = Math.max(0, ev.timestamp - startTimestamp);

            // FullSnapshot (DOM re-render or route change)
            if (ev.type === 2 && offsetMs > 1000) {
                markers.push({
                    timeMs: offsetMs,
                    label: "DOM Snapshot",
                    type: "navigation",
                    icon: Navigation,
                    detail: "DOM Viewport Refresh",
                });
            }

            // IncrementalSnapshot
            if (ev.type === 3 && ev.data) {
                const source = ev.data.source;

                // Mouse interaction (Click = 2, TouchStart = 4, etc.)
                if (source === 1 && (ev.data.type === 2 || ev.data.type === 4)) {
                    if (offsetMs - lastInteractionTime > 300) {
                        markers.push({
                            timeMs: offsetMs,
                            label: "User Click",
                            type: "click",
                            icon: MousePointer,
                            detail: `Click at (${ev.data.x ?? 0}, ${ev.data.y ?? 0})`,
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
                        detail: "User entered text",
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
                        detail: `${ev.data.width ?? 0}x${ev.data.height ?? 0}`,
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
                });
            }
        }

        // 3. Error snap moment
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
            });
        }

        // Sort markers chronologically
        return markers.sort((a, b) => a.timeMs - b.timeMs);
    }, [events, replaySession, issueTitle]);

    // Initialize rrweb-player when events are loaded
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
                        speed: playbackSpeed,
                    },
                });

                playerInstanceRef.current = player;

                const replayer = player.getReplayer();
                if (replayer) {
                    replayer.on("start", () => setIsPlaying(true));
                    replayer.on("pause", () => setIsPlaying(false));
                    replayer.on("finish", () => setIsPlaying(false));
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

    function togglePlay() {
        const player = playerInstanceRef.current;
        if (!player) return;
        if (isPlaying) {
            player.pause();
            setIsPlaying(false);
        } else {
            player.play();
            setIsPlaying(true);
        }
    }

    function seekTo(ms: number) {
        const player = playerInstanceRef.current;
        if (!player) return;
        player.goto(ms);
        setCurrentMs(ms);
    }

    function setSpeed(speed: number) {
        setPlaybackSpeed(speed);
        const player = playerInstanceRef.current;
        if (!player) return;
        player.setSpeed(speed);
    }

    function jumpToError() {
        if (!replaySession.errorAt || events.length === 0) return;
        const start = events[0].timestamp;
        const errorTime = new Date(replaySession.errorAt).getTime();
        const errorOffset = Math.max(0, errorTime - start - 2000); // 2s before error
        seekTo(errorOffset);
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
                        <Activity size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">Browser Session Replay</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                Reconstructed DOM Stream
                            </span>
                        </div>
                        <p className="text-xs text-secondary">
                            {replaySession.url || "Web Application"} &bull; {replaySession.browser || "Browser"} ({replaySession.os || "OS"})
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {errorOffsetMs !== null && (
                        <button
                            type="button"
                            onClick={jumpToError}
                            className="halo-btn halo-btn-sm halo-btn-secondary text-xs gap-1.5"
                        >
                            <Zap size={12} className="text-amber-400" />
                            Jump to Crash (-2s)
                        </button>
                    )}

                    <Link
                        href={`/projects/${replaySession.projectId}/investigations/new?issueId=${replaySession.issueId || ""}`}
                        className="halo-btn halo-btn-sm halo-btn-primary text-xs gap-1.5"
                    >
                        <Sparkles size={12} />
                        Investigate this session
                    </Link>
                </div>
            </div>

            {/* RRWeb Canvas Viewport Frame */}
            <div className="relative rounded-2xl bg-[#080b11] border border-white/10 shadow-2xl overflow-hidden flex flex-col items-center">
                {/* Browser URL Bar header */}
                <div className="w-full h-8 bg-[#0f141f] border-b border-white/10 flex items-center justify-between px-3 gap-2 text-[11px] font-mono text-zinc-400">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 max-w-lg h-5 bg-[#080b11] rounded border border-white/5 px-2 flex items-center text-zinc-300 truncate">
                        {replaySession.url || "Web Application"}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                        {events.length} DOM snapshots
                    </div>
                </div>

                {/* Player Target container */}
                <div
                    ref={containerRef}
                    className="w-full min-h-[480px] bg-white flex items-center justify-center overflow-auto"
                />

                {/* Custom Halo Controls & Scrubber */}
                <div className="w-full bg-[#0f141f] border-t border-white/10 p-3 space-y-2">
                    {/* Scrubber with Error Marker */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-400 w-12 text-right">
                            {currentFormatted}
                        </span>

                        <div className="relative flex-1 flex items-center">
                            {/* Error milestone pin on the timeline */}
                            {errorOffsetMs !== null && durationMs > 0 && (
                                <div
                                    className="absolute -top-1.5 -bottom-1.5 w-1 bg-red-500 z-10 rounded-full cursor-pointer hover:scale-125 transition-transform"
                                    style={{
                                        left: `${Math.min(100, Math.max(0, (errorOffsetMs / durationMs) * 100))}%`,
                                    }}
                                    onClick={() => seekTo(errorOffsetMs)}
                                    title="Exception captured at this timestamp"
                                />
                            )}

                            <input
                                type="range"
                                min="0"
                                max={durationMs || 100}
                                step="100"
                                value={currentMs}
                                onChange={(e) => seekTo(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none"
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
                            >
                                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                                {isPlaying ? "Pause" : "Play Replay"}
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
                                {([0.5, 1, 2, 4] as const).map((spd) => (
                                    <button
                                        key={spd}
                                        type="button"
                                        onClick={() => setSpeed(spd)}
                                        className={`px-2 py-0.5 rounded ${
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

                        <div className="flex items-center gap-2 text-xs text-muted font-mono">
                            <span>Session ID: {replaySession.sessionId.slice(0, 16)}...</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic Timeline Milestones Extracted from DOM Stream */}
            <div className="rounded-xl bg-surface border border-border p-4 space-y-2">
                <div className="text-muted text-[11px] uppercase tracking-wider font-semibold border-b border-border pb-2 flex items-center justify-between">
                    <span>Captured Session Timeline ({timelineMarkers.length} milestones)</span>
                    <span className="font-mono text-xs text-secondary">Click milestone to seek</span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {timelineMarkers.map((marker, idx) => {
                        const Icon = marker.icon;
                        const isError = marker.type === "error";
                        return (
                            <div
                                key={idx}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                                    isError
                                        ? "bg-red-500/10 border border-red-500/30 text-red-300"
                                        : "bg-surface-elevated hover:bg-surface-hover text-secondary"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => seekTo(marker.timeMs)}
                                    className="flex-1 flex items-center gap-2.5 text-left cursor-pointer"
                                >
                                    <Icon size={14} className={isError ? "text-red-400" : "text-accent"} />
                                    <span className="font-semibold text-white">{marker.label}</span>
                                    <span className="text-muted truncate max-w-sm font-mono text-[11px]">
                                        {marker.detail}
                                    </span>
                                </button>

                                <div className="flex items-center gap-3">
                                    {marker.traceId && (
                                        <Link
                                            href={`/explore/traces`}
                                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 flex items-center gap-1 hover:bg-accent/20"
                                        >
                                            <Layers size={10} />
                                            Trace: {marker.traceId.slice(0, 8)}...
                                        </Link>
                                    )}
                                    <span className="font-mono text-[11px] text-muted">
                                        {formatMs(marker.timeMs)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function formatMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
