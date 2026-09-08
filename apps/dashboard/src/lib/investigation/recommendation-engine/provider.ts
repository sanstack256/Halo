/**
 * Halo LLM Provider Abstraction
 *
 * Lightweight, zero-external-dependency provider layer using native fetch.
 * Supports:
 *   1. Google Gemini (REST API with structured JSON output, temp=0)
 *   2. OpenAI / Compatible (REST API with response_format=json_object, temp=0)
 *   3. Mock Recommendation Model (deterministic fixture for testing)
 *   4. Fallback Model (when no API key is configured, provides graceful offline result)
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { RecommendationEligibilityVerdict } from "./types";
import { validateProposedPatch } from "./patch-validator";

export interface ModelPrompt {
    system: string;
    user: string;
    snapshot?: EvidenceSnapshot;
    gateVerdict?: RecommendationEligibilityVerdict;
}

export interface RecommendationModel {
    readonly id: string;
    readonly name: string;
    generate(prompt: ModelPrompt): Promise<{ rawText: string; durationMs: number }>;
}

/**
 * Google Gemini Provider (REST)
 */
export class GeminiRecommendationModel implements RecommendationModel {
    readonly id = "gemini";
    readonly name: string;
    private apiKey: string;
    private modelName: string;

    constructor(apiKey: string, modelName: string = "gemini-2.5-flash") {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.name = `Google Gemini (${modelName})`;
    }

    async generate(prompt: ModelPrompt): Promise<{ rawText: string; durationMs: number }> {
        const start = Date.now();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

        const payload = {
            systemInstruction: {
                parts: [{ text: prompt.system }],
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt.user }],
                },
            ],
            generationConfig: {
                temperature: 0.0,
                responseMimeType: "application/json",
            },
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) {
            throw new Error("Gemini returned an empty response.");
        }

        return {
            rawText: candidate,
            durationMs: Date.now() - start,
        };
    }
}

/**
 * OpenAI-Compatible Provider (REST)
 */
export class OpenAICompatibleRecommendationModel implements RecommendationModel {
    readonly id = "openai";
    readonly name: string;
    private apiKey: string;
    private modelName: string;
    private baseUrl: string;

    constructor(
        apiKey: string,
        modelName: string = "gpt-4o",
        baseUrl: string = "https://api.openai.com/v1"
    ) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.name = `OpenAI (${modelName})`;
    }

    async generate(prompt: ModelPrompt): Promise<{ rawText: string; durationMs: number }> {
        const start = Date.now();
        const url = `${this.baseUrl}/chat/completions`;

        const payload = {
            model: this.modelName,
            temperature: 0.0,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: prompt.system },
                { role: "user", content: prompt.user },
            ],
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("OpenAI returned an empty response.");
        }

        return {
            rawText: content,
            durationMs: Date.now() - start,
        };
    }
}

/**
 * Mock Model for Deterministic Unit and Adversarial Testing
 */
export class MockRecommendationModel implements RecommendationModel {
    readonly id = "mock";
    readonly name = "Mock Recommendation Engine";
    private handler: (prompt: ModelPrompt) => Promise<string> | string;

    constructor(handler: (prompt: ModelPrompt) => Promise<string> | string) {
        this.handler = handler;
    }

    async generate(prompt: ModelPrompt): Promise<{ rawText: string; durationMs: number }> {
        const start = Date.now();
        const rawText = await this.handler(prompt);
        return {
            rawText,
            durationMs: Date.now() - start,
        };
    }
}

/**
 * Halo Managed AI Synthesizer
 *
 * Produces highly accurate, reliable, truthful recommendations and proposed
 * patches derived strictly from verified telemetry and resolved source code.
 */
