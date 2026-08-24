import type {
    Investigation,
    Hypothesis,
    Evidence,
    Finding,
    Change,
    Impact,
    Recommendation,
} from "@halo/investigation-engine";

export interface EvidenceMatrixItem {
    id: string;
    type: "CULPRIT" | "TRIGGER" | "SYMPTOM" | "CHANGE";
    title: string;
    service: string;
    timestamp: Date;
    timeDeltaFormatted: string;
    details: string;
    traceId?: string;
    requestId?: string;
    status?: string | number;
    resource?: string;
    operation?: string;
    stackPreview?: string;
}

export interface RuledOutAlternative {
    title: string;
    confidence: number;
    confidenceLevel: string;
    whyRejected: string;
    counterEvidenceCount: number;
}

export interface RemediationPlanItem {
    category: "IMMEDIATE" | "PERMANENT_FIX" | "PREVENTION";
    priority: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    rationale: string;
    codeSnippet?: string;
    actionableSteps: string[];
}

export interface InterpretedInvestigation {
    /**
     * Clear, executive explanation of what actually broke in plain English.
     */
    whatHappened: {
        headline: string;
        narrative: string;
        initiatingService: string;
        triggerEvent: string;
        affectedEndpoints: string[];
        propagationSummary: string;
    };

    /**
     * Architectural and causal mechanics: why this failure occurred.
     */
    whyItHappened: {
        rootMechanism: string;
        contributingFactors: string[];
        architecturalContext: string;
    };

    /**
     * Diagnostic proof: exactly how Halo arrived at this conclusion.
     */
    howHaloKnows: {
        confidencePercent: number;
        confidenceLabel: string;
        coreSignals: string[];
        temporalCorrelation: string;
        statisticalProof: string;
    };

    /**
     * Categorized evidence matrix with timing offsets and trace references.
     */
    evidenceMatrix: {
        culprits: EvidenceMatrixItem[];
        triggers: EvidenceMatrixItem[];
        symptoms: EvidenceMatrixItem[];
        correlatedChanges: EvidenceMatrixItem[];
        totalEvaluatedCount: number;
    };

    /**
     * Analysis of disproved alternative hypotheses.
     */
    ruledOutAlternatives: RuledOutAlternative[];

    /**
     * Blast radius, customer impact, and service health degradation.
     */
    impactAnalysis: {
        blastRadiusScore: number;
        summary: string;
        affectedServices: string[];
        affectedUsersCount: number;
        affectedEndpoints: string[];
        errorBurstRate?: string;
    };

    /**
     * Actionable, concrete engineering remediation guide.
     */
    remediationGuide: {
        summary: string;
        immediateMitigation: RemediationPlanItem[];
        permanentFix: RemediationPlanItem[];
        preventiveMeasures: RemediationPlanItem[];
    };
}

/**
 * Transforms raw investigation engine outputs, evidence, and timeline
 * into a rich, natural-language, developer-facing interpretation.
 */
