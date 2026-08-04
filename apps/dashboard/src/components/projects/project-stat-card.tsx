import type { ReactNode } from "react";

type Props = {
    title: string;
    value: string | number;
    subtitle: string;
    icon: ReactNode;
};

export default function ProjectStatCard({
    title,
    value,
    subtitle,
    icon,
}: Props) {
    return (
        <div
            className="
                rounded-2xl
                border
                border-zinc-800
                bg-zinc-950
                p-6
                transition
                hover:border-zinc-700
            "
        >
            <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">
                    {title}
                </span>

                <div className="text-zinc-500">
                    {icon}
                </div>
            </div>

            <div className="mt-5 text-3xl font-semibold text-white">
                {value}
            </div>

            <p className="mt-2 text-sm text-zinc-500">
                {subtitle}
            </p>
        </div>
    );
}