import {
    Boxes,
    KeyRound,
    Activity,
    Clock3,
} from "lucide-react";

import ProjectStatCard from "./project-stat-card";

export default function ProjectOverview() {
    return (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <ProjectStatCard
                title="Environments"
                value={1}
                subtitle="Production"
                icon={<Boxes className="h-5 w-5" />}
            />

            <ProjectStatCard
                title="API Keys"
                value={0}
                subtitle="No keys generated"
                icon={<KeyRound className="h-5 w-5" />}
            />

            <ProjectStatCard
                title="Events"
                value={0}
                subtitle="No events received"
                icon={<Activity className="h-5 w-5" />}
            />

            <ProjectStatCard
                title="Last Event"
                value="—"
                subtitle="Never"
                icon={<Clock3 className="h-5 w-5" />}
            />
        </div>
    );
}