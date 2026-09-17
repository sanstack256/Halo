import Link from "next/link";
import { Compass, Home, ArrowLeft } from "lucide-react";

export default function DashboardNotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border text-secondary mb-6">
                <Compass size={32} strokeWidth={1.8} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
            <p className="text-sm text-secondary max-w-md mb-8 leading-relaxed">
                The resource or dashboard page you were looking for doesn't exist or has moved.
            </p>
            <div className="flex items-center gap-3">
                <Link
                    href="/overview"
                    className="halo-btn halo-btn-primary inline-flex items-center gap-2"
                >
                    <Home size={15} />
                    <span>Go to Overview</span>
                </Link>
                <Link
                    href="/projects"
                    className="halo-btn halo-btn-secondary inline-flex items-center gap-2"
                >
                    <ArrowLeft size={15} />
                    <span>Projects</span>
                </Link>
            </div>
        </div>
    );
}