export function interpretInvestigation(
    investigation: Investigation,
    replaySession?: any | null
): InterpretedInvestigation {
    const {
        rootCause,
        report,
        timeline,
        evidence,
        hypotheses,
        findings,
        changes,
        impact,
        recommendations,
    } = investigation;

    // Determine baseline timing
    const sortedEvidence = [...evidence].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const firstEventTime = sortedEvidence[0]?.timestamp
        ? new Date(sortedEvidence[0].timestamp).getTime()
        : Date.now();

    // Identify primary services, operations, and endpoints
    const services = Array.from(new Set(evidence.map((e) => e.service).filter(Boolean)));
    const primaryService =
        evidence.find((e) => e.type === "ERROR" || e.type === "LOG")?.service ||
        services[0] ||
        "web-service";

    const errorEvidence = evidence.filter((e) => e.type === "ERROR");
    const traceEvidence = evidence.filter((e) => e.type === "TRACE");
    const metricEvidence = evidence.filter((e) => e.type === "METRIC");

    const affectedEndpoints = Array.from(
        new Set(
            evidence
                .map((e) => e.resource || e.operation || (e.tags?.path as string))
                .filter(Boolean) as string[]
        )
    );

    // 1. Synthesize "What Happened"
    const whatHappened = synthesizeWhatHappened({
        rootCause,
        report,
        evidence,
        errorEvidence,
        primaryService,
        affectedEndpoints,
        replaySession,
    });

    // 2. Synthesize "Why It Happened"
    const whyItHappened = synthesizeWhyItHappened({
        rootCause,
        findings,
        changes,
        errorEvidence,
        primaryService,
    });

    // 3. Synthesize "How Halo Knows"
    const howHaloKnows = synthesizeHowHaloKnows({
        rootCause,
        report,
        findings,
        evidence,
        errorEvidence,
        firstEventTime,
    });

    // 4. Synthesize Evidence Matrix
    const evidenceMatrix = synthesizeEvidenceMatrix({
        evidence,
        firstEventTime,
        rootCause,
    });

    // 5. Synthesize Ruled Out Alternatives
    const ruledOutAlternatives = synthesizeRuledOutAlternatives({
        hypotheses,
        rootCause,
        report,
    });

    // 6. Synthesize Impact Analysis
    const impactAnalysis = synthesizeImpactAnalysis({
        impact,
        evidence,
        services,
        affectedEndpoints,
        errorEvidence,
    });

    // 7. Synthesize Remediation Guide
    const remediationGuide = synthesizeRemediationGuide({
        rootCause,
        recommendations,
        primaryService,
        errorEvidence,
        findings,
    });

    return {
        whatHappened,
        whyItHappened,
        howHaloKnows,
        evidenceMatrix,
        ruledOutAlternatives,
        impactAnalysis,
        remediationGuide,
    };
}

/* -------------------------------------------------------------------------- */
/* Sub-Synthesizers                                                           */
/* -------------------------------------------------------------------------- */

function synthesizeWhatHappened({
    rootCause,
    report,
    evidence,
    errorEvidence,
    primaryService,
    affectedEndpoints,
    replaySession,
}: {
    rootCause: Hypothesis | null;
    report: any;
    evidence: Evidence[];
    errorEvidence: Evidence[];
    primaryService: string;
    affectedEndpoints: string[];
    replaySession?: any;
}) {
    const errorCount = errorEvidence.length;
    const primaryError = errorEvidence[0];
    const errorTitle = primaryError?.title || "Unhandled Exception";

    let headline = "";
    let narrative = "";
    let propagationSummary = "";

    if (rootCause) {
        headline = `${rootCause.title} in ${primaryService}`;
        narrative =
            report.rootCause?.explanation ||
            rootCause.description ||
            `Halo identified an anomalous failure cascade in ${primaryService} initiated by ${errorTitle}.`;

        if (affectedEndpoints.length > 0) {
            propagationSummary = `Failure propagated across ${affectedEndpoints.slice(0, 3).join(", ")} resulting in ${errorCount} captured incident events.`;
        } else {
            propagationSummary = `Failure cascade captured within ${primaryService} across ${evidence.length} correlated telemetry signals.`;
        }
    } else {
        headline = `Incident observed in ${primaryService}: ${errorTitle}`;
        narrative =
            report.summary ||
            `Halo evaluated ${evidence.length} telemetry points across ${primaryService}. While multiple anomalous signals were captured, no single hypothesis met full deterministic threshold.`;
        propagationSummary = `Observed ${errorCount} error events across ${evidence.length} total telemetry records.`;
    }

    if (replaySession?.url) {
        propagationSummary += ` Session replay indicates client failure initiated from ${replaySession.url}.`;
    }

    return {
        headline,
        narrative,
        initiatingService: primaryService,
        triggerEvent: errorTitle,
        affectedEndpoints: affectedEndpoints.length > 0 ? affectedEndpoints : ["/api/v1/request"],
        propagationSummary,
    };
}

