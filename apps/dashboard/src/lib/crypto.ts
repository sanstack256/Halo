import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM
const SALT = "halo-telemetry-ai-salt-2026";

function getDerivedKey(): Buffer {
    const rawSecret =
        process.env.ENCRYPTION_SECRET ||
        process.env.BETTER_AUTH_SECRET ||
        "halo-fallback-encryption-secret-do-not-use-in-production-32b";
    return crypto.scryptSync(rawSecret, SALT, 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns IV:AuthTag:EncryptedContent in hex format.
 */
export function encryptSecret(plaintext: string): string {
    if (!plaintext) {
        return "";
    }
    const key = getDerivedKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string produced by encryptSecret.
 */
export function decryptSecret(ciphertext: string): string {
    if (!ciphertext) {
        return "";
    }
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted format.");
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * Mask an API key to safely display in the UI.
 * Never displays the full key.
 */
export function maskApiKey(key: string): string {
    if (!key) return "";
    const trimmed = key.trim();
    if (trimmed.length <= 8) {
        return "••••••••";
    }
    const suffix = trimmed.slice(-4);
    return `••••••••••••${suffix}`;
}

/**
 * Extract safe prefix and suffix.
 */
export function extractKeyBounds(key: string): { prefix: string; suffix: string } {
    const trimmed = key.trim();
    if (trimmed.length <= 4) {
        return { prefix: "", suffix: trimmed };
    }
    return {
        prefix: trimmed.slice(0, Math.min(4, trimmed.length - 4)),
        suffix: trimmed.slice(-4),
    };
}
