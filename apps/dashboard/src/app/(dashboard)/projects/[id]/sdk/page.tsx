import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    Check,
    Copy,
    Terminal,
} from "lucide-react";

import { getProjectHeader } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectSdkPage({
    params,
}: Props) {
    const { id } = await params;

    const project = await getProjectHeader(id);

    if (!project) {
        notFound();
    }

    const apiKeys = await getApiKeys(id);

    const hasApiKey = apiKeys.length > 0;

    return (
        <div className="mx-auto max-w-4xl space-y-10">

            {/* Header */}

            <div>

                <Link
                    href={`/projects/${id}`}
                    className="
                        inline-flex
                        items-center
                        gap-2
                        text-sm
                        text-muted
                        transition-colors
                        hover:text-primary
                    "
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to project
                </Link>

                <div className="mt-8">

                    <div className="flex items-center gap-3">

                        <div
                            className="
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-xl
                                bg-accent/10
                                text-accent
                            "
                        >
                            <Terminal
                                className="h-5 w-5"
                                strokeWidth={1.8}
                            />
                        </div>

                        <div>

                            <p className="text-sm text-secondary">
                                {project.name}
                            </p>

                            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">
                                Install Halo SDK
                            </h1>

                        </div>

                    </div>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
                        Connect your application to Halo so it can
                        capture errors, messages, breadcrumbs, users,
                        tags, and other telemetry.
                    </p>

                </div>

            </div>

            {/* API key warning */}

            {!hasApiKey && (
                <section
                    className="
                        rounded-2xl
                        border
                        border-accent/20
                        bg-accent/[0.04]
                        p-6
                    "
                >
                    <h2 className="font-medium text-primary">
                        Generate an API key first
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-secondary">
                        Your application needs a project API key before
                        it can send events to Halo.
                    </p>

                    <Link
                        href={`/projects/${id}/api-keys`}
                        className="
                            mt-5
                            inline-flex
                            items-center
                            gap-2
                            rounded-xl
                            bg-accent
                            px-4
                            py-2
                            text-sm
                            font-medium
                            text-white
                            transition-opacity
                            hover:opacity-90
                        "
                    >
                        Generate API Key
                    </Link>
                </section>
            )}

            {/* Step 1 */}

            <section className="overflow-hidden rounded-2xl border border-border bg-surface">

                <div className="border-b border-border px-6 py-5">

                    <div className="flex items-center gap-3">

                        <div
                            className="
                                flex
                                h-7
                                w-7
                                items-center
                                justify-center
                                rounded-full
                                bg-accent/10
                                text-sm
                                font-medium
                                text-accent
                            "
                        >
                            1
                        </div>

                        <div>

                            <h2 className="font-semibold text-primary">
                                Install the SDK
                            </h2>

                            <p className="mt-1 text-sm text-secondary">
                                Add the Halo package to your application.
                            </p>

                        </div>

                    </div>

                </div>

                <div className="p-6">

                    <p className="mb-3 text-sm text-secondary">
                        Your current Halo SDK package is:
                    </p>

                    <CodeBlock>
                        pnpm add @halo-trace/sdk
                    </CodeBlock>

                    <p className="mt-4 text-xs leading-5 text-muted">
                        Halo SDK is currently being developed locally.
                        This installation command will become the
                        public package installation command once the
                        SDK is published.
                    </p>

                </div>

            </section>

            {/* Step 2 */}

            <section className="overflow-hidden rounded-2xl border border-border bg-surface">

                <div className="border-b border-border px-6 py-5">

                    <div className="flex items-center gap-3">

                        <div
                            className="
                                flex
                                h-7
                                w-7
                                items-center
                                justify-center
                                rounded-full
                                bg-accent/10
                                text-sm
                                font-medium
                                text-accent
                            "
                        >
                            2
                        </div>

                        <div>

                            <h2 className="font-semibold text-primary">
                                Configure your API key
                            </h2>

                            <p className="mt-1 text-sm text-secondary">
                                Store your key in an environment variable.
                            </p>

                        </div>

                    </div>

                </div>

                <div className="p-6">

                    <CodeBlock>
                        HALO_API_KEY=hl_live_your_project_key
                    </CodeBlock>

                    <p className="mt-4 text-xs leading-5 text-muted">
                        Never commit your API key to source control.
                        Keep it in your environment configuration.
                    </p>

                </div>

            </section>

            {/* Step 3 */}

            <section className="overflow-hidden rounded-2xl border border-border bg-surface">

                <div className="border-b border-border px-6 py-5">

                    <div className="flex items-center gap-3">

                        <div
                            className="
                                flex
                                h-7
                                w-7
                                items-center
                                justify-center
                                rounded-full
                                bg-accent/10
                                text-sm
                                font-medium
                                text-accent
                            "
                        >
                            3
                        </div>

                        <div>

                            <h2 className="font-semibold text-primary">
                                Initialize Halo
                            </h2>

                            <p className="mt-1 text-sm text-secondary">
                                Create a Halo client in your application.
                            </p>

                        </div>

                    </div>

                </div>

                <div className="p-6">

                    <CodeBlock>
{`import { Halo } from "@halo-trace/sdk";

const halo = new Halo({
    apiKey: process.env.HALO_API_KEY!,
});`}
                    </CodeBlock>

                </div>

            </section>

            {/* Step 4 */}

            <section className="overflow-hidden rounded-2xl border border-border bg-surface">

                <div className="border-b border-border px-6 py-5">

                    <div className="flex items-center gap-3">

                        <div
                            className="
                                flex
                                h-7
                                w-7
                                items-center
                                justify-center
                                rounded-full
                                bg-accent/10
                                text-sm
                                font-medium
                                text-accent
                            "
                        >
                            4
                        </div>

                        <div>

                            <h2 className="font-semibold text-primary">
                                Send your first event
                            </h2>

                            <p className="mt-1 text-sm text-secondary">
                                Verify that Halo can receive telemetry.
                            </p>

                        </div>

                    </div>

                </div>

                <div className="p-6">

                    <CodeBlock>
{`await halo.captureMessage(
    "Hello Halo"
);`}
                    </CodeBlock>

                    <div className="mt-5 flex items-start gap-3 rounded-xl bg-surface-elevated p-4">

                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />

                        <p className="text-sm leading-6 text-secondary">
                            Once Halo receives this event, the project
                            will show your first event and the setup
                            checklist will reflect that telemetry is
                            flowing.
                        </p>

                    </div>

                </div>

            </section>

            {/* Completion */}

            <div className="flex justify-end">

                <Link
                    href={`/projects/${id}`}
                    className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-xl
                        border
                        border-border
                        bg-surface
                        px-4
                        py-2.5
                        text-sm
                        font-medium
                        text-primary
                        transition-colors
                        hover:border-accent/30
                        hover:text-accent
                    "
                >
                    Return to project
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                </Link>

            </div>

        </div>
    );
}

function CodeBlock({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="group relative overflow-hidden rounded-xl border border-border bg-background">

            <pre className="overflow-x-auto p-5 font-mono text-sm leading-7 text-secondary">
                <code>{children}</code>
            </pre>

            <button
                type="button"
                className="
                    absolute
                    right-3
                    top-3
                    rounded-lg
                    border
                    border-border
                    bg-surface
                    p-2
                    text-muted
                    opacity-0
                    transition-opacity
                    hover:text-primary
                    group-hover:opacity-100
                "
                aria-label="Copy code"
            >
                <Copy className="h-4 w-4" />
            </button>

        </div>
    );
}