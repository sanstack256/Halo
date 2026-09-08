import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { getProject } from "@/actions/project";
import { getApiKeys } from "@/actions/api-key";
import { CodeSnippet } from "./code-snippet";
import { OptionalReplaySection } from "./optional-replay";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectSdkPage({
    params,
}: Props) {
    const { id } = await params;

    let project;
    try {
        project = await getProject(id);
    } catch {
        notFound();
    }

    if (!project) {
        notFound();
    }

    const apiKeys = await getApiKeys(project.id).catch(() => []);
    const hasApiKey = apiKeys.length > 0;
    const apiKeySample = hasApiKey ? `${apiKeys[0].prefix}_••••••••` : "hl_live_your_project_key";
    const hasEvents = (project.events?.length ?? 0) > 0;

    const initCode = `import { Halo } from "@halo-trace/sdk";

const halo = new Halo({
  apiKey: process.env.HALO_API_KEY!,
});`;

    const eventCode = `await halo.captureMessage("Hello from Halo");`;

    return (
        <div className="w-full max-w-[760px] mx-auto px-5 py-6">
            {/* Navigation back */}
            <div>
                <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-secondary transition-colors hover:text-primary"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to project</span>
                </Link>
            </div>

            {/* Header with Project Context */}
            <div className="mt-8 mb-8">
                <p className="text-sm font-medium text-muted lowercase">
                    {project.name}
                </p>
                <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-primary">
                    Install Halo SDK
                </h1>
                <p className="mt-1.5 text-base text-secondary">
                    Send your first telemetry to Halo.
                </p>
            </div>

            {/* Setup Flow — 4 Primary Steps */}
            <div className="space-y-8">
                {/* Step 01: Install */}
                <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm font-semibold text-muted">01</span>
                        <div>
                            <h2 className="text-base font-semibold text-primary">Install</h2>
                            <p className="mt-0.5 text-sm text-secondary">
                                Add the Halo SDK to your application.
                            </p>
                        </div>
                    </div>
                    <CodeSnippet code="pnpm add @halo-trace/sdk" language="bash" />
                </div>

                {/* Step 02: Configure */}
                <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm font-semibold text-muted">02</span>
                        <div>
                            <h2 className="text-base font-semibold text-primary">Configure</h2>
                            <p className="mt-0.5 text-sm text-secondary">
                                Add your project&apos;s API key to your environment.
                            </p>
                        </div>
                    </div>
                    <CodeSnippet code={`HALO_API_KEY=${apiKeySample}`} language="env" />
                </div>

                {/* Step 03: Initialize */}
                <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm font-semibold text-muted">03</span>
                        <div>
                            <h2 className="text-base font-semibold text-primary">Initialize</h2>
                            <p className="mt-0.5 text-sm text-secondary">
                                Create a Halo client in your application.
                            </p>
                        </div>
                    </div>
                    <CodeSnippet code={initCode} language="typescript" />
                </div>

                {/* Step 04: Send an event */}
                <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm font-semibold text-muted">04</span>
                        <div>
                            <h2 className="text-base font-semibold text-primary">Send your first event</h2>
                            <p className="mt-0.5 text-sm text-secondary">
                                Verify that Halo is receiving telemetry.
                            </p>
                        </div>
                    </div>
                    <CodeSnippet code={eventCode} language="typescript" />
                    <p className="text-sm text-secondary leading-normal">
                        Once Halo receives the event, it will appear in your project telemetry.
                    </p>
                </div>

                {/* Optional Section: Browser Replay */}
                <OptionalReplaySection />
            </div>

            {/* Completion state */}
            <div className="border-t border-border pt-6 mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-base font-semibold text-primary">
                                SDK setup complete?
                            </h3>
                            {hasEvents && (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-[#35d08a]">
                                    Telemetry received
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-secondary">
                            Send an event from your application and check the project for new telemetry.
                        </p>
                    </div>

                    <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-accent transition-colors self-start sm:self-auto group"
                    >
                        <span>Back to project</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}