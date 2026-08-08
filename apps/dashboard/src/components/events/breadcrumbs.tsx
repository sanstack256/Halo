type Breadcrumb = {
    timestamp?: string;
    category: string;
    message: string;
};

type Props = {
    breadcrumbs: Breadcrumb[];
};

export default function Breadcrumbs({
    breadcrumbs,
}: Props) {
    return (
        <section>
            <h2 className="mb-5 text-lg font-semibold">
                Breadcrumbs
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">

                {breadcrumbs.map((breadcrumb, index) => (
                    <div
                        key={index}
                        className={`
                            flex gap-4 px-6 py-5
                            ${index !== breadcrumbs.length - 1
                                ? "border-b border-border"
                                : ""
                            }
                        `}
                    >
                        <div className="mt-2 h-2 w-2 rounded-full bg-accent shrink-0" />

                        <div className="min-w-0 flex-1">

                            <div className="flex items-center gap-3">

                                <p className="text-sm font-medium">
                                    {breadcrumb.category}
                                </p>

                                <span className="text-xs text-muted">
                                    {breadcrumb.timestamp
                                        ? new Date(
                                            breadcrumb.timestamp
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        })
                                        : "-"}
                                </span>

                            </div>

                            <p className="mt-1 text-sm text-secondary">
                                {breadcrumb.message}
                            </p>

                        </div>
                    </div>
                ))}

            </div>
        </section>
    );
}