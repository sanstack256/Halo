import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    Check,
    Terminal,
} from "lucide-react";

import { getProjectHeader } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";
import { CodeSnippet } from "./code-snippet";

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
    const apiKeySample = hasApiKey ? apiKeys[0].prefix + "_••••••••" : "hl_live_your_project_key";

    return (
        <div className="mx-auto max-w-4xl space-y-10">
            {/* Header */}
            <div>
                <Link
                    href={`/projects/${id}`}
                    className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to project
                </Link>

                <div className="mt-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <Terminal className="h-5 w-5" strokeWidth={1.8} />
                        </div>

                        <div>
                            <p className="text-sm text-secondary">{project.name}</p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">
                                Install Halo SDK
                            </h1>
                        </div>
                    </div>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
                        Connect your application to Halo so it can capture errors, messages, breadcrumbs, users, tags, and other telemetry.
                    </p>
                </div>
            </div>

            {/* API key warning */}
            {!hasApiKey && (
                <section className="rounded-xl border border-accent/20 bg-accent/[0.04] p-6">
                    <h2 className="font-medium text-primary">Generate an API key first</h2>
                    <p className="mt-2 text-sm leading-6 text-secondary">
                        Your application needs a project API key before it can send events to Halo.
                    </p>

                    <Link
                        href={`/projects/${id}/api-keys`}
                        className="halo-btn halo-btn-primary mt-5 inline-flex"
                    >
                        Generate API Key
                    </Link>
                </section>
            )}

            {/* Step 1 */}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                            1
                        </div>
                        <div>
                            <h2 className="font-semibold text-primary">Install the SDK</h2>
                            <p className="mt-1 text-sm text-secondary">
                                Add the Halo package to your application.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-3">
                    <p className="text-sm text-secondary">
                        Your current Halo SDK installation command is:
                    </p>

                    <CodeSnippet code="pnpm add @halo-trace/sdk" />

                    <p className="text-xs leading-5 text-muted">
                        Halo SDK is compatible with Node.js, Next.js, Express, Bun, and browser runtimes.
                    </p>
                </div>
            </section>

            {/* Step 2 */}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                            2
                        </div>
                        <div>
                            <h2 className="font-semibold text-primary">Configure your API key</h2>
                            <p className="mt-1 text-sm text-secondary">
                                Store your key in an environment variable.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-3">
                    <CodeSnippet code={`HALO_API_KEY=${apiKeySample}`} />

                    <p className="text-xs leading-5 text-muted">
                        Never commit your API key to source control. Keep it in your `.env.local` or secret store.
                    </p>
                </div>
            </section>

            {/* Step 3 */}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                            3
                        </div>
                        <div>
                            <h2 className="font-semibold text-primary">Initialize Halo</h2>
                            <p className="mt-1 text-sm text-secondary">
                                Create a Halo client in your application entrypoint.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <CodeSnippet
                        code={`import { Halo } from "@halo-trace/sdk";

const halo = new Halo({
    apiKey: process.env.HALO_API_KEY!,
});`}
                    />
                </div>
            </section>

            {/* Step 4 */}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                            4
                        </div>
                        <div>
                            <h2 className="font-semibold text-primary">Send your first event</h2>
                            <p className="mt-1 text-sm text-secondary">
                                Verify that Halo can receive telemetry.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <CodeSnippet
                        code={`await halo.captureMessage("Hello from Halo SDK!");`}
                    />

                    <div className="flex items-start gap-3 rounded-xl bg-surface-elevated p-4">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <p className="text-sm leading-6 text-secondary">
                            Once Halo receives this event, the project will immediately update and show live telemetry.
                        </p>
                    </div>
                </div>
            </section>

            {/* Step 5 */}
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                            5
                        </div>
                        <div>
                            <h2 className="font-semibold text-primary">Enable Browser Session Replay (Optional)</h2>
                            <p className="mt-1 text-sm text-secondary">
                                Record and reconstruct real DOM interactions leading up to frontend errors.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-secondary">
                        Install the lightweight browser recording package:
                    </p>

                    <CodeSnippet code="pnpm add @halo-trace/replay" />

                    <p className="text-sm text-secondary pt-2">
                        Initialize in your browser entrypoint (`app/layout.tsx` or `index.ts`):
                    </p>

                    <CodeSnippet
                        code={`import { HaloReplay } from "@halo-trace/replay";

const replay = new HaloReplay({
    apiKey: process.env.NEXT_PUBLIC_HALO_API_KEY!,
    errorTriggered: true, // Captures 60s pre-error buffer on unhandled exceptions
    privacy: {
        maskAllText: true, // Privacy-safe by default
    },
});

replay.start();`}
                    />

                    <div className="flex items-start gap-3 rounded-xl bg-surface-elevated p-4">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <p className="text-sm leading-6 text-secondary">
                            Replays will be automatically uploaded in chunked batches and linked to issues in the Investigation Workspace.
                        </p>
                    </div>
                </div>
            </section>

            {/* Completion */}
            <div className="flex justify-end">
                <Link
                    href={`/projects/${id}`}
                    className="halo-btn halo-btn-secondary"
                >
                    Return to project
                    <ArrowLeft className="h-4 w-4 rotate-180 ml-1.5" />
                </Link>
            </div>
        </div>
    );
}