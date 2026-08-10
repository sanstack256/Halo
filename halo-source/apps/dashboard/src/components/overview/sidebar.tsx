"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    LayoutDashboard,
    FolderOpen,
    TriangleAlert,
    Code2,
    Settings,
} from "lucide-react";

const navigation = [
    {
        name: "Overview",
        href: "/overview",
        icon: LayoutDashboard,
    },
    {
        name: "Projects",
        href: "/projects",
        icon: FolderOpen,
    },
    {
        name: "Incidents",
        href: "/incidents",
        icon: TriangleAlert,
    },
    {
        name: "SDK",
        href: "/sdk",
        icon: Code2,
    },
    {
        name: "Settings",
        href: "/settings",
        icon: Settings,
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="flex h-screen w-60 flex-col bg-background">

            {/* Logo */}

            <div className="px-7 pt-8 pb-10">

                <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">

                        <div className="h-2.5 w-2.5 rounded-full bg-accent" />

                    </div>

                    <span className="text-xl font-semibold tracking-tight text-primary">
                        Halo
                    </span>

                </div>

            </div>

            {/* Navigation */}

            <nav className="flex flex-1 flex-col gap-1 px-4">

                {navigation.map((item) => {

                    const Icon = item.icon;

                    const active =
                        pathname === item.href;

                    return (

                        <Link
                            key={item.name}
                            href={item.href}
                            className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                                active
                                    ? "bg-accent/10 text-accent"
                                    : "text-secondary hover:bg-white/[0.025] hover:text-primary"
                            }`}
                        >

                            <Icon
                                size={18}
                                strokeWidth={2}
                            />

                            {item.name}

                        </Link>

                    );

                })}

            </nav>

            {/* Footer */}

            <div className="px-5 pb-6 pt-6">

                <div className="flex items-center gap-3 rounded-xl p-3 hover:bg-white/[0.025] transition-colors">

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-sm font-semibold">

                        D

                    </div>

                    <div>

                        <p className="text-sm font-medium text-primary">
                            Developer
                        </p>

                        <p className="text-xs text-muted">
                            Free Plan
                        </p>

                    </div>

                </div>

            </div>

        </aside>
    );
}