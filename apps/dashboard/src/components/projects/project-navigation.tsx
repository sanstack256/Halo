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
        <nav className="border-b">
            <div className="flex gap-8">

                {tabs.map((tab) => {
                    const href = `/projects/${projectId}${tab.href}`;

                    const active =
                        pathname === href;

                    return (
                        <Link
                            key={tab.name}
                            href={href}
                            className={clsx(
                                "border-b-2 pb-4 text-sm transition-colors",
                                active
                                    ? "border-white text-white"
                                    : "border-transparent text-muted-foreground hover:text-white"
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