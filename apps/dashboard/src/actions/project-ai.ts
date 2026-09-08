"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getProject } from "@/actions/project";
import { revalidatePath } from "next/cache";
import { encryptSecret, decryptSecret, extractKeyBounds } from "@/lib/crypto";
import {
    GeminiRecommendationModel,
    OpenAICompatibleRecommendationModel,
    getRecommendationModel,
    type RecommendationModel,
} from "@/lib/investigation/recommendation-engine/provider";
import {
    AiProvider,
    AiConnectionStatus,
    type SafeAiConfig,
    type AiConnectionTestResult,
} from "@/lib/investigation/recommendation-engine/types";

const DEFAULT_MODELS: Record<AiProvider, string> = {
    HALO_MANAGED: "halo-managed-default",
    GEMINI: "gemini-2.5-flash",
    OPENAI: "gpt-4o",
};

/**
 * Verify Gemini API key by making a lightweight API request.
 */
async function verifyGeminiConnection(
    apiKey: string,
    modelName: string = "gemini-2.5-flash"
): Promise<{ success: boolean; errorMessage?: string }> {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "ping" }] }],
                generationConfig: { maxOutputTokens: 1 },
            }),
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (!res.ok) {
            const errText = await res.text();
            let parsedMsg = errText;
            try {
                const parsed = JSON.parse(errText);
                parsedMsg = parsed.error?.message || errText;
            } catch {
                // Keep raw response text if not JSON
            }
            return {
                success: false,
                errorMessage: `Google Gemini verification failed (${res.status}): ${parsedMsg}`,
            };
        }

        return { success: true };
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            return { success: false, errorMessage: "Google Gemini request timed out after 8s." };
        }
        return {
            success: false,
            errorMessage: err instanceof Error ? err.message : "Failed to connect to Google Gemini.",
        };
    }
}

/**
 * Verify OpenAI API key by making a lightweight GET request to models endpoint.
 */
async function verifyOpenAiConnection(
    apiKey: string
): Promise<{ success: boolean; errorMessage?: string }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (!res.ok) {
            const errText = await res.text();
            let parsedMsg = errText;
            try {
                const parsed = JSON.parse(errText);
                parsedMsg = parsed.error?.message || errText;
            } catch {
                // Keep raw response text if not JSON
            }
            return {
                success: false,
                errorMessage: `OpenAI verification failed (${res.status}): ${parsedMsg}`,
            };
        }

        return { success: true };
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            return { success: false, errorMessage: "OpenAI request timed out after 8s." };
        }
        return {
            success: false,
            errorMessage: err instanceof Error ? err.message : "Failed to connect to OpenAI.",
        };
    }
}

/**
 * Retrieve safe AI configuration for a project.
 * Plaintext keys are NEVER sent to the client.
 */
export async function getProjectAiConfig(projectId: string): Promise<SafeAiConfig> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const p = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            aiProvider: true,
            aiKeySuffix: true,
            aiModel: true,
            aiStatus: true,
            aiLastTestedAt: true,
            aiEncryptedKey: true,
        },
    });

    if (!p) {
        return {
            provider: AiProvider.HALO_MANAGED,
            status: AiConnectionStatus.CONNECTED,
            model: null,
            hasKey: false,
        };
    }

    const maskedKey = p.aiKeySuffix ? `••••••••••••${p.aiKeySuffix}` : undefined;

    return {
        provider: p.aiProvider,
        status: p.aiStatus,
        model: p.aiModel,
        maskedKey,
        hasKey: Boolean(p.aiEncryptedKey),
        lastTestedAt: p.aiLastTestedAt,
    };
}

/**
 * Live test connection to an AI provider.
 */
export async function testProjectAiConnection(
    projectId: string,
    provider: AiProvider,
    apiKey?: string,
    model?: string
): Promise<AiConnectionTestResult> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    // Determine the actual API key to test
    let effectiveKey = apiKey?.trim();
    if (!effectiveKey) {
        const stored = await prisma.project.findUnique({
            where: { id: projectId },
            select: { aiEncryptedKey: true },
        });
        if (stored?.aiEncryptedKey) {
            try {
                effectiveKey = decryptSecret(stored.aiEncryptedKey);
            } catch {
                return {
                    success: false,
                    provider,
                    errorMessage: "Failed to decrypt stored credentials. Please re-enter your API key.",
                };
            }
        }
    }

    const targetModel = model?.trim() || DEFAULT_MODELS[provider];

    if (provider === AiProvider.HALO_MANAGED) {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                aiStatus: AiConnectionStatus.CONNECTED,
                aiLastTestedAt: new Date(),
            },
        });
        return {
            success: true,
            provider,
            model: "Halo Managed AI Engine",
        };
    }

    if (!effectiveKey) {
        return {
            success: false,
            provider,
            errorMessage: `API key is required to test ${provider === AiProvider.GEMINI ? "Google Gemini" : "OpenAI"}.`,
        };
    }

    let verificationResult: { success: boolean; errorMessage?: string };
    if (provider === AiProvider.GEMINI) {
        verificationResult = await verifyGeminiConnection(effectiveKey, targetModel);
    } else {
        verificationResult = await verifyOpenAiConnection(effectiveKey);
    }

    const newStatus = verificationResult.success
        ? AiConnectionStatus.CONNECTED
        : AiConnectionStatus.FAILED;

    // Update the database status if the provider matches currently stored or configured
    await prisma.project.update({
        where: { id: projectId },
        data: {
            aiStatus: newStatus,
            aiLastTestedAt: new Date(),
        },
    });

    return {
        success: verificationResult.success,
        provider,
        model: targetModel,
        errorMessage: verificationResult.errorMessage,
    };
}

