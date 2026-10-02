"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Users, Wifi, WifiOff, MessageSquare, Shield, Clock, HelpCircle, AlertCircle, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import {
    getInvestigationCollaborationState,
    sendPresenceHeartbeat,
    addInvestigationComment,
    recordPeerVerdict,
    deleteInvestigationComment,
    type InvestigationCollaborationState,
} from "@/actions/collaboration";
import type { ActiveParticipantSummary, InvestigationArea } from "@/lib/investigation/collaboration-hub";
import { InvestigationActivityFeed } from "./investigation-activity-feed";
import { EvidenceCommentDrawer } from "./evidence-comment-drawer";

interface Props {
    investigationId: string;
    projectId: string;
    isTeamPlan: boolean;
    currentArea?: InvestigationArea;
}

export function InvestigationCollaborativeRoom({
    investigationId,
    projectId,
    isTeamPlan,
    currentArea = "OVERVIEW",
}: Props) {
    const [state, setState] = useState<InvestigationCollaborationState | null>(null);
    const [activeDrawerTarget, setActiveDrawerTarget] = useState<{
        type: "INVESTIGATION" | "HYPOTHESIS" | "EVIDENCE" | "CAUSAL_EDGE" | "TOPOLOGY_NODE" | "REPLAY";
        id?: string;
        title?: string;
        evidenceId?: string;
    } | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const clientIdRef = useRef<string>(`client_${Math.random().toString(36).slice(2, 10)}`);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Initial load of authoritative server state
    const loadAuthoritativeState = useCallback(async () => {
        if (!isTeamPlan) return;
        try {
            const data = await getInvestigationCollaborationState(investigationId);
            setState(data);
        } catch (err) {
            console.warn("[CollaborationRoom] Unable to load collaboration state:", err);
        }
    }, [investigationId, isTeamPlan]);

    // Presence Heartbeat Loop (every 12 seconds)
    useEffect(() => {
        if (!isTeamPlan) return;

        loadAuthoritativeState();

        const sendHeartbeat = async () => {
            try {
                const active = await sendPresenceHeartbeat({
                    investigationId,
                    clientId: clientIdRef.current,
                    currentArea,
                });
                setState((prev) => (prev ? { ...prev, presence: active } : prev));
            } catch (err) {
                console.warn("[CollaborationRoom] Heartbeat error:", err);
            }
        };

        sendHeartbeat();
        const interval = setInterval(sendHeartbeat, 12_000);

        return () => {
            clearInterval(interval);
        };
    }, [investigationId, isTeamPlan, currentArea, loadAuthoritativeState]);

    // Server-Sent Events (SSE) Stream Subscription
    useEffect(() => {
        if (!isTeamPlan) return;

        let isMounted = true;
        const sseUrl = `/api/investigations/${investigationId}/events`;

        const connectSSE = () => {
            if (!isMounted) return;
            const es = new EventSource(sseUrl);
            eventSourceRef.current = es;

            es.onopen = () => {
                if (!isMounted) return;
                setIsConnected(true);
                setIsReconnecting(false);
            };

            es.onmessage = (e) => {
                if (!isMounted) return;
                try {
                    const event = JSON.parse(e.data);
                    handleDomainEvent(event);
                } catch (err) {
                    console.error("[CollaborationRoom] Error parsing SSE payload:", err);
                }
            };

            es.onerror = () => {
                if (!isMounted) return;
                setIsConnected(false);
                setIsReconnecting(true);
                es.close();
                // Attempt reconnect with backoff
                setTimeout(() => {
                    if (isMounted) {
                        loadAuthoritativeState();
                        connectSSE();
                    }
                }, 4000);
            };
        };

        connectSSE();

        return () => {
            isMounted = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [investigationId, isTeamPlan, loadAuthoritativeState]);

    // Dispatch domain events into local state incrementally without full-page reloads
    const handleDomainEvent = (event: any) => {
        if (!event || !event.type) return;

        switch (event.type) {
            case "CONNECTED":
                setIsConnected(true);
                if (event.payload?.activeParticipants) {
                    setState((prev) =>
                        prev ? { ...prev, presence: event.payload.activeParticipants } : prev
                    );
                }
                break;

            case "PRESENCE_UPDATED":
                if (event.payload?.activeParticipants) {
                    setState((prev) =>
                        prev ? { ...prev, presence: event.payload.activeParticipants } : prev
                    );
                }
                break;

            case "COMMENT_ADDED":
                if (event.payload?.comment) {
                    setState((prev) => {
                        if (!prev) return prev;
                        const exists = prev.comments.some((c) => c.id === event.payload.comment.id);
                        if (exists) return prev;
                        return {
                            ...prev,
                            comments: [...prev.comments, event.payload.comment],
                        };
                    });
                }
                break;

            case "COMMENT_EDITED":
                if (event.payload?.comment) {
                    setState((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            comments: prev.comments.map((c) =>
                                c.id === event.payload.comment.id ? event.payload.comment : c
                            ),
                        };
                    });
                }
                break;

            case "COMMENT_DELETED":
                if (event.payload?.commentId) {
                    setState((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            comments: prev.comments.filter((c) => c.id !== event.payload.commentId),
                        };
                    });
                }
                break;

            case "VERDICT_RECORDED":
                if (event.payload?.verdict) {
                    setState((prev) => {
                        if (!prev) return prev;
                        const filtered = prev.verdicts.filter(
                            (v) =>
                                !(
                                    v.hypothesisId === event.payload.verdict.hypothesisId &&
                                    v.authorId === event.payload.verdict.authorId
                                )
                        );
                        return {
                            ...prev,
                            verdicts: [event.payload.verdict, ...filtered],
                        };
                    });
                }
                break;

            case "ACTIVITY_RECORDED":
                if (event.payload?.activity) {
                    setState((prev) => {
                        if (!prev) return prev;
                        const exists = prev.activities.some((a) => a.id === event.payload.activity.id);
                        if (exists) return prev;
                        return {
                            ...prev,
                            activities: [event.payload.activity, ...prev.activities.slice(0, 49)],
                        };
                    });
                }
                break;

            case "RELATION_PROPOSED":
                if (event.payload?.relation) {
                    setState((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            proposedRelations: [...prev.proposedRelations, event.payload.relation],
                        };
                    });
                }
                break;
        }
    };

    if (!isTeamPlan) {
        return (
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                            <Lock size={16} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-200">
                                Collaborative Investigation Rooms
                            </div>
                            <div className="text-xs text-zinc-400">
                                Live presence, peer verdicts on hypotheses, and evidence annotations require the Team plan.
                            </div>
                        </div>
                    </div>
                    <a
                        href="/settings/billing"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
                    >
                        Upgrade to Team
                    </a>
                </div>
            </div>
        );
    }

    const participants = state?.presence || [];
    const commentsCount = state?.comments.length || 0;
    const activitiesCount = state?.activities.length || 0;

    return (
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 mb-8 shadow-sm">
            {/* Live Presence Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
                        <div
                            className={`w-2 h-2 rounded-full ${
                                isConnected
                                    ? "bg-emerald-500 animate-pulse"
                                    : isReconnecting
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-zinc-500"
                            }`}
                        />
                        <span className="text-xs font-mono font-medium text-zinc-300">
                            {participants.length} Active {participants.length === 1 ? "Engineer" : "Engineers"}
                        </span>
                    </div>

                    {/* Active Participant Avatars */}
                    <div className="flex items-center -space-x-2">
                        {participants.slice(0, 6).map((p) => {
                            const initials = (p.userName || p.userEmail)
                                .split(" ")
                                .map((s) => s[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase();

                            return (
                                <div
                                    key={p.userId}
                                    title={`${p.userName} (${p.userEmail}) · Focused on: ${p.currentArea}${
                                        p.tabCount > 1 ? ` · ${p.tabCount} tabs` : ""
                                    }`}
                                    className="relative flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-950 text-[10px] font-bold text-zinc-200 shadow-sm cursor-help hover:z-10 hover:border-indigo-500 transition"
                                >
                                    {initials}
                                    {p.tabCount > 1 && (
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-indigo-600 rounded-full text-[8px] flex items-center justify-center text-white border border-zinc-950">
                                            {p.tabCount}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {participants.length > 6 && (
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-950 text-[10px] font-medium text-zinc-400">
                                +{participants.length - 6}
                            </div>
                        )}
                    </div>

                    {/* Active focus pill */}
                    {participants.length > 0 && (
                        <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 pl-2">
                            <span className="text-zinc-500">Live focus:</span>
                            <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 font-mono text-[11px]">
                                {participants[0]?.userName}: {participants[0]?.currentArea}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right controls: quick comment & activity trigger */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() =>
                            setActiveDrawerTarget({
                                type: "INVESTIGATION",
                                title: "General Investigation Notes",
                            })
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition"
                    >
                        <MessageSquare size={13} className="text-zinc-400" />
                        <span>Notes ({commentsCount})</span>
                    </button>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 pl-2">
                        {isConnected ? (
                            <>
                                <Wifi size={12} className="text-emerald-500" />
                                <span>Live Sync</span>
                            </>
                        ) : isReconnecting ? (
                            <>
                                <WifiOff size={12} className="text-amber-500" />
                                <span>Reconnecting...</span>
                            </>
                        ) : (
                            <>
                                <WifiOff size={12} className="text-zinc-500" />
                                <span>Offline</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Collapsible Activity Feed */}
            {state && (
                <div className="mt-4 pt-4 border-t border-zinc-900">
                    <InvestigationActivityFeed
                        activities={state.activities}
                        onTargetSelect={(target) => setActiveDrawerTarget(target)}
                    />
                </div>
            )}

            {/* Contextual Evidence / Target Comment Drawer */}
            {activeDrawerTarget && state && (
                <EvidenceCommentDrawer
                    investigationId={investigationId}
                    target={activeDrawerTarget}
                    comments={state.comments.filter(
                        (c) =>
                            c.targetType === activeDrawerTarget.type &&
                            (activeDrawerTarget.id ? c.targetId === activeDrawerTarget.id : true)
                    )}
                    onClose={() => setActiveDrawerTarget(null)}
                />
            )}
        </div>
    );
}
