/**
 * Device, Browser, and OS Parsing Utilities
 *
 * Normalizes raw userAgent and platform strings into clean, human-readable names.
 * E.g., "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ... HeadlessChrome/152.0.0.0"
 * -> browser: "Headless Chrome", os: "macOS"
 */

export function parseBrowserName(raw?: string | null): string {
    if (!raw) return "Browser";
    const str = raw.trim();

    // Check for Headless Chrome
    if (/HeadlessChrome/i.test(str)) {
        return "Headless Chrome";
    }
    // Microsoft Edge
    if (/Edg(?:e)?\/(\d+)/i.test(str) || /Edge/i.test(str)) {
        return "Edge";
    }
    // Opera
    if (/OPR\/|Opera/i.test(str)) {
        return "Opera";
    }
    // Chrome
    if (/Chrome\/|CriOS\//i.test(str)) {
        return "Chrome";
    }
    // Firefox
    if (/Firefox\/|FxiOS\//i.test(str)) {
        return "Firefox";
    }
    // Safari (ensure not Chrome, which includes Safari/ in userAgent)
    if (/Safari\//i.test(str) && !/Chrome|CriOS/i.test(str)) {
        return "Safari";
    }
    // Arc Browser
    if (/Arc\//i.test(str)) {
        return "Arc";
    }
    // Clean names already formatted
    if (/^(Chrome|Safari|Firefox|Edge|Opera|Brave|Arc|Headless Chrome)$/i.test(str)) {
        return str;
    }

    // Generic fallback for unparsed Mozilla userAgent
    if (/Mozilla/i.test(str)) {
        return "Browser";
    }

    return str;
}

export function parseOsName(rawOs?: string | null, rawBrowserOrUserAgent?: string | null): string {
    const combined = `${rawOs || ""} ${rawBrowserOrUserAgent || ""}`.trim();

    if (/iPhone|iPad|iPod/i.test(combined)) {
        return "iOS";
    }
    if (/Macintosh|Mac OS X|MacIntel|macOS|Darwin/i.test(combined)) {
        return "macOS";
    }
    if (/Windows|Win32|Win64/i.test(combined)) {
        return "Windows";
    }
    if (/Android/i.test(combined)) {
        return "Android";
    }
    if (/Linux|X11/i.test(combined)) {
        return "Linux";
    }

    if (rawOs && !/Mozilla/i.test(rawOs)) {
        return rawOs;
    }

    return "Unknown OS";
}

export function formatBrowserAndOs(
    browser?: string | null,
    os?: string | null,
    userAgent?: string | null
): {
    browser: string;
    os: string;
    label: string;
} {
    const b = parseBrowserName(browser || userAgent);
    const o = parseOsName(os, browser || userAgent);
    return {
        browser: b,
        os: o,
        label: `${b} • ${o}`,
    };
}
