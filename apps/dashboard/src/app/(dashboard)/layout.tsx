import Sidebar from "@/components/overview/sidebar";
import Topbar from "@/components/overview/topbar";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { ensureOrganization } from "@/lib/organization";
import { getProjects } from "@/actions/project";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session) {
        redirect("/sign-in");
    }

    try {
        await ensureOrganization(session.user.id);
    } catch {
        redirect("/sign-in");
    }

    let projects: Array<{ id: string; name: string }> = [];
    try {
        const dbProjects = await getProjects();
        projects = dbProjects.map((p) => ({
            id: p.id,
            name: p.name,
        }));
    } catch {
        projects = [];
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Global navigation */}
            <Sidebar initialProjects={projects} />

            {/* Application */}
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />

                <main className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}