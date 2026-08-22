"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Search } from "lucide-react";
import { authClient } from "@/lib/auth-client";

// Map path segments to human-readable labels
const segmentLabels: Record<string, string> = {
    overview: "Overview",
    investigate: "Investigate",
    issues: "Issues",
    services: "Services",
    explore: "Explore",
    dashboards: "Dashboards",
    monitors: "Monitors",
    projects: "Projects",
    settings: "Settings",
    organization: "Organization",
    project: "Project Settings",
    alerts: "Notifications",
    environments: "Environments",
    ownership: "Ownership Rules",
    filters: "Inbound Filters",
    privacy: "Security & Privacy",
    grouping: "Issue Grouping",
    keys: "Client Keys (DSN)",
    releases: "Releases",
    "security-headers": "Security Headers",
    security: "Security",
    emails: "Email Addresses",
    subscriptions: "Subscriptions",
    close: "Close Account",
    usage: "Stats & Usage",
    teams: "Teams",
    members: "Members",
    auth: "Auth",
    audit: "Audit Log",
    forwarding: "Data Forwarding",
    relay: "Relay",
    flags: "Feature Flags",
    autofix: "Autofix",
    engine: "Advanced Settings",
    mcp: "MCP & CLI",
    integrations: "Integrations",
    repos: "Repositories",
    custom: "Custom Integrations",
    tokens: "Tokens",
    org: "Organization Tokens",
    personal: "Personal Tokens",
    oauth: "OAuth Applications",
    billing: "Subscription",
    promo: "Redeem Promo Code",
    legal: "Legal & Compliance",
    active: "Active",
    recent: "Recent",
    saved: "Saved",
    mine: "My Investigations",
    team: "Team Investigations",
    errors: "Errors",
    warnings: "Warnings",
    regressions: "Regressions",
    recurring: "Recurring",
    resolved: "Resolved",
    ignored: "Ignored",
    healthy: "Healthy",
    degraded: "Degraded",
    critical: "Critical",
    dependencies: "Dependencies",
    logs: "Logs",
    traces: "Traces",
    metrics: "Metrics",
    requests: "Requests",
    database: "Database",
    infrastructure: "Infrastructure",
    system: "System Health",
    slo: "SLO & Error Budget",
    firing: "Firing Alerts",
    slos: "Service SLOs",
    sdk: "SDK",
    "api-keys": "API Keys",
    investigations: "Investigations",
    new: "New Investigation",
    events: "Events",
};

function buildBreadcrumbs(pathname: string) {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs: { label: string; href: string; isId?: boolean }[] = [];
    let currentPath = "";

    for (const segment of segments) {
        currentPath += `/${segment}`;
        // Detect UUID-like IDs or short IDs (not readable text)
        const isId = /^[a-f0-9-]{8,}$/i.test(segment) || /^[a-z0-9]{20,}$/i.test(segment);
        const label = isId
            ? `#${segment.slice(0, 7)}…`
            : (segmentLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1));

        crumbs.push({ label, href: currentPath, isId });
    }

    return crumbs;
}

export default function Topbar() {
    const pathname = usePathname();
    const router = useRouter();

    const breadcrumbs = buildBreadcrumbs(pathname);

    async function handleLogout() {
        const { error } = await authClient.signOut();
        if (error) {
            console.error(error);
            return;
        }
        router.replace("/sign-in");
        router.refresh();
    }

    return (
        <header className="halo-topbar">
            {/* Breadcrumb Navigation */}
            <nav className="halo-topbar-breadcrumbs" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                    <span key={crumb.href} className="halo-topbar-breadcrumb-item">
                        {index > 0 && (
                            <ChevronRight
                                size={13}
                                className="halo-topbar-breadcrumb-sep"
                                aria-hidden
                            />
                        )}
                        {index === breadcrumbs.length - 1 ? (
                            <span className="halo-topbar-breadcrumb-current">
                                {crumb.label}
                            </span>
                        ) : (
                            <a
                                href={crumb.href}
                                className="halo-topbar-breadcrumb-link"
                            >
                                {crumb.label}
                            </a>
                        )}
                    </span>
                ))}
            </nav>

            <div className="halo-topbar-actions">
                <button
                    type="button"
                    className="halo-topbar-button"
                    aria-label="Search"
                >
                    <Search size={16} />
                </button>

                <button
                    type="button"
                    onClick={handleLogout}
                    className="halo-topbar-button"
                    aria-label="Log out"
                >
                    <LogOut size={16} />
                </button>
            </div>
        </header>
    );
}