import type { StackFrame } from "./types";
import { classifyFrame } from "./call-chain";

/**
 * Robust Multi-Runtime Stack Trace Parser
 *
 * Extracts structured stack frames from raw stack strings across:
 * - V8 / Node.js
 * - Chromium / Edge
 * - Firefox (Gecko)
 * - Safari (WebKit)
 * - Python / Go
 *
 * Distinguishes application frames from runtime/vendor internals without
 * losing any raw telemetry.
 */
export function parseStackTrace(rawStack: string | null | undefined): StackFrame[] {
    if (!rawStack || typeof rawStack !== "string") {
        return [];
    }

    const lines = rawStack.split("\n");
    const frames: StackFrame[] = [];
    let order = 1;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Skip error message headers (e.g. "TypeError: Cannot read properties...", "Traceback (most recent call last):")
        if (
            line.startsWith("Error:") ||
            line.includes("Exception:") ||
            line.includes("Traceback (") ||
            /^[A-Za-z0-9_$]+Error:\s*/.test(line) ||
            /^[A-Za-z0-9_$]+Exception:\s*/.test(line)
        ) {
            continue;
        }

        const parsed =
            parseV8Frame(line) ||
            parseGeckoWebKitFrame(line) ||
            parsePythonFrame(line) ||
            parseGoFrame(line);

        if (parsed) {
            const isInternal = checkIsInternal(parsed.filePath, parsed.functionName);
            const classification = classifyFrame(
                parsed.filePath,
                parsed.functionName || ""
            );
            frames.push({
                order: order++,
                functionName: parsed.functionName || "<anonymous>",
                moduleOrPackage: extractModuleOrPackage(parsed.filePath),
                rawFilePath: parsed.filePath,
                filePath: cleanFilePath(parsed.filePath),
                lineNumber: parsed.lineNumber,
                columnNumber: parsed.columnNumber,
                isInternal,
                isApplication: !isInternal,
                classification,
            });
        }
    }

    return frames;
}

/**
 * Parse V8 / Node.js stack line format:
 * - "at functionName (/path/to/file.ts:42:10)"
 * - "at async functionName (/path/to/file.ts:42:10)"
 * - "at new ClassName (/path/to/file.ts:42:10)"
 * - "at /path/to/file.ts:42:10"
 */
function parseV8Frame(line: string): { functionName: string; filePath: string; lineNumber?: number; columnNumber?: number } | null {
    if (!line.startsWith("at ")) {
        return null;
    }

    const withoutAt = line.slice(3).trim();

    // Pattern 1: "at functionName (file:line:col)" or "at async functionName (file:line:col)"
    const namedMatch = withoutAt.match(/^(?:async\s+)?(?:new\s+)?([^\s(]+)\s*\((.+)\)$/);
    if (namedMatch) {
        const functionName = namedMatch[1];
        const locationPart = namedMatch[2];
        const location = parseLocationString(locationPart);
        return {
            functionName,
            filePath: location.filePath,
            lineNumber: location.lineNumber,
            columnNumber: location.columnNumber,
        };
    }

    // Pattern 2: "at (file:line:col)"
    const parenthesizedOnly = withoutAt.match(/^\((.+)\)$/);
    if (parenthesizedOnly) {
        const location = parseLocationString(parenthesizedOnly[1]);
        return {
            functionName: "<anonymous>",
            filePath: location.filePath,
            lineNumber: location.lineNumber,
            columnNumber: location.columnNumber,
        };
    }

    // Pattern 3: "at file:line:col"
    const location = parseLocationString(withoutAt);
    if (location.filePath) {
        return {
            functionName: "<anonymous>",
            filePath: location.filePath,
            lineNumber: location.lineNumber,
            columnNumber: location.columnNumber,
        };
    }

    return null;
}

/**
 * Parse Gecko (Firefox) / WebKit (Safari) format:
 * - "functionName@http://localhost:3000/src/app.ts:42:10"
 * - "functionName@file.ts:42:10"
 * - "@file.ts:42:10"
 */
function parseGeckoWebKitFrame(line: string): { functionName: string; filePath: string; lineNumber?: number; columnNumber?: number } | null {
    const atIndex = line.indexOf("@");
    if (atIndex === -1) return null;

    const functionName = line.slice(0, atIndex).trim() || "<anonymous>";
    const locationPart = line.slice(atIndex + 1).trim();

    if (!locationPart) return null;

    const location = parseLocationString(locationPart);
    return {
        functionName,
        filePath: location.filePath,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
    };
}

/**
 * Parse Python frame format:
 * - 'File "app/main.py", line 42, in process_request'
 */
function parsePythonFrame(line: string): { functionName: string; filePath: string; lineNumber?: number; columnNumber?: number } | null {
    const match = line.match(/^File\s+"([^"]+)",\s*line\s*(\d+)(?:,\s*in\s*(.+))?/);
    if (!match) return null;

    return {
        filePath: match[1],
        lineNumber: parseInt(match[2], 10),
        functionName: match[3] ? match[3].trim() : "<module>",
    };
}

