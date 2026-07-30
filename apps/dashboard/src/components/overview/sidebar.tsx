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
        <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
            {/* Logo */}
            <div className="px-7 pt-8">
                <div className="flex items-center gap-3">
  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/10">
    <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
  </div>

  <span className="text-lg font-semibold tracking-tight text-white">
    Halo
  </span>
</div>
            </div>

            {/* Navigation */}
            <nav className="mt-10 flex flex-col px-4">
                {navigation.map((item) => {
                    const Icon = item.icon;

                    const active = pathname === item.href;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 ${active
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                }`}
                        >
                            <Icon
                                size={18}
                                strokeWidth={2}
                            />

                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="mt-auto border-t border-zinc-800 px-5 py-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-white">
                        D
                    </div>

                    <div>
                        <p className="text-sm font-medium text-white">Developer</p>
                        <p className="text-xs text-zinc-500">Free Plan</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}