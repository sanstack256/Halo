import { CheckCircle2, Circle } from "lucide-react";

type Step = {
    title: string;
    description: string;
    completed: boolean;
};

type Props = {
    hasApiKey: boolean;
    hasEvents: boolean;
};

export default function ProjectQuickStart({
    hasApiKey,
    hasEvents,
}: Props) {
    const steps: Step[] = [
        {
            title: "Create Project",
            description: "Your project has been created successfully.",
            completed: true,
        },
        {
            title: "Generate API Key",
            description: "Create an ingestion key for your application.",
            completed: hasApiKey,
        },
        {
            title: "Install SDK",
            description: "Install Halo into your application.",
            completed: false,
        },
        {
            title: "Send First Event",
            description: "Verify Halo is receiving telemetry.",
            completed: hasEvents,
        },
    ];

    return (
        <section className="mt-12 rounded-2xl border border-border bg-surface overflow-hidden">

            <div className="border-b border-border px-8 py-6">

                <h2 className="text-xl font-semibold">
                    Quick Start
                </h2>

                <p className="mt-1 text-secondary">
                    Complete these steps to start monitoring your application.
                </p>

            </div>

            <div>

                {steps.map((step, index) => (

                    <div
                        key={step.title}
                        className={`
                            flex
                            items-start
                            gap-5
                            px-8
                            py-6
                            ${index !== steps.length - 1 ? "border-b border-border" : ""}
                        `}
                    >

                        <div className="mt-0.5 shrink-0">

                            {step.completed ? (

                                <CheckCircle2
                                    className="h-5 w-5 text-accent"
                                />

                            ) : (

                                <Circle
                                    className="h-5 w-5 text-muted"
                                />

                            )}

                        </div>

                        <div className="min-w-0">

                            <h3 className="font-medium text-primary">
                                {step.title}
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-secondary">
                                {step.description}
                            </p>

                        </div>

                    </div>

                ))}

            </div>

        </section>
    );
}