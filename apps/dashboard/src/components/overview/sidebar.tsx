"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Activity,
    AlertCircle,
    Archive,
    BarChart3,
    BellRing,
    Blocks,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    Code2,
    Compass,
    Cpu,
    CreditCard,
    Database,
    FileText,
    FileWarning,
    FolderKanban,
    GitBranch,
    Home,
    Key,
    Layers,
    LayoutDashboard,
    ListFilter,
    Network,
    PlusCircle,
    Radio,
    Search,
    Server,
    Settings,
    ShieldAlert,
    Sparkles,
    Terminal,
    UserPlus,
    Users,
    Waypoints,
    Zap,
} from "lucide-react";
import { useState } from "react";
import { UserProfileMenu } from "./user-profile-menu";

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
        id: "overview",
        label: "Overview",
        icon: Home,
        sections: [
            {
                items: [
                    { label: "Home", href: "/overview", icon: Home },
                    { label: "Active Incidents", href: "/issues?status=OPEN", icon: ShieldAlert },
                    { label: "Recent Investigations", href: "/investigate", icon: Compass },
                    { label: "Recent Changes", href: "/explore/errors", icon: GitBranch },
                    { label: "Halo Discoveries", href: "/overview#discoveries", icon: Sparkles },
                ],
            },
        ],
    },
    {
        id: "investigate",
        label: "Investigate",
        icon: Compass,
        sections: [
            {
                items: [
                    { label: "New Investigation", href: "/investigate", icon: PlusCircle },
                    { label: "Active", href: "/investigate/active", icon: Activity },
                    { label: "Recent", href: "/investigate/recent", icon: FileText },
                    { label: "Saved", href: "/investigate/saved", icon: Sparkles },
                    { label: "My Investigations", href: "/investigate/mine", icon: CircleUserRound },
                    { label: "Team Investigations", href: "/investigate/team", icon: Layers },
                ],
            },
        ],
    },
    {
        id: "issues",
        label: "Issues",
        icon: ShieldAlert,
        sections: [
            {
                items: [
                    { label: "All Issues", href: "/issues", icon: ShieldAlert },
                    { label: "Errors", href: "/issues/errors", icon: FileWarning },
                    { label: "Warnings", href: "/issues/warnings", icon: BellRing },
                    { label: "Regressions", href: "/issues/regressions", icon: Zap },
                    { label: "Recurring", href: "/issues/recurring", icon: ListFilter },
                    { label: "Resolved", href: "/issues/resolved", icon: Activity },
                    { label: "Ignored", href: "/issues/ignored", icon: AlertCircle },
                ],
            },
        ],
    },
    {
        id: "services",
        label: "Services",
        icon: Server,
        sections: [
            {
                items: [
                    { label: "All Services", href: "/services", icon: Server },
                    { label: "Healthy", href: "/services/healthy", icon: Activity },
                    { label: "Degraded", href: "/services/degraded", icon: BellRing },
                    { label: "Critical", href: "/services/critical", icon: ShieldAlert },
                    { label: "Dependencies", href: "/services/dependencies", icon: Network },
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
                    { label: "Search", href: "/explore", icon: Search },
                    { label: "Logs", href: "/explore/logs", icon: Terminal },
                    { label: "Traces", href: "/explore/traces", icon: Waypoints },
                    { label: "Errors", href: "/explore/errors", icon: FileWarning },
                    { label: "Metrics", href: "/explore/metrics", icon: BarChart3 },
                    { label: "Requests", href: "/explore/requests", icon: Activity },
                    { label: "Database", href: "/explore/database", icon: Database },
                    { label: "Infrastructure", href: "/explore/infrastructure", icon: Cpu },
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
                    { label: "All Dashboards", href: "/dashboards", icon: LayoutDashboard },
                    { label: "System Health", href: "/dashboards/system", icon: Activity },
                    { label: "Service Health", href: "/dashboards/services", icon: Server },
                    { label: "SLO & Error Budget", href: "/dashboards/slo", icon: Radio },
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
                    { label: "All Monitors", href: "/monitors", icon: BellRing },
                    { label: "Firing Alerts", href: "/monitors/firing", icon: ShieldAlert },
                    { label: "Healthy Monitors", href: "/monitors/healthy", icon: Activity },
                    { label: "Service SLOs", href: "/monitors/slos", icon: Radio },
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
                    { label: "All Projects", href: "/projects", icon: FolderKanban },
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
                collapsible: true,
                items: [
                    { label: "Account Details", href: "/settings", icon: CircleUserRound },
                    { label: "Security", href: "/settings/security", icon: ShieldAlert },
                    { label: "Notifications", href: "/settings/alerts", icon: BellRing },
                    { label: "Email Addresses", href: "/settings/emails", icon: Activity },
                    { label: "Close Account", href: "/settings/close", icon: Archive },
                ],
            },
            {
                label: "Organization",
                collapsible: true,
                items: [
                    { label: "General Settings", href: "/settings/organization", icon: Settings },
                    { label: "Teams", href: "/settings/teams", icon: Users },
                    { label: "Members", href: "/settings/members", icon: UserPlus },
                    { label: "Security & Compliance", href: "/settings/privacy", icon: ShieldAlert },
                    { label: "Audit Log", href: "/settings/audit", icon: FileText },
                ],
            },
            {
                label: "Halo AI",
                collapsible: true,
                items: [
                    { label: "Autofix", href: "/settings/autofix", icon: Sparkles },
                    { label: "AI Configuration", href: "/settings/engine", icon: Cpu },
                ],
            },
            {
                label: "Integrations",
                collapsible: true,
                items: [
                    { label: "MCP & CLI", href: "/settings/mcp", icon: Terminal },
                    { label: "Integrations", href: "/settings/integrations", icon: Blocks },
                    { label: "Repositories", href: "/settings/repos", icon: GitBranch },
                    { label: "Custom Integrations", href: "/settings/custom", icon: Code2 },
                ],
            },
            {
                label: "Developer Settings",
                collapsible: true,
                items: [
                    { label: "Organization Tokens", href: "/settings/tokens/org", icon: Key },
                    { label: "Personal Tokens", href: "/settings/tokens/personal", icon: Key },
                    { label: "OAuth Applications", href: "/settings/oauth", icon: ShieldAlert },
                ],
            },
            {
                label: "Usage & Billing",
                collapsible: true,
                items: [
                    { label: "Usage", href: "/settings/usage", icon: BarChart3 },
                    { label: "Subscription", href: "/settings/billing", icon: CreditCard },
                    { label: "Spike Protection", href: "/settings/project", icon: Zap },
                    { label: "Legal & Compliance", href: "/settings/legal", icon: FileText },
                ],
            },
        ],
    },
];

