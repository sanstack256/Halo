import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function RootNotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border text-accent mb-6">
                <Compass size={32} strokeWidth={1.8} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">404 — Page Not Found</h1>
            <p className="text-sm text-secondary max-w-md mb-8 leading-relaxed">
                The page you are looking for does not exist or has been moved.
            </p>
            <div className="flex items-center gap-3">
                <Link
                    href="/"
                    className="halo-btn halo-btn-primary inline-flex items-center gap-2"
                >
                    <Home size={15} />
                    <span>Return to Halo</span>
                </Link>
            </div>
        </div>
    );
}
