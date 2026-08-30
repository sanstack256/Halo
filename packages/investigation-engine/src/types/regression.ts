export type RegressionConfidence =
    | "OBSERVED"
    | "STRONGLY_SUPPORTED"
    | "PLAUSIBLE_CANDIDATE"
    | "INSUFFICIENT_EVIDENCE"
    | "UNKNOWN";

export type CodeChangeRelationship =
    | "INTRODUCED"
    | "MODIFIED"
    | "MOVED"
    | "INDIRECTLY_AFFECTED"
    | "UNRELATED"
    | "UNKNOWN";

export interface ChangedFileDetail {
    filePath: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
    patch?: string;
    matchingFailingLines?: number[];
    isFailingFile: boolean;
}

export interface ChangedFunctionDetail {
    functionName: string;
    filePath: string;
    lineNumber?: number;
    isFailingFunction: boolean;
    relationship: CodeChangeRelationship;
}

export interface RegressionCandidate {
    id: string;
    commitSha: string;
    shortSha: string;
    commitMessage: string;
    authorName?: string;
    commitDate: Date | string;
    deploymentDate?: Date | string;
    releaseVersion?: string;
    branch?: string;
    confidence: RegressionConfidence;
    confidenceScore: number;
    codeRelationship: CodeChangeRelationship;
    changedFiles: ChangedFileDetail[];
    changedFunctions: ChangedFunctionDetail[];
    supportingReasons: string[];
    unprovenGaps: string[];
    explanation: string;
    timeline: {
        changeTime: Date | string;
        deploymentTime?: Date | string;
        incidentFirstSeen: Date | string;
        minutesBetweenDeployAndIncident?: number;
        frequencyChangeSummary?: string;
    };
}

export interface RegressionAnalysisResult {
    isRegressionDetected: boolean;
    confidence: RegressionConfidence;
    headline: string;
    strongestCandidate?: RegressionCandidate;
    candidates: RegressionCandidate[];
    failingLocation?: {
        filePath?: string;
        lineNumber?: number;
        functionName?: string;
    };
    unprovenFactors: string[];
    hasGitIntegration: boolean;
    hasDeploymentData: boolean;
}
