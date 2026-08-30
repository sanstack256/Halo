"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Activity,
    FileText,
    GitBranch,
    Layers,
    Network,
    Sparkles,
} from "lucide-react";

interface CategoryNavItem {
    id: string;
    label: string;
    targetSectionId: string;
    sectionIds: string[];
    icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CATEGORIES: CategoryNavItem[] = [
    {
        id: "summary",
        label: "Summary",
        targetSectionId: "section-summary",
        sectionIds: ["section-summary", "section-earliest-failure"],
        icon: FileText,
    },
    {
        id: "cause",
        label: "Cause",
        targetSectionId: "section-causal-chain",
        sectionIds: ["section-causal-chain", "section-evidence-graph"],
        icon: Network,
    },
    {
        id: "evidence",
        label: "Evidence",
        targetSectionId: "section-evidence-records",
        sectionIds: [
            "section-evidence-records",
            "section-replay",
            "section-runtime-stack",
            "section-telemetry",
        ],
        icon: Layers,
    },
    {
        id: "changes",
        label: "Changes",
        targetSectionId: "section-regression",
        sectionIds: ["section-regression"],
        icon: GitBranch,
    },
    {
        id: "timeline",
        label: "Timeline",
        targetSectionId: "section-what-happened",
        sectionIds: ["section-what-happened", "section-known-unknown"],
        icon: Activity,
    },
    {
        id: "actions",
        label: "Actions",
        targetSectionId: "section-recommendations",
        sectionIds: ["section-recommendations"],
        icon: Sparkles,
    },
];

export function InvestigationStickyNav() {
    const [activeCategoryId, setActiveCategoryId] = useState<string>("summary");
    const [scrollPercent, setScrollPercent] = useState<number>(0);
    const [isSticky, setIsSticky] = useState<boolean>(false);

    const updateActiveCategory = useCallback(() => {
        const main = document.querySelector("main");
        const scrollY = main ? main.scrollTop : window.scrollY;
        const containerHeight = main ? main.clientHeight : window.innerHeight;
        const scrollHeight = main ? main.scrollHeight : document.documentElement.scrollHeight;

        // Calculate scroll progress percentage (0 - 100%)
        const maxScroll = scrollHeight - containerHeight;
        const progress = maxScroll > 0 ? Math.min(100, Math.max(0, (scrollY / maxScroll) * 100)) : 0;
        setScrollPercent(progress);
        setIsSticky(scrollY > 60);

        // If at the bottom of the page, automatically activate the last category (Actions)
        if (scrollY + containerHeight >= scrollHeight - 50) {
            setActiveCategoryId("actions");
            return;
        }

        const containerTop = main ? main.getBoundingClientRect().top : 0;
        const activeMarker = containerTop + 140; // line below sticky header to test active section

        let currentCategory = CATEGORIES[0].id;

        for (const cat of CATEGORIES) {
            const el = document.getElementById(cat.targetSectionId);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.top <= activeMarker) {
                    currentCategory = cat.id;
                }
            }
        }

        setActiveCategoryId(currentCategory);
    }, []);

    useEffect(() => {
        const main = document.querySelector("main");
        const scrollTarget = main || window;

        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    updateActiveCategory();
                    ticking = false;
                });
                ticking = true;
            }
        };

        scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll, { passive: true });
        // Initial run
        updateActiveCategory();

        return () => {
            scrollTarget.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
        };
    }, [updateActiveCategory]);

    const scrollToCategory = (targetSectionId: string, categoryId: string) => {
        const el = document.getElementById(targetSectionId);
        if (el) {
            el.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
            setActiveCategoryId(categoryId);
        }
    };

    return (
        <div
            className={`sticky top-0 z-30 transition-all duration-200 backdrop-blur-md border-b ${
                isSticky
                    ? "bg-[#080b11]/92 border-border shadow-xl"
                    : "bg-[#080b11]/60 border-border/40"
            }`}
        >
            <div className="max-w-5xl mx-auto px-2 sm:px-4">
                {/* 6 Category Navigation Items */}
                <div className="grid grid-cols-6 gap-1 sm:gap-2 py-2">
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = activeCategoryId === cat.id;

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => scrollToCategory(cat.targetSectionId, cat.id)}
                                aria-current={isActive ? "true" : undefined}
                                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-1 sm:px-3 rounded-lg text-xs font-mono transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                    isActive
                                        ? "bg-accent text-white font-bold shadow-md shadow-accent/20 ring-1 ring-white/15"
                                        : "text-zinc-400 hover:text-zinc-100 hover:bg-surface/70"
                                }`}
                            >
                                <Icon size={14} className="shrink-0" />
                                <span className="truncate tracking-wide">{cat.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Subtle Scroll Progress Indicator */}
                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-accent transition-all duration-75 ease-out rounded-full"
                        style={{ width: `${scrollPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
