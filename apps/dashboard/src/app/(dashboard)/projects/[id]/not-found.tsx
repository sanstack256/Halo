import Link from "next/link";
import { FolderGit2, ArrowLeft, Home } from "lucide-react";

export default function ProjectNotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-6">
                <FolderGit2 size={32} strokeWidth={1.8} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Project Not Found</h2>
            <p className="text-sm text-secondary max-w-md mb-8 leading-relaxed">
                The requested project could not be found, has been removed, or you don't have permission to access it in your current workspace.
            </p>
            <div className="flex items-center gap-3">
                <Link
                    href="/projects"
                    className="halo-btn halo-btn-primary inline-flex items-center gap-2"
                >
                    <ArrowLeft size={15} />
                    <span>View All Projects</span>
                </Link>
                <Link
                    href="/overview"
                    className="halo-btn halo-btn-secondary inline-flex items-center gap-2"
                >
                    <Home size={15} />
                    <span>Go to Overview</span>
                </Link>
            </div>
        </div>
    );
}
