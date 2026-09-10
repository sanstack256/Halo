"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
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
        startedAt: Date | string;
        endedAt?: Date | string | null;
        errorAt?: Date | string | null;
        totalDurationMs?: number | null;
        status: string;
        issueId?: string | null;
        traceId?: string | null;
        requestId?: string | null;
        viewportWidth?: number | null;
        viewportHeight?: number | null;
    };
    issueTitle?: string;
    initialTimeMs?: number;
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
    initialTimeMs,
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
    const [playerError, setPlayerError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

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

        // 2. Parse real user interaction and custom events from rrweb event stream
        let lastInteractionTime = -500;

        for (const ev of events) {
            const offsetMs = Math.max(0, ev.timestamp - startTimestamp);

            // FullSnapshot (DOM re-render or initial page snapshot)
            if (ev.type === 2 && offsetMs > 1000) {
                markers.push({
                    timeMs: offsetMs,
                    label: "DOM Snapshot",
                    type: "navigation",
                    icon: Navigation,
                    detail: "Full DOM snapshot reconstructed",
                    rawData: { rrwebType: ev.type, offsetMs },
                });
            }

            // IncrementalSnapshot
            if (ev.type === 3 && ev.data) {
                const source = ev.data.source;

                // Mouse interaction (source 2: Click = 2, TouchStart = 7)
                if (source === 2 && (ev.data.type === 2 || ev.data.type === 7)) {
                    if (offsetMs - lastInteractionTime > 300) {
                        markers.push({
                            timeMs: offsetMs,
                            label: ev.data.type === 7 ? "Touch Action" : "User Click",
                            type: "click",
                            icon: MousePointer,
                            detail: `Observed pointer click at (${ev.data.x ?? 0}, ${ev.data.y ?? 0})`,
                            rawData: {
                                rrwebType: ev.type,
                                source,
                                interactionType: ev.data.type === 7 ? "touch" : "click",
                                x: ev.data.x,
                                y: ev.data.y,
                                id: ev.data.id,
                                offsetMs,
                            },
                        });
                        lastInteractionTime = offsetMs;
                    }
                }

                // Form Input / Typing (source 5)
                if (source === 5 && offsetMs - lastInteractionTime > 800) {
                    markers.push({
                        timeMs: offsetMs,
                        label: "Form Input",
                        type: "input",
                        icon: Type,
                        detail: `User entered input on target #${ev.data.id ?? "node"} (masked before transmission)`,
                        rawData: { rrwebType: ev.type, source, id: ev.data.id, offsetMs, privacy: "MASKED" },
                    });
                    lastInteractionTime = offsetMs;
                }

                // Scroll (source 3)
                if (source === 3 && offsetMs - lastInteractionTime > 1500) {
                    markers.push({
                        timeMs: offsetMs,
                        label: "User Scroll",
                        type: "scroll",
                        icon: Move,
                        detail: `Scrolled to (${ev.data.x ?? 0}, ${ev.data.y ?? 0})`,
                        rawData: { rrwebType: ev.type, source, x: ev.data.x, y: ev.data.y, offsetMs },
                    });
                    lastInteractionTime = offsetMs;
                }

                // Viewport Resize (source 4)
                if (source === 4 && offsetMs - lastInteractionTime > 1500) {
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

            // Custom rrweb events (type 5)
            if (ev.type === 5 && ev.data) {
                const tag = ev.data.tag;
                const payload = ev.data.payload || {};

                if (tag === "halo:navigation") {
                    markers.push({
                        timeMs: offsetMs,
                        label: "Navigation",
                        type: "navigation",
                        icon: Compass,
                        detail: `Navigated to ${payload.to || ""}`,
                        rawData: { tag, ...payload, offsetMs },
                    });
                } else if (tag === "halo:request") {
                    const statusStr = payload.status ? ` [${payload.status}]` : "";
                    markers.push({
                        timeMs: offsetMs,
                        label: payload.failed ? "Failed Request" : "Network Request",
                        type: payload.failed ? "error" : "custom",
                        icon: Zap,
                        detail: `${payload.method || "GET"} ${payload.url || ""}${statusStr}`,
                        traceId: payload.traceId,
                        rawData: { tag, ...payload, offsetMs },
                    });
                } else if (tag === "halo:console") {
                    markers.push({
                        timeMs: offsetMs,
                        label: "Console Error",
                        type: "error",
                        icon: Terminal,
                        detail: payload.message || "Console error logged",
                        rawData: { tag, ...payload, offsetMs },
                    });
                } else if (tag === "halo:error") {
                    markers.push({
                        timeMs: offsetMs,
                        label: "Exception Captured",
                        type: "error",
                        icon: AlertCircle,
                        detail: payload.message || issueTitle || "Unhandled Exception",
                        traceId: payload.traceId,
                        rawData: { tag, ...payload, offsetMs },
                    });
                }
            }
        }

        // 3. Error snap moment — anchored from real replaySession.errorAt if not already added
        if (replaySession.errorAt && !markers.some(m => m.type === "error" && m.label.includes("Exception"))) {
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
                    errorAt: new Date(replaySession.errorAt).toISOString(),
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

        let isCancelled = false;
        let player: any = null;

        async function initPlayer() {
            try {
                const RRWebPlayer = (await import("rrweb-player")).default;

                if (isCancelled || !containerRef.current) return;

                // Safely destroy previous Svelte player instance before clearing DOM
                if (playerInstanceRef.current) {
                    try {
                        playerInstanceRef.current.pause();
                        if (typeof playerInstanceRef.current.$destroy === "function") {
                            playerInstanceRef.current.$destroy();
                        }
                    } catch {}
                    playerInstanceRef.current = null;
                }

                if (containerRef.current) {
                    containerRef.current.innerHTML = "";
                }

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
                        mouseTail: false, // Disables red line cursor trail
                        speed: playbackSpeed,
                    },
                });

                if (isCancelled) {
                    try {
                        player.pause();
                        if (typeof player.$destroy === "function") {
                            player.$destroy();
                        }
                    } catch {}
                    return;
                }

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

                    // Error-centered playback: Seek to requested initial time or error timestamp on load
                    const errorTime = replaySession.errorAt ? new Date(replaySession.errorAt).getTime() : null;
                    const errorOffset = errorTime ? Math.max(0, errorTime - start) : null;
                    const targetSeek = initialTimeMs !== undefined ? initialTimeMs : (errorOffset !== null ? errorOffset : 0);

                    if (targetSeek > 0 && targetSeek <= total) {
                        try {
                            replayer.play(targetSeek);
                            replayer.pause();
                            setCurrentMs(targetSeek);
                        } catch {}
                    }
                }
            } catch (err: any) {
                console.error("Failed to initialize rrweb-player:", err);
                setPlayerError(err.message || "Failed to initialize replay player");
            }
        }

        initPlayer();

        return () => {
            isCancelled = true;
            if (player) {
                try {
                    player.pause();
                    if (typeof player.$destroy === "function") {
                        player.$destroy();
                    }
                } catch {}
                player = null;
            }
            if (playerInstanceRef.current) {
                try {
                    playerInstanceRef.current.pause();
                    if (typeof playerInstanceRef.current.$destroy === "function") {
                        playerInstanceRef.current.$destroy();
                    }
                } catch {}
                playerInstanceRef.current = null;
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

    const jumpPrevEvent = () => {
        const pastMarkers = timelineMarkers.filter(m => m.timeMs < currentMs - 250);
        if (pastMarkers.length > 0) {
            seekTo(pastMarkers[pastMarkers.length - 1].timeMs);
        } else {
            seekTo(0);
        }
    };

    const jumpNextEvent = () => {
        const futureMarkers = timelineMarkers.filter(m => m.timeMs > currentMs + 250);
        if (futureMarkers.length > 0) {
            seekTo(futureMarkers[0].timeMs);
        }
    };

    const copyText = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1500);
    };

    const copyDeepLink = () => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        url.searchParams.set("t", String(Math.round(currentMs)));
        navigator.clipboard.writeText(url.toString());
        setCopiedField("deeplink");
        setTimeout(() => setCopiedField(null), 1500);
    };

    const currentFormatted = formatMsPrecise(currentMs);
    const totalFormatted = formatMsPrecise(durationMs);

    return (
        <div className="halo-card p-5 space-y-4 overflow-hidden">

            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                        {replaySession.url || "Session Recording"}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted">
                        {totalFormatted}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={copyDeepLink}
                        className="halo-btn halo-btn-sm halo-btn-secondary text-xs gap-1.5"
                        title="Copy direct link to current playback position"
                    >
                        {copiedField === "deeplink" ? (
                            <>
                                <Check size={12} className="text-teal-400" />
                                <span className="text-teal-300">Link Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={12} />
                                Share at {currentFormatted}
                            </>
                        )}
                    </button>

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
                        href={`/projects/${replaySession.projectId}/investigations/new?issueId=${replaySession.issueId || ""}&traceId=${replaySession.traceId || ""}&sessionId=${replaySession.sessionId}`}
                        className="halo-btn halo-btn-sm halo-btn-primary text-xs gap-1.5"
                    >
                        <Sparkles size={12} />
                        Investigate
                    </Link>
                </div>
            </div>

            {/* RRWeb Canvas Viewport — real application DOM, no fake browser chrome */}
            <div className="relative rounded-xl bg-[#080b11] border border-white/10 overflow-hidden flex flex-col items-center">
                {/* Minimal honest session info strip — only real data from recording */}
                <div className="w-full h-7 bg-[#0d1117] border-b border-white/[0.06] flex items-center justify-between px-3 gap-2 text-[11px] font-mono text-zinc-500">
                    <span className="truncate max-w-xs text-zinc-400">
                        {replaySession.url || "Session recording"}
                    </span>
                    <span className="shrink-0">{events.length} DOM events</span>
                </div>

                {/* Explicit style tag to guarantee fake simulated cursor is removed */}
                <style>{`
                    .replayer-wrapper .replayer-mouse,
                    .replayer-mouse,
                    .replayer-mouse-tail {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                        width: 0 !important;
                        height: 0 !important;
                    }
                `}</style>

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
                        className={`pointer-events-auto w-16 h-16 rounded-full bg-[#080b11] hover:bg-[#0b0f16] text-[#f2f5f8] border border-[#222b38] flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"}`}
                    >
                        {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1 text-accent" />}
                    </button>
                </div>

                {/* Controls & Scrubber */}
                <div className="w-full bg-[#0f141f] border-t border-white/10 p-3 space-y-2 z-10">
                    {/* Scrubber with Error Marker */}
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-400 w-16 text-right">
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
                                    title={`Exception at ${formatMsPrecise(errorOffsetMs)}`}
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

                        <span className="text-[11px] font-mono text-zinc-500 w-16">
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
                                title="Restart from beginning"
                            >
                                <RotateCcw size={13} />
                            </button>

                            <button
                                type="button"
                                onClick={jumpPrevEvent}
                                className="halo-btn halo-btn-sm halo-btn-secondary p-1.5"
                                title="Previous recorded event"
                            >
                                <ChevronLeft size={13} />
                            </button>

                            <button
                                type="button"
                                onClick={jumpNextEvent}
                                className="halo-btn halo-btn-sm halo-btn-secondary p-1.5"
                                title="Next recorded event"
                            >
                                <ChevronRight size={13} />
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

            {/* Correlated Production Telemetry Evidence Panel */}
            <div className="p-4 rounded-xl bg-[#0d1117] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-accent" />
                        Correlated Telemetry Evidence
                    </span>
                    {replaySession.issueId && (
                        <Link
                            href={`/projects/${replaySession.projectId}/investigations/new?issueId=${replaySession.issueId}&traceId=${replaySession.traceId || ""}&sessionId=${replaySession.sessionId}`}
                            className="halo-btn halo-btn-sm halo-btn-primary text-xs gap-1.5"
                        >
                            <Sparkles size={12} />
                            Investigate Failure
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {/* Session ID */}
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-zinc-500 block">Session ID</span>
                        <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs text-zinc-200 truncate">{replaySession.sessionId}</span>
                            <button
                                onClick={() => copyText(replaySession.sessionId, "session")}
                                className="text-zinc-500 hover:text-white shrink-0"
                                title="Copy Session ID"
                            >
                                {copiedField === "session" ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
                            </button>
                        </div>
                    </div>

                    {/* Issue */}
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-zinc-500 block">Associated Issue</span>
                        {replaySession.issueId ? (
                            <Link
                                href={`/projects/${replaySession.projectId}/issues/${replaySession.issueId}`}
                                className="text-xs text-red-300 hover:underline truncate block font-medium"
                            >
                                {issueTitle || "Correlated Issue"}
                            </Link>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">None</span>
                        )}
                    </div>

                    {/* Trace ID */}
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-zinc-500 block">Distributed Trace</span>
                        {replaySession.traceId ? (
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-xs text-zinc-200 truncate">{replaySession.traceId}</span>
                                <button
                                    onClick={() => copyText(replaySession.traceId!, "trace")}
                                    className="text-zinc-500 hover:text-white shrink-0"
                                    title="Copy Trace ID"
                                >
                                    {copiedField === "trace" ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
                                </button>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">Not captured</span>
                        )}
                    </div>

                    {/* Request ID */}
                    <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-zinc-500 block">HTTP Request ID</span>
                        {replaySession.requestId ? (
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-xs text-zinc-200 truncate">{replaySession.requestId}</span>
                                <button
                                    onClick={() => copyText(replaySession.requestId!, "request")}
                                    className="text-zinc-500 hover:text-white shrink-0"
                                    title="Copy Request ID"
                                >
                                    {copiedField === "request" ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
                                </button>
                            </div>
                        ) : (
                            <span className="text-xs text-zinc-500 italic">Not captured</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Session Timeline */}
            <div className="pt-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                        Observed Session Timeline
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
                                        {formatMsPrecise(marker.timeMs)}
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

function formatMsPrecise(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = Math.floor(ms % 1000);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}


