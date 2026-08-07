import {
    Activity,
    AlertTriangle,
    Clock3,
} from "lucide-react";

export default function ProjectOverview() {
    return (
        <section className="mt-10">

            <div className="grid grid-cols-3 gap-8">

                <div>

                    <div className="mb-3 flex items-center gap-2 text-secondary">

                        <Activity className="h-4 w-4" />

                        <span className="text-sm">
                            Events Today
                        </span>

                    </div>

                    <p className="text-5xl font-semibold tracking-tight">
                        0
                    </p>

                </div>

                <div>

                    <div className="mb-3 flex items-center gap-2 text-secondary">

                        <AlertTriangle className="h-4 w-4" />

                        <span className="text-sm">
                            Open Issues
                        </span>

                    </div>

                    <p className="text-5xl font-semibold tracking-tight">
                        0
                    </p>

                </div>

                <div>

                    <div className="mb-3 flex items-center gap-2 text-secondary">

                        <Clock3 className="h-4 w-4" />

                        <span className="text-sm">
                            Last Event
                        </span>

                    </div>

                    <p className="text-xl font-medium">
                        Never
                    </p>

                </div>

            </div>

        </section>
    );
}