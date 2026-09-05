"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Radio, Sparkles } from "lucide-react";
import { acknowledgeAlert, resolveAlert, updateAlertNotes, type AlertWithMonitor } from "@/actions/alert";

interface AlertDetailActionsProps {
    alert: AlertWithMonitor;
}

export function AlertDetailActions({ alert }: AlertDetailActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [notes, setNotes] = useState(alert.notes ?? "");
    const [notesChanged, setNotesChanged] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setNotes(e.target.value);
        setNotesChanged(e.target.value !== (alert.notes ?? ""));
    }

    async function handleSaveNotes() {
        setError(null);
        startTransition(async () => {
            const result = await updateAlertNotes(alert.id, notes);
            if (result.success) {
                setNotesChanged(false);
                router.refresh();
            } else {
                setError(result.error ?? "Failed to save notes");
            }
        });
    }

    async function handleAcknowledge() {
        setError(null);
        startTransition(async () => {
            const result = await acknowledgeAlert(alert.id, notes || undefined);
            if (result.success) {
                router.refresh();
            } else {
                setError(result.error ?? "Failed to acknowledge");
            }
        });
    }

    async function handleResolve() {
        setError(null);
        startTransition(async () => {
            const result = await resolveAlert(alert.id, notes || undefined);
            if (result.success) {
                router.refresh();
            } else {
                setError(result.error ?? "Failed to resolve");
            }
        });
    }

    return (
        <div className="flex flex-col gap-3 min-w-[280px]">
            {error && (
                <p className="text-xs text-red-400">{error}</p>
            )}

            {/* Notes */}
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                <label className="text-xs text-[var(--text-muted)]">Operator Notes</label>
                <textarea
                    value={notes}
                    onChange={handleNotesChange}
                    disabled={isPending || alert.status === "RESOLVED"}
                    placeholder="Add notes about this alert…"
                    rows={3}
                    className="w-full text-xs font-mono resize-none bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:text-white transition-colors"
                />
                {notesChanged && (
                    <button
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={isPending}
                        className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
                    >
                        {isPending ? "Saving…" : "Save notes"}
                    </button>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
                {/* Primary Launch Investigation Action */}
                <Link
                    href={`/projects/${alert.projectId}/investigations/new?monitorId=${alert.monitorId}&alertId=${alert.id}`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-mono rounded-lg border border-[var(--accent)] text-white bg-[var(--accent)] hover:opacity-90 transition-opacity font-semibold"
                >
                    <span>Investigate Trigger</span>
                </Link>

                {alert.status === "OPEN" && (
                    <button
                        type="button"
                        onClick={handleAcknowledge}
                        disabled={isPending}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-mono rounded-lg border border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    >
                        <Radio size={12} />
                        {isPending ? "Processing…" : "Acknowledge Alert"}
                    </button>
                )}
                {(alert.status === "OPEN" || alert.status === "ACKNOWLEDGED") && (
                    <button
                        type="button"
                        onClick={handleResolve}
                        disabled={isPending}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-mono rounded-lg border border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    >
                        <CheckCheck size={12} />
                        {isPending ? "Processing…" : "Resolve Alert"}
                    </button>
                )}
                {alert.status === "RESOLVED" && (
                    <div className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-mono rounded-lg border border-emerald-500/20 text-emerald-400/60 bg-emerald-500/5">
                        <CheckCheck size={12} />
                        Alert Resolved
                    </div>
                )}
            </div>
        </div>
    );
}
