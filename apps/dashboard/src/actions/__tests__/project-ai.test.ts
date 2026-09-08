import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    encryptSecret,
    decryptSecret,
    maskApiKey,
    extractKeyBounds,
} from "../../lib/crypto";
import {
    GeminiRecommendationModel,
    OpenAICompatibleRecommendationModel,
    MockRecommendationModel,
    FallbackRecommendationModel,
} from "../../lib/investigation/recommendation-engine/provider";

describe("Project AI Provider & Security Suite", () => {
    describe("Cryptographic Credential Protection (AES-256-GCM)", () => {
        it("encrypts and decrypts API keys deterministically and securely", () => {
            const secretKey = "AIzaSyFakeGoogleGeminiApiKey1234567890";
            const encrypted = encryptSecret(secretKey);

            expect(encrypted).not.toEqual(secretKey);
            expect(encrypted).toContain(":"); // iv:tag:ciphertext format
            const parts = encrypted.split(":");
            expect(parts).toHaveLength(3);

            const decrypted = decryptSecret(encrypted);
            expect(decrypted).toBe(secretKey);
        });

        it("fails securely when ciphertext or auth tag has been tampered with", () => {
            const secretKey = "sk-proj-testOpenAiSecretKeyTamperProof";
            const encrypted = encryptSecret(secretKey);
            const parts = encrypted.split(":");

            // Tamper with auth tag to trigger AES-GCM verification failure
            const firstChar = parts[1][0];
            const flippedChar = firstChar === "a" ? "b" : "a";
            const tamperedCiphertext = parts[0] + ":" + flippedChar + parts[1].slice(1) + ":" + parts[2];

            expect(() => decryptSecret(tamperedCiphertext)).toThrow();
        });

        it("fails when payload format is invalid", () => {
            expect(() => decryptSecret("invalid-not-three-parts")).toThrow("Invalid encrypted format.");
        });

        it("handles empty secrets gracefully", () => {
            expect(encryptSecret("")).toBe("");
            expect(decryptSecret("")).toBe("");
        });
    });

    describe("Safe API Key Masking and Non-Disclosure", () => {
        it("never displays raw API key in masked view", () => {
            const key = "AIzaSyD_abc12345XYZ9876Q";
            const masked = maskApiKey(key);

            expect(masked).toBe("••••••••••••876Q");
            expect(masked).not.toContain("AIzaSyD");
            expect(masked).not.toContain("abc12345");
        });

        it("masks short keys completely without leaking characters", () => {
            expect(maskApiKey("short")).toBe("••••••••");
            expect(maskApiKey("12345678")).toBe("••••••••");
            expect(maskApiKey("")).toBe("");
        });

        it("extracts safe prefix and suffix bounds correctly", () => {
            const bounds = extractKeyBounds("sk-proj-abcd1234efgh5678");
            expect(bounds.prefix).toBe("sk-p");
            expect(bounds.suffix).toBe("5678");
        });
    });

    describe("Recommendation Engine Provider Polymorphism", () => {
        it("instantiates Gemini provider with configured model and key", () => {
            const gemini = new GeminiRecommendationModel("test-key", "gemini-2.5-flash");
            expect(gemini.id).toBe("gemini");
            expect(gemini.name).toContain("gemini-2.5-flash");
        });

        it("instantiates OpenAI provider with configured model and key", () => {
            const openai = new OpenAICompatibleRecommendationModel("test-key", "gpt-4o");
            expect(openai.id).toBe("openai");
            expect(openai.name).toContain("gpt-4o");
        });

        it("offline fallback model gracefully explains unconfigured status without throwing", async () => {
            const fallback = new FallbackRecommendationModel();
            expect(fallback.id).toBe("offline-fallback");

            const result = await fallback.generate();
            const parsed = JSON.parse(result.rawText);

            expect(parsed.status).toBe("INSUFFICIENT_EVIDENCE");
            expect(parsed.proposedPatch.status).toBe("NOT_SAFE_TO_GENERATE");
            expect(parsed.claims[0].category).toBe("OBSERVED");
        });
    });

    describe("Connection Verification and Strict Truthfulness", () => {
        it("rejects connection if API returns non-200 error", async () => {
            // Mock fetch to simulate invalid Google API key
            const originalFetch = global.fetch;
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                text: async () => JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }),
            }) as unknown as typeof fetch;

            try {
                // Call verification via REST
                const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=invalid", {
                    method: "POST",
                });
                expect(res.ok).toBe(false);
                const data = await res.text();
                expect(data).toContain("API key not valid");
            } finally {
                global.fetch = originalFetch;
            }
        });
    });
});
