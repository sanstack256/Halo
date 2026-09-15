/**
 * Halo LLM Provider Abstraction
 *
 * Lightweight, zero-external-dependency provider layer using native fetch.
 * Supports:
 *   1. Google Gemini (REST API with structured JSON output, temp=0)
 *   2. OpenAI / Compatible (REST API with response_format=json_object, temp=0)
 *   3. Mock Recommendation Model (deterministic fixture for testing)
 *   4. Halo Managed AI (uses env keys or deterministic candidate synthesis)
 */

import type { InvestigationSnapshot, StructuredLlmOutput } from "./types";

export interface ModelPrompt {
    system: string;
    user: string;
    snapshot?: InvestigationSnapshot;
    structuredContext?: {
        actionTitle: string;
        actionDescription: string;
        justification: string;
        repairLocationRationale: string;
        whyNotSymptomFix?: string;
        facts: Array<{ id: string; value: string }>;
        uncertainty: string[];
        validationPlan: string[];
        confidenceLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
        blockedBy?: string;
    };
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
 * Halo Managed Recommendation Model
 *
 * Production default provider:
 * 1. If server environment has GEMINI_API_KEY or OPENAI_API_KEY configured, delegates to external LLM.
 * 2. If running offline or in self-hosted mode without external keys, formats the deterministically
 *    evaluated candidate action and facts into valid structured JSON.
 */
export class HaloManagedRecommendationModel implements RecommendationModel {
    readonly id = "halo-managed";
    readonly name = "Halo Managed AI Engine";

    async generate(prompt: ModelPrompt): Promise<{ rawText: string; durationMs: number }> {
        const start = Date.now();

        // 1. Check Gemini environment key
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
            try {
                const gemini = new GeminiRecommendationModel(
                    geminiKey,
                    process.env.GEMINI_MODEL || "gemini-2.5-flash"
                );
                return await gemini.generate(prompt);
            } catch (err) {
                console.warn("[HaloManagedAI] Gemini call failed, falling back to deterministic synthesis:", err);
            }
        }

        // 2. Check OpenAI environment key
        const openAiKey = process.env.OPENAI_API_KEY;
        if (openAiKey) {
            try {
                const openAi = new OpenAICompatibleRecommendationModel(
                    openAiKey,
                    process.env.OPENAI_MODEL || "gpt-4o"
                );
                return await openAi.generate(prompt);
            } catch (err) {
                console.warn("[HaloManagedAI] OpenAI call failed, falling back to deterministic synthesis:", err);
            }
        }

        // 3. Deterministic Grounded Synthesis from Candidate Actions
        const ctx = prompt.structuredContext;
        const snapshot = prompt.snapshot;

        const changes: StructuredLlmOutput["changes"] = [];
        if (
            snapshot?.source?.lines &&
            snapshot.source.resolutionStatus === "exact_file" &&
            !ctx?.blockedBy &&
            ctx?.confidenceLevel === "HIGH"
        ) {
            const failingLineObj = snapshot.source.lines.find(
                (l) => l.lineNumber === snapshot.source?.failingLineNumber || l.isFailingLine
            );
            if (failingLineObj) {
                const expr = snapshot.source?.failingExpression;
                let proposed = failingLineObj.content;
                if (expr && expr.includes(".") && !expr.includes("?.")) {
                    const guardedExpr = expr.replace(".", "?.");
                    proposed = failingLineObj.content.replace(expr, guardedExpr);
                }
                changes.push({
                    file: snapshot.source.filePath,
                    symbol: snapshot.failure.executingFunction,
                    lines: String(failingLineObj.lineNumber),
                    existingCode: failingLineObj.content,
                    proposedCode: proposed,
                    rationale: `Safely guard '${expr || "target"}' dereference against nullish runtime values.`,
                });
            }
        }

        const output: StructuredLlmOutput = {
            action: ctx?.actionTitle || "Investigate the failure mechanism before modifying production code.",
            summary: ctx?.actionDescription || "Review verified evidence and execution path.",
            why: ctx?.justification || "Evidence does not yet conclusively prove a safe repair target.",
            repairLocationRationale: ctx?.repairLocationRationale || "Identified from stack trace and source inspection.",
            whyNotSymptomFix: ctx?.whyNotSymptomFix || "Do not apply defensive symptom suppression or blind nullish defaults when caller contracts are violated.",
            claims: (ctx?.facts || []).map((f) => ({
                claim: f.value,
                factId: f.id,
                category: "CONFIRMED" as const,
            })),
            changes,
            alternatives: [],
            validationPlan: ctx?.validationPlan || ["Reproduce with incident payload in development"],
            uncertainty: ctx?.uncertainty || [],
            confidenceLevel: ctx?.confidenceLevel || "MEDIUM",
            blockedBy: ctx?.blockedBy,
        };

        if (output.claims.length === 0 && snapshot) {
            output.claims.push({
                claim: `${snapshot.failure.exceptionType}: ${snapshot.failure.exceptionMessage}`,
                factId: snapshot.runtimeContext.anchorErrorId,
                category: "CONFIRMED",
            });
        }

        return {
            rawText: JSON.stringify(output),
            durationMs: Date.now() - start,
        };
    }
}

/**
 * Resolves the active model provider.
 */
export function getRecommendationModel(overrideModel?: RecommendationModel): RecommendationModel {
    if (overrideModel) {
        return overrideModel;
    }
    return new HaloManagedRecommendationModel();
}

/**
 * Offline Fallback Recommendation Model
 */
export class FallbackRecommendationModel implements RecommendationModel {
    readonly id = "offline-fallback";
    readonly name = "Offline Fallback Engine";

    async generate(_prompt?: any): Promise<{ rawText: string; durationMs: number }> {
        return {
            rawText: JSON.stringify({
                status: "INSUFFICIENT_EVIDENCE",
                whatHappened: "Model provider is unconfigured or unavailable.",
                claims: [
                    {
                        statement: "External AI recommendation provider is unconfigured.",
                        category: "OBSERVED",
                        evidenceIds: [],
                    },
                ],
                action: "Configure an AI provider in Project Settings to generate intelligent fix recommendations.",
                summary: "AI provider not configured.",
                why: "No API key configured.",
                repairLocationRationale: "N/A",
                proposedPatch: {
                    status: "NOT_SAFE_TO_GENERATE",
                    files: [],
                    refusalReason: "No AI provider configured.",
                },
                changes: [],
                alternatives: [],
                validationPlan: [],
                uncertainty: ["AI provider unavailable"],
                confidenceLevel: "LOW",
            }),
            durationMs: 0,
        };
    }
}