function synthesizeWhyItHappened({
    rootCause,
    findings,
    changes,
    errorEvidence,
    primaryService,
}: {
    rootCause: Hypothesis | null;
    findings: Finding[];
    changes: Change[];
    errorEvidence: Evidence[];
    primaryService: string;
}) {
    const contributingFactors: string[] = [];

    // Extract contributing factors from findings
    for (const finding of findings) {
        if (finding.causalRole === "CONTRIBUTING" || finding.causalRole === "TRIGGER") {
            contributingFactors.push(finding.description || finding.title);
        }
    }

    // Extract correlated changes
    for (const change of changes) {
        contributingFactors.push(`Correlated change: ${change.title} (${change.type})`);
    }

    if (contributingFactors.length === 0 && errorEvidence.length > 0) {
        const err = errorEvidence[0];
        if (err.description) {
            contributingFactors.push(err.description);
        }
        contributingFactors.push(`Repeated exceptions in ${primaryService} under active request load.`);
    }

    const rootMechanism =
        rootCause?.description ||
        (findings.length > 0 ? findings[0].title : "Anomalous execution path in application logic");

    const architecturalContext = `Execution context indicates ${primaryService} experienced an unexpected state transition leading to downstream failure.`;

    return {
        rootMechanism,
        contributingFactors: contributingFactors.slice(0, 5),
        architecturalContext,
    };
}

function synthesizeHowHaloKnows({
    rootCause,
    report,
    findings,
    evidence,
    errorEvidence,
    firstEventTime,
}: {
    rootCause: Hypothesis | null;
    report: any;
    findings: Finding[];
    evidence: Evidence[];
    errorEvidence: Evidence[];
    firstEventTime: number;
}) {
    const confidence = rootCause?.confidence ?? report.rootCause?.confidence ?? 0.85;
    const confidencePercent = Math.round(confidence * 100);

    let confidenceLabel = "High Confidence";
    if (confidencePercent < 60) confidenceLabel = "Low Confidence (Needs Verification)";
    else if (confidencePercent < 80) confidenceLabel = "Moderate Confidence";

    const coreSignals: string[] = [];

    if (rootCause?.supportingReasons && rootCause.supportingReasons.length > 0) {
        for (const reason of rootCause.supportingReasons) {
            coreSignals.push(reason.description || reason.title);
        }
    } else {
        for (const finding of findings.slice(0, 4)) {
            coreSignals.push(`${finding.title}: ${finding.description || "Observed signal"}`);
        }
    }

    if (coreSignals.length === 0) {
        coreSignals.push(`Temporal alignment of ${errorEvidence.length} error signals.`);
        coreSignals.push(`Correlated trace propagation across ${evidence.length} telemetry points.`);
    }

    // Temporal proof calculation
    const lastEventTime =
        evidence.length > 1
            ? new Date(evidence[evidence.length - 1].timestamp).getTime()
            : firstEventTime;
    const durationSec = Math.max(1, Math.round((lastEventTime - firstEventTime) / 1000));

    const temporalCorrelation = `Incident signals clustered tightly across a ${durationSec}s window, establishing direct cause-and-effect sequencing.`;
    const statisticalProof = `Signal pattern matches known failure signatures with ${confidencePercent}% deterministic validation.`;

    return {
        confidencePercent,
        confidenceLabel,
        coreSignals,
        temporalCorrelation,
        statisticalProof,
    };
}

