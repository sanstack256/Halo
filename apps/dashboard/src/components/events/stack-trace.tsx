type Props = {
    stack: string;
};

export default function StackTrace({
    stack,
}: Props) {
    return (
        <section>
            <h2 className="mb-5 text-lg font-semibold">
                Stack Trace
            </h2>

            <div className="overflow-hidden rounded-xl bg-surface border border-border">
                <pre className="overflow-x-auto p-6 font-mono text-sm leading-7 whitespace-pre-wrap break-words">
                    {stack}
                </pre>
            </div>
        </section>
    );
}