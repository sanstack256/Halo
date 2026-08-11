import type {
    Evidence,
    EvidenceBreadcrumb,
    EvidenceUser,
} from "../types/evidence";

export function normalizeEvidence(
    evidence: Evidence[]
): Evidence[] {
    const seen = new Set<string>();

    return evidence
        .filter(item => {
            if (
                !item ||
                typeof item.id !== "string" ||
                item.id.trim().length === 0
            ) {
                return false;
            }

            if (seen.has(item.id)) {
                return false;
            }

            seen.add(item.id);

            return true;
        })
        .map(item => ({
            ...item,

            id: item.id.trim(),

            source: normalizeString(
                item.source,
                "unknown"
            ),

            service: normalizeString(
                item.service,
                "unknown"
            ),

            title: normalizeString(
                item.title,
                "Untitled evidence"
            ),

            description:
                normalizeOptionalString(
                    item.description
                ),

            release:
                normalizeOptionalString(
                    item.release
                ),

            commit:
                normalizeOptionalString(
                    item.commit
                ),

            environment:
                normalizeOptionalString(
                    item.environment
                ),

            traceId:
                normalizeOptionalString(
                    item.traceId
                ),

            spanId:
                normalizeOptionalString(
                    item.spanId
                ),

            parentSpanId:
                normalizeOptionalString(
                    item.parentSpanId
                ),

            requestId:
                normalizeOptionalString(
                    item.requestId
                ),

            sessionId:
                normalizeOptionalString(
                    item.sessionId
                ),

            operation:
                normalizeOptionalString(
                    item.operation
                ),

            resource:
                normalizeOptionalString(
                    item.resource
                ),

            fingerprint:
                normalizeOptionalString(
                    item.fingerprint
                ),

            tags: normalizeTags(
                item.tags
            ),

            breadcrumbs:
                normalizeBreadcrumbs(
                    item.breadcrumbs
                ),

            user:
                normalizeUser(item.user),

            metadata: {
                ...item.metadata,
            },
        }))
        .sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime()
        );
}

function normalizeString(
    value: string,
    fallback: string
): string {
    const normalized = value.trim();

    return normalized.length > 0
        ? normalized
        : fallback;
}

function normalizeOptionalString(
    value: string | undefined
): string | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0
        ? normalized
        : undefined;
}

function normalizeTags(
    tags: Record<string, string> | undefined
): Record<string, string> | undefined {
    if (!tags) {
        return undefined;
    }

    const normalized: Record<
        string,
        string
    > = {};

    for (const [key, value] of Object.entries(
        tags
    )) {
        const normalizedKey = key.trim();

        if (!normalizedKey) {
            continue;
        }

        normalized[normalizedKey] =
            value.trim();
    }

    return Object.keys(normalized).length > 0
        ? normalized
        : undefined;
}

function normalizeBreadcrumbs(
    breadcrumbs:
        | EvidenceBreadcrumb[]
        | undefined
): EvidenceBreadcrumb[] | undefined {
    if (!breadcrumbs?.length) {
        return undefined;
    }

    return breadcrumbs.map(
        breadcrumb => ({
            ...breadcrumb,

            timestamp:
                breadcrumb.timestamp,

            category:
                breadcrumb.category.trim(),

            message:
                breadcrumb.message.trim(),

            data: breadcrumb.data
                ? {
                      ...breadcrumb.data,
                  }
                : undefined,
        })
    );
}

function normalizeUser(
    user: EvidenceUser | undefined
): EvidenceUser | undefined {
    if (!user) {
        return undefined;
    }

    const normalized: EvidenceUser = {
        id: normalizeOptionalString(
            user.id
        ),

        email: normalizeOptionalString(
            user.email
        ),

        username:
            normalizeOptionalString(
                user.username
            ),
    };

    return Object.values(normalized).some(
        value => value !== undefined
    )
        ? normalized
        : undefined;
}