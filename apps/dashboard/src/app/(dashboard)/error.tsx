"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Dashboard error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error mb-6">
                <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-secondary max-w-md mb-8">
                {error.message || "An unexpected error occurred while loading this page."}
            </p>
            <div className="flex items-center gap-3">
                <button
                    onClick={() => reset()}
                    className="halo-btn halo-btn-primary inline-flex items-center gap-2"
                >
                    <RotateCcw size={15} />
                    Try again
                </button>
                <Link href="/overview" className="halo-btn halo-btn-secondary">
                    Go to Overview
                </Link>
            </div>
        </div>
    );
}
