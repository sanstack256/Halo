"use client";

import React, { useState, useEffect, useCallback } from "react";
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
        sectionIds: ["section-causal-chain"],
        icon: Network,
    },
    {
        id: "evidence",
        label: "Evidence",
        targetSectionId: "section-evidence-graph",
        sectionIds: [
            "section-evidence-graph",
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

    const updateActiveCategory = useCallback(() => {
        const main = document.querySelector("main");
        const scrollY = main ? main.scrollTop : window.scrollY;
        const containerHeight = main ? main.clientHeight : window.innerHeight;
        const scrollHeight = main ? main.scrollHeight : document.documentElement.scrollHeight;

        // Calculate scroll progress percentage (0 - 100%)
        const maxScroll = scrollHeight - containerHeight;
        const progress = maxScroll > 0 ? Math.min(100, Math.max(0, (scrollY / maxScroll) * 100)) : 0;
        setScrollPercent(progress);

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
        <div className="sticky top-0 z-30 w-full max-w-5xl mx-auto my-2">
            {/* Elevated, solid persistent navigation container */}
            <div className="halo-sticky-nav-container">
                {/* 6 Category Navigation Items on a single horizontal row */}
                <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar flex-nowrap">
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isActive = activeCategoryId === cat.id;

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => scrollToCategory(cat.targetSectionId, cat.id)}
                                aria-current={isActive ? "true" : undefined}
                                className={`halo-sticky-nav-item flex-1 ${
                                    isActive ? "halo-sticky-nav-item-active" : ""
                                }`}
                            >
                                <Icon size={13} className="shrink-0" />
                                <span className="tracking-wide">{cat.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Subtle Scroll Progress Indicator at bottom boundary */}
                <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden mt-1.5">
                    <div
                        className="h-full bg-accent transition-all duration-75 ease-out rounded-full"
                        style={{ width: `${scrollPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
