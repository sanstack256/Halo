"use client";

import Link from "next/link";
import { AlertCircle, Clock, Lock, ShieldAlert, Sparkles, VideoOff, WifiOff } from "lucide-react";

export type ReplayStateStatus =
    | "NO_REPLAY"
    | "RECORDING"
    | "PROCESSING"
    | "EXPIRED"
    | "DISABLED"
    | "PLAN_REQUIRED"
    | "ERROR";

export function ReplayStatus({
    status,
    message,
    projectId,
}: {
    status: ReplayStateStatus;
    message?: string;
    projectId?: string;
}) {
    switch (status) {
        case "RECORDING":
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 animate-pulse">
                        <Clock size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Session Recording in Progress</h4>
                        <p className="text-xs text-secondary max-w-sm">
                            {message || "The browser session is currently being recorded. The complete replay will become available once the session concludes."}
                        </p>
                    </div>
                </div>
            );

        case "PROCESSING":
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent animate-spin">
                        <Sparkles size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Processing Session Replay</h4>
                        <p className="text-xs text-secondary max-w-sm">
                            {message || "Stitching and indexing captured DOM mutation chunks. Replay will be ready in a few seconds."}
                        </p>
                    </div>
                </div>
            );

        case "EXPIRED":
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-muted">
                        <Clock size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Session Replay Expired</h4>
                        <p className="text-xs text-secondary max-w-sm">
                            {message || "This replay exceeded the data retention window of your current plan and has been purged."}
                        </p>
                    </div>
                    <Link href="/pricing" className="halo-btn halo-btn-sm halo-btn-secondary text-xs">
                        View Retention Plans
                    </Link>
                </div>
            );

        case "PLAN_REQUIRED":
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[280px]">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <Lock size={22} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Session Replay is a Developer &amp; Team Feature</h4>
                        <p className="text-xs text-secondary max-w-md leading-relaxed">
                            Watch the exact DOM interactions, mouse clicks, and network requests leading up to this crash with privacy-safe browser session reconstruction.
                        </p>
                    </div>
                    <Link href="/pricing" className="halo-btn halo-btn-sm halo-btn-primary text-xs gap-1.5">
                        <Sparkles size={13} />
                        Upgrade to Developer Plan
                    </Link>
                </div>
            );

        case "DISABLED":
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-muted">
                        <VideoOff size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Session Replay Disabled</h4>
                        <p className="text-xs text-secondary max-w-sm">
                            Session recording is disabled in project settings. Enable it to capture browser session replays on future errors.
                        </p>
                    </div>
                    {projectId && (
                        <Link href={`/projects/${projectId}/settings`} className="halo-btn halo-btn-sm halo-btn-secondary text-xs">
                            Project Settings
                        </Link>
                    )}
                </div>
            );

        case "ERROR":
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                        <AlertCircle size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">Replay Capture Incomplete</h4>
                        <p className="text-xs text-secondary max-w-sm">
                            {message || "The browser session recording was interrupted before final chunks could be delivered."}
                        </p>
                    </div>
                </div>
            );

        case "NO_REPLAY":
        default:
            return (
                <div className="halo-card p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
                    <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted">
                        <VideoOff size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white">No Session Replay Captured</h4>
                        <p className="text-xs text-secondary max-w-md leading-relaxed">
                            {message || "This event was emitted by a server runtime, or occurred on a client session where Session Replay was not initialized. Install @halo-trace/replay in your frontend app to record browser sessions."}
                        </p>
                    </div>
                    {projectId && (
                        <Link href={`/projects/${projectId}/sdk`} className="halo-btn halo-btn-sm halo-btn-secondary text-xs">
                            View SDK Setup
                        </Link>
                    )}
                </div>
            );
    }
}
