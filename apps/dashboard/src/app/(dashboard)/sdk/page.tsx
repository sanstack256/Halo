import { redirect } from "next/navigation";
import { getProjects } from "@/actions/project";
import { getSession } from "@/lib/session";

export default async function SdkPage() {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    const projects = await getProjects();

    if (projects.length > 0) {
        redirect(`/projects/${projects[0].id}/sdk`);
    }

    redirect("/projects");
}