/**
 * Save project AI provider configuration.
 * Keys are securely encrypted with AES-256-GCM before writing to the database.
 */
export async function saveProjectAiConfig(
    projectId: string,
    config: {
        provider: AiProvider;
        apiKey?: string;
        model?: string;
    }
): Promise<{ success: boolean; status: AiConnectionStatus; errorMessage?: string }> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const { provider, apiKey, model } = config;
    const targetModel = model?.trim() || DEFAULT_MODELS[provider];

    if (provider === AiProvider.HALO_MANAGED) {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                aiProvider: AiProvider.HALO_MANAGED,
                aiEncryptedKey: null,
                aiKeyPrefix: null,
                aiKeySuffix: null,
                aiModel: null,
                aiStatus: AiConnectionStatus.CONNECTED,
                aiLastTestedAt: new Date(),
            },
        });

        revalidatePath(`/projects/${projectId}/settings`);
        return { success: true, status: AiConnectionStatus.CONNECTED };
    }

    // For BYOK (Gemini or OpenAI):
    let keyToUse = apiKey?.trim();
    if (!keyToUse) {
        // Check if project already has an encrypted key saved
        const existing = await prisma.project.findUnique({
            where: { id: projectId },
            select: { aiEncryptedKey: true },
        });
        if (existing?.aiEncryptedKey) {
            try {
                keyToUse = decryptSecret(existing.aiEncryptedKey);
            } catch {
                throw new Error("Failed to decrypt existing key. Please enter a new API key.");
            }
        }
    }

    if (!keyToUse) {
        throw new Error(`An API key is required for ${provider === AiProvider.GEMINI ? "Google Gemini" : "OpenAI"}.`);
    }

    // Verify the connection live before claiming CONNECTED
    let testRes: { success: boolean; errorMessage?: string };
    if (provider === AiProvider.GEMINI) {
        testRes = await verifyGeminiConnection(keyToUse, targetModel);
    } else {
        testRes = await verifyOpenAiConnection(keyToUse);
    }

    const encryptedKey = encryptSecret(keyToUse);
    const { prefix, suffix } = extractKeyBounds(keyToUse);
    const status = testRes.success ? AiConnectionStatus.CONNECTED : AiConnectionStatus.FAILED;

    await prisma.project.update({
        where: { id: projectId },
        data: {
            aiProvider: provider,
            aiEncryptedKey: encryptedKey,
            aiKeyPrefix: prefix,
            aiKeySuffix: suffix,
            aiModel: targetModel,
            aiStatus: status,
            aiLastTestedAt: new Date(),
        },
    });

    revalidatePath(`/projects/${projectId}/settings`);

    if (!testRes.success) {
        return {
            success: false,
            status: AiConnectionStatus.FAILED,
            errorMessage: testRes.errorMessage || "Connection verification failed.",
        };
    }

    return {
        success: true,
        status: AiConnectionStatus.CONNECTED,
    };
}

/**
 * Disconnect BYOK AI provider and revert to Halo Managed AI.
 */
export async function disconnectProjectAi(projectId: string): Promise<{ success: boolean }> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    await prisma.project.update({
        where: { id: projectId },
        data: {
            aiProvider: AiProvider.HALO_MANAGED,
            aiEncryptedKey: null,
            aiKeyPrefix: null,
            aiKeySuffix: null,
            aiModel: null,
            aiStatus: AiConnectionStatus.CONNECTED,
            aiLastTestedAt: null,
        },
    });

    revalidatePath(`/projects/${projectId}/settings`);
    return { success: true };
}

/**
 * Resolve the recommendation engine model instance for a given project.
 * Uses BYOK if configured and connected; otherwise falls back to Halo Managed AI.
 */
export async function getProjectRecommendationModel(projectId: string): Promise<RecommendationModel> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            aiProvider: true,
            aiEncryptedKey: true,
            aiModel: true,
            aiStatus: true,
        },
    });

    if (!project) {
        return getRecommendationModel();
    }

    if (project.aiProvider === AiProvider.GEMINI && project.aiEncryptedKey) {
        try {
            const key = decryptSecret(project.aiEncryptedKey);
            return new GeminiRecommendationModel(key, project.aiModel || "gemini-2.5-flash");
        } catch (err) {
            console.error(`[ProjectAi] Decryption failure for project ${projectId} (Gemini):`, err);
        }
    }

    if (project.aiProvider === AiProvider.OPENAI && project.aiEncryptedKey) {
        try {
            const key = decryptSecret(project.aiEncryptedKey);
            return new OpenAICompatibleRecommendationModel(key, project.aiModel || "gpt-4o");
        } catch (err) {
            console.error(`[ProjectAi] Decryption failure for project ${projectId} (OpenAI):`, err);
        }
    }

    // Default to Halo Managed AI
    return getRecommendationModel();
}
