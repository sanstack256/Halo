import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MonitorPlay } from "lucide-react";
import { getReplaySession } from "@/actions/replay";
import { ReplayPlayerClient } from "@/components/replay/replay-player-client";
import { ReplayStatus } from "@/components/replay/replay-status";

type Props = {
    params: Promise<{
        id: string;
        replayId: string;
    }>;
    searchParams: Promise<{
        t?: string;
    }>;
};

export default async function ReplayDetailPage({ params, searchParams }: Props) {
    const { id: projectId, replayId } = await params;
    const { t } = await searchParams;

    const replaySession = await getReplaySession(replayId);

    if (!replaySession || replaySession.projectId !== projectId) {
        notFound();
    }

    if (replaySession.status === "RECORDING") {
        return (
            <div className="space-y-6">
                <Link
                    href={`/projects/${projectId}/replays`}
                    className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Replays
                </Link>
                <ReplayStatus status="RECORDING" projectId={projectId} />
            </div>
        );
    }

    if (replaySession.status === "PROCESSING") {
        return (
            <div className="space-y-6">
                <Link
                    href={`/projects/${projectId}/replays`}
                    className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Replays
                </Link>
                <ReplayStatus status="PROCESSING" projectId={projectId} />
            </div>
        );
    }

    if (replaySession.status === "EXPIRED") {
        return (
            <div className="space-y-6">
                <Link
                    href={`/projects/${projectId}/replays`}
                    className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Replays
                </Link>
                <ReplayStatus status="EXPIRED" projectId={projectId} />
            </div>
        );
    }

    const initialTimeMs = t && !isNaN(Number(t)) ? Math.max(0, Number(t)) : undefined;

    return (
        <div className="space-y-6 pb-16">
            <div className="flex items-center justify-between">
                <Link
                    href={`/projects/${projectId}/replays`}
                    className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Replays
                </Link>

                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                    <MonitorPlay className="h-3.5 w-3.5 text-accent" />
                    Replay Workspace
                </div>
            </div>

            <ReplayPlayerClient
                replaySession={replaySession}
                initialTimeMs={initialTimeMs}
            />
        </div>
    );
}
