"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    AlertCircle,
    BarChart3,
    BellRing,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    Code2,
    Database,
    FileWarning,
    FolderKanban,
    Gauge,
    GitBranch,
    LayoutDashboard,
    ListFilter,
    Monitor,
    Search,
    Settings,
    ShieldAlert,
    Sparkles,
    Terminal,
    Waypoints,
    X,
} from "lucide-react";
import { useState } from "react";

type NavItem = {
    label: string;
    href: string;
    icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

type NavSection = {
    label?: string;
    items: NavItem[];
    collapsible?: boolean;
};

type PrimarySection = {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    sections: NavSection[];
};

const primaryNavigation: PrimarySection[] = [
    {
        id: "issues",
        label: "Issues",
        icon: ShieldAlert,
        sections: [
            {
                items: [
                    {
                        label: "All Issues",
                        href: "/issues",
                        icon: AlertCircle,
                    },
                    {
                        label: "Errors",
                        href: "/issues/errors",
                        icon: FileWarning,
                    },
                    {
                        label: "Warnings",
                        href: "/issues/warnings",
                        icon: BellRing,
                    },
                ],
            },
        ],
    },

    {
        id: "projects",
        label: "Projects",
        icon: FolderKanban,
        sections: [
            {
                items: [
                    {
                        label: "All Projects",
                        href: "/projects",
                        icon: FolderKanban,
                    },
                ],
            },
        ],
    },


    {
        id: "explore",
        label: "Explore",
        icon: Search,
        sections: [
            {
                items: [
                    {
                        label: "Traces",
                        href: "/explore/traces",
                        icon: Waypoints,
                    },
                    {
                        label: "Logs",
                        href: "/explore/logs",
                        icon: Terminal,
                    },
                    {
                        label: "Metrics",
                        href: "/explore/metrics",
                        icon: BarChart3,
                    },
                    {
                        label: "Errors",
                        href: "/explore/errors",
                        icon: FileWarning,
                    },
                    {
                        label: "Profiles",
                        href: "/explore/profiles",
                        icon: Gauge,
                    },
                    {
                        label: "Replays",
                        href: "/explore/replays",
                        icon: Monitor,
                    },
                    {
                        label: "Releases",
                        href: "/explore/releases",
                        icon: GitBranch,
                    },
                    {
                        label: "All Queries",
                        href: "/explore/queries",
                        icon: ListFilter,
                    },
                ],
            },
        ],
    },
    {
        id: "dashboards",
        label: "Dashboards",
        icon: LayoutDashboard,
        sections: [
            {
                items: [
                    {
                        label: "All Dashboards",
                        href: "/dashboards",
                        icon: LayoutDashboard,
                    },
                ],
            },
        ],
    },
    {
        id: "monitors",
        label: "Monitors",
        icon: BellRing,
        sections: [
            {
                items: [
                    {
                        label: "All Monitors",
                        href: "/monitors",
                        icon: BellRing,
                    },
                    {
                        label: "Alerts",
                        href: "/monitors/alerts",
                        icon: AlertCircle,
                    },
                ],
            },
        ],
    },
    {
        id: "settings",
        label: "Settings",
        icon: Settings,
        sections: [
            {
                label: "Account",
                items: [
                    {
                        label: "Account Details",
                        href: "/settings",
                        icon: CircleUserRound,
                    },
                ],
            },
            {
                label: "Organization",
                items: [
                    {
                        label: "General Settings",
                        href: "/settings/organization",
                        icon: Settings,
                    },
                    
                ],
            },
        ],
    },
];

function getActiveSection(pathname: string) {
    if (
        pathname.startsWith("/issues") ||
        pathname.startsWith("/incidents")
    ) {
        return "issues";
    }

    if (pathname.startsWith("/explore")) {
        return "explore";
    }

    if (pathname.startsWith("/dashboards")) {
        return "dashboards";
    }

    if (pathname.startsWith("/monitors")) {
        return "monitors";
    }

    if (pathname.startsWith("/settings")) {
        return "settings";
    }

    return "issues";
}

function isItemActive(pathname: string, href: string) {
    if (href === "/settings") {
        return pathname === "/settings";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
    const pathname = usePathname();

    const [hoveredSection, setHoveredSection] = useState<string | null>(null);

    const activeSectionId = getActiveSection(pathname);

    const visibleSectionId =
        hoveredSection ?? activeSectionId;

    const activeSection =
        primaryNavigation.find(
            (section) => section.id === visibleSectionId,
        ) ?? primaryNavigation[0];

    return (
        <aside className="halo-sidebar-shell">
            {/* Primary navigation rail */}
            <div className="halo-sidebar-primary">
                <Link
                    href="/overview"
                    className="halo-sidebar-logo"
                    aria-label="Halo"
                >
                    <Sparkles size={19} strokeWidth={2.2} />
                </Link>

                <nav className="halo-sidebar-primary-nav">
                    {primaryNavigation.map((section) => {
                        const Icon = section.icon;

                        const active =
                            activeSectionId === section.id;

                        return (
                            <div
                                key={section.id}
                                className="halo-sidebar-primary-item"
                                onMouseEnter={() =>
                                    setHoveredSection(section.id)
                                }
                            >
                                <Link
                                    href={
                                        section.id === "issues"
                                            ? "/issues"
                                            : section.sections[0]?.items[0]
                                                ?.href ?? "/overview"
                                    }
                                    className={
                                        active
                                            ? "halo-sidebar-primary-link is-active"
                                            : "halo-sidebar-primary-link"
                                    }
                                    aria-label={section.label}
                                    title={section.label}
                                >
                                    <Icon
                                        size={19}
                                        strokeWidth={active ? 2.2 : 1.9}
                                    />

                                    <span className="halo-sidebar-primary-label">
                                        {section.label}
                                    </span>
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                <div className="halo-sidebar-primary-footer">
                    <button
                        type="button"
                        className="halo-sidebar-utility-button"
                        aria-label="Search"
                    >
                        <Search size={18} />
                    </button>

                    <Link
                        href="/sdk"
                        className="halo-sidebar-utility-button"
                        aria-label="SDK"
                        title="SDK"
                    >
                        <Code2 size={18} />
                    </Link>

                    <button
                        type="button"
                        className="halo-sidebar-utility-button"
                        aria-label="Collapse navigation"
                    >
                        <ChevronLeft size={18} />
                    </button>
                </div>
            </div>

            {/* Secondary navigation */}
            <div
                className="halo-sidebar-secondary"
                onMouseLeave={() => setHoveredSection(null)}
            >
                <div className="halo-sidebar-secondary-header">
                    <span>{activeSection.label}</span>

                    <button
                        type="button"
                        className="halo-sidebar-collapse-button"
                        onClick={() => setHoveredSection(null)}
                        aria-label="Close navigation"
                    >
                        <ChevronLeft size={17} />
                    </button>
                </div>

                <nav className="halo-sidebar-secondary-nav">
                    {activeSection.sections.map((section, sectionIndex) => (
                        <div
                            key={`${activeSection.id}-${sectionIndex}`}
                            className="halo-sidebar-secondary-section"
                        >
                            {section.label && (
                                <div className="halo-sidebar-secondary-section-label">
                                    {section.label}

                                    {section.collapsible && (
                                        <ChevronDown size={14} />
                                    )}
                                </div>
                            )}

                            <div className="halo-sidebar-secondary-items">
                                {section.items.map((item) => {
                                    const Icon = item.icon;

                                    const active = isItemActive(
                                        pathname,
                                        item.href,
                                    );

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={
                                                active
                                                    ? "halo-sidebar-secondary-link is-active"
                                                    : "halo-sidebar-secondary-link"
                                            }
                                        >
                                            {Icon && (
                                                <Icon
                                                    size={16}
                                                    strokeWidth={1.9}
                                                />
                                            )}

                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="halo-sidebar-secondary-footer">
                    <div className="halo-sidebar-workspace">
                        <div className="halo-sidebar-workspace-icon">
                            H
                        </div>

                        <div className="halo-sidebar-workspace-content">
                            <span className="halo-sidebar-workspace-name">
                                Halo
                            </span>
                            <span className="halo-sidebar-workspace-meta">
                                Workspace
                            </span>
                        </div>

                        <ChevronRight size={15} />
                    </div>
                </div>
            </div>
        </aside>
    );
}