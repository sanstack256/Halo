/**
 * Halo Recommendation Engine — Release & Regression Analysis
 *
 * Implements Phase C (Section 11):
 * Evaluates commits, deployments, and semantic diffs against the execution path.
 * Classifies regression candidates into strict categories:
 *   - UNRELATED
 *   - TEMPORALLY_ASSOCIATED
 *   - PATH_ASSOCIATED
 *   - BEHAVIOR_ASSOCIATED
 *   - STRONGLY_SUPPORTED_REGRESSION
 *   - CONFIRMED_REGRESSION
 */

import type {
    InvestigationSnapshot,
    ReleaseRegressionContext,
    EvaluatedRegressionCandidate,
    RegressionCandidateClassification,
} from "./types";

export function analyzeReleasesAndRegressions(
    snapshot: InvestigationSnapshot
): ReleaseRegressionContext {
    const rawRelease = snapshot.release;
    const candidates: EvaluatedRegressionCandidate[] = [];

    const failingFile = snapshot.source?.filePath || snapshot.failure.primaryFrame?.filePath;
    const failingLine = snapshot.source?.failingLineNumber || snapshot.failure.primaryFrame?.lineNumber;
    const failingSymbol = snapshot.failure.executingFunction || snapshot.source?.containingFunction || snapshot.failure.primaryFrame?.functionName;

    for (const rawCand of rawRelease.candidates || []) {
        const modifiesFailingFile = Boolean(
            rawCand.modifiesFailingFile ?? (
                failingFile &&
                rawCand.changedFiles.some((f) => f.includes(failingFile) || failingFile.includes(f))
            )
        );

        const modifiesFailingSymbol = Boolean(
            rawCand.modifiesFailingSymbol ?? (
                modifiesFailingFile &&
                failingSymbol &&
                rawCand.diffSnippet?.includes(failingSymbol)
            )
        );

        // Determine temporal relationship
        const incidentTime = snapshot.incident.firstSeen.getTime();
        const commitTime = rawCand.commitDate.getTime();
        const diffMinutes = Math.round((incidentTime - commitTime) / (1000 * 60));
        const isPreceding = diffMinutes >= 0 && diffMinutes <= 1440 * 3; // within 3 days

        let classification: RegressionCandidateClassification = "UNRELATED";
        let reason = "Commit did not touch failing files or incident path.";

        if (modifiesFailingFile && modifiesFailingSymbol && isPreceding) {
            classification = "STRONGLY_SUPPORTED_REGRESSION";
            reason = `Commit ${rawCand.shortSha} modified symbol '${failingSymbol}' in '${failingFile}' ${diffMinutes}m before incident first appeared.`;
        } else if (modifiesFailingFile && isPreceding) {
            classification = "PATH_ASSOCIATED";
            reason = `Commit ${rawCand.shortSha} modified failing file '${failingFile}' ${diffMinutes}m before incident first appeared.`;
        } else if (isPreceding) {
            classification = "TEMPORALLY_ASSOCIATED";
            reason = `Commit ${rawCand.shortSha} was deployed ${diffMinutes}m before incident first appeared, but did not touch the failing file.`;
        }

        candidates.push({
            commitSha: rawCand.commitSha,
            shortSha: rawCand.shortSha,
            message: rawCand.message,
            author: rawCand.author,
            commitDate: rawCand.commitDate,
            deploymentDate: rawCand.deploymentDate,
            classification,
            classificationReason: reason,
            modifiesFailingFile,
            modifiesFailingSymbol,
            diffSnippet: rawCand.diffSnippet,
            changedFiles: rawCand.changedFiles,
        });
    }

    // Identify strongest candidate
    const stronglySupported = candidates.find(
        (c) =>
            c.classification === "CONFIRMED_REGRESSION" ||
            c.classification === "STRONGLY_SUPPORTED_REGRESSION"
    );

    return {
        deployedRelease: rawRelease.deployedRelease,
        deployedCommitSha: rawRelease.deployedCommitSha,
        previousKnownGoodRelease: rawRelease.previousKnownGoodRelease,
        previousKnownGoodCommitSha: rawRelease.previousKnownGoodCommitSha,
        candidates,
        stronglySupportedCandidate: stronglySupported,
    };
}

export const analyzeReleaseRegression = analyzeReleasesAndRegressions;
