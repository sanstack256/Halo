"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ChevronUp,
    LogOut,
    User,
    Settings,
    CreditCard,
    Building2,
    Check,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserProfileMenu() {
    const { data: session, isPending } = authClient.useSession();
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    const user = session?.user;
    const name = user?.name || user?.email?.split("@")[0] || "Developer";
    const email = user?.email || "";
    const initial = name.charAt(0).toUpperCase();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function handleLogout() {
        await authClient.signOut();
        router.replace("/sign-in");
        router.refresh();
    }

    return (
        <div className="relative w-full" ref={menuRef}>
            {/* User Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-elevated transition-colors text-left border border-transparent hover:border-border"
                aria-label="User Profile Menu"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                        {isPending ? "..." : initial}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate leading-tight">
                            {isPending ? "Loading..." : name}
                        </div>
                        <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Pro Plan
                        </div>
                    </div>
                </div>

                <ChevronUp
                    size={14}
                    className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-xl bg-surface border border-border-strong shadow-2xl space-y-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {/* Header info */}
                    <div className="px-3 py-2 border-b border-border text-xs">
                        <p className="font-medium text-white truncate">{name}</p>
                        <p className="text-[11px] text-muted truncate">{email}</p>
                    </div>

                    <div className="py-1">
                        <Link
                            href="/settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                        >
                            <User size={14} />
                            Account Profile
                        </Link>

                        <Link
                            href="/settings/organization"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                        >
                            <Building2 size={14} />
                            Workspace Settings
                        </Link>

                        <Link
                            href="/settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-secondary hover:text-white hover:bg-surface-elevated transition-colors"
                        >
                            <CreditCard size={14} />
                            Plan & Billing
                        </Link>
                    </div>

                    <div className="pt-1 border-t border-border">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-error hover:bg-error/10 transition-colors text-left"
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