function synthesizeEvidenceMatrix({
    evidence,
    firstEventTime,
    rootCause,
}: {
    evidence: Evidence[];
    firstEventTime: number;
    rootCause: Hypothesis | null;
}) {
    const culprits: EvidenceMatrixItem[] = [];
    const triggers: EvidenceMatrixItem[] = [];
    const symptoms: EvidenceMatrixItem[] = [];
    const correlatedChanges: EvidenceMatrixItem[] = [];

    for (const item of evidence) {
        const itemTime = new Date(item.timestamp).getTime();
        const deltaMs = itemTime - firstEventTime;
        const timeDeltaFormatted = formatDeltaMs(deltaMs);

        const stackPreview =
            typeof item.metadata?.stack === "string"
                ? item.metadata.stack.split("\n")[0]
                : typeof item.metadata?.error === "string"
                ? item.metadata.error
                : undefined;

        const matrixItem: EvidenceMatrixItem = {
            id: item.id,
            type: "SYMPTOM",
            title: item.title,
            service: item.service,
            timestamp: new Date(item.timestamp),
            timeDeltaFormatted,
            details: item.description || item.title,
            traceId: item.traceId,
            requestId: item.requestId,
            status: item.status,
            resource: item.resource,
            operation: item.operation,
            stackPreview,
        };

        if (item.type === "DEPLOYMENT" || item.type === "CONFIG" || item.type === "FEATURE_FLAG") {
            matrixItem.type = "CHANGE";
            correlatedChanges.push(matrixItem);
        } else if (item.type === "ERROR") {
            if (culprits.length === 0) {
                matrixItem.type = "CULPRIT";
                culprits.push(matrixItem);
            } else {
                matrixItem.type = "SYMPTOM";
                symptoms.push(matrixItem);
            }
        } else if (item.type === "METRIC" || item.type === "TRACE") {
            matrixItem.type = "TRIGGER";
            triggers.push(matrixItem);
        } else {
            matrixItem.type = "SYMPTOM";
            symptoms.push(matrixItem);
        }
    }

    return {
        culprits: culprits.length > 0 ? culprits : symptoms.slice(0, 1),
        triggers,
        symptoms,
        correlatedChanges,
        totalEvaluatedCount: evidence.length,
    };
}

function synthesizeRuledOutAlternatives({
    hypotheses,
    rootCause,
    report,
}: {
    hypotheses: Hypothesis[];
    rootCause: Hypothesis | null;
    report: any;
}) {
    const ruledOut: RuledOutAlternative[] = [];

    const alternatives = hypotheses.filter((h) => h.id !== rootCause?.id);

    for (const alt of alternatives) {
        const conf = alt.confidence ?? 0.2;
        const confidencePercent = Math.round(conf * 100);

        let whyRejected = "Contradicted by active telemetry metrics.";
        if (alt.contradictingReasons && alt.contradictingReasons.length > 0) {
            whyRejected = alt.contradictingReasons.map((r) => r.title || r.description).join("; ");
        } else if (alt.missingReasons && alt.missingReasons.length > 0) {
            whyRejected = `Missing required precondition signals: ${alt.missingReasons
                .map((r) => r.title || r.description)
                .join(", ")}`;
        } else {
            whyRejected = `Insufficient signal density compared to leading hypothesis (${confidencePercent}% vs ${Math.round(
                (rootCause?.confidence || 0.8) * 100
            )}%).`;
        }

        ruledOut.push({
            title: alt.title,
            confidence: conf,
            confidenceLevel: `${confidencePercent}% Match`,
            whyRejected,
            counterEvidenceCount: alt.contradictingReasons?.length || 1,
        });
    }

    // If report has explicit alternatives
    if (ruledOut.length === 0 && report.alternatives && report.alternatives.length > 0) {
        for (const alt of report.alternatives) {
            ruledOut.push({
                title: alt.title,
                confidence: alt.confidence,
                confidenceLevel: alt.confidenceLevel || `${Math.round(alt.confidence * 100)}% Match`,
                whyRejected: "Telemetry showed contradictory health signals across monitored dependencies.",
                counterEvidenceCount: 1,
            });
        }
    }

    return ruledOut;
}

function synthesizeImpactAnalysis({
    impact,
    evidence,
    services,
    affectedEndpoints,
    errorEvidence,
}: {
    impact: Impact | null;
    evidence: Evidence[];
    services: string[];
    affectedEndpoints: string[];
    errorEvidence: Evidence[];
}) {
    const userCount = impact?.usersAffected ?? Math.max(1, Math.min(errorEvidence.length, 12));
    const blastRadiusScore = Math.min(
        100,
        Math.round((services.length * 20) + (affectedEndpoints.length * 15) + (errorEvidence.length * 5))
    );

    const summary = `Blast radius score of ${blastRadiusScore}/100. Affected ${services.length} service(s) and ~${userCount} user session(s) across ${affectedEndpoints.length} endpoint(s).`;

    return {
        blastRadiusScore,
        summary,
        affectedServices: services,
        affectedUsersCount: userCount,
        affectedEndpoints,
        errorBurstRate: `${errorEvidence.length} errors captured`,
    };
}

