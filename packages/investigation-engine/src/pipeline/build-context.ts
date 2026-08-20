import type { Change } from "../types/change";
import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";
import type { EvidenceGraph } from "../types/graph";
import type { AnomalySignal, StatisticalBaseline } from "../types/anomaly";
import type { StructuralTemplate } from "../types/template";
import { computeBaselines } from "../detection/statistical/baselines";
import { detectNovelPatterns } from "../novelty/novelty-detector";
import { detectKnownFailurePatterns } from "../detection/deterministic/patterns";
import { detectSecurityAnomalies } from "../detection/deterministic/security";
import { detectRateBursts } from "../detection/statistical/rate-burst";
import { detectLatencyAnomalies } from "../detection/statistical/latency";
import { detectDistributionShifts } from "../detection/statistical/distribution";
import { detectCascadingFailures } from "../detection/temporal/cascade";
import { detectDegradationSequences } from "../detection/temporal/sequences";

export function buildContext(
    evidence: Evidence[],
    changes: Change[],
    graph: EvidenceGraph,
    providedAnomalies?: AnomalySignal[],
    providedTemplates?: StructuralTemplate[],
    providedBaselines?: Map<string, StatisticalBaseline>
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

    // Compute baselines, templates, and multi-layer anomaly signals
    const baselines = providedBaselines || computeBaselines(orderedEvidence);
    const { anomalies: novelAnomalies, templates } = detectNovelPatterns(orderedEvidence);

    const allAnomalies: AnomalySignal[] = providedAnomalies || [
        ...detectKnownFailurePatterns(orderedEvidence),
        ...detectSecurityAnomalies(orderedEvidence),
        ...detectRateBursts(orderedEvidence, baselines),
        ...detectLatencyAnomalies(orderedEvidence, baselines),
        ...detectDistributionShifts(orderedEvidence, baselines),
        ...detectCascadingFailures(orderedEvidence),
        ...detectDegradationSequences(orderedEvidence),
        ...novelAnomalies,
    ];

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

        anomalies: allAnomalies,
        templates: providedTemplates || templates,
        baselines,
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