export interface EngineTelemetry {
    executionDurationMs: number;
    evidenceCount: number;
    nodesCount: number;
    edgesCount: number;
    anomaliesCount: number;
    templatesCount: number;
    hypothesesEvaluated: number;
    hypothesesPruned: number;
    rulesEvaluated: number;
    memoryEstimateBytes: number;
    timestamp: Date;
}
