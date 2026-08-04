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
        title: "Install the SDK",
        description: "Install the Halo SDK into your application.",
        completed: false,
    },
    {
        title: "Send your First Event",
        description: "Verify that Halo is receiving telemetry.",
        completed: hasEvents,
    },
];

    return (
        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="text-xl font-semibold text-white">
                Quick Start
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
                Complete these steps to start monitoring your application.
            </p>

            <div className="mt-8 space-y-6">
                {steps.map((step) => (
                    <div
                        key={step.title}
                        className="flex items-start gap-4"
                    >
                        <div className="mt-0.5">
                            {step.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            ) : (
                                <Circle className="h-5 w-5 text-zinc-600" />
                            )}
                        </div>

                        <div>
                            <h3 className="font-medium text-white">
                                {step.title}
                            </h3>

                            <p className="mt-1 text-sm text-zinc-500">
                                {step.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}