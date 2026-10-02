import type React from "react";
import {
    AlertCircle,
    Compass,
    Flame,
    MonitorPlay,
    MousePointer,
    Move,
    Navigation,
    Terminal,
    Type,
    Zap,
} from "lucide-react";

export type FilterCategoryId = "all" | "errors" | "frustration" | "network" | "navigation" | "interactions";

export type TimelineMarker = {
    timeMs: number;
    label: string;
    type: "navigation" | "click" | "input" | "scroll" | "resize" | "error" | "custom";
    icon: React.ComponentType<{ size?: number; className?: string }>;
    detail: string;
    traceId?: string | null;
    category?: FilterCategoryId;
    /** Raw rrweb event data for inspector panel */
    rawData?: Record<string, unknown>;
};

export function extractTimelineMarkers(
    events: any[],
    replaySession: {
        url?: string | null;
        errorAt?: Date | string | null;
        traceId?: string | null;
        requestId?: string | null;
        sessionId?: string;
    },
    issueTitle?: string
): TimelineMarker[] {
    if (!events || !Array.isArray(events) || events.length === 0) return [];

    const startTimestamp = events[0]?.timestamp || 0;
    const markers: TimelineMarker[] = [];

    // 1. Initial Page Load
    markers.push({
        timeMs: 0,
        label: "Page Load",
        type: "navigation",
        category: "navigation",
        icon: Compass,
        detail: replaySession.url || "DOM Initialized",
        rawData: { url: replaySession.url, offsetMs: 0 },
    });

    // 2. Parse real user interaction and custom events from rrweb event stream
    let lastInteractionTime = -500;

    for (const ev of events) {
        if (!ev || typeof ev !== "object") continue;
        const offsetMs = Math.max(0, (ev.timestamp || startTimestamp) - startTimestamp);

        // FullSnapshot (DOM re-render or initial page snapshot)
        if (ev.type === 2 && offsetMs > 1000) {
            markers.push({
                timeMs: offsetMs,
                label: "DOM Snapshot",
                type: "navigation",
                category: "navigation",
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
                        category: "interactions",
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
                    category: "interactions",
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
                    category: "interactions",
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
                    category: "interactions",
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

            if (tag === "halo:rage-click") {
                markers.push({
                    timeMs: offsetMs,
                    label: "Rage Click Burst",
                    type: "error",
                    category: "frustration",
                    icon: Flame,
                    detail: `Burst: ${payload.count || 3} clicks in ${payload.durationMs || 1000}ms on ${payload.targetSelector || "element"}`,
                    rawData: { tag, ...payload, offsetMs },
                });
            } else if (tag === "halo:dead-click") {
                markers.push({
                    timeMs: offsetMs,
                    label: "Dead Click",
                    type: "custom",
                    category: "frustration",
                    icon: MousePointer,
                    detail: `Dead click: no response within ${payload.inactiveDurationMs || 2500}ms on ${payload.targetSelector || "element"}`,
                    rawData: { tag, ...payload, offsetMs },
                });
            } else if (tag === "halo:lifecycle") {
                markers.push({
                    timeMs: offsetMs,
                    label: `Lifecycle: ${payload.event || "event"}`,
                    type: "navigation",
                    category: "navigation",
                    icon: Compass,
                    detail: `Page state: ${payload.state || payload.event}`,
                    rawData: { tag, ...payload, offsetMs },
                });
            } else if (tag === "halo:navigation") {
                markers.push({
                    timeMs: offsetMs,
                    label: "Navigation",
                    type: "navigation",
                    category: "navigation",
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
                    category: payload.failed ? "errors" : "network",
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
                    category: "errors",
                    icon: Terminal,
                    detail: payload.message || "Console error logged",
                    rawData: { tag, ...payload, offsetMs },
                });
            } else if (tag === "halo:error") {
                markers.push({
                    timeMs: offsetMs,
                    label: "Exception Captured",
                    type: "error",
                    category: "errors",
                    icon: AlertCircle,
                    detail: payload.message || issueTitle || "Unhandled Exception",
                    traceId: payload.traceId,
                    rawData: { tag, ...payload, offsetMs },
                });
            } else if (tag === "halo:trigger") {
                const rawTrigger = typeof payload === "object" && payload !== null ? payload : {};
                const rawType = String(rawTrigger.triggerType || rawTrigger.type || "").trim();
                const upperType = rawType.toUpperCase();
                const reason = typeof rawTrigger.reason === "string" ? rawTrigger.reason : undefined;

                if (rawType || reason) {
                    let label = `Trigger: ${rawType || "Evidence Capture"}`;
                    let markerType: TimelineMarker["type"] = "custom";
                    let category: FilterCategoryId = "interactions";
                    let icon = Zap;
                    let defaultDetail = reason || "Replay evidence capture trigger";

                    if (upperType === "NETWORK_5XX") {
                        label = "Trigger: Network 5xx";
                        markerType = "error";
                        category = "network";
                        icon = Zap;
                        defaultDetail = reason || "Network 5xx response failure trigger";
                    } else if (upperType === "ERROR") {
                        label = "Trigger: Application Error";
                        markerType = "error";
                        category = "errors";
                        icon = AlertCircle;
                        defaultDetail = reason || issueTitle || "Application error trigger";
                    } else if (upperType === "UNHANDLED_REJECTION") {
                        label = "Trigger: Unhandled Rejection";
                        markerType = "error";
                        category = "errors";
                        icon = AlertCircle;
                        defaultDetail = reason || "Unhandled Promise Rejection trigger";
                    } else if (upperType === "RAGE_CLICK") {
                        label = "Trigger: Rage Click";
                        markerType = "error";
                        category = "frustration";
                        icon = Flame;
                        defaultDetail = reason || "Rage click burst trigger";
                    } else if (upperType === "DEAD_CLICK") {
                        label = "Trigger: Dead Click";
                        markerType = "custom";
                        category = "frustration";
                        icon = MousePointer;
                        defaultDetail = reason || "Dead click trigger";
                    } else if (upperType === "MANUAL") {
                        label = "Trigger: Manual Capture";
                        markerType = "custom";
                        category = "interactions";
                        icon = MonitorPlay;
                        defaultDetail = reason || "Manual replay capture trigger";
                    } else if (upperType === "SAMPLED" || upperType === "SAMPLE") {
                        label = "Trigger: Sampled Session";
                        markerType = "custom";
                        category = "interactions";
                        icon = Compass;
                        defaultDetail = reason || "Automated sampling trigger";
                    } else if (rawType) {
                        label = `Trigger: ${rawType}`;
                        markerType = "custom";
                        category = "interactions";
                        icon = Zap;
                        defaultDetail = reason || `Replay trigger: ${rawType}`;
                    }

                    let triggerTimeMs = offsetMs;
                    if (rawTrigger.timestamp) {
                        const parsedTime = new Date(rawTrigger.timestamp).getTime();
                        if (!isNaN(parsedTime) && startTimestamp > 0) {
                            triggerTimeMs = Math.max(0, parsedTime - startTimestamp);
                        }
                    }

                    markers.push({
                        timeMs: triggerTimeMs,
                        label,
                        type: markerType,
                        category,
                        icon,
                        detail: defaultDetail,
                        traceId: rawTrigger.traceId || null,
                        rawData: {
                            tag,
                            triggerType: upperType || rawType,
                            ...rawTrigger,
                            offsetMs: triggerTimeMs,
                        },
                    });
                }
            }
        }
    }

    // 3. Error snap moment — anchored from real replaySession.errorAt if not already added
    if (replaySession.errorAt && !markers.some((m) => m.type === "error" && m.label.includes("Exception"))) {
        const errorTime = new Date(replaySession.errorAt).getTime();
        const errorOffsetMs = Math.max(0, errorTime - startTimestamp);

        markers.push({
            timeMs: errorOffsetMs,
            label: "Exception Captured",
            type: "error",
            category: "errors",
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
}
