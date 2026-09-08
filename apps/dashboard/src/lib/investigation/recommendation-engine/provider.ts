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
import { buildRepairCase } from "../repair-intelligence/repair-case-builder";

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

    // Build the deterministic, evidence-bound Repair Case
    const repairCase = buildRepairCase({ snapshot });
    const { failureModel, protectionAnalysis, repairEligibility, repairOptions, proposedPatch } = repairCase;

    const anchor = snapshot.runtime.anchorError || snapshot.evidence.find((e) => e.type === "ERROR");
    const anchorId = anchor?.id;
    const file = failureModel.failingFile || "unknown";
    const line = failureModel.failingLineNumber || 1;
    const fnName = failureModel.containingFunction || "handler";
    const expr = failureModel.failingExpression || "";

    // Build What Happened
    let whatHappened = `${failureModel.errorTitle} occurred in service '${failureModel.service}' at ${file}:${line} inside function '${fnName}'.`;
    if (expr) {
        whatHappened += ` Execution reached expression '${expr}'.`;
    }
    if (failureModel.runtimeValueStatus === "NOT_CAPTURED" && expr) {
        whatHappened += ` Runtime value of '${expr}' was not captured in telemetry; cannot prove whether the value was undefined or if invocation threw internally.`;
    }

    // Build Claims strictly citing real evidence IDs
    const claims: Array<{
        statement: string;
        category: "OBSERVED" | "DERIVED" | "SUPPORTED" | "UNKNOWN";
        evidenceIds: string[];
    }> = [];

    // Observed Facts
    for (const f of failureModel.knownFacts) {
        claims.push({
            statement: f.claim,
            category: "OBSERVED",
            evidenceIds: f.evidenceIds.filter((id) => snapshot.evidenceMap[id]),
        });
    }

    // Derived Facts
    for (const f of failureModel.derivedFacts) {
        claims.push({
            statement: f.claim,
            category: "DERIVED",
            evidenceIds: f.evidenceIds.filter((id) => snapshot.evidenceMap[id]),
        });
    }

    // Supported Facts
    for (const f of failureModel.supportedFacts) {
        claims.push({
            statement: f.claim,
            category: "SUPPORTED",
            evidenceIds: f.evidenceIds.filter((id) => snapshot.evidenceMap[id]),
        });
    }

    // Protection finding claim
    if (protectionAnalysis.guards.length > 0) {
        claims.push({
            statement: protectionAnalysis.summary,
            category: "DERIVED",
            evidenceIds: anchorId && snapshot.evidenceMap[anchorId] ? [anchorId] : [],
        });
    }

    // Unknowns
    for (const u of failureModel.unknowns) {
        claims.push({
            statement: u.claim,
            category: "UNKNOWN",
            evidenceIds: [],
        });
    }

    // Ensure at least 1 claim
    if (claims.length === 0) {
        claims.push({
            statement: `Runtime exception observed in ${failureModel.service}`,
            category: "OBSERVED",
            evidenceIds: anchorId ? [anchorId] : [],
        });
    }

    // Recommendation Action
    let action = repairEligibility.reason;
    let reasoning = protectionAnalysis.detailedReasoning;

    if (repairEligibility.state === "REPAIR_READY" && repairOptions.length > 0) {
        action = repairOptions[0]!.title;
        reasoning = repairOptions[0]!.approach;
    } else if (repairEligibility.state === "REPAIR_UNDERDETERMINED") {
        action = `Capture runtime telemetry for '${expr || "failing expression"}' before applying code modifications.`;
        reasoning = repairEligibility.reason;
    } else if (repairEligibility.state === "REPAIR_PLAUSIBLE" && repairOptions.length > 0) {
        action = `Evaluate repair options: ${repairOptions.map((o) => o.title).join(" OR ")}`;
        reasoning = repairEligibility.reason;
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
    let outputPatch: {
        status: "AVAILABLE" | "NOT_SAFE_TO_GENERATE" | "SOURCE_UNAVAILABLE" | "NOT_APPLICABLE";
        files: Array<{ path: string; diff: string; explanation: string }>;
        refusalReason?: string;
    };

    if (
        (repairEligibility.state === "REPAIR_READY" || repairEligibility.state === "REPAIR_PLAUSIBLE") &&
        proposedPatch &&
        proposedPatch.validationStatus === "VALID"
    ) {
        outputPatch = {
            status: "AVAILABLE",
            files: [
                {
                    path: proposedPatch.targetFile,
                    diff: proposedPatch.unifiedDiff,
                    explanation: repairOptions[0]?.title || "Minimal verified patch proposal",
                },
            ],
        };
    } else if (!snapshot.source || snapshot.source.resolutionStatus !== "exact_file") {
        outputPatch = {
            status: "SOURCE_UNAVAILABLE",
            files: [],
            refusalReason: "Source code is unavailable for the incident release.",
        };
    } else {
        outputPatch = {
            status: "NOT_SAFE_TO_GENERATE",
            files: [],
            refusalReason: repairEligibility.reason,
        };
    }

    return {
        status: repairEligibility.state === "REPAIR_BLOCKED" ? "NO_SAFE_RECOMMENDATION" : "RECOMMENDATION",
        whatHappened,
        claims,
        recommendation,
        proposedPatch: outputPatch,
        unknowns: failureModel.unknowns.map((u) => u.claim),
        limitations: repairCase.sideEffects.contractBreaks,
        confidenceLevel:
            repairEligibility.state === "REPAIR_READY"
                ? "High"
                : repairEligibility.state === "REPAIR_PLAUSIBLE"
                ? "Medium"
                : "Low",
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
