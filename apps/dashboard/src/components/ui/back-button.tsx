"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
    fallbackHref?: string;
    label?: string;
    className?: string;
};

export function BackButton({
    fallbackHref = "/overview",
    label = "Back",
    className,
}: BackButtonProps) {
    const router = useRouter();

    function handleBack() {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallbackHref);
        }
    }

    return (
        <button
            type="button"
            onClick={handleBack}
            className={
                className ??
                "inline-flex items-center gap-2 text-xs font-medium text-secondary hover:text-white transition-colors"
            }
        >
            <ArrowLeft size={14} />
            <span>{label}</span>
        </button>
    );
}
