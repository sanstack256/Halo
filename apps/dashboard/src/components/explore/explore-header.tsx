"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface ExploreHeaderProps {
    title: string;
    subtitle: string;
    icon: LucideIcon;
    badgeText?: string;
    actions?: React.ReactNode;
}

export function ExploreHeader({
    title,
    subtitle,
    icon: Icon,
    badgeText,
    actions,
}: ExploreHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
            <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-accent shrink-0">
                        <Icon size={16} />
                    </div>
                    <h1 className="text-xl font-bold text-white font-sans tracking-tight">
                        {title}
                    </h1>
                    {badgeText && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-surface border border-border text-muted">
                            {badgeText}
                        </span>
                    )}
                </div>
                <p className="text-xs text-secondary font-sans leading-relaxed">
                    {subtitle}
                </p>
            </div>

            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
}
