"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    TriangleAlert,
    Activity,
    KeyRound,
    Settings,
} from "lucide-react";

type Props = {
    projectId: string;
};

const navigation = [
    {
        label: "Overview",
        segment: "",
        icon: LayoutDashboard,
    },
    {
        label: "Issues",
        segment: "issues",
        icon: TriangleAlert,
    },
    {
        label: "Events",
        segment: "events",
        icon: Activity,
    },
    {
        label: "API Keys",
        segment: "api-keys",
        icon: KeyRound,
    },
    {
        label: "Settings",
        segment: "settings",
        icon: Settings,
    },
];

export function ProjectNavigation({
    projectId,
}: Props) {
    const pathname = usePathname();

    const basePath = `/projects/${projectId}`;

    return (
        <nav
            aria-label="Project navigation"
            className="
                flex
                items-center
                gap-1
                border-b
                border-border
            "
        >
            {navigation.map((item) => {
                const href = item.segment
                    ? `${basePath}/${item.segment}`
                    : basePath;

                const isActive =
                    item.segment === ""
                        ? pathname === basePath
                        : pathname === href ||
                          pathname.startsWith(`${href}/`);

                const Icon = item.icon;

                return (
                    <Link
                        key={item.label}
                        href={href}
                        className={`
                            group
                            relative
                            flex
                            items-center
                            gap-2
                            rounded-t-lg
                            px-3
                            py-3
                            text-sm
                            font-medium
                            transition-colors
                            duration-150
                            ${
                                isActive
                                    ? "text-primary"
                                    : "text-secondary hover:text-primary"
                            }
                        `}
                    >
                        <Icon
                            className={`
                                h-4
                                w-4
                                transition-colors
                                ${
                                    isActive
                                        ? "text-accent"
                                        : "text-muted group-hover:text-primary"
                                }
                            `}
                            strokeWidth={isActive ? 2 : 1.8}
                        />

                        <span>{item.label}</span>

                        {isActive && (
                            <span
                                className="
                                    absolute
                                    inset-x-2
                                    -bottom-px
                                    h-px
                                    bg-accent
                                "
                            />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}