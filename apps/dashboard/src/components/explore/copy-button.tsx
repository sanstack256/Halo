"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
    text: string;
    label?: string;
    className?: string;
}

export function CopyButton({ text, label = "Copy", className = "" }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // Fallback
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${label}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                copied
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-surface border-border text-secondary hover:text-white hover:border-border-strong"
            } ${className}`}
        >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? "Copied" : label}</span>
        </button>
    );
}