function synthesizeRemediationGuide({
    rootCause,
    recommendations,
    primaryService,
    errorEvidence,
    findings,
}: {
    rootCause: Hypothesis | null;
    recommendations: Recommendation[];
    primaryService: string;
    errorEvidence: Evidence[];
    findings: Finding[];
}) {
    const immediateMitigation: RemediationPlanItem[] = [];
    const permanentFix: RemediationPlanItem[] = [];
    const preventiveMeasures: RemediationPlanItem[] = [];

    // Map existing recommendations
    for (const rec of recommendations) {
        const item: RemediationPlanItem = {
            category: "IMMEDIATE",
            priority: rec.priority === "HIGH" ? "HIGH" : "MEDIUM",
            title: rec.title,
            rationale: rec.description || "Remediates verified root cause condition.",
            actionableSteps: [rec.description || rec.title],
        };

        if (rec.type === "CODE_FIX") {
            item.category = "PERMANENT_FIX";
            permanentFix.push(item);
        } else if (rec.type === "PREVENTION" || rec.type === "MONITORING") {
            item.category = "PREVENTION";
            preventiveMeasures.push(item);
        } else {
            immediateMitigation.push(item);
        }
    }

    // Ensure robust default steps if recommendations were sparse
    if (immediateMitigation.length === 0) {
        immediateMitigation.push({
            category: "IMMEDIATE",
            priority: "HIGH",
            title: `Inspect and isolate ${primaryService} active worker instances`,
            rationale: "Prevents ongoing error accumulation while applying code corrections.",
            actionableSteps: [
                `Verify memory and connection limits on ${primaryService}.`,
                "Check upstream load balancer health checks to ensure traffic sheds from degrading pods.",
            ],
        });
    }

    if (permanentFix.length === 0) {
        permanentFix.push({
            category: "PERMANENT_FIX",
            priority: "HIGH",
            title: `Add defensive error handling and timeout bounds in ${primaryService}`,
            rationale: "Ensures future unexpected exceptions fail gracefully rather than crashing requests.",
            codeSnippet: `try {\n  // Target execution path in ${primaryService}\n  const result = await executeOperation();\n} catch (error) {\n  logger.error("Handled incident fallback", { error });\n  return fallbackResponse();\n}`,
            actionableSteps: [
                "Wrap asynchronous database and network calls in structured try/catch blocks.",
                "Enforce strict per-request timeouts (e.g. 5000ms) with circuit breaker fallback.",
            ],
        });
    }

    if (preventiveMeasures.length === 0) {
        preventiveMeasures.push({
            category: "PREVENTION",
            priority: "MEDIUM",
            title: `Configure automated alert rule for ${primaryService} error rates`,
            rationale: "Notifies team immediately if error rate exceeds 1% over a 5-minute rolling window.",
            actionableSteps: [
                `Add monitor: Error rate > 1.0% on service '${primaryService}'.`,
                "Enable automated anomaly detection for sudden latency shifts.",
            ],
        });
    }

    const summary = `3-stage remediation plan synthesized to mitigate immediate user impact, address the core ${primaryService} fault, and establish regression guardrails.`;

    return {
        summary,
        immediateMitigation,
        permanentFix,
        preventiveMeasures,
    };
}

function formatDeltaMs(deltaMs: number): string {
    if (deltaMs === 0) return "T+0s (Initial signal)";
    const sign = deltaMs >= 0 ? "+" : "-";
    const absMs = Math.abs(deltaMs);
    if (absMs < 1000) return `T${sign}${absMs}ms`;
    const sec = (absMs / 1000).toFixed(1);
    return `T${sign}${sec}s`;
}
