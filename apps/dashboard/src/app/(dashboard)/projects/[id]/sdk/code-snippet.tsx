"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeSnippet({ code }: { code: string }) {
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
        <div className="group relative overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-accent/30">
            <pre className="overflow-x-auto p-5 font-mono text-sm leading-7 text-secondary">
                <code>{code}</code>
            </pre>

            <button
                type="button"
                onClick={handleCopy}
                className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-secondary opacity-80 transition-all hover:bg-surface-elevated hover:text-white group-hover:opacity-100"
                aria-label="Copy code to clipboard"
            >
                {copied ? (
                    <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium text-[11px]">Copied!</span>
                    </>
                ) : (
                    <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-[11px]">Copy</span>
                    </>
                )}
            </button>
        </div>
    );
}
