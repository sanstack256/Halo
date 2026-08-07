import { cn } from "@/lib/utils";

type PageHeaderProps = {
    title: string;
    description?: string;
    className?: string;
    action?: React.ReactNode;
};

export function PageHeader({
    title,
    description,
    className,
    action,
}: PageHeaderProps) {
    return (
        <header
            className={cn(
                "flex items-end justify-between gap-8",
                className
            )}
        >
            <div className="space-y-2">

                <h1 className="text-5xl font-semibold tracking-[-0.045em] text-primary">
                    {title}
                </h1>

                {description && (
                    <p className="max-w-3xl text-base leading-7 text-secondary">
                        {description}
                    </p>
                )}

            </div>

            {action && (
                <div className="shrink-0">
                    {action}
                </div>
            )}

        </header>
    );
}