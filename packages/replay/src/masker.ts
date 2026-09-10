import type { ReplayPrivacyOptions } from "./types";

const DEFAULT_MASK_SELECTORS = [
    'input[type="password"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[name*="card" i]',
    'input[name*="cvv" i]',
    'input[name*="cvc" i]',
    'input[name*="ssn" i]',
    'input[name*="pass" i]',
    'input[name*="token" i]',
    'input[name*="secret" i]',
    'input[autocomplete*="cc-" i]',
    'input[autocomplete*="password" i]',
    '[data-halo-mask]',
    '.halo-mask',
].join(", ");

const DEFAULT_BLOCK_SELECTORS = [
    'video',
    'canvas',
    'iframe:not([data-halo-record])',
    '[data-halo-block]',
    '.halo-block',
].join(", ");

const DEFAULT_IGNORE_SELECTORS = [
    '[data-halo-ignore]',
    '.halo-ignore',
].join(", ");

export function buildMaskerConfig(options?: ReplayPrivacyOptions) {
    const maskTextSelector = options?.maskTextSelector
        ? `${DEFAULT_MASK_SELECTORS}, ${options.maskTextSelector}`
        : DEFAULT_MASK_SELECTORS;

    const blockSelector = options?.blockSelector
        ? `${DEFAULT_BLOCK_SELECTORS}, ${options.blockSelector}`
        : DEFAULT_BLOCK_SELECTORS;

    const ignoreSelector = options?.ignoreSelector
        ? `${DEFAULT_IGNORE_SELECTORS}, ${options.ignoreSelector}`
        : DEFAULT_IGNORE_SELECTORS;

    return {
        maskAllInputs: true,
        maskInputOptions: {
            password: true,
            email: true,
            tel: true,
            text: true,
            color: false,
            date: false,
            'datetime-local': false,
            file: true,
            image: false,
            month: false,
            number: true,
            range: false,
            search: true,
            time: false,
            url: false,
            week: false,
            textarea: true,
            select: true,
        },
        maskTextSelector,
        blockSelector,
        ignoreSelector,
        maskTextFn: (text: string, element?: HTMLElement | null) => {
            if (!text) return text;
            if (options?.maskAllText !== false) {
                return text.replace(/[^\s\n\t]/g, "*");
            }
            if (element && element.matches(maskTextSelector)) {
                return text.replace(/[^\s\n\t]/g, "*");
            }
            return text;
        },
        maskInputFn: (text: string, element?: HTMLElement | null) => {
            if (!text) return text;
            return "*".repeat(Math.min(text.length, 8));
        },
    };
}

const SENSITIVE_QUERY_PARAMS = [
    "token",
    "auth",
    "key",
    "api_key",
    "apiKey",
    "secret",
    "password",
    "pass",
    "access_token",
    "refresh_token",
    "code",
    "sessionId",
    "session_id",
];

export function sanitizeUrl(urlStr: string): string {
    if (!urlStr) return urlStr;
    try {
        const parsed = new URL(urlStr, "http://localhost");
        let modified = false;
        for (const param of SENSITIVE_QUERY_PARAMS) {
            if (parsed.searchParams.has(param)) {
                parsed.searchParams.set(param, "[REDACTED]");
                modified = true;
            }
        }
        if (!modified) return urlStr;
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return urlStr;
    }
}

export function isUrlIgnored(url: string, ignorePatterns?: (string | RegExp)[]): boolean {
    if (!ignorePatterns || ignorePatterns.length === 0) return false;

    for (const pattern of ignorePatterns) {
        if (typeof pattern === "string") {
            if (url.includes(pattern)) return true;
        } else if (pattern instanceof RegExp) {
            if (pattern.test(url)) return true;
        }
    }

    return false;
}

