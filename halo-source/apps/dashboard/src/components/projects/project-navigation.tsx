"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type Props = {
    projectId: string;
};

const tabs = [
    {
        name: "Overview",
        href: "",
    },
    {
        name: "Issues",
        href: "/issues",
    },
    {
        name: "Events",
        href: "/events",
    },
    {
        name: "API Keys",
        href: "/api-keys",
    },
    {
        name: "Settings",
        href: "/settings",
    },
];

export function ProjectNavigation({
    projectId,
}: Props) {
    const pathname = usePathname();

    return (
        <nav className="border-b border-border pb-3">

            <div className="flex items-center gap-2">

                {tabs.map((tab) => {

                    const href = `/projects/${projectId}${tab.href}`;

                    const active = pathname === href;

                    return (
                        <Link
                            key={tab.name}
                            href={href}
                            className={clsx(
                                "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                                active
                                    ? "bg-accent/10 text-accent"
                                    : "text-secondary hover:bg-white/[0.03] hover:text-primary"
                            )}
                        >
                            {tab.name}
                        </Link>
                    );

                })}

            </div>

        </nav>
    );
}