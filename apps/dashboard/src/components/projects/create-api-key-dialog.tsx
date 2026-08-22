"use client";

import { useState } from "react";
import { createApiKey } from "@/actions/api-key";
import { useRouter } from "next/navigation";
import { Check, Copy, Key, Plus } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function CreateApiKeyDialog({
    projectId,
}: {
    projectId: string;
}) {
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    function resetDialog() {
        setGeneratedKey(null);
        setName("");
        setOpen(false);
        router.refresh();
    }

    async function handleCreate() {
        if (!name.trim()) return;

        setLoading(true);

        try {
            const key = await createApiKey(projectId, name.trim());
            setGeneratedKey(key);
        } catch (error) {
            console.error("Failed to create API key:", error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <button
                type="button"
                className="halo-btn halo-btn-primary"
                onClick={() => {
                    setGeneratedKey(null);
                    setName("");
                    setOpen(true);
                }}
            >
                <Plus size={15} />
                Generate API Key
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    {!generatedKey ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Generate API Key</DialogTitle>
                                <DialogDescription>
                                    Create a client DSN / API key for telemetry streaming from your application.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-white">
                                        Key Name <span className="text-error">*</span>
                                    </label>
                                    <input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Production SDK Key"
                                        className="w-full rounded-lg border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm text-white placeholder:text-muted outline-none transition focus:border-accent"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    className="halo-btn halo-btn-secondary"
                                    onClick={() => setOpen(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    disabled={!name.trim() || loading}
                                    className="halo-btn halo-btn-primary"
                                    onClick={handleCreate}
                                >
                                    {loading ? "Generating…" : "Generate Key"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Key size={18} />
                                    <DialogTitle>API Key Generated</DialogTitle>
                                </div>
                                <DialogDescription>
                                    Copy and store this key securely. You will not be able to view it again.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-3 py-2">
                                <div className="rounded-xl bg-surface p-4 font-mono text-xs text-white break-all border border-border flex items-center justify-between gap-3">
                                    <span>{generatedKey}</span>
                                    <button
                                        type="button"
                                        className="halo-btn halo-btn-sm halo-btn-secondary flex-shrink-0"
                                        onClick={() => {
                                            navigator.clipboard.writeText(generatedKey);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                    >
                                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                        {copied ? "Copied" : "Copy"}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    className="halo-btn halo-btn-primary"
                                    onClick={resetDialog}
                                >
                                    Done
                                </button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}