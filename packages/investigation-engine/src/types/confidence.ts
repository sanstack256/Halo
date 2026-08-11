export type ConfidenceLevel =
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "VERY_HIGH";

export function getConfidenceLevel(
    confidence: number
): ConfidenceLevel {
    if (!Number.isFinite(confidence)) {
        return "LOW";
    }

    if (confidence >= 85) {
        return "VERY_HIGH";
    }

    if (confidence >= 65) {
        return "HIGH";
    }

    if (confidence >= 40) {
        return "MEDIUM";
    }

    return "LOW";
}