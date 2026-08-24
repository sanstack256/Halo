import { investigateIssue } from "@/lib/investigation/run";
import { BackButton } from "@/components/ui/back-button";

import type {
    Investigation,
    Hypothesis,
    Recommendation,
} from "@halo/investigation-engine";

type Props = {
    params: Promise<{
        id: string;
    }>;

    searchParams: Promise<{
        issueId?: string;
    }>;
};

import { NoEventsInvestigationModal } from "./no-events-modal";
import { getReplaySessionForIssue } from "@/actions/replay";
import { ReplayPlayerClient } from "@/components/replay/replay-player-client";
import { ReplayStatus } from "@/components/replay/replay-status";

export default async function InvestigationPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    const { issueId } = await searchParams;

    if (!issueId) {
        return (
            <NoEventsInvestigationModal
                projectId={id}
                errorMessage="Please select an active issue to start an investigation."
            />
        );
    }

    try {
        const [investigation, replaySession] = await Promise.all([
            investigateIssue(issueId, id),
            getReplaySessionForIssue(issueId),
        ]);
        return (
            <InvestigationView
                investigation={investigation}
                replaySession={replaySession}
                projectId={id}
            />
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run investigation.";
        return (
            <NoEventsInvestigationModal
                projectId={id}
                errorMessage={message}
            />
        );
    }
}

/* -------------------------------------------------------------------------- */
/* Main view                                                                   */
/* -------------------------------------------------------------------------- */

