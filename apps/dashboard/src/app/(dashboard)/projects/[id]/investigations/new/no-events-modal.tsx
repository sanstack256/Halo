"use client";

import Link from "next/link";
import { AlertCircle, Code2, Compass, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

export function NoEventsInvestigationModal({
    projectId,
    errorMessage,
}: {
    projectId: string;
    errorMessage?: string;
}) {
    const router = useRouter();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in-0 duration-150">
            <div className="w-full max-w-lg rounded-2xl bg-[#0b0f16] p-6 border border-[#222b38] space-y-6 animate-in zoom-in-95 duration-150">
                {/* Header with Icon */}
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400">
                        <AlertCircle size={24} />
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-lg font-bold text-white tracking-tight">
                            No Telemetry Events Available
                        </h2>
                        <p className="text-xs text-secondary leading-relaxed">
                            {errorMessage || "This issue does not contain any recorded telemetry events or the retention window has expired."}
                        </p>
                    </div>
                </div>

                {/* Explanation Card */}
                <div className="rounded-xl bg-surface p-4 border border-border space-y-2 text-xs text-secondary leading-relaxed">
                    <p className="font-semibold text-white">How Halo Investigation Works:</p>
                    <p>
                        Halo&apos;s autonomous root cause engine correlates stack traces, correlated trace spans, request payloads, and surrounding service logs to reconstruct incident evidence. Without at least one event payload, a causal verdict cannot be established.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="halo-btn halo-btn-secondary w-full sm:w-auto"
                    >
                        Go Back
                    </button>

                    <Link
                        href={`/projects/${projectId}/sdk`}
                        className="halo-btn halo-btn-secondary w-full sm:w-auto gap-1.5"
                    >
                        <Code2 size={14} />
                        SDK Setup
                    </Link>

                    <Link
                        href="/issues"
                        className="halo-btn halo-btn-primary w-full sm:w-auto gap-1.5"
                    >
                        <Compass size={14} />
                        View All Issues
                    </Link>
                </div>
            </div>
        </div>
    );
}
