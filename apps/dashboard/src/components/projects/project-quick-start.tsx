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
            description:
                hasApiKey
                    ? "An ingestion key is ready for your application."
                    : "Create an ingestion key for your application.",
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
            description:
                hasEvents
                    ? "Halo has received telemetry from your application."
                    : "Send an event to verify Halo is receiving telemetry.",
            completed: hasEvents,
            href: `/projects/${projectId}/sdk`,
        },
    ];

    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">

            <div className="border-b border-border px-8 py-6">

                <h2 className="text-xl font-semibold text-primary">
                    Quick Start
                </h2>

                <p className="mt-1 text-sm text-secondary">
                    Connect your application to Halo in a few steps.
                </p>

            </div>

            <div>

                {steps.map((step, index) => {

                    const content = (
                        <>
                            <div className="mt-0.5 shrink-0">

                                {step.completed ? (
                                    <CheckCircle2
                                        className="h-5 w-5 text-accent"
                                        strokeWidth={1.8}
                                    />
                                ) : (
                                    <Circle
                                        className="h-5 w-5 text-muted"
                                        strokeWidth={1.8}
                                    />
                                )}

                            </div>

                            <div className="min-w-0 flex-1">

                                <div className="flex items-center justify-between gap-4">

                                    <h3 className="font-medium text-primary">
                                        {step.title}
                                    </h3>

                                    {step.href && !step.completed && (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-accent opacity-0 transition-opacity group-hover:opacity-100">
                                            Continue
                                            <ArrowRight className="h-4 w-4" />
                                        </span>
                                    )}

                                </div>

                                <p className="mt-1 text-sm leading-6 text-secondary">
                                    {step.description}
                                </p>

                            </div>
                        </>
                    );

                    if (step.href && !step.completed) {
                        return (
                            <Link
                                key={step.title}
                                href={step.href}
                                className={`
                                    group
                                    flex
                                    items-start
                                    gap-5
                                    px-8
                                    py-6
                                    transition-colors
                                    hover:bg-white/[0.02]
                                    ${
                                        index !== steps.length - 1
                                            ? "border-b border-border"
                                            : ""
                                    }
                                `}
                            >
                                {content}
                            </Link>
                        );
                    }

                    return (
                        <div
                            key={step.title}
                            className={`
                                flex
                                items-start
                                gap-5
                                px-8
                                py-6
                                ${
                                    index !== steps.length - 1
                                        ? "border-b border-border"
                                        : ""
                                }
                            `}
                        >
                            {content}
                        </div>
                    );
                })}

            </div>

        </section>
    );
}