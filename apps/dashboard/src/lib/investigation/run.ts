import {
    investigate,
} from "@halo/investigation-engine";

import { getIssue } from "@/actions/issue";

import {
    eventsToEvidence,
} from "./evidence";

export async function investigateIssue(
    issueId: string,
    projectId: string
) {
    const issue = await getIssue(
        issueId,
        projectId
    );

    if (!issue) {
        throw new Error(
            "Issue not found"
        );
    }

    const evidence =
        eventsToEvidence(
            issue.events
        );

    return investigate(evidence);
}