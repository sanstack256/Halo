import { investigateIssue } from "@/lib/investigation/run";

import type {
    Investigation,
    Hypothesis,
} from "@halo/investigation-engine";

type Props = {
    params: Promise<{
        id: string;
    }>;

    searchParams: Promise<{
        issueId?: string;
    }>;
};

export default async function InvestigationPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    const { issueId } = await searchParams;

    void id;

    if (!issueId) {
        return (
            <div className="py-20 text-center">
                <h1 className="text-xl font-semibold">
                    No issue selected
                </h1>

                <p className="mt-2 text-secondary">
                    Select an issue to investigate.
                </p>
            </div>
        );
    }

    const investigation =
        await investigateIssue(issueId);

    return (
        <InvestigationView
            investigation={investigation}
        />
    );
}

/* -------------------------------------------------------------------------- */
/* Main view                                                                   */
/* -------------------------------------------------------------------------- */

function InvestigationView({
    investigation,
}: {
    investigation: Investigation;
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

    const hasRootCause =
        rootCause !== null;


    return (
        <div className="space-y-12 pb-20">
            {/* ---------------------------------------------------------------- */}
            {/* Header                                                           */}
            {/* ---------------------------------------------------------------- */}

            <header className="space-y-3">
                <div className="flex items-center gap-3">
                    <p className="text-sm text-muted">
                        Investigation
                    </p>

                    <StatusBadge status={status} />
                </div>

                <h1 className="text-4xl font-semibold tracking-tight">
                    Why did this fail?
                </h1>

                <p className="max-w-2xl text-secondary">
                    Halo reconstructed the available evidence
                    and evaluated possible causes.
                </p>
            </header>

            {/* ---------------------------------------------------------------- */}
            {/* Verdict                                                          */}
            {/* ---------------------------------------------------------------- */}

            <section className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="border-b border-border px-6 py-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">
                        Investigation result
                    </p>
                </div>

                <div className="px-6 py-7">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <h2 className="text-2xl font-semibold">
                                {hasRootCause
                                    ? report.rootCause?.title
                                    : "No root cause established"}
                            </h2>

                            <p className="leading-7 text-secondary">
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
                                />
                            )}
                    </div>
                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            {/* Root cause                                                       */}
            {/* ---------------------------------------------------------------- */}

            {rootCause && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Root cause"
                        description="The strongest explanation supported by the available evidence."
                    />

                    <RootCauseCard
                        hypothesis={rootCause}
                    />
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Timeline                                                          */}
            {/* ---------------------------------------------------------------- */}

            {timeline.events.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Timeline"
                        description="The sequence of events Halo reconstructed around the failure."
                    />

                    <div className="rounded-2xl border border-border bg-surface">
                        <div className="divide-y divide-border">
                            {timeline.events.map(
                                (event) => (
                                    <TimelineItem
                                        key={event.id}
                                        event={event}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Evidence                                                          */}
            {/* ---------------------------------------------------------------- */}

            {evidence.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Evidence"
                        description={`${evidence.length} ${evidence.length === 1 ? "piece" : "pieces"} of evidence considered.`}
                    />

                    <div className="space-y-3">
                        {evidence.map((item) => (
                            <EvidenceCard
                                key={item.id}
                                evidence={item}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Findings                                                          */}
            {/* ---------------------------------------------------------------- */}

            {findings.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Findings"
                        description="Observations derived from the evidence."
                    />

                    <div className="grid gap-3 lg:grid-cols-2">
                        {findings.map((finding) => (
                            <div
                                key={finding.id}
                                className="rounded-2xl border border-border bg-surface p-5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wider text-muted">
                                            {formatLabel(
                                                finding.causalRole
                                            )}
                                        </p>

                                        <h3 className="mt-2 font-medium">
                                            {finding.title}
                                        </h3>
                                    </div>

                                    <Score
                                        value={
                                            finding.strength
                                        }
                                    />
                                </div>

                                <p className="mt-3 text-sm leading-6 text-secondary">
                                    {finding.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Alternatives                                                     */}
            {/* ---------------------------------------------------------------- */}

            {report.alternatives.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Other possible causes"
                        description="Alternative explanations considered during the investigation."
                    />

                    <div className="rounded-2xl border border-border bg-surface">
                        <div className="divide-y divide-border">
                            {report.alternatives.map(
                                (alternative, index) => (
                                    <div
                                        key={`${alternative.title}-${index}`}
                                        className="flex items-center justify-between gap-6 px-5 py-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-medium">
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
                    </div>
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Changes                                                           */}
            {/* ---------------------------------------------------------------- */}

            {changes.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Changes"
                        description="Changes detected around the incident."
                    />

                    <div className="space-y-3">
                        {changes.map((change) => (
                            <div
                                key={change.id}
                                className="rounded-2xl border border-border bg-surface p-5"
                            >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="rounded-md border border-border px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                                            {formatLabel(
                                                change.type
                                            )}
                                        </span>

                                        <h3 className="font-medium">
                                            {change.title}
                                        </h3>
                                    </div>

                                    <time className="text-xs text-muted">
                                        {formatDate(
                                            change.timestamp
                                        )}
                                    </time>
                                </div>

                                {change.description && (
                                    <p className="mt-3 text-sm leading-6 text-secondary">
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

            {/* ---------------------------------------------------------------- */}
            {/* Impact                                                            */}
            {/* ---------------------------------------------------------------- */}

            {impact && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Impact"
                        description="The observed scope of the incident."
                    />

                    <div className="grid gap-3 sm:grid-cols-3">
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
                            <div className="grid gap-3 lg:grid-cols-2">
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

            {/* ---------------------------------------------------------------- */}
            {/* Uncertainties                                                    */}
            {/* ---------------------------------------------------------------- */}

            {report.uncertainties.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="What is still unknown"
                        description="Evidence gaps that prevent a stronger conclusion."
                    />

                    <div className="rounded-2xl border border-border bg-surface">
                        <div className="divide-y divide-border">
                            {report.uncertainties.map(
                                (uncertainty, index) => (
                                    <div
                                        key={`${uncertainty}-${index}`}
                                        className="flex gap-3 px-5 py-4"
                                    >
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />

                                        <p className="text-sm leading-6 text-secondary">
                                            {
                                                uncertainty
                                            }
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Next steps                                                       */}
            {/* ---------------------------------------------------------------- */}

            {recommendations.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Recommended next steps"
                        description="Actions that can reduce uncertainty or validate the investigation."
                    />

                    <div className="space-y-3">
                        {recommendations.map(
                            (recommendation) => (
                                <div
                                    key={
                                        recommendation.id
                                    }
                                    className="rounded-2xl border border-border bg-surface p-5"
                                >
                                    <div className="flex items-start justify-between gap-5">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-medium">
                                                    {
                                                        recommendation.title
                                                    }
                                                </h3>

                                                <PriorityBadge
                                                    priority={
                                                        recommendation.priority
                                                    }
                                                />
                                            </div>

                                            <p className="mt-2 text-sm leading-6 text-secondary">
                                                {
                                                    recommendation.description
                                                }
                                            </p>
                                        </div>

                                        <Confidence
                                            value={
                                                recommendation.confidence
                                            }
                                        />
                                    </div>

                                    {recommendation.question && (
                                        <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3">
                                            <p className="text-xs font-medium uppercase tracking-wider text-muted">
                                                Question to answer
                                            </p>

                                            <p className="mt-1 text-sm text-secondary">
                                                {
                                                    recommendation.question
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </section>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Hypotheses                                                       */}
            {/* ---------------------------------------------------------------- */}

            {hypotheses.length > 0 && (
                <section className="space-y-5">
                    <SectionHeading
                        title="Investigation hypotheses"
                        description="How Halo evaluated the possible explanations."
                    />

                    <div className="space-y-3">
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
/* Components                                                                  */
/* -------------------------------------------------------------------------- */

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div>
            <h2 className="text-lg font-semibold">
                {title}
            </h2>

            <p className="mt-1 text-sm text-muted">
                {description}
            </p>
        </div>
    );
}

function StatusBadge({
    status,
}: {
    status: Investigation["status"];
}) {
    const styles =
        status === "CONCLUDED"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : status === "INVESTIGATING"
                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                : "border-amber-500/20 bg-amber-500/10 text-amber-400";

    return (
        <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${styles}`}
        >
            {status}
        </span>
    );
}

function RootCauseCard({
    hypothesis,
}: {
    hypothesis: Hypothesis;
}) {
    return (
        <div className="rounded-2xl border border-emerald-500/20 bg-surface">
            <div className="border-b border-border px-6 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                            Most likely cause
                        </p>

                        <h3 className="mt-2 text-xl font-semibold">
                            {hypothesis.title}
                        </h3>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
                            {hypothesis.description}
                        </p>
                    </div>

                    <Confidence
                        value={hypothesis.confidence}
                    />
                </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2">
                <ReasonGroup
                    title="Supporting evidence"
                    reasons={
                        hypothesis.supportingReasons
                    }
                    type="supporting"
                />

                <ReasonGroup
                    title="Contradicting evidence"
                    reasons={
                        hypothesis.contradictingReasons
                    }
                    type="contradicting"
                />
            </div>

            {hypothesis.missingReasons.length > 0 && (
                <div className="border-t border-border px-6 py-5">
                    <ReasonGroup
                        title="Evidence still missing"
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
                <p className="text-sm font-medium">
                    {title}
                </p>

                <p className="mt-2 text-sm text-muted">
                    None identified.
                </p>
            </div>
        );
    }

    const marker =
        type === "supporting"
            ? "bg-emerald-400"
            : type === "contradicting"
                ? "bg-red-400"
                : "bg-amber-400";

    return (
        <div>
            <p className="text-sm font-medium">
                {title}
            </p>

            <div className="mt-3 space-y-3">
                {reasons
                    .slice(0, 5)
                    .map((reason, index) => (
                        <div
                            key={`${reason.title}-${index}`}
                            className="flex gap-3"
                        >
                            <span
                                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${marker}`}
                            />

                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {reason.title}
                                </p>

                                <p className="mt-1 text-sm leading-6 text-secondary">
                                    {
                                        reason.description
                                    }
                                </p>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}

function TimelineItem({
    event,
}: {
    event: Investigation["timeline"]["events"][number];
}) {
    return (
        <div className="grid grid-cols-[110px_20px_1fr] gap-4 px-5 py-5">
            <time className="text-right text-xs leading-5 text-muted">
                {formatDate(event.timestamp)}
            </time>

            <div className="relative flex justify-center">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-400 ring-4 ring-blue-400/10" />
            </div>

            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">
                        {event.title}
                    </h3>

                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                        {formatLabel(event.type)}
                    </span>
                </div>

                {event.description && (
                    <p className="mt-1 text-sm leading-6 text-secondary">
                        {event.description}
                    </p>
                )}
            </div>
        </div>
    );
}

function EvidenceCard({
    evidence,
}: {
    evidence: Investigation["evidence"][number];
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                    <span className="rounded-md border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                        {formatLabel(evidence.type)}
                    </span>

                    <div className="min-w-0">
                        <h3 className="font-medium">
                            {evidence.title}
                        </h3>

                        <p className="mt-1 text-xs text-muted">
                            {evidence.source}
                            {" · "}
                            {evidence.service}
                        </p>
                    </div>
                </div>

                <time className="shrink-0 text-xs text-muted">
                    {formatDate(evidence.timestamp)}
                </time>
            </div>

            {evidence.description && (
                <p className="mt-4 text-sm leading-6 text-secondary">
                    {evidence.description}
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
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

                {evidence.status !==
                    undefined && (
                        <MetadataChip
                            label="status"
                            value={String(
                                evidence.status
                            )}
                        />
                    )}

                {evidence.durationMs !==
                    undefined && (
                        <MetadataChip
                            label="duration"
                            value={`${evidence.durationMs}ms`}
                        />
                    )}
            </div>
        </div>
    );
}

function HypothesisCard({
    hypothesis,
}: {
    hypothesis: Hypothesis;
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">
                            {hypothesis.title}
                        </h3>

                        <span className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted">
                            {formatLabel(
                                hypothesis.status
                            )}
                        </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-secondary">
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

function Confidence({
    value,
}: {
    value: number;
}) {
    return (
        <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tracking-tight">
                {value}%
            </p>

            <p className="text-[10px] uppercase tracking-wider text-muted">
                confidence
            </p>
        </div>
    );
}

function Score({
    value,
}: {
    value: number;
}) {
    return (
        <span className="text-xs font-medium text-muted">
            {value} strength
        </span>
    );
}

function PriorityBadge({
    priority,
}: {
    priority:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
}) {
    const styles =
        priority === "HIGH"
            ? "border-red-500/20 bg-red-500/10 text-red-400"
            : priority === "MEDIUM"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                : "border-border bg-background text-muted";

    return (
        <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles}`}
        >
            {priority}
        </span>
    );
}

function ImpactCard({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wider text-muted">
                {label}
            </p>

            <p className="mt-2 text-xl font-semibold">
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
        <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
                {title}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
                {items.map((item, index) => (
                    <span
                        key={`${item}-${index}`}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-secondary"
                    >
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

function MetadataChip({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <span className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-secondary">
            <span className="text-muted">
                {label}
                {" "}
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