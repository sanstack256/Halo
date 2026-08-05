import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
    | "default"
    | "outline"
    | "success"
    | "warning"
    | "destructive";

type BadgeProps = {
    children: ReactNode;
    className?: string;
    variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
    default:
        "border-zinc-700 bg-zinc-900 text-zinc-300",

    outline:
        "border-zinc-700 bg-transparent text-zinc-300",

    success:
        "border-emerald-600/30 bg-emerald-500/10 text-emerald-400",

    warning:
        "border-yellow-600/30 bg-yellow-500/10 text-yellow-400",

    destructive:
        "border-red-600/30 bg-red-500/10 text-red-400",
};

export function Badge({
    children,
    className,
    variant = "default",
}: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                variants[variant],
                className
            )}
        >
            {children}
        </span>
    );
}