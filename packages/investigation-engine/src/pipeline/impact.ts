import type { Evidence } from "../types/evidence";
import type { Impact } from "../types/impact";

export function analyzeImpact(
    evidence: Evidence[]
): Impact {
    const affectedServices = [
        ...new Set(
            evidence
                .filter(e => e.type === "ERROR")
                .map(e => e.service)
                .filter(Boolean)
        ),
    ];

    const affectedRegions = [
        ...new Set(
            evidence
                .map(e => e.tags?.region)
                .filter(
                    (region): region is string =>
                        Boolean(region)
                )
        ),
    ];

    const affectedUsers = countAffectedUsers(
        evidence
    );

    const severity = determineSeverity(
        affectedServices.length,
        affectedUsers,
        affectedRegions.length
    );

    return {
        affectedServices,
        affectedUsers,
        affectedRegions,
        severity,
    };
}

function countAffectedUsers(
    evidence: Evidence[]
): number {
    const users = new Set<string>();

    for (const item of evidence) {
        const userId = item.tags?.userId;

        if (userId) {
            users.add(userId);
        }
    }

    return users.size;
}

function determineSeverity(
    serviceCount: number,
    userCount: number,
    regionCount: number
): Impact["severity"] {
    if (
        serviceCount >= 4 ||
        userCount >= 10000 ||
        regionCount >= 3
    ) {
        return "CRITICAL";
    }

    if (
        serviceCount >= 2 ||
        userCount >= 1000 ||
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