function InvestigationView({
    investigation,
    replaySession,
    projectId,
}: {
    investigation: Investigation;
    replaySession?: any | null;
    projectId: string;
}) {
    const {
        status,
        report,
        rootCause,
        timeline,
        evidence,
        hypotheses,
        findings,
        changes,
        impact,
        recommendations,
    } = investigation;

    const hasRootCause = rootCause !== null;

    return (
        <div className="halo-investigation">
            <div className="mb-4">
                <BackButton fallbackHref="/overview" label="Back to Overview" />
            </div>

            {/* Header */}

            <header className="halo-investigation-header">
                <div className="halo-eyebrow-row">
                    <span className="halo-eyebrow">
                        Investigation
                    </span>

                    <StatusBadge status={status} />
                </div>

                <h1 className="halo-investigation-title">
                    Why did this fail?
                </h1>

                <p className="halo-investigation-description">
                    Halo reconstructed the available evidence
                    and evaluated possible causes.
                </p>
            </header>

            {/* Verdict */}

            <section className="halo-verdict">
                <div className="halo-verdict-header">
                    <span className="halo-section-label">
                        Investigation result
                    </span>
                </div>

                <div className="halo-verdict-body">
                    <div className="halo-verdict-content">
                        <div className="halo-verdict-main">
                            <span className="halo-result-label">
                                {hasRootCause
                                    ? "Likely root cause"
                                    : "No validated root cause"}
                            </span>

                            <h2 className="halo-verdict-title">
                                {hasRootCause
                                    ? report.rootCause?.title
                                    : "No root cause established"}
                            </h2>

                            <p className="halo-verdict-summary">
                                {report.summary}
                            </p>
                        </div>

                        {hasRootCause &&
                            report.rootCause && (
                                <Confidence
                                    value={
                                        report.rootCause
                                            .confidence
                                    }
                                    supportingCount={
                                        rootCause
                                            ?.supportingReasons
                                            .length ?? 0
                                    }
                                    contradictingCount={
                                        rootCause
                                            ?.contradictingReasons
                                            .length ?? 0
                                    }
                                    missingCount={
                                        rootCause
                                            ?.missingReasons
                                            .length ?? 0
                                    }
                                />
                            )}
                    </div>
                </div>
            </section>

            {/* Root cause */}

            {rootCause && (
                <section className="halo-section">
                    <SectionHeading
                        title="Root cause"
                        description="The strongest explanation supported by the available evidence."
                    />

                    <RootCauseCard
                        hypothesis={rootCause}
                    />
                </section>
            )}

            {/* Timeline */}

            {timeline.events.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Timeline"
                        description="The sequence of events Halo reconstructed around the failure."
                    />

                    <div className="halo-card halo-timeline">
                        {timeline.events.map(
                            (event, index) => (
                                <TimelineItem
                                    key={event.id}
                                    event={event}
                                    isLast={
                                        index ===
                                        timeline.events
                                            .length -
                                        1
                                    }
                                />
                            )
                        )}
                    </div>
                </section>
            )}

            {/* User Session Replay */}
            <section className="halo-section">
                <SectionHeading
                    title="User Session Replay"
                    description="Reconstructed browser DOM interactions, mouse clicks, and network requests correlated directly with this failure."
                />

                {replaySession ? (
                    <div className="space-y-4">
                        {/* Correlated Evidence Chain */}
                        <div className="p-3.5 rounded-xl bg-surface-elevated border border-border flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted uppercase text-[10px] font-semibold tracking-wider mr-1">
                                Correlated Evidence Flow:
                            </span>
                            <div className="flex items-center gap-1 text-accent font-medium">
                                <span>User Interaction</span>
                            </div>
                            <span className="text-muted font-mono">→</span>
                            {replaySession.url && (
                                <>
                                    <div className="flex items-center gap-1 text-blue-400 font-mono text-[11px]">
                                        <span>{replaySession.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                                    </div>
                                    <span className="text-muted font-mono">→</span>
                                </>
                            )}
                            {replaySession.traceId && (
                                <>
                                    <div className="flex items-center gap-1 text-purple-400 font-mono text-[11px]">
                                        <span>trace:{replaySession.traceId.slice(0, 8)}</span>
                                    </div>
                                    <span className="text-muted font-mono">→</span>
                                </>
                            )}
                            {evidence.find((e) => e.service)?.service && (
                                <>
                                    <div className="flex items-center gap-1 text-emerald-400 font-medium">
                                        <span>{evidence.find((e) => e.service)?.service}</span>
                                    </div>
                                    <span className="text-muted font-mono">→</span>
                                </>
                            )}
                            <div className="flex items-center gap-1 text-red-400 font-medium">
                                <span>{rootCause?.title || "Failure Event"}</span>
                            </div>
                            <span className="text-muted font-mono">→</span>
                            <div className="flex items-center gap-1 text-amber-400 font-medium">
                                <span>Root Cause Hypothesis</span>
                            </div>
                        </div>

                        <ReplayPlayerClient
                            replaySession={replaySession}
                            issueTitle={rootCause?.title || "Incident Session"}
                        />
                    </div>
                ) : (
                    <ReplayStatus status="NO_REPLAY" projectId={projectId} />
                )}
            </section>

            {/* Recommended Next Steps to Resolve */}
            <section className="halo-section">
                <SectionHeading
                    title="Recommended Next Steps to Resolve"
                    description="Actionable remediation plan, verification tasks, and automated fix recommendations derived from the investigation evidence."
                />

                <ResolutionNextSteps
                    recommendations={recommendations}
                    rootCause={rootCause}
                    hasRootCause={hasRootCause}
                />
            </section>

            {/* Evidence */}

            {evidence.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Evidence"
                        description={`${evidence.length} ${evidence.length === 1
                            ? "piece"
                            : "pieces"
                            } of evidence considered.`}
                    />

                    <div className="halo-stack">
                        {evidence.map((item) => (
                            <EvidenceCard
                                key={item.id}
                                evidence={item}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Findings */}

            {findings.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Findings"
                        description="Observations derived from the evidence."
                    />

                    <div className="halo-grid-2">
                        {findings.map((finding) => (
                            <div
                                key={finding.id}
                                className="halo-card halo-finding"
                            >
                                <div className="halo-card-top">
                                    <div>
                                        <span className="halo-meta-label">
                                            {formatLabel(
                                                finding.causalRole
                                            )}
                                        </span>

                                        <h3 className="halo-card-title">
                                            {finding.title}
                                        </h3>
                                    </div>

                                    <Strength
                                        value={
                                            finding.strength
                                        }
                                    />
                                </div>

                                <p className="halo-card-description">
                                    {finding.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Alternatives */}

            {report.alternatives.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Other possible causes"
                        description="Alternative explanations considered during the investigation."
                    />

                    <div className="halo-card">
                        {report.alternatives.map(
                            (alternative, index) => (
                                <div
                                    key={`${alternative.title}-${index}`}
                                    className="halo-list-row"
                                >
                                    <div className="halo-list-content">
                                        <p className="halo-list-title">
                                            {
                                                alternative.title
                                            }
                                        </p>
                                    </div>

                                    <Confidence
                                        value={
                                            alternative.confidence
                                        }
                                    />
                                </div>
                            )
                        )}
                    </div>
                </section>
            )}

            {/* Changes */}

            {changes.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Changes"
                        description="Changes detected around the incident."
                    />

                    <div className="halo-stack">
                        {changes.map((change) => (
                            <div
                                key={change.id}
                                className="halo-card"
                            >
                                <div className="halo-change-header">
                                    <div className="halo-change-title">
                                        <span className="halo-type-badge">
                                            {formatLabel(
                                                change.type
                                            )}
                                        </span>

                                        <h3 className="halo-card-title">
                                            {change.title}
                                        </h3>
                                    </div>

                                    <time className="halo-time">
                                        {formatDate(
                                            change.timestamp
                                        )}
                                    </time>
                                </div>

                                {change.description && (
                                    <p className="halo-card-description">
                                        {
                                            change.description
                                        }
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Impact */}

            {impact && (
                <section className="halo-section">
                    <SectionHeading
                        title="Impact"
                        description="The observed scope of the incident."
                    />

                    <div className="halo-grid-3">
                        <ImpactCard
                            label="Severity"
                            value={formatLabel(
                                impact.severity
                            )}
                        />

                        <ImpactCard
                            label="Affected users"
                            value={impact.affectedUsers.toLocaleString()}
                        />

                        <ImpactCard
                            label="Affected services"
                            value={impact.affectedServices.length.toLocaleString()}
                        />
                    </div>

                    {(impact.affectedServices.length >
                        0 ||
                        impact.affectedRegions.length >
                        0) && (
                            <div className="halo-grid-2">
                                {impact.affectedServices.length >
                                    0 && (
                                        <ListCard
                                            title="Services"
                                            items={
                                                impact.affectedServices
                                            }
                                        />
                                    )}

                                {impact.affectedRegions.length >
                                    0 && (
                                        <ListCard
                                            title="Regions"
                                            items={
                                                impact.affectedRegions
                                            }
                                        />
                                    )}
                            </div>
                        )}
                </section>
            )}

            {/* Uncertainties */}

            {report.uncertainties.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="What is still unknown"
                        description="Evidence gaps that prevent a stronger conclusion."
                    />

                    <div className="halo-card">
                        {report.uncertainties.map(
                            (uncertainty, index) => (
                                <div
                                    key={`${uncertainty}-${index}`}
                                    className="halo-list-row halo-uncertainty"
                                >
                                    <span className="halo-uncertainty-marker" />

                                    <p className="halo-list-description">
                                        {uncertainty}
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </section>
            )}

            {/* Hypotheses */}

            {hypotheses.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Investigation hypotheses"
                        description="How Halo evaluated the possible explanations."
                    />

                    <div className="halo-stack">
                        {hypotheses.map((hypothesis) => (
                            <HypothesisCard
                                key={hypothesis.id}
                                hypothesis={hypothesis}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="halo-section-heading">
            <h2 className="halo-section-title">
                {title}
            </h2>

            <p className="halo-section-description">
                {description}
            </p>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

function StatusBadge({
    status,
}: {
    status: Investigation["status"];
}) {
    return (
        <span
            className={`halo-status halo-status-${status.toLowerCase()}`}
        >
            {formatLabel(status)}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/* Confidence                                                                  */
/* -------------------------------------------------------------------------- */

function Confidence({
    value,
    supportingCount,
    contradictingCount,
    missingCount,
}: {
    value: number;
    supportingCount?: number;
    contradictingCount?: number;
    missingCount?: number;
}) {
    const level = getConfidenceLevel(value);

    return (
        <div
            className={`halo-confidence halo-confidence-${level.toLowerCase().replace(" ", "-")}`}
            title={`${value}% internal confidence`}
        >
            <span className="halo-confidence-dot" />

            <div>
                <p className="halo-confidence-level">
                    {level} confidence
                </p>

                {(supportingCount !== undefined ||
                    contradictingCount !== undefined ||
                    missingCount !== undefined) && (
                        <p className="halo-confidence-detail">
                            {supportingCount ?? 0} supporting
                            {" · "}
                            {contradictingCount ?? 0} contradicting
                            {" · "}
                            {missingCount ?? 0} missing
                        </p>
                    )}
            </div>
        </div>
    );
}

function getConfidenceLevel(
    value: number
): "Low" | "Medium" | "High" | "Very High" {
    if (value >= 85) {
        return "Very High";
    }

    if (value >= 65) {
        return "High";
    }

    if (value >= 40) {
        return "Medium";
    }

    return "Low";
}

/* -------------------------------------------------------------------------- */
/* Root cause                                                                  */
/* -------------------------------------------------------------------------- */

function RootCauseCard({
    hypothesis,
}: {
    hypothesis: Hypothesis;
}) {
    return (
        <div className="halo-card halo-root-cause">
            <div className="halo-root-cause-header">
                <div>
                    <span className="halo-result-label">
                        Most likely cause
                    </span>

                    <h3 className="halo-root-cause-title">
                        {hypothesis.title}
                    </h3>

                    <p className="halo-card-description">
                        {hypothesis.description}
                    </p>
                </div>

                <Confidence
                    value={hypothesis.confidence}
                    supportingCount={
                        hypothesis.supportingReasons.length
                    }
                    contradictingCount={
                        hypothesis.contradictingReasons
                            .length
                    }
                    missingCount={
                        hypothesis.missingReasons.length
                    }
                />
            </div>

            <div className="halo-reason-grid">
                <ReasonGroup
                    title="Why Halo believes this"
                    reasons={
                        hypothesis.supportingReasons
                    }
                    type="supporting"
                />

                <ReasonGroup
                    title="What argues against it"
                    reasons={
                        hypothesis.contradictingReasons
                    }
                    type="contradicting"
                />
            </div>

            {hypothesis.missingReasons.length > 0 && (
                <div className="halo-reason-missing">
                    <ReasonGroup
                        title="Evidence still needed"
                        reasons={
                            hypothesis.missingReasons
                        }
                        type="missing"
                    />
                </div>
            )}
        </div>
    );
}

function ReasonGroup({
    title,
    reasons,
    type,
}: {
    title: string;
    reasons: Hypothesis["supportingReasons"];
    type:
    | "supporting"
    | "contradicting"
    | "missing";
}) {
    if (reasons.length === 0) {
        return (
            <div>
                <p className="halo-reason-title">
                    {title}
                </p>

                <p className="halo-empty-text">
                    None identified.
                </p>
            </div>
        );
    }

    return (
        <div>
            <p className="halo-reason-title">
                {title}
            </p>

            <div className="halo-reason-list">
                {reasons.slice(0, 5).map(
                    (reason, index) => (
                        <div
                            key={`${reason.title}-${index}`}
                            className={`halo-reason halo-reason-${type}`}
                        >
                            <span className="halo-reason-marker" />

                            <div>
                                <p className="halo-reason-name">
                                    {reason.title}
                                </p>

                                <p className="halo-reason-description">
                                    {
                                        reason.description
                                    }
                                </p>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Timeline                                                                    */
/* -------------------------------------------------------------------------- */

function TimelineItem({
    event,
    isLast,
}: {
    event: Investigation["timeline"]["events"][number];
    isLast: boolean;
}) {
    return (
        <div className="halo-timeline-item">
            <time className="halo-timeline-time">
                {formatDate(event.timestamp)}
            </time>

            <div className="halo-timeline-track">
                <span className="halo-timeline-dot" />

                {!isLast && (
                    <span className="halo-timeline-line" />
                )}
            </div>

            <div className="halo-timeline-content">
                <div className="halo-timeline-title-row">
                    <h3 className="halo-card-title">
                        {event.title}
                    </h3>

                    <span className="halo-meta-label">
                        {formatLabel(event.type)}
                    </span>
                </div>

                {event.description && (
                    <p className="halo-card-description">
                        {event.description}
                    </p>
                )}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Evidence                                                                    */
/* -------------------------------------------------------------------------- */

function EvidenceCard({
    evidence,
}: {
    evidence: Investigation["evidence"][number];
}) {
    return (
        <div className="halo-card halo-evidence">
            <div className="halo-evidence-header">
                <div className="halo-evidence-main">
                    <span className="halo-type-badge">
                        {formatLabel(evidence.type)}
                    </span>

                    <div>
                        <h3 className="halo-card-title">
                            {evidence.title}
                        </h3>

                        <p className="halo-evidence-source">
                            {evidence.source}
                            {" · "}
                            {evidence.service}
                        </p>
                    </div>
                </div>

                <time className="halo-time">
                    {formatDate(evidence.timestamp)}
                </time>
            </div>

            {evidence.description && (
                <p className="halo-card-description">
                    {evidence.description}
                </p>
            )}

            <div className="halo-metadata">
                {evidence.environment && (
                    <MetadataChip
                        label="environment"
                        value={evidence.environment}
                    />
                )}

                {evidence.release && (
                    <MetadataChip
                        label="release"
                        value={evidence.release}
                    />
                )}

                {evidence.operation && (
                    <MetadataChip
                        label="operation"
                        value={evidence.operation}
                    />
                )}

                {evidence.resource && (
                    <MetadataChip
                        label="resource"
                        value={evidence.resource}
                    />
                )}

                {evidence.status !== undefined && (
                    <MetadataChip
                        label="status"
                        value={String(
                            evidence.status
                        )}
                    />
                )}

                {evidence.durationMs !== undefined && (
                    <MetadataChip
                        label="duration"
                        value={`${evidence.durationMs}ms`}
                    />
                )}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Findings                                                                    */
/* -------------------------------------------------------------------------- */

function Strength({
    value,
}: {
    value: number;
}) {
    return (
        <span className="halo-strength">
            {getStrengthLevel(value)}
        </span>
    );
}

function getStrengthLevel(
    value: number
): "Weak" | "Moderate" | "Strong" | "Very Strong" {
    if (value >= 0.85) {
        return "Very Strong";
    }

    if (value >= 0.65) {
        return "Strong";
    }

    if (value >= 0.4) {
        return "Moderate";
    }

    return "Weak";
}

/* -------------------------------------------------------------------------- */
/* Recommendations & Next Steps to Resolve                                     */
/* -------------------------------------------------------------------------- */

function ResolutionNextSteps({
    recommendations,
    rootCause,
    hasRootCause,
}: {
    recommendations: Recommendation[];
    rootCause: Hypothesis | null;
    hasRootCause: boolean;
}) {
    return (
        <div className="space-y-4">
            {/* Specific Engine Recommendations */}
            {recommendations.length > 0 && (
                <div className="halo-stack">
                    {recommendations.map((recommendation) => (
                        <RecommendationCard
                            key={recommendation.id}
                            recommendation={recommendation}
                        />
                    ))}
                </div>
            )}

            {/* Structured Step-by-Step Action Plan */}
            <div className="halo-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-sm font-semibold text-white">
                        Standard Resolution &amp; Verification Checklist
                    </h3>
                    <span className="text-xs text-muted">
                        {hasRootCause ? "Targeted for verified root cause" : "General triage plan"}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center">
                                1
                            </span>
                            <p className="text-xs font-semibold text-white">Code Remediation</p>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {rootCause
                                ? `Inspect the failure point for "${rootCause.title}". Review handler logic, add null/undefined checks, and boundary guards.`
                                : "Review the stack trace frames and surrounding log context for unhandled runtime exceptions."}
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center">
                                2
                            </span>
                            <p className="text-xs font-semibold text-white">Deployment / Rollback</p>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            If this failure correlated with a recent release, consider immediate canary rollback or deploying a fast-forward patch.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center">
                                3
                            </span>
                            <p className="text-xs font-semibold text-white">Verification &amp; Regression Test</p>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Write a unit or integration test reproducing the exact input conditions that triggered this event before merging to production.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center">
                                4
                            </span>
                            <p className="text-xs font-semibold text-white">Monitor Telemetry Recovery</p>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Check the System Health Dashboard to ensure error rates decline to 0% and crash-free session metrics return to 100%.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RecommendationCard({
    recommendation,
}: {
    recommendation: Recommendation;
}) {
    return (
        <div className="halo-card">
            <div className="halo-card-top">
                <div>
                    <div className="halo-recommendation-title">
                        <h3 className="halo-card-title">
                            {recommendation.title}
                        </h3>

                        <PriorityBadge
                            priority={
                                recommendation.priority
                            }
                        />
                    </div>

                    <p className="halo-card-description">
                        {recommendation.description}
                    </p>
                </div>

                <Confidence
                    value={recommendation.confidence}
                />
            </div>

            {recommendation.question && (
                <div className="halo-question">
                    <span className="halo-meta-label">
                        Question to answer
                    </span>

                    <p className="halo-question-text">
                        {recommendation.question}
                    </p>
                </div>
            )}
        </div>
    );
}

function PriorityBadge({
    priority,
}: {
    priority: Recommendation["priority"];
}) {
    return (
        <span
            className={`halo-priority halo-priority-${priority.toLowerCase()}`}
        >
            {priority}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/* Hypotheses                                                                  */
/* -------------------------------------------------------------------------- */

function HypothesisCard({
    hypothesis,
}: {
    hypothesis: Hypothesis;
}) {
    return (
        <div className="halo-card">
            <div className="halo-card-top">
                <div>
                    <div className="halo-hypothesis-title">
                        <h3 className="halo-card-title">
                            {hypothesis.title}
                        </h3>

                        <span className="halo-type-badge">
                            {formatLabel(
                                hypothesis.status
                            )}
                        </span>
                    </div>

                    <p className="halo-card-description">
                        {hypothesis.description}
                    </p>
                </div>

                <Confidence
                    value={hypothesis.confidence}
                />
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Impact                                                                      */
/* -------------------------------------------------------------------------- */

function ImpactCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="halo-card halo-impact-card">
            <span className="halo-meta-label">
                {label}
            </span>

            <p className="halo-impact-value">
                {value}
            </p>
        </div>
    );
}

function ListCard({
    title,
    items,
}: {
    title: string;
    items: string[];
}) {
    return (
        <div className="halo-card">
            <span className="halo-meta-label">
                {title}
            </span>

            <div className="halo-list-chips">
                {items.map((item, index) => (
                    <span
                        key={`${item}-${index}`}
                        className="halo-list-chip"
                    >
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

function MetadataChip({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <span className="halo-metadata-chip">
            <span className="halo-metadata-label">
                {label}
            </span>

            {value}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

function formatLabel(value: string) {
    return value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
            character.toUpperCase()
        );
}

function formatDate(value: Date) {
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}