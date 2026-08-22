"use client";

import { useState } from "react";
import { createApiKey } from "@/actions/api-key";
import { revokeApiKey } from "@/actions/settings";
import { Check, Code2, Copy, Key, Plus, Trash2 } from "lucide-react";

type KeyItem = {
    id: string;
    name: string;
    prefix: string;
    createdAt: Date;
};

type ClientKeysManagerProps = {
    projectId: string;
    initialKeys: KeyItem[];
};

export function ClientKeysManager({ projectId, initialKeys }: ClientKeysManagerProps) {
    const [keys, setKeys] = useState<KeyItem[]>(initialKeys);
    const [newKeyName, setNewKeyName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    async function handleCreateKey(e: React.FormEvent) {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        setIsCreating(true);
        try {
            const rawKey = await createApiKey(projectId, newKeyName.trim());
            setNewlyCreatedKey(rawKey);
            setNewKeyName("");
            setKeys([
                {
                    id: `key-${Date.now()}`,
                    name: newKeyName.trim(),
                    prefix: rawKey.slice(0, 10),
                    createdAt: new Date(),
                },
                ...keys,
            ]);
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    }

    async function handleRevoke(keyId: string) {
        try {
            await revokeApiKey(keyId);
            setKeys(keys.filter((k) => k.id !== keyId));
        } catch (err) {
            console.error(err);
        }
    }

    function copyToClipboard(text: string, index: number) {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    }

    return (
        <div className="space-y-8 max-w-3xl">
            {/* Newly Created Key Alert */}
            {newlyCreatedKey && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        <Key size={14} />
                        New Client API Key Created
                    </div>
                    <p className="text-xs text-secondary">
                        Copy your API key now. For security, it won't be displayed again in full.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-white font-mono select-all">
                            {newlyCreatedKey}
                        </code>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(newlyCreatedKey, -1)}
                            className="halo-btn halo-btn-sm halo-btn-primary"
                        >
                            {copiedIndex === -1 ? <Check size={14} /> : <Copy size={14} />}
                            Copy
                        </button>
                    </div>
                </div>
            )}

            {/* Create New Key Form */}
            <form onSubmit={handleCreateKey} className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Generate New Client Key (DSN)
                </h2>

                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Key label (e.g. Next.js Frontend DSN)"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent"
                    />
                    <button
                        type="submit"
                        disabled={isCreating || !newKeyName.trim()}
                        className="halo-btn halo-btn-primary"
                    >
                        <Plus size={14} />
                        Generate Key
                    </button>
                </div>
            </form>

            {/* Existing Keys Table */}
            <div className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Active Client Keys
                </h2>

                {keys.length === 0 ? (
                    <p className="text-xs text-secondary py-4 text-center">No active API keys found for this project.</p>
                ) : (
                    <div className="halo-table">
                        <div className="halo-table-header grid-cols-[1fr_160px_140px_100px]">
                            <div className="halo-table-col-label">Name / Label</div>
                            <div className="halo-table-col-label">Key Prefix</div>
                            <div className="halo-table-col-label">Created</div>
                            <div className="halo-table-col-label">Action</div>
                        </div>

                        {keys.map((k, idx) => (
                            <div key={k.id} className="halo-table-row grid-cols-[1fr_160px_140px_100px]">
                                <div className="halo-table-row-title">{k.name}</div>
                                <div className="halo-table-cell-mono text-xs">{k.prefix}...</div>
                                <div className="halo-table-cell text-xs">{new Date(k.createdAt).toLocaleDateString()}</div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => handleRevoke(k.id)}
                                        className="text-xs text-error hover:underline flex items-center gap-1"
                                    >
                                        <Trash2 size={12} />
                                        Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
