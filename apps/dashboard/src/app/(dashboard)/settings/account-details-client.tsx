"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, User } from "lucide-react";
import { getClientTimezone, setClientTimezone, SUPPORTED_TIMEZONES } from "@/lib/timezone";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

const LANGUAGE_OPTIONS: HaloSelectOption[] = [
    { value: "en", label: "English" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "es", label: "Spanish" },
    { value: "ja", label: "Japanese" },
];

const STACK_ORDER_OPTIONS: HaloSelectOption[] = [
    { value: "default", label: "Default (newest at top)" },
    { value: "oldest-first", label: "Oldest first" },
];

type AccountDetailsClientProps = {
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    };
};

export function AccountDetailsClient({ user }: AccountDetailsClientProps) {
    const router = useRouter();
    const [name, setName] = useState(user.name);
    const [language, setLanguage] = useState("en");
    const [timezone, setTimezone] = useState("UTC");
    const [use24h, setUse24h] = useState(false);
    const [stackOrder, setStackOrder] = useState("default");
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    useEffect(() => {
        setTimezone(getClientTimezone());
    }, []);

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

        // Persist timezone preference to canonical cookie & localStorage
        setClientTimezone(timezone);

        await new Promise((r) => setTimeout(r, 400));
        setSavedSuccess(true);
        setIsSaving(false);
        router.refresh();
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
                                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold text-white bg-[#0b0f16] border border-[#222b38]"
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
                        <HaloSelect
                            value={language}
                            onChange={(val) => setLanguage(val)}
                            options={LANGUAGE_OPTIONS}
                            ariaLabel="Language"
                            className="w-full"
                            triggerClassName="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1">Timezone</label>
                        <HaloSelect
                            value={timezone}
                            onChange={(val) => setTimezone(val)}
                            options={SUPPORTED_TIMEZONES}
                            ariaLabel="Timezone"
                            className="w-full"
                            triggerClassName="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1">Stack Trace Order</label>
                        <HaloSelect
                            value={stackOrder}
                            onChange={(val) => setStackOrder(val)}
                            options={STACK_ORDER_OPTIONS}
                            ariaLabel="Stack Trace Order"
                            className="w-full"
                            triggerClassName="w-full"
                        />
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
