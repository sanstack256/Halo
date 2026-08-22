import { getOverviewData } from "@/actions/overview";
import { getApiKeys } from "@/actions/api-key";
import { ClientKeysManager } from "./client-keys-manager";

export default async function ClientKeysPage() {
    const overview = await getOverviewData();
    const activeProject = overview.projects[0];

    if (!activeProject) {
        return (
            <div className="halo-empty-state">
                <h2 className="halo-empty-state-title">No projects available</h2>
                <p className="halo-empty-state-description">Initialize a project to generate client DSN keys.</p>
            </div>
        );
    }

    const keys = await getApiKeys(activeProject.id);

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Client Keys (DSN)</h1>
                <p className="halo-page-description">
                    Manage client credentials and DSN keys used to authenticate SDK telemetry from <span className="font-semibold text-white">{activeProject.name}</span>.
                </p>
            </div>

            <ClientKeysManager projectId={activeProject.id} initialKeys={keys} />
        </div>
    );
}
