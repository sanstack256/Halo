import type { Change } from "../types/change";
import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";
import type { EvidenceGraph } from "../types/graph";

export function buildContext(
    evidence: Evidence[],
    changes: Change[],
    graph: EvidenceGraph,
): InvestigationContext {
    const orderedEvidence =
        [...evidence].sort(
            compareByTimestamp,
        );

    const orderedChanges =
        [...changes].sort(
            compareByTimestamp,
        );

    const deployments =
        filterByType(
            orderedEvidence,
            "DEPLOYMENT",
        );

    const errors =
        filterByType(
            orderedEvidence,
            "ERROR",
        );

    const logs =
        filterByType(
            orderedEvidence,
            "LOG",
        );

    const traces =
        filterByType(
            orderedEvidence,
            "TRACE",
        );

    const metrics =
        filterByType(
            orderedEvidence,
            "METRIC",
        );

    const configs =
        filterByType(
            orderedEvidence,
            "CONFIG",
        );

    const featureFlags =
        filterByType(
            orderedEvidence,
            "FEATURE_FLAG",
        );

    const infrastructure =
        filterByType(
            orderedEvidence,
            "INFRASTRUCTURE",
        );

    const thirdParty =
        filterByType(
            orderedEvidence,
            "THIRD_PARTY",
        );

    const services =
        uniqueNonEmpty(
            orderedEvidence.map(
                item => item.service,
            ),
        );

    const releases =
        uniqueNonEmpty(
            orderedEvidence.map(
                item => item.release,
            ),
        );

    const environments =
        uniqueNonEmpty(
            orderedEvidence.map(
                item => item.environment,
            ),
        );

    return {
        evidence: orderedEvidence,
        graph,
        changes: orderedChanges,
        findings: [],

        deployments,
        errors,
        logs,
        traces,
        metrics,
        configs,
        featureFlags,
        infrastructure,
        thirdParty,

        services,
        releases,
        environments,

        firstError:
            errors[0],

        latestError:
            errors.at(-1),

        latestDeployment:
            deployments.at(-1),

        earliestChange:
            orderedChanges[0],

        latestChange:
            orderedChanges.at(-1),
    };
}

function filterByType<
    T extends Evidence["type"],
>(
    evidence: Evidence[],
    type: T,
): Evidence[] {
    return evidence.filter(
        item => item.type === type,
    );
}

function compareByTimestamp(
    a: {
        timestamp: Date;
    },
    b: {
        timestamp: Date;
    },
): number {
    const difference =
        a.timestamp.getTime() -
        b.timestamp.getTime();

    if (difference !== 0) {
        return difference;
    }

    return 0;
}

function uniqueNonEmpty(
    values: Array<string | undefined>,
): string[] {
    const seen =
        new Set<string>();

    const result: string[] = [];

    for (const value of values) {
        if (
            typeof value !== "string" ||
            value.length === 0 ||
            seen.has(value)
        ) {
            continue;
        }

        seen.add(value);
        result.push(value);
    }

    return result;
}