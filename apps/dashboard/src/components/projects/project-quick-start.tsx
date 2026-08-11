import Link from "next/link";

import {
    ArrowRight,
    CheckCircle2,
    Circle,
} from "lucide-react";

type Step = {
    title: string;
    description: string;
    completed: boolean;
    href?: string;
};

type Props = {
    projectId: string;
    hasApiKey: boolean;
    hasEvents: boolean;
};

export default function ProjectQuickStart({
    projectId,
    hasApiKey,
    hasEvents,
}: Props) {
    const steps: Step[] = [
        {
            title: "Create Project",
            description:
                "Your project has been created successfully.",
            completed: true,
        },
        {
            title: "Generate API Key",
            description: hasApiKey
                ? "An ingestion key is ready."
                : "Create an ingestion key.",
            completed: hasApiKey,
            href: `/projects/${projectId}/api-keys`,
        },
        {
            title: "Install SDK",
            description:
                "Add the Halo SDK to your application.",
            completed: hasEvents,
            href: `/projects/${projectId}/sdk`,
        },
        {
            title: "Send First Event",
            description: hasEvents
                ? "Telemetry is being received."
                : "Send an event to verify the connection.",
            completed: hasEvents,
            href: `/projects/${projectId}/sdk`,
        },
    ];

    return (
        <section
            className="
                overflow-hidden
                rounded-2xl
                border
                border-border
                bg-surface
            "
        >

            {/* Header */}

            <div className="border-b border-border px-5 py-5">

                <h2 className="text-base font-semibold text-primary">
                    Quick Start
                </h2>

                <p className="mt-1 text-xs leading-5 text-secondary">
                    Connect your application to Halo.
                </p>

            </div>

            {/* Steps */}

            <div className="divide-y divide-border">

                {steps.map((step) => {

                    const content = (
                        <div className="flex gap-3 px-5 py-4">

                            {/* Status */}

                            <div className="mt-0.5 shrink-0">

                                {step.completed ? (
                                    <CheckCircle2
                                        className="
                                            h-4
                                            w-4
                                            text-accent
                                        "
                                        strokeWidth={1.8}
                                    />
                                ) : (
                                    <Circle
                                        className="
                                            h-4
                                            w-4
                                            text-muted
                                        "
                                        strokeWidth={1.8}
                                    />
                                )}

                            </div>

                            {/* Content */}

                            <div className="min-w-0 flex-1">

                                <div className="flex items-start justify-between gap-2">

                                    <h3
                                        className="
                                            text-sm
                                            font-medium
                                            text-primary
                                        "
                                    >
                                        {step.title}
                                    </h3>

                                    {step.href &&
                                        !step.completed && (
                                            <ArrowRight
                                                className="
                                                    mt-0.5
                                                    h-3.5
                                                    w-3.5
                                                    shrink-0
                                                    text-muted
                                                    transition-colors
                                                    group-hover:text-accent
                                                "
                                            />
                                        )}

                                </div>

                                <p
                                    className="
                                        mt-1
                                        text-xs
                                        leading-5
                                        text-secondary
                                    "
                                >
                                    {step.description}
                                </p>

                            </div>

                        </div>
                    );

                    if (
                        step.href &&
                        !step.completed
                    ) {
                        return (
                            <Link
                                key={step.title}
                                href={step.href}
                                className="
                                    group
                                    block
                                    transition-colors
                                    hover:bg-white/[0.02]
                                "
                            >
                                {content}
                            </Link>
                        );
                    }

                    return (
                        <div key={step.title}>
                            {content}
                        </div>
                    );
                })}

            </div>

        </section>
    );
}