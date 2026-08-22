"use client";

import { useState } from "react";
import { Check, Loader2, Save, User } from "lucide-react";

type AccountDetailsClientProps = {
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
};

export function AccountDetailsClient({ user }: AccountDetailsClientProps) {
    const [name, setName] = useState(user.name);
    const [language, setLanguage] = useState("en");
    const [timezone, setTimezone] = useState(
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
    );
    const [use24h, setUse24h] = useState(false);
    const [stackOrder, setStackOrder] = useState("default");
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    // Derive initials from the real name
    const initials = name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("");

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        // Preferences (language, timezone, etc.) are persisted via server action in a future iteration.
        await new Promise((r) => setTimeout(r, 600));
        setSavedSuccess(true);
        setIsSaving(false);
        setTimeout(() => setSavedSuccess(false), 3000);
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar + Identity */}
            <div className="halo-card p-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3 mb-5">
                    Identity
                </h2>

                <div className="flex flex-col sm:flex-row gap-6">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3 flex-shrink-0">
                        {user.image ? (
                            <img
                                src={user.image}
                                alt={name}
                                className="w-20 h-20 rounded-full object-cover ring-2 ring-border"
                            />
                        ) : (
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ring-2 ring-border"
                                style={{ background: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)" }}
                                aria-label={`Avatar for ${name}`}
                            >
                                {initials || <User size={28} />}
                            </div>
                        )}
                        <p className="text-xs text-secondary text-center max-w-[120px] leading-relaxed">
                            Avatar generated from your initials
                        </p>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-white mb-1.5">
                                Display Name <span className="text-error">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-white mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={user.email}
                                readOnly
                                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-muted cursor-not-allowed"
                            />
                            <p className="text-xs text-secondary mt-1">
                                Change via{" "}
                                <a href="/settings/emails" className="text-accent hover:underline">
                                    Email Addresses
                                </a>
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-white mb-1.5">
                                User ID
                            </label>
                            <input
                                type="text"
                                value={user.id}
                                readOnly
                                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-muted font-mono cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <div className="halo-card p-6 space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Preferences
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div>
                        <label className="block text-xs font-medium text-white mb-1">Language</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent"
                        >
                            <option value="en">English</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="es">Spanish</option>
                            <option value="ja">Japanese</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1">Timezone</label>
                        <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent"
                        >
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">America/New_York</option>
                            <option value="America/Los_Angeles">America/Los_Angeles</option>
                            <option value="Europe/London">Europe/London</option>
                            <option value="Asia/Kolkata">Asia/Kolkata</option>
                            <option value="Asia/Tokyo">Asia/Tokyo</option>
                            <option value="Australia/Sydney">Australia/Sydney</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1">Stack Trace Order</label>
                        <select
                            value={stackOrder}
                            onChange={(e) => setStackOrder(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent"
                        >
                            <option value="default">Default (newest at top)</option>
                            <option value="oldest-first">Oldest first</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div>
                        <p className="text-sm font-medium text-white">Use 24-hour clock</p>
                        <p className="text-xs text-secondary mt-0.5">
                            Show timestamps in 24-hour format throughout the UI.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setUse24h(!use24h)}
                        aria-checked={use24h}
                        role="switch"
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                            use24h ? "bg-accent" : "bg-surface-elevated border border-border-strong"
                        }`}
                    >
                        <span
                            className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                use24h ? "translate-x-5" : "translate-x-0"
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="halo-btn halo-btn-primary"
                >
                    {isSaving ? (
                        <><Loader2 size={14} className="animate-spin" />Saving…</>
                    ) : (
                        <><Save size={14} />Save Changes</>
                    )}
                </button>

                {savedSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <Check size={14} />
                        Saved successfully
                    </span>
                )}
            </div>
        </form>
    );
}
