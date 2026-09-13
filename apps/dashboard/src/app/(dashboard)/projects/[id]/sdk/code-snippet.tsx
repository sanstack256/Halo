"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal, FileCode } from "lucide-react";

export type Language = "bash" | "env" | "typescript" | "tsx" | "javascript";

function renderHighlightedTokens(code: string, lang: Language): React.ReactNode {
    if (lang === "bash") {
        const parts = code.split(/(\s+|&&|[|;])/);
        return parts.map((part, i) => {
            if (["pnpm", "npm", "yarn", "bun", "add", "install", "npx", "run", "curl"].includes(part)) {
                return (
                    <span key={i} className="text-[#5bbcff] font-medium">
                        {part}
                    </span>
                );
            }
            if (part.startsWith("@halo-trace/") || part.startsWith("-D") || part.startsWith("--")) {
                return (
                    <span key={i} className="text-[#35d08a]">
                        {part}
                    </span>
                );
            }
            if (part.startsWith('"') || part.startsWith("'")) {
                return (
                    <span key={i} className="text-[#35d08a]">
                        {part}
                    </span>
                );
            }
            if (part === "&&" || part === "|" || part === ";") {
                return (
                    <span key={i} className="text-secondary/70">
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    }

    if (lang === "env") {
        const lines = code.split("\n");
        return lines.map((line, lineIdx) => {
            const eqIdx = line.indexOf("=");
            if (eqIdx !== -1) {
                const key = line.slice(0, eqIdx);
                const val = line.slice(eqIdx + 1);
                return (
                    <React.Fragment key={lineIdx}>
                        {lineIdx > 0 && "\n"}
                        <span className="text-[#5bbcff] font-mono">{key}</span>
                        <span className="text-muted">=</span>
                        <span className="text-[#35d08a] font-mono">{val}</span>
                    </React.Fragment>
                );
            }
            return (
                <React.Fragment key={lineIdx}>
                    {lineIdx > 0 && "\n"}
                    <span className="text-muted">{line}</span>
                </React.Fragment>
            );
        });
    }

    // TypeScript / TSX / JavaScript highlighting
    const tokenRegex = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Z][a-zA-Z0-9]*(?:\s+[^>]*)?\/?>|\/\/[^\n]*|\b(?:import|from|export|default|const|let|var|function|new|await|async|type|interface|return|throw|class|extends|try|catch|finally)\b|[{}();=,!]|\s+|[a-zA-Z_$][a-zA-Z0-9_$]*|[^\s{}();=,!a-zA-Z0-9_$]+)/g;
    const matches = code.match(tokenRegex) || [code];
    const keywords = new Set([
        "import", "from", "export", "default", "const", "let", "var",
        "function", "new", "await", "async", "type", "interface",
        "return", "throw", "class", "extends", "try", "catch", "finally"
    ]);

    return matches.map((token, i) => {
        if (token.startsWith("//")) {
            return (
                <span key={i} className="text-muted italic">
                    {token}
                </span>
            );
        }
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
        if (token.startsWith("<") && token.endsWith(">")) {
            return (
                <span key={i} className="text-[#5bbcff]">
                    {token}
                </span>
            );
        }
        if (["process", "env", "window", "document", "globalThis"].includes(token)) {
            return (
                <span key={i} className="text-[#f2b84b]">
                    {token}
                </span>
            );
        }
        if (["Halo", "HaloProvider", "HaloErrorBoundary", "BrowserClient", "NodeClient", "HaloReplay", "Scope"].includes(token)) {
            return (
                <span key={i} className="text-[#5bbcff] font-semibold">
                    {token}
                </span>
            );
        }
        if (["init", "captureException", "captureMessage", "capturePerformance", "addBreadcrumb", "setUser", "withHaloRoute", "withHaloAction", "runWithContext", "openFeedbackModal", "flush", "start", "stop"].includes(token)) {
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

export function CodeSnippet({
    code,
    language = "bash",
    filename,
    className = "",
}: {
    code: string;
    language?: Language;
    filename?: string;
    className?: string;
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
        <div className={`group relative overflow-hidden rounded-lg border border-border bg-[#04060a] transition-colors hover:border-border-strong ${className}`}>
            {filename && (
                <div className="flex items-center justify-between border-b border-border/80 bg-surface px-3.5 py-1.5 text-xs text-secondary">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                        {language === "bash" ? (
                            <Terminal className="h-3 w-3 text-accent" />
                        ) : (
                            <FileCode className="h-3 w-3 text-accent" />
                        )}
                        <span>{filename}</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                        {language}
                    </span>
                </div>
            )}

            <pre className="overflow-x-auto p-3.5 sm:p-4 font-mono text-[13px] sm:text-[13.5px] leading-relaxed text-secondary select-all">
                <code>{renderHighlightedTokens(code, language)}</code>
            </pre>

            <button
                type="button"
                onClick={handleCopy}
                className={`absolute ${filename ? "top-8" : "top-2.5"} right-2.5 flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2 py-1 text-xs font-medium text-secondary shadow-sm backdrop-blur transition-all hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent`}
                aria-label="Copy code to clipboard"
            >
                {copied ? (
                    <>
                        <Check className="h-3.5 w-3.5 text-accent" />
                        <span className="text-accent text-[11px]">Copied</span>
                    </>
                ) : (
                    <>
                        <Copy className="h-3.5 w-3.5 text-muted group-hover:text-secondary" />
                        <span className="text-[11px]">Copy</span>
                    </>
                )}
            </button>
        </div>
    );
}
