import type { InvestigationContext } from "../types/context";
import type { Evidence } from "../types/evidence";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

const DEPLOYMENT_CAUSAL_WINDOW_MS = 30 * 60 * 1000;

export function generateDeploymentHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    return context.deployments
        .filter((d) => d.service && d.service.length > 0)
        .map((d) => createDeploymentHypothesis(d, context))
        .filter((h): h is Hypothesis => h !== null);
}

function createDeploymentHypothesis(
    deployment: Evidence,
    context: InvestigationContext
): Hypothesis | null {
    const deploymentTime = deployment.timestamp.getTime();

    // Check all errors/failures in the same service
    const sameServiceErrors = context.errors.filter(
        (e) => e.service === deployment.service
    );

    // If there are no errors anywhere in the investigation, return null
    if (context.errors.length === 0) {
        return null;
    }

    const sameServicePostErrors = sameServiceErrors
        .filter((e) => {
            const delta = e.timestamp.getTime() - deploymentTime;
            return delta > 0 && delta <= DEPLOYMENT_CAUSAL_WINDOW_MS;
        })
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // If this deployment is a rollback/revert and no errors occurred after it, do not create a regression hypothesis for it
    const isRollback = /\b(?:rollback|revert)\b/i.test(
        `${deployment.title} ${deployment.description || ""}`
    );
    if (isRollback && sameServicePostErrors.length === 0) {
        return null;
    }

    const preDeploymentFailures = context.evidence.filter(
        (e) =>
            e.service === deployment.service &&
            e.id !== deployment.id &&
            e.timestamp.getTime() < deploymentTime &&
            (e.type === "ERROR" ||
                e.type === "CONFIG" ||
                e.type === "INFRASTRUCTURE" ||
                (typeof e.status === "number" && e.status >= 400))
    );

    const postErrorIds = new Set(sameServicePostErrors.map((e) => e.id));
    const findings = context.findings.filter((f) =>
        f.evidenceIds.some(
            (id) =>
                id === deployment.id ||
                postErrorIds.has(id)
        )
    );

    const supportingReasons: Reason[] = [];

    if (sameServicePostErrors.length > 0) {
        const firstError = sameServicePostErrors[0];
        const deltaMs = firstError.timestamp.getTime() - deploymentTime;
        const deltaMinutes = Math.round(deltaMs / 60_000);

        supportingReasons.push({
            type: "SUPPORTING",
            causalRole: "CAUSE",
            title: "Deployment triggered same-service failure",
            description: `Deployment "${deployment.title}" immediately preceded errors in ${deployment.service}.`,
            strength: 0.85,
            evidenceIds: [deployment.id, firstError.id],
        });

        supportingReasons.push({
            type: "SUPPORTING",
            causalRole: "TRIGGER",
            title: "Failure followed deployment",
            description:
                deltaMinutes === 0
                    ? "A same-service error occurred immediately after the deployment."
                    : `A same-service error occurred ${deltaMinutes} minute${
                          deltaMinutes === 1 ? "" : "s"
                      } after the deployment.`,
            strength: Math.max(0.6, 0.9 - (deltaMs / DEPLOYMENT_CAUSAL_WINDOW_MS) * 0.3),
            evidenceIds: [deployment.id, firstError.id],
        });
    }

    // Check for commit attribution
    if (deployment.commit) {
        supportingReasons.push({
            type: "SUPPORTING",
            causalRole: "TRIGGER",
            title: "Deployment attributed to commit",
            description: `Deployment is attributed to commit ${deployment.commit}.`,
            strength: 0.75,
            evidenceIds: [deployment.id],
        });
    }

    // Check for rollback & recovery evidence
    const rollback = context.evidence.find(
        (e) =>
            e.type === "DEPLOYMENT" &&
            e.timestamp.getTime() >= deploymentTime &&
            /\b(?:rollback|revert)\b/i.test(`${e.title} ${e.description || ""}`)
    );

    const recovery = context.evidence.find((e) => {
        if (e.service !== deployment.service) return false;
        if (e.timestamp.getTime() <= deploymentTime) return false;
        return (
            e.status === "success" ||
            e.status === "healthy" ||
            e.status === "ok" ||
            /\b(?:recovered|healthy|resolved|success|ok)\b/i.test(
                `${e.title} ${e.description || ""}`
            )
        );
    });

    if (rollback && recovery) {
        supportingReasons.push({
            type: "SUPPORTING",
            causalRole: "MECHANISM",
            title: "Service recovered after rollback",
            description: `Rollback deployment "${rollback.title}" was performed and service ${deployment.service} recovered.`,
            strength: 0.95,
            evidenceIds: [deployment.id, rollback.id, recovery.id],
        });
    } else if (rollback) {
        supportingReasons.push({
            type: "SUPPORTING",
            causalRole: "CAUSE",
            title: "Rollback observed after incident onset",
            description: `Rollback deployment "${rollback.title}" was performed following the failure.`,
            strength: 0.85,
            evidenceIds: [deployment.id, rollback.id],
        });
    }

    // Collect reasons from findings
    for (const f of findings) {
        for (const r of f.reasons) {
            if (r.type === "SUPPORTING") {
                supportingReasons.push(r);
            }
        }
    }

    // Contradicting reasons:
    const contradictingReasons: Reason[] = [];

    // 1. Errors predate deployment
    if (preDeploymentFailures.length > 0) {
        contradictingReasons.push({
            type: "CONTRADICTING",
            causalRole: "CONTEXT",
            title: "Error predates deployment",
            description: `Failure-related evidence from ${deployment.service} existed before deployment, weakening the hypothesis that this deployment introduced the incident.`,
            strength: 0.85,
            evidenceIds: preDeploymentFailures.map((e) => e.id),
        });
    }

    // 2. Errors only in other services
    const otherServiceErrors = context.errors.filter(
        (e) => e.service !== deployment.service
    );
    if (sameServiceErrors.length === 0 && otherServiceErrors.length > 0) {
        contradictingReasons.push({
            type: "CONTRADICTING",
            causalRole: "CONTEXT",
            title: "Failure isolated to different service",
            description: `Errors occurred in other services (${otherServiceErrors
                .map((e) => e.service)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(", ")}), not in ${deployment.service}.`,
            strength: 0.85,
            evidenceIds: otherServiceErrors.map((e) => e.id),
        });
    }

    // Missing reasons are computed comprehensively in evaluate.ts
    const missingReasons: Reason[] = [];

    const firstPostError = sameServicePostErrors[0];
    const deltaMinutes = firstPostError
        ? Math.round((firstPostError.timestamp.getTime() - deploymentTime) / 60_000)
        : 0;

    const evidenceIds = Array.from(
        new Set([
            deployment.id,
            ...sameServicePostErrors.map((e) => e.id),
            ...preDeploymentFailures.map((e) => e.id),
            ...otherServiceErrors.map((e) => e.id),
            ...findings.flatMap((f) => f.evidenceIds),
            ...(rollback ? [rollback.id] : []),
            ...(recovery ? [recovery.id] : []),
        ])
    );

    const positiveScore = supportingReasons.reduce((sum, r) => sum + r.strength, 0);
    const negativeScore = contradictingReasons.reduce((sum, r) => sum + r.strength, 0);

    return {
        id: `deployment-regression:${deployment.id}`,
        title: "Deployment Regression",
        description: `The ${deployment.service} service experienced a failure ${deltaMinutes} minute${
            deltaMinutes === 1 ? "" : "s"
        } after deployment "${deployment.title}".`,
        score: {
            positive: positiveScore,
            negative: negativeScore,
            unknown: missingReasons.reduce((sum, r) => sum + r.strength, 0),
        },
        confidence: 0, // Calculated in ranking
        status: "CANDIDATE",
        supportingReasons,
        contradictingReasons,
        missingReasons,
        findingIds: Array.from(new Set(findings.map((f) => f.id))),
        evidenceIds,
        alternativeIds: [],
        provenance: deployment.source,
    };
}
