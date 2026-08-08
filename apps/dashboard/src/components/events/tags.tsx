type Props = {
    tags: Record<string, unknown>;
};

export default function Tags({
    tags,
}: Props) {
    const entries = Object.entries(tags);

    return (
        <section>
            <h2 className="mb-5 text-lg font-semibold">
                Tags
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">

                {entries.map(([key, value], index) => (
                    <div
                        key={key}
                        className={`
                            flex items-center justify-between
                            px-6 py-4
                            ${
                                index !== entries.length - 1
                                    ? "border-b border-border"
                                    : ""
                            }
                        `}
                    >
                        <span className="font-medium">
                            {key}
                        </span>

                        <span className="font-mono text-sm text-secondary">
                            {String(value)}
                        </span>
                    </div>
                ))}

            </div>
        </section>
    );
}