"use client";

import { usePathname, useRouter } from "next/navigation";
import { Search, LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";

const titles: Record<string, string> = {
    "/overview": "Overview",
    "/projects": "Projects",
    "/incidents": "Incidents",
    "/sdk": "SDK",
    "/settings": "Settings",
};

export default function Topbar() {
    const pathname = usePathname();
    const router = useRouter();

    const title = titles[pathname] ?? "Halo";

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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-background/80 px-8 backdrop-blur-xl">

            <div>

                <h1 className="text-lg font-semibold text-white">
                    Halo
                </h1>

            </div>

            <div className="flex items-center gap-2">

                <button
                    className="
                        flex
                        items-center
                        gap-2
                        rounded-xl
                        px-3
                        py-2
                        text-sm
                        text-secondary
                        transition-all
                        hover:bg-white/[0.03]
                        hover:text-primary
                    "
                >
                    <Search size={16} />
                    Search
                </button>

                <button
                    onClick={handleLogout}
                    className="
                        flex
                        items-center
                        gap-2
                        rounded-xl
                        px-3
                        py-2
                        text-sm
                        text-secondary
                        transition-all
                        hover:bg-red-500/10
                        hover:text-red-400
                    "
                >
                    <LogOut size={16} />
                    Logout
                </button>

            </div>

        </header>
    );
}