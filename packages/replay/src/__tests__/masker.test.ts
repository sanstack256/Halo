import { describe, it, expect } from "vitest";
import { buildMaskerConfig, sanitizeUrl, isUrlIgnored } from "../masker";

describe("Replay Masker & Privacy", () => {
    it("builds correct default masker config", () => {
        const config = buildMaskerConfig();
        expect(config.maskAllInputs).toBe(true);
        expect(config.maskInputOptions.password).toBe(true);
        expect(config.maskInputOptions.email).toBe(true);
        expect(config.maskInputOptions.number).toBe(true);
        expect(config.maskInputOptions.textarea).toBe(true);
        expect(config.blockSelector).toContain("video");
        expect(config.blockSelector).toContain("canvas");
        expect(config.blockSelector).toContain("[data-halo-block]");
        expect(config.maskTextSelector).toContain('input[type="password"]');
        expect(config.maskTextSelector).toContain('[data-halo-mask]');
    });

    it("masks sensitive input values with asterisks", () => {
        const config = buildMaskerConfig();
        const masked = config.maskInputFn("secret_password_123");
        expect(masked).toBe("********"); // max 8 chars
        expect(masked.includes("secret")).toBe(false);
    });

    it("masks text nodes when maskAllText is active", () => {
        const config = buildMaskerConfig({ maskAllText: true });
        const masked = config.maskTextFn("User Secret Information");
        expect(masked).not.toContain("Secret");
        expect(masked).toMatch(/^\*+\s\*+\s\*+$/);
    });

    it("sanitizes sensitive query params from URLs before transmission", () => {
        const safeUrl = sanitizeUrl("https://checkout.example.com/pay?token=xyz123&session_id=abc456&plan=pro");
        expect(safeUrl).toContain("token=%5BREDACTED%5D");
        expect(safeUrl).toContain("session_id=%5BREDACTED%5D");
        expect(safeUrl).toContain("plan=pro");
        expect(safeUrl).not.toContain("xyz123");
        expect(safeUrl).not.toContain("abc456");
    });

    it("correctly identifies ignored URLs", () => {
        const ignorePatterns = ["/admin/secret", /internal-portal/];
        expect(isUrlIgnored("https://app.com/admin/secret/settings", ignorePatterns)).toBe(true);
        expect(isUrlIgnored("https://app.com/internal-portal/dashboard", ignorePatterns)).toBe(true);
        expect(isUrlIgnored("https://app.com/checkout", ignorePatterns)).toBe(false);
    });
});
