import type { Evidence } from "../types/evidence";
import type { Impact } from "../types/impact";

export function analyzeImpact(
    evidence: Evidence[],
): Impact {
    const failureEvidence =
        evidence.filter(isFailureEvidence);

    const affectedServices =
        uniqueStrings(
            failureEvidence
                .map(
                    item =>
                        item.service,
                )
                .filter(
                    (
                        service,
                    ): service is string =>
                        Boolean(service),
                ),
        );

    const affectedRegions =
        uniqueStrings(
            failureEvidence
                .map(
                    item =>
                        item.tags?.region,
                )
                .filter(
                    (
                        region,
                    ): region is string =>
                        Boolean(region),
                ),
        );

    const affectedUsers =
        countAffectedUsers(
            failureEvidence,
        );

    const severity =
        determineSeverity(
            affectedServices.length,
            affectedUsers,
            affectedRegions.length,
        );

    return {
        affectedServices,
        affectedUsers,
        affectedRegions,
        severity,
    };
}

function isFailureEvidence(
    evidence: Evidence,
): boolean {
    if (
        evidence.type === "ERROR"
    ) {
        return true;
    }

    if (
        typeof evidence.status ===
        "number"
    ) {
        return evidence.status >= 400;
    }

    if (
        typeof evidence.status ===
        "string"
    ) {
        const status =
            evidence.status
                .trim()
                .toLowerCase();

        return (
            status === "error" ||
            status === "failed" ||
            status === "failure" ||
            status === "timeout" ||
            status === "unavailable"
        );
    }

    return false;
}

function countAffectedUsers(
    evidence: Evidence[],
): number {
    const users =
        new Set<string>();

    for (const item of evidence) {
        const userId =
            item.tags?.userId;

        if (
            userId &&
            userId.trim()
        ) {
            users.add(
                userId.trim(),
            );
        }
    }

    return users.size;
}

function determineSeverity(
    serviceCount: number,
    userCount: number,
    regionCount: number,
): Impact["severity"] {
    if (
        serviceCount >= 4 ||
        userCount >= 10_000 ||
        regionCount >= 3
    ) {
        return "CRITICAL";
    }

    if (
        serviceCount >= 2 ||
        userCount >= 1_000 ||
        regionCount >= 2
    ) {
        return "HIGH";
    }

    if (
        serviceCount >= 1 ||
        userCount > 0 ||
        regionCount >= 1
    ) {
        return "MEDIUM";
    }

    return "LOW";
}

function uniqueStrings(
    values: string[],
): string[] {
    return [
        ...new Set(
            values
                .map(
                    value =>
                        value.trim(),
                )
                .filter(
                    value =>
                        value.length > 0,
                ),
        ),
    ];
}