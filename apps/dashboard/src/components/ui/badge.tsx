import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = {
    children: ReactNode;
    className?: string;
};

export function Badge({
    children,
    className,
}: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300",
                className
            )}
        >
            {children}
        </span>
    );
}