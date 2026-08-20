export interface StructuralTemplate {
    id: string; // Hash of canonical template
    pattern: string; // "Connection to <*> failed with status <*>"
    tokenCount: number;
    wildcardCount: number;
    sampleCount: number;
    services: string[];
    firstSeen: Date;
    lastSeen: Date;
    sampleTitles: string[];
}

export interface TokenCluster {
    templateId: string;
    evidenceIds: string[];
    frequency: number;
    isNovel: boolean;
    noveltyScore: number;
}
