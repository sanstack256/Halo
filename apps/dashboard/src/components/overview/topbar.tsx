"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";

import { authClient } from "@/lib/auth-client";

const titles: Record<string, string> = {
    "/overview": "Overview",
    "/projects": "Projects",
    "/incidents": "Issues",
    "/sdk": "SDK",
    "/settings": "Settings",
};

export default function Topbar() {
    const pathname = usePathname();
    const router = useRouter();

    const title =
        Object.entries(titles).find(([path]) =>
            pathname === path || pathname.startsWith(`${path}/`),
        )?.[1] ?? "Halo";

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
            <div className="halo-topbar-title">
                {title}
            </div>

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