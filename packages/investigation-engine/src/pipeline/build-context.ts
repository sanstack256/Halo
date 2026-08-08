import type { Change } from "../types/change";
import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";

export function buildContext(
    evidence: Evidence[],
    changes: Change[]
): InvestigationContext {
    const deployments = evidence.filter(
        e => e.type === "DEPLOYMENT"
    );

    const errors = evidence.filter(
        e => e.type === "ERROR"
    );

    const logs = evidence.filter(
        e => e.type === "LOG"
    );

    const traces = evidence.filter(
        e => e.type === "TRACE"
    );

    const metrics = evidence.filter(
        e => e.type === "METRIC"
    );

    const configs = evidence.filter(
        e => e.type === "CONFIG"
    );

    const featureFlags = evidence.filter(
        e => e.type === "FEATURE_FLAG"
    );

    const infrastructure = evidence.filter(
        e => e.type === "INFRASTRUCTURE"
    );

    const thirdParty = evidence.filter(
        e => e.type === "THIRD_PARTY"
    );

    const services = [
        ...new Set(
            evidence
                .map(e => e.service)
                .filter(Boolean)
        ),
    ];

    const releases = [
        ...new Set(
            evidence
                .map(e => e.release)
                .filter(
                    (release): release is string =>
                        Boolean(release)
                )
        ),
    ];

    const environments = [
        ...new Set(
            evidence
                .map(e => e.environment)
                .filter(
                    (environment): environment is string =>
                        Boolean(environment)
                )
        ),
    ];

    return {
        evidence,
        changes,
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

        firstError: errors[0],
        latestError: errors.at(-1),

        latestDeployment:
            deployments.at(-1),

        earliestChange:
            changes[0],

        latestChange:
            changes.at(-1),
    };
}