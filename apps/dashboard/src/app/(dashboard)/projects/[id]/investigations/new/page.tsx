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

import { interpretInvestigation, type InterpretedInvestigation } from "@/lib/investigation/interpreter";

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
    const interpreted = interpretInvestigation(investigation, replaySession);

    return (
        <div className="halo-investigation">
            <div className="mb-4">
                <BackButton fallbackHref="/overview" label="Back to Overview" />
            </div>

            {/* Header */}

            <header className="halo-investigation-header">
                <div className="halo-eyebrow-row">
                    <span className="halo-eyebrow">
                        Automated Investigation &amp; Root Cause Analysis
                    </span>

                    <StatusBadge status={status} />
                </div>

                <h1 className="halo-investigation-title">
                    {interpreted.whatHappened.headline}
                </h1>

                <p className="halo-investigation-description">
                    Halo evaluated {evidence.length} telemetry signals, reconstructed the timeline, and synthesized the causal failure chain.
                </p>
            </header>

            {/* Verdict */}

            <section className="halo-verdict">
                <div className="halo-verdict-header">
                    <span className="halo-section-label">
                        Executive Diagnosis
                    </span>
                    <span className="text-xs font-mono text-secondary">
                        Blast Radius: {interpreted.impactAnalysis.blastRadiusScore}/100
                    </span>
                </div>

                <div className="halo-verdict-body">
                    <div className="halo-verdict-content">
                        <div className="halo-verdict-main space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="halo-result-label">
                                    {hasRootCause
                                        ? "Validated Root Cause"
                                        : "Inconclusive Signal"}
                                </span>
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                                    {interpreted.whatHappened.initiatingService}
                                </span>
                            </div>

                            <h2 className="halo-verdict-title text-xl font-bold text-white">
                                {hasRootCause
                                    ? report.rootCause?.title || rootCause.title
                                    : "No singular root cause established"}
                            </h2>

                            <p className="halo-verdict-summary text-sm text-zinc-300 leading-relaxed">
                                {interpreted.whatHappened.narrative}
                            </p>

                            <div className="p-3 rounded-lg bg-surface border border-border text-xs text-secondary flex items-start gap-2">
                                <span className="text-accent font-semibold">Propagation:</span>
                                <span>{interpreted.whatHappened.propagationSummary}</span>
                            </div>
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
                        title="Root cause & Diagnostic Reasoning"
                        description="The strongest explanation supported by the available telemetry, architectural context, and causal proof."
                    />

                    <RootCauseCard
                        hypothesis={rootCause}
                        interpreted={interpreted}
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
                    interpreted={interpreted}
                />
            </section>

            {/* Evidence */}

            {evidence.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Evidence Matrix"
                        description={`${evidence.length} ${evidence.length === 1
                            ? "piece"
                            : "pieces"
                            } of evidence analyzed across timing offsets and telemetry channels.`}
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

            {/* Alternatives / Ruled out causes */}

            {interpreted.ruledOutAlternatives.length > 0 && (
                <section className="halo-section">
                    <SectionHeading
                        title="Evaluated &amp; Ruled Out Hypotheses"
                        description="Alternative explanations considered and why Halo rejected them based on contradictory telemetry."
                    />

                    <div className="halo-stack">
                        {interpreted.ruledOutAlternatives.map(
                            (alt, index) => (
                                <div
                                    key={`${alt.title}-${index}`}
                                    className="halo-card p-4 space-y-2 border border-border"
                                >
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-white">
                                            {alt.title}
                                        </h4>
                                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted">
                                            {alt.confidenceLevel}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded bg-red-500/5 border border-red-500/20 text-xs text-red-300">
                                        <span className="font-semibold text-red-400">Why Ruled Out: </span>
                                        {alt.whyRejected}
                                    </div>
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

function RootCauseCard({
    hypothesis,
    interpreted,
}: {
    hypothesis: Hypothesis;
    interpreted?: InterpretedInvestigation;
}) {
    return (
        <div className="halo-card halo-root-cause space-y-6">
            {/* Header / Verdict */}
            <div className="halo-root-cause-header">
                <div>
                    <span className="halo-result-label">
                        Primary Root Cause
                    </span>

                    <h3 className="halo-root-cause-title text-lg font-bold text-white mt-1">
                        {hypothesis.title}
                    </h3>

                    <p className="halo-card-description text-sm text-zinc-300 mt-1.5 leading-relaxed">
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

            {/* Deep Developer Interpretation Panels */}
            {interpreted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
                    {/* Why It Happened Panel */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                                Why It Likely Happened
                            </h4>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {interpreted.whyItHappened.rootMechanism}
                        </p>
                        {interpreted.whyItHappened.contributingFactors.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <span className="text-[11px] font-semibold text-zinc-400">
                                    Contributing Factors:
                                </span>
                                <ul className="space-y-1">
                                    {interpreted.whyItHappened.contributingFactors.map((factor, idx) => (
                                        <li key={idx} className="text-[11px] text-zinc-300 flex items-start gap-1.5">
                                            <span className="text-amber-400/80 font-bold">&bull;</span>
                                            <span>{factor}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* How Halo Knows Panel */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent" />
                            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                                How Halo Validated This
                            </h4>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {interpreted.howHaloKnows.temporalCorrelation}
                        </p>
                        <div className="p-2 rounded bg-accent/5 border border-accent/20 text-[11px] text-accent">
                            <span className="font-semibold">Diagnostic Proof: </span>
                            {interpreted.howHaloKnows.statisticalProof}
                        </div>
                    </div>
                </div>
            )}

            {/* Structured Reasons */}
            <div className="halo-reason-grid border-t border-border pt-4">
                <ReasonGroup
                    title="Supporting Telemetry Signals"
                    reasons={
                        hypothesis.supportingReasons
                    }
                    type="supporting"
                />

                <ReasonGroup
                    title="Contradicting / Counter Evidence"
                    reasons={
                        hypothesis.contradictingReasons
                    }
                    type="contradicting"
                />
            </div>

            {hypothesis.missingReasons.length > 0 && (
                <div className="halo-reason-missing">
                    <ReasonGroup
                        title="Evidence still needed for 100% certainty"
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
    interpreted,
}: {
    recommendations: Recommendation[];
    rootCause: Hypothesis | null;
    hasRootCause: boolean;
    interpreted?: InterpretedInvestigation;
}) {
    return (
        <div className="space-y-6">
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

            {/* Synthesized 3-Stage Developer Action Plan */}
            {interpreted && (
                <div className="halo-card p-6 space-y-5 border border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-white">
                                Actionable Developer Remediation Plan
                            </h3>
                            <p className="text-xs text-secondary mt-0.5">
                                {interpreted.remediationGuide.summary}
                            </p>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold self-start sm:self-auto">
                            Prioritized Guide
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Stage 1: Immediate Mitigation */}
                        <div className="p-4 rounded-xl bg-surface border border-red-500/20 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 font-semibold">
                                        Stage 1 &bull; Immediate
                                    </span>
                                    <span className="text-[10px] text-muted uppercase font-bold">Mitigate</span>
                                </div>
                                {interpreted.remediationGuide.immediateMitigation.map((item, idx) => (
                                    <div key={idx} className="space-y-1.5 pt-1">
                                        <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed">{item.rationale}</p>
                                        <ul className="space-y-1 pt-1">
                                            {item.actionableSteps.map((step, sIdx) => (
                                                <li key={sIdx} className="text-[11px] text-zinc-400 flex items-start gap-1.5">
                                                    <span className="text-red-400 font-bold">&rarr;</span>
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stage 2: Permanent Code Fix */}
                        <div className="p-4 rounded-xl bg-surface border border-blue-500/20 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold">
                                        Stage 2 &bull; Permanent Fix
                                    </span>
                                    <span className="text-[10px] text-muted uppercase font-bold">Code / Architecture</span>
                                </div>
                                {interpreted.remediationGuide.permanentFix.map((item, idx) => (
                                    <div key={idx} className="space-y-1.5 pt-1">
                                        <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed">{item.rationale}</p>
                                        {item.codeSnippet && (
                                            <pre className="p-2.5 rounded-lg bg-[#0a0d14] border border-white/10 text-[10px] font-mono text-emerald-300 overflow-x-auto my-2">
                                                <code>{item.codeSnippet}</code>
                                            </pre>
                                        )}
                                        <ul className="space-y-1 pt-1">
                                            {item.actionableSteps.map((step, sIdx) => (
                                                <li key={sIdx} className="text-[11px] text-zinc-400 flex items-start gap-1.5">
                                                    <span className="text-blue-400 font-bold">&rarr;</span>
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stage 3: Prevention & Guardrails */}
                        <div className="p-4 rounded-xl bg-surface border border-emerald-500/20 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                                        Stage 3 &bull; Guardrails
                                    </span>
                                    <span className="text-[10px] text-muted uppercase font-bold">Prevention</span>
                                </div>
                                {interpreted.remediationGuide.preventiveMeasures.map((item, idx) => (
                                    <div key={idx} className="space-y-1.5 pt-1">
                                        <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed">{item.rationale}</p>
                                        <ul className="space-y-1 pt-1">
                                            {item.actionableSteps.map((step, sIdx) => (
                                                <li key={sIdx} className="text-[11px] text-zinc-400 flex items-start gap-1.5">
                                                    <span className="text-emerald-400 font-bold">&rarr;</span>
                                                    <span>{step}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
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