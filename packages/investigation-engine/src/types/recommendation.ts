export type RecommendationPriority =
    | "LOW"
    | "MEDIUM"
    | "HIGH";

export interface Recommendation {
    id: string;

    title: string;

    description: string;

    priority: RecommendationPriority;

    confidence: number;

    evidenceIds: string[];
}