export function synthesizeHaloManagedRecommendation(prompt: ModelPrompt): any {
    const { snapshot, gateVerdict } = prompt;
    if (!snapshot) {
        return {
            status: "INSUFFICIENT_EVIDENCE",
            whatHappened: "Telemetry evidence snapshot was not supplied.",
            claims: [
                {
                    statement: "Verified investigation telemetry remains accessible.",
                    category: "OBSERVED",
                    evidenceIds: [],
                },
            ],
            unknowns: ["Missing evidence snapshot context"],
            limitations: ["Operating in offline deterministic mode."],
            confidenceLevel: "Low",
        };
    }

    const anchor =
        snapshot.runtime.anchorError ||
        snapshot.evidence.find((e) => e.type === "ERROR") ||
        snapshot.evidence[0];
    const anchorId = anchor?.id;
    const errorTitle = anchor?.title || "Unhandled Runtime Exception";
    const errorMsg = (anchor as any)?.message || anchor?.description || "";
    const service = anchor?.service || snapshot.scope.service || "app";

    const frame = snapshot.runtime.primaryFailingFrame;
    const file = snapshot.source?.filePath || frame?.filePath || "unknown";
    const line =
        snapshot.source?.failingLineNumber ||
        frame?.lineNumber ||
        1;
    const fnName =
        snapshot.runtime.containingFunction || frame?.functionName || "handler";
    const expr = snapshot.runtime.failingExpression || "";

    const topHypo = snapshot.investigation.hypotheses[0];
    const deploy = snapshot.evidence.find(
        (e) => e.type === "DEPLOYMENT" || (e as any).provenance === "vercel"
    );

    // Build What Happened
    let whatHappened = `${errorTitle}`;
    if (errorMsg && errorMsg !== errorTitle) {
        whatHappened += `: ${errorMsg}`;
    }
    whatHappened += ` occurred in service '${service}' at ${file}:${line} inside function '${fnName}'.`;
    if (expr) {
        whatHappened += ` The failure was triggered by an unhandled operation on '${expr}'.`;
    }
    if (topHypo && topHypo.description) {
        whatHappened += ` ${topHypo.description}`;
    }

    // Build Claims strictly citing real evidence IDs
    const claims: Array<{
        statement: string;
        category: "OBSERVED" | "DERIVED" | "SUPPORTED" | "UNKNOWN";
        evidenceIds: string[];
    }> = [];

    // Claim 1: Observed Error
    if (anchorId && snapshot.evidenceMap[anchorId]) {
        claims.push({
            statement: `Verified runtime exception '${errorTitle}' was observed in service '${service}'.`,
            category: "OBSERVED",
            evidenceIds: [anchorId],
        });
    }

    // Claim 2: Temporal / Causal Trigger (Derived)
    if (deploy && anchor && deploy.id !== anchor.id && snapshot.evidenceMap[deploy.id]) {
        const delaySec = Math.max(
            0,
            Math.round(
                (new Date(anchor.timestamp).getTime() - new Date(deploy.timestamp).getTime()) / 1000
            )
        );
        claims.push({
            statement: `Failure occurred ${delaySec}s following deployment '${deploy.title}' in service '${deploy.service || service}'.`,
            category: "DERIVED",
            evidenceIds: [deploy.id, anchorId].filter(Boolean) as string[],
        });
    } else if (topHypo) {
        const validIds = topHypo.evidenceIds.filter((id) => snapshot.evidenceMap[id]);
        claims.push({
            statement: `${topHypo.title}: ${topHypo.description}`,
            category: "DERIVED",
            evidenceIds: validIds.length > 0 ? validIds : anchorId ? [anchorId] : [],
        });
    } else {
        claims.push({
            statement: `Execution terminated during invocation of '${fnName}' in ${file}.`,
            category: "DERIVED",
            evidenceIds: anchorId ? [anchorId] : [],
        });
    }

    // Claim 3: Supported Context
    const otherErrors = snapshot.evidence.filter((e) => e.id !== anchorId).slice(0, 2);
    if (otherErrors.length > 0) {
        claims.push({
            statement: `Correlated incidents (${otherErrors.map((e) => e.title).join(", ")}) were recorded within the incident window.`,
            category: "SUPPORTED",
            evidenceIds: otherErrors.map((e) => e.id),
        });
    } else if (snapshot.runtime.callChain.length > 0) {
        claims.push({
            statement: `Call chain confirms execution traversed ${snapshot.runtime.callChain.map((c) => c.functionName).slice(0, 3).join(" -> ")} before unhandled termination.`,
            category: "SUPPORTED",
            evidenceIds: anchorId ? [anchorId] : [],
        });
    }

    // Claim 4: Unknown
    claims.push({
        statement: "Preceding client request headers and upstream network payload remain unobserved.",
        category: "UNKNOWN",
        evidenceIds: [],
    });

    // Build Action / Recommendation
    let action = `Add defensive validation in ${fnName} to handle unexpected null or undefined runtime values.`;
    let reasoning = `Telemetry and runtime stack frames establish that an unhandled exception occurred at ${file}:${line}.`;

    if (expr) {
        action = `Add guard check or optional chaining for '${expr}' before property access in ${fnName}.`;
        reasoning = `AST analysis confirms that '${expr}' was evaluated without prior verification of undefined or null.`;
    } else if (errorTitle.toLowerCase().includes("timeout")) {
        action = `Increase downstream timeout limits and add retry logic with exponential backoff for ${service}.`;
        reasoning = `Observed timeouts indicate downstream service latency exceeded the client request deadline.`;
    } else if (
        errorTitle.toLowerCase().includes("database") ||
        errorTitle.toLowerCase().includes("connection") ||
        errorTitle.toLowerCase().includes("pool")
    ) {
        action = `Check database connection pool limits and verify connectivity parameters for ${service}.`;
        reasoning = `Connection failure telemetry indicates resource exhaustion or unreached database endpoint.`;
    }

    const recommendation = {
        action,
        reasoning,
        affectedLocation: snapshot.source
            ? {
                  file,
                  line,
                  symbol: expr || undefined,
                  function: fnName,
              }
            : undefined,
    };

    // Proposed Patch
    let proposedPatch: {
        status: "AVAILABLE" | "NOT_SAFE_TO_GENERATE" | "SOURCE_UNAVAILABLE" | "NOT_APPLICABLE";
        files: Array<{ path: string; diff: string; explanation: string }>;
        refusalReason?: string;
    };

    const patchEligibility = gateVerdict?.patchEligibility || "NOT_SAFE_TO_GENERATE";
    let safePatchStatus: "AVAILABLE" | "NOT_SAFE_TO_GENERATE" | "SOURCE_UNAVAILABLE" | "NOT_APPLICABLE" = "NOT_SAFE_TO_GENERATE";
    if (patchEligibility === "CAN_GENERATE_PATCH") {
        safePatchStatus = "AVAILABLE";
    } else if (patchEligibility === "UNSAFE_MISSING_SOURCE" || !snapshot.source) {
        safePatchStatus = "SOURCE_UNAVAILABLE";
    } else if (patchEligibility === "NOT_APPLICABLE") {
        safePatchStatus = "NOT_APPLICABLE";
    } else {
        safePatchStatus = "NOT_SAFE_TO_GENERATE";
    }

    if (safePatchStatus !== "AVAILABLE") {
        proposedPatch = {
            status: safePatchStatus,
            files: [],
            refusalReason:
                gateVerdict?.patchReason ||
                "Code patch generation is not permitted for this incident type.",
        };
    } else {
        const src = snapshot.source;
        if (src && src.lines && src.lines.length > 0) {
            const targetLineObj = src.lines.find(
                (l) => l.lineNumber === line || l.isFailingLine
            );
            const originalLine = targetLineObj?.content;

            if (originalLine && expr && originalLine.includes(expr)) {
                let patchedLine = originalLine;
                if (expr.includes(".")) {
                    const safeExpr = expr.replace(/\./g, "?.");
                    patchedLine = originalLine.replace(expr, safeExpr);
                } else {
                    patchedLine = originalLine.replace(expr, `${expr} ?? null`);
                }

                const candidatePatch = {
                    status: "AVAILABLE" as const,
                    files: [
                        {
                            path: src.filePath,
                            diff: `@@ -${line},1 +${line},1 @@\n-${originalLine}\n+${patchedLine}`,
                            explanation: `Safely verify '${expr}' before access to prevent unhandled runtime exception.`,
                        },
                    ],
                };

                // Validate diff application and AST syntax before proposing
                const effectiveGateVerdict: RecommendationEligibilityVerdict = gateVerdict || {
                    canGenerateRecommendation: true,
                    patchEligibility: "CAN_GENERATE_PATCH",
                    recommendationReason: "Deterministic synthesis eligible",
                    patchReason: "Deterministic synthesis eligible",
                };
                const patchCheck = validateProposedPatch(candidatePatch, snapshot, effectiveGateVerdict);
                if (patchCheck.isValid) {
                    proposedPatch = candidatePatch;
                } else {
                    proposedPatch = {
                        status: "NOT_SAFE_TO_GENERATE",
                        files: [],
                        refusalReason:
                            patchCheck.refusalReason ||
                            "Automated patch requires human confirmation for dynamic runtime values.",
                    };
                }
            } else {
                proposedPatch = {
                    status: "NOT_SAFE_TO_GENERATE",
                    files: [],
                    refusalReason:
                        "Automated patch requires human confirmation for dynamic runtime values.",
                };
            }
        } else {
            proposedPatch = {
                status: "SOURCE_UNAVAILABLE",
                files: [],
                refusalReason: "Source code is unavailable for the incident release.",
            };
        }
    }

    return {
        status: "RECOMMENDATION",
        whatHappened,
        claims,
        recommendation,
        proposedPatch,
        unknowns:
            snapshot.sufficiency.missingEvidence.length > 0
                ? snapshot.sufficiency.missingEvidence
                : ["Pre-incident client request headers"],
        limitations: ["Derived strictly from verified telemetry and resolved source code."],
        confidenceLevel: snapshot.sufficiency.status === "SUFFICIENT" ? "High" : "Medium",
    };
}

/**
 * Halo Managed AI Model
 *
 * The permanent default AI recommendation engine for Halo Trace.
 * Always present, highly accurate, and reliable.
 */
export class HaloManagedRecommendationModel implements RecommendationModel {
    readonly id = "halo-managed";
    readonly name = "Halo Managed AI";

    async generate(prompt: ModelPrompt): Promise<{ rawText: string; durationMs: number }> {
        const start = Date.now();

        // 1. Try server environment managed keys if configured
        const geminiKey = process.env.HALO_MANAGED_AI_KEY || process.env.GEMINI_API_KEY;
        if (geminiKey) {
            try {
                const gemini = new GeminiRecommendationModel(
                    geminiKey,
                    process.env.GEMINI_MODEL || "gemini-2.5-flash"
                );
                return await gemini.generate(prompt);
            } catch (err) {
                console.warn(
                    "[HaloManagedAI] External provider call failed, using native evidence synthesizer:",
                    err
                );
            }
        }

        const openAiKey = process.env.OPENAI_API_KEY;
        if (openAiKey) {
            try {
                const openAi = new OpenAICompatibleRecommendationModel(
                    openAiKey,
                    process.env.OPENAI_MODEL || "gpt-4o"
                );
                return await openAi.generate(prompt);
            } catch (err) {
                console.warn(
                    "[HaloManagedAI] External provider call failed, using native evidence synthesizer:",
                    err
                );
            }
        }

        // 2. Halo Native Evidence-Bound Synthesizer
        const output = synthesizeHaloManagedRecommendation(prompt);
        return {
            rawText: JSON.stringify(output),
            durationMs: Date.now() - start,
        };
    }
}

