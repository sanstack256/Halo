import { getReplaySessionForIssue } from "@/actions/replay";
import { ReplayPlayerClient } from "./replay-player-client";
import { ReplayStatus } from "./replay-status";

export async function ReplayView({
    issueId,
    issueTitle,
    projectId,
    planAllowed = true,
}: {
    issueId: string;
    issueTitle?: string;
    projectId: string;
    planAllowed?: boolean;
}) {
    if (!planAllowed) {
        return <ReplayStatus status="PLAN_REQUIRED" projectId={projectId} />;
    }

    const replaySession = await getReplaySessionForIssue(issueId);

    if (!replaySession) {
        return <ReplayStatus status="NO_REPLAY" projectId={projectId} />;
    }

    if (replaySession.status === "RECORDING") {
        return <ReplayStatus status="RECORDING" projectId={projectId} />;
    }

    if (replaySession.status === "PROCESSING") {
        return <ReplayStatus status="PROCESSING" projectId={projectId} />;
    }

    if (replaySession.status === "EXPIRED") {
        return <ReplayStatus status="EXPIRED" projectId={projectId} />;
    }

    return (
        <ReplayPlayerClient
            replaySession={replaySession}
            issueTitle={issueTitle}
        />
    );
}
