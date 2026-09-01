import { prisma } from "@/lib/prisma";
import type {
    RegressionAnalysisResult,
    RegressionCandidate,
    ChangedFileDetail,
    ChangedFunctionDetail,
    CodeChangeRelationship,
    RegressionConfidence,
} from "@halo/investigation-engine";
import { normalizeRepositoryFilePath } from "../runtime/github-source-utils";
import { formatDeterministicTime } from "@/lib/date-format";

export interface RegressionDetectionOptions {
    projectId: string;
    issueId: string;
    incidentFirstSeen: Date;
    failingLocation?: {
        filePath?: string;
        lineNumber?: number;
        functionName?: string;
    };
    releaseVersion?: string | null;
    commitSha?: string | null;
}

/**
 * Automatically detects code changes, commits, releases, and deployments
 * that correlate with the first appearance of an incident.
 */
export async function detectAutomaticRegression(
    opts: RegressionDetectionOptions
): Promise<RegressionAnalysisResult> {
    const {
        projectId,
        issueId,
        incidentFirstSeen,
        failingLocation,
        releaseVersion,
        commitSha: explicitCommitSha,
    } = opts;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            id: true,
            name: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubToken: true,
            githubDefaultBranch: true,
            releases: {
                take: 10,
                orderBy: { firstSeen: "desc" },
                select: {
                    id: true,
                    version: true,
                    commitSha: true,
                    firstSeen: true,
                    lastSeen: true,
                    errorCount: true,
                    eventCount: true,
                },
            },
        },
    });

    const hasGitIntegration = Boolean(project?.githubRepoOwner && project?.githubRepoName && project?.githubToken);
    const hasDeploymentData = Boolean(project?.releases && project.releases.length > 0);

    const candidates: RegressionCandidate[] = [];
    const unprovenFactors: string[] = [];

    // Step 1: Collect Candidate Commits from GitHub API if integrated
    if (hasGitIntegration && project?.githubRepoOwner && project?.githubRepoName && project?.githubToken) {
        try {
            const commitsUrl = `https://api.github.com/repos/${project.githubRepoOwner}/${project.githubRepoName}/commits?per_page=10`;
            const res = await fetch(commitsUrl, {
                headers: {
                    Accept: "application/vnd.github.v3+json",
                    Authorization: `Bearer ${project.githubToken}`,
                    "User-Agent": "Halo-Trace-Investigation-Engine",
                },
                next: { revalidate: 60 },
            });

            if (res.ok) {
                const commitList = await res.json();
                if (Array.isArray(commitList)) {
                    for (const ghCommit of commitList) {
                        const sha = ghCommit.sha;
                        const shortSha = sha.slice(0, 7);
                        const message = ghCommit.commit?.message?.split("\n")[0] || "Update";
                        const author = ghCommit.commit?.author?.name || ghCommit.author?.login || "Unknown Author";
                        const commitDate = new Date(ghCommit.commit?.author?.date || ghCommit.commit?.committer?.date || Date.now());

                        // Match against release record if one exists with same SHA or version
                        const matchingRelease = project.releases.find((r) => r.commitSha === sha || (releaseVersion && r.version === releaseVersion));
                        const deploymentTime = matchingRelease?.firstSeen || commitDate;

                        // Fetch individual commit diff to inspect changed files and line ranges
                        let changedFiles: ChangedFileDetail[] = [];
                        let changedFunctions: ChangedFunctionDetail[] = [];
                        let codeRel: CodeChangeRelationship = "UNRELATED";
                        let isFailingLocationTouched = false;

                        try {
                            const detailUrl = `https://api.github.com/repos/${project.githubRepoOwner}/${project.githubRepoName}/commits/${sha}`;
                            const detailRes = await fetch(detailUrl, {
                                headers: {
                                    Accept: "application/vnd.github.v3+json",
                                    Authorization: `Bearer ${project.githubToken}`,
                                    "User-Agent": "Halo-Trace-Investigation-Engine",
                                },
                                next: { revalidate: 300 },
                            });

                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                if (Array.isArray(detailData.files)) {
                                    for (const f of detailData.files) {
                                        const normPath = normalizeRepositoryFilePath(f.filename, project.githubRepoName);
                                        const isFailing = Boolean(
                                            failingLocation?.filePath &&
                                            (f.filename.includes(failingLocation.filePath) ||
                                                failingLocation.filePath.includes(f.filename) ||
                                                normPath === failingLocation.filePath)
                                        );

                                        if (isFailing) {
                                            isFailingLocationTouched = true;
                                            codeRel = f.status === "added" ? "INTRODUCED" : "MODIFIED";

                                            if (failingLocation?.functionName) {
                                                changedFunctions.push({
                                                    functionName: failingLocation.functionName,
                                                    filePath: f.filename,
                                                    lineNumber: failingLocation.lineNumber,
                                                    isFailingFunction: true,
                                                    relationship: codeRel,
                                                });
                                            }
                                        }

                                        changedFiles.push({
                                            filePath: f.filename,
                                            status: f.status,
                                            additions: f.additions || 0,
                                            deletions: f.deletions || 0,
                                            patch: f.patch?.slice(0, 500),
                                            isFailingFile: isFailing,
                                        });
                                    }
                                }
                            }
                        } catch {
                            // ignore individual commit fetch failure
                        }

                        // Calculate Confidence Level with strict causality guardrails
                        const minutesDiff = Math.round((incidentFirstSeen.getTime() - deploymentTime.getTime()) / 60000);
                        const isTemporallyPreceding = minutesDiff >= 0 && minutesDiff <= 1440; // within 24h

                        let confidence: RegressionConfidence = "PLAUSIBLE_CANDIDATE";
                        let confidenceScore = 0.4;
                        const supportingReasons: string[] = [];
                        const unprovenGaps: string[] = [];

                        if (isTemporallyPreceding) {
                            supportingReasons.push(`Change deployed ${minutesDiff}m prior to the incident first seen.`);
                            confidenceScore += 0.2;
                        } else {
                            unprovenGaps.push("Change was committed/deployed outside the immediate pre-incident window.");
                        }

                        if (isFailingLocationTouched) {
                            supportingReasons.push(`Commit modified the exact failing source file ("${failingLocation?.filePath}").`);
                            confidenceScore += 0.35;
                            confidence = isTemporallyPreceding ? "STRONGLY_SUPPORTED" : "PLAUSIBLE_CANDIDATE";
                        } else if (failingLocation?.filePath) {
                            unprovenGaps.push(`Failing file "${failingLocation.filePath}" was not modified in this commit.`);
                            confidence = "PLAUSIBLE_CANDIDATE";
                        }

                        if (explicitCommitSha && (explicitCommitSha === sha || explicitCommitSha.startsWith(shortSha))) {
                            supportingReasons.push("Commit SHA is explicitly bound to the error occurrence runtime metadata.");
                            confidenceScore += 0.2;
                            if (isFailingLocationTouched) {
                                confidence = "OBSERVED";
                            }
                        }

                        unprovenGaps.push("Rollback has not been executed to verify that reverting this commit eliminates the failure.");

                        candidates.push({
                            id: `regression-${shortSha}`,
                            commitSha: sha,
                            shortSha,
                            commitMessage: message,
                            authorName: author,
                            commitDate,
                            deploymentDate: deploymentTime,
                            releaseVersion: matchingRelease?.version || releaseVersion || undefined,
                            branch: project.githubDefaultBranch || "main",
                            confidence,
                            confidenceScore: Math.min(1.0, confidenceScore),
                            codeRelationship: codeRel,
                            changedFiles,
                            changedFunctions,
                            supportingReasons,
                            unprovenGaps,
                            explanation: isFailingLocationTouched
                                ? `Commit ${shortSha} modified "${failingLocation?.filePath}" ${minutesDiff >= 0 ? `${minutesDiff}m before` : "near"} the incident first appeared.`
                                : `Commit ${shortSha} was deployed ${minutesDiff >= 0 ? `${minutesDiff}m before` : "near"} the incident first appeared.`,
                            timeline: {
                                changeTime: commitDate,
                                deploymentTime,
                                incidentFirstSeen,
                                minutesBetweenDeployAndIncident: minutesDiff >= 0 ? minutesDiff : undefined,
                                frequencyChangeSummary: `First observed at ${formatDeterministicTime(incidentFirstSeen)}`,
                            },
                        });
                    }
                }
            }
        } catch (err) {
            unprovenFactors.push(`GitHub API synchronization error: ${(err as Error).message}`);
        }
    }

    // Step 2: Fallback to Prisma Releases if GitHub integration is not configured
    if (candidates.length === 0 && project?.releases && project.releases.length > 0) {
        for (const rel of project.releases.slice(0, 3)) {
            const minutesDiff = Math.round((incidentFirstSeen.getTime() - rel.firstSeen.getTime()) / 60000);
            const isPreceding = minutesDiff >= 0 && minutesDiff <= 1440;

            candidates.push({
                id: `regression-rel-${rel.version}`,
                commitSha: rel.commitSha || rel.version,
                shortSha: rel.commitSha ? rel.commitSha.slice(0, 7) : rel.version,
                commitMessage: `Release ${rel.version}`,
                commitDate: rel.firstSeen,
                deploymentDate: rel.firstSeen,
                releaseVersion: rel.version,
                confidence: isPreceding ? "PLAUSIBLE_CANDIDATE" : "INSUFFICIENT_EVIDENCE",
                confidenceScore: isPreceding ? 0.5 : 0.2,
                codeRelationship: "UNKNOWN",
                changedFiles: [],
                changedFunctions: [],
                supportingReasons: isPreceding
                    ? [`Release ${rel.version} was first observed ${minutesDiff}m before this incident.`]
                    : [`Release ${rel.version} recorded in project activity.`],
                unprovenGaps: [
                    "Git provider is not connected; individual code diffs and modified functions could not be inspected.",
                    "Rollback has not been executed to confirm reversion eliminates the error.",
                ],
                explanation: `Release "${rel.version}" was first observed ${minutesDiff}m before this incident first occurred.`,
                timeline: {
                    changeTime: rel.firstSeen,
                    deploymentTime: rel.firstSeen,
                    incidentFirstSeen,
                    minutesBetweenDeployAndIncident: minutesDiff >= 0 ? minutesDiff : undefined,
                },
            });
        }
    }

    // Sort candidates by confidence score
    candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
    const strongestCandidate = candidates[0];
    const isRegressionDetected = Boolean(
        strongestCandidate && (strongestCandidate.confidence === "OBSERVED" || strongestCandidate.confidence === "STRONGLY_SUPPORTED")
    );

    let overallConfidence: RegressionConfidence = "UNKNOWN";
    if (strongestCandidate) {
        overallConfidence = strongestCandidate.confidence;
    } else if (!hasGitIntegration) {
        overallConfidence = "INSUFFICIENT_EVIDENCE";
    }

    const headline = isRegressionDetected
        ? `Likely regression introduced in commit ${strongestCandidate.shortSha} ("${strongestCandidate.commitMessage}")`
        : strongestCandidate
        ? `Candidate change evaluated: ${strongestCandidate.shortSha} (${strongestCandidate.confidence.replace("_", " ")})`
        : hasGitIntegration
        ? "No recent commits correlated with this failure location."
        : "Connect a Git repository to enable automatic commit and code diff regression detection.";

    return {
        isRegressionDetected,
        confidence: overallConfidence,
        headline,
        strongestCandidate,
        candidates,
        failingLocation,
        unprovenFactors,
        hasGitIntegration,
        hasDeploymentData,
    };
}