/**
 * Parse Go frame format:
 * - "main.handleRequest(/path/to/main.go:42 +0x123)"
 */
function parseGoFrame(line: string): { functionName: string; filePath: string; lineNumber?: number; columnNumber?: number } | null {
    const match = line.match(/^([a-zA-Z0-9_./]+)\((.*):(\d+)(?:\s+\+0x[0-9a-f]+)?\)$/);
    if (!match) return null;

    return {
        functionName: match[1],
        filePath: match[2],
        lineNumber: parseInt(match[3], 10),
    };
}

/**
 * Parse "path/to/file.ts:42:10" or "http://host/file.ts:42:10"
 */
function parseLocationString(str: string): { filePath: string; lineNumber?: number; columnNumber?: number } {
    let clean = str.trim();

    // Remove file:/// or http:// or webpack:// prefixes
    clean = clean.replace(/^webpack-internal:\/\/\//, "");
    clean = clean.replace(/^webpack:\/\/\//, "");

    // Match file:line:col or file:line
    const lineColMatch = clean.match(/(.+?):(\d+)(?::(\d+))?$/);
    if (lineColMatch) {
        return {
            filePath: lineColMatch[1],
            lineNumber: parseInt(lineColMatch[2], 10),
            columnNumber: lineColMatch[3] ? parseInt(lineColMatch[3], 10) : undefined,
        };
    }

    return {
        filePath: clean,
    };
}

/**
 * Classify if frame is an internal runtime/framework/library frame.
 */
function checkIsInternal(filePath: string, functionName: string): boolean {
    const fp = filePath.toLowerCase();
    const fn = functionName.toLowerCase();

    if (fp.startsWith("node:") || fp.includes("node:internal") || fp.includes("internal/process")) {
        return true;
    }
    if (fp.includes("node_modules")) {
        return true;
    }
    if (fp.includes("next/dist") || fp.includes("next-server") || fp.includes("turbopack")) {
        return true;
    }
    if (fp.includes("webpack/bootstrap") || fp.includes("webpack-runtime")) {
        return true;
    }
    if (fp === "<anonymous>" || fp === "native" || fp.includes("[native code]")) {
        return true;
    }
    if (fn.includes("processticksandrejections") || fn.includes("runmicrotasks") || fn.includes("timercallback")) {
        return true;
    }

    return false;
}

/**
 * Extract module / package name from file path if in node_modules.
 */
function extractModuleOrPackage(filePath: string): string | undefined {
    const nmIndex = filePath.indexOf("node_modules/");
    if (nmIndex !== -1) {
        const sub = filePath.slice(nmIndex + "node_modules/".length);
        const parts = sub.split("/");
        if (parts[0].startsWith("@") && parts.length > 1) {
            return `${parts[0]}/${parts[1]}`;
        }
        return parts[0];
    }

    if (filePath.startsWith("node:")) {
        return filePath;
    }

    return undefined;
}

/**
 * Clean up URLs, workspace prefixes, query strings, and hashes from file paths.
 */
function cleanFilePath(filePath: string): string {
    let clean = filePath;

    // Strip http(s)://host:port/
    clean = clean.replace(/^https?:\/\/[^/]+\//, "");

    // Strip file:// prefix
    clean = clean.replace(/^file:\/\//, "");

    // Strip webpack query strings (e.g. ?ts=123)
    clean = clean.replace(/\?[^:]+/, "");

    // Strip leading ./ or /
    clean = clean.replace(/^\.?\/+/, "");

    return clean;
}