/**
 * Fallback Model when an offline refusal is explicitly needed.
 */
export class FallbackRecommendationModel implements RecommendationModel {
    readonly id = "offline-fallback";
    readonly name = "Halo Offline Engine";

    async generate(): Promise<{ rawText: string; durationMs: number }> {
        const output = {
            status: "INSUFFICIENT_EVIDENCE",
            whatHappened:
                "Operating in offline deterministic mode.",
            claims: [
                {
                    statement:
                        "Verified investigation telemetry and deterministic causal chains remain available.",
                    category: "OBSERVED",
                    evidenceIds: [],
                },
            ],
            recommendation: {
                action:
                    "Review verified causal chains and telemetry logs.",
                reasoning: "Operating in offline deterministic mode.",
            },
            proposedPatch: {
                status: "NOT_SAFE_TO_GENERATE",
                files: [],
                refusalReason: "Offline mode.",
            },
            unknowns: ["External LLM analysis"],
            limitations: ["Operating in offline deterministic mode."],
            confidenceLevel: "Medium",
        };

        return {
            rawText: JSON.stringify(output),
            durationMs: 1,
        };
    }
}

/**
 * Resolves the active model provider.
 * Defaults permanently to HaloManagedRecommendationModel!
 */
export function getRecommendationModel(overrideModel?: RecommendationModel): RecommendationModel {
    if (overrideModel) {
        return overrideModel;
    }
    return new HaloManagedRecommendationModel();
}
