"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

type Language = "bash" | "env" | "typescript";

function renderHighlightedTokens(code: string, lang: Language): React.ReactNode {
    if (lang === "bash") {
        // e.g., pnpm add @halo-trace/sdk
        const parts = code.split(/(\s+)/);
        return parts.map((part, i) => {
            if (part === "pnpm" || part === "npm" || part === "yarn" || part === "bun" || part === "add" || part === "install") {
                return (
                    <span key={i} className="text-[#5bbcff]">
                        {part}
                    </span>
                );
            }
            if (part.startsWith("@halo-trace/")) {
                return (
                    <span key={i} className="text-[#35d08a]">
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    }

    if (lang === "env") {
        // e.g., HALO_API_KEY=hl_live_••••••••
        const eqIdx = code.indexOf("=");
        if (eqIdx !== -1) {
            const key = code.slice(0, eqIdx);
            const val = code.slice(eqIdx + 1);
            return (
                <>
                    <span className="text-[#5bbcff]">{key}</span>
                    <span className="text-muted">=</span>
                    <span className="text-[#35d08a]">{val}</span>
                </>
            );
        }
        return code;
    }

    if (lang === "typescript") {
        // Simple regex token matching for ts keywords, strings, etc.
        const tokenRegex = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|from|const|let|var|new|await|async|export|type|return)\b|[{}();=,!]|\s+|[a-zA-Z_$][a-zA-Z0-9_$]*|[^\s{}();=,!a-zA-Z0-9_$]+)/g;
        const matches = code.match(tokenRegex) || [code];
        const keywords = new Set(["import", "from", "const", "let", "var", "new", "await", "async", "export", "type", "return"]);

        return matches.map((token, i) => {
            if (keywords.has(token)) {
                return (
                    <span key={i} className="text-[#c084fc]">
                        {token}
                    </span>
                );
            }
            if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
                return (
                    <span key={i} className="text-[#35d08a]">
                        {token}
                    </span>
                );
            }
            if (token === "process" || token === "env") {
                return (
                    <span key={i} className="text-[#f2b84b]">
                        {token}
                    </span>
                );
            }
            if (token === "Halo" || token === "HaloReplay") {
                return (
                    <span key={i} className="text-[#5bbcff] font-semibold">
                        {token}
                    </span>
                );
            }
            if (token === "captureMessage" || token === "start") {
                return (
                    <span key={i} className="text-[#60a5fa]">
                        {token}
                    </span>
                );
            }
            if (/^[{}();=,!]$/.test(token)) {
                return (
                    <span key={i} className="text-secondary/70">
                        {token}
                    </span>
                );
            }
            return (
                <span key={i} className="text-primary">
                    {token}
                </span>
            );
        });
    }

    return code;
}

export function CodeSnippet({
    code,
    language = "bash",
}: {
    code: string;
    language?: Language;
}) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy code snippet", err);
        }
    }

    return (
        <div className="group relative overflow-hidden rounded-lg border border-border bg-[#04060a] transition-colors hover:border-border-strong">
            <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-secondary select-all">
                <code>{renderHighlightedTokens(code, language)}</code>
            </pre>

            <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-secondary transition-all hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                aria-label="Copy code to clipboard"
            >
                {copied ? (
                    <>
                        <Check className="h-3.5 w-3.5 text-accent" />
                        <span className="text-accent">Copied</span>
                    </>
                ) : (
                    <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                    </>
                )}
            </button>
        </div>
    );
}