function getActiveSection(pathname: string) {
    if (pathname === "/overview" || pathname.startsWith("/overview/")) return "overview";
    if (pathname.startsWith("/investigate")) return "investigate";
    if (pathname.startsWith("/issues") || pathname.startsWith("/incidents")) return "issues";
    if (pathname.startsWith("/services")) return "services";
    if (pathname.startsWith("/explore")) return "explore";
    if (pathname.startsWith("/dashboards")) return "dashboards";
    if (pathname.startsWith("/monitors")) return "monitors";
    if (pathname.startsWith("/projects")) return "projects";
    if (pathname.startsWith("/settings")) return "settings";

    return "overview";
}

function isItemActive(pathname: string, href: string) {
    if (href === "/settings") return pathname === "/settings";
    if (href === "/overview") return pathname === "/overview";
    if (href === "/investigate") return pathname === "/investigate";
    if (href === "/issues") return pathname === "/issues";
    if (href === "/services") return pathname === "/services";
    if (href === "/explore") return pathname === "/explore";
    if (href === "/dashboards") return pathname === "/dashboards";
    if (href === "/monitors") return pathname === "/monitors";
    if (href === "/projects") return pathname === "/projects";

    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
    const pathname = usePathname();

    const [hoveredSection, setHoveredSection] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const activeSectionId = getActiveSection(pathname);
    const visibleSectionId = hoveredSection ?? activeSectionId;

    const activeSection =
        primaryNavigation.find((section) => section.id === visibleSectionId) ??
        primaryNavigation[0];

    function toggleCollapse() {
        setIsCollapsed((prev) => !prev);
    }

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
                        const active = activeSectionId === section.id;

                        const targetHref =
                            section.sections[0]?.items[0]?.href ?? `/${section.id}`;

                        return (
                            <div
                                key={section.id}
                                className="halo-sidebar-primary-item"
                                onMouseEnter={() => {
                                    if (isCollapsed) setIsCollapsed(false);
                                    setHoveredSection(section.id);
                                }}
                            >
                                <Link
                                    href={targetHref}
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
                        aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                        title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                        onClick={toggleCollapse}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>
            </div>

            {/* Secondary navigation */}
            <div
                className={`halo-sidebar-secondary${isCollapsed ? " is-collapsed" : ""}`}
                onMouseLeave={() => setHoveredSection(null)}
            >
                <div className="halo-sidebar-secondary-header">
                    <span>{activeSection.label}</span>

                    <button
                        type="button"
                        className="halo-sidebar-collapse-button"
                        onClick={toggleCollapse}
                        aria-label="Collapse navigation"
                        title="Collapse sidebar"
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
                                    const active = isItemActive(pathname, item.href);

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
                    <UserProfileMenu />
                </div>
            </div>
        </aside>
    );
}