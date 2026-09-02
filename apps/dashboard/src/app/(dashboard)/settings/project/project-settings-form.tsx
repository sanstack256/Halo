"use client";

import { useState } from "react";
import { updateProjectSettings } from "@/actions/settings";
import { Check, Loader2, Save } from "lucide-react";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

const AUTO_RESOLVE_OPTIONS: HaloSelectOption[] = [
    { value: "disabled", label: "Disabled" },
    { value: "7", label: "7 days" },
    { value: "14", label: "14 days" },
    { value: "30", label: "30 days" },
];

const ERROR_TRIGGERED_OPTIONS: HaloSelectOption[] = [
    { value: "enabled", label: "Preserve Pre-Error Buffer (60s)" },
    { value: "disabled", label: "Record Sampled Only" },
];

type ProjectSettingsFormProps = {
    project: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
    };
};

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
    const [name, setName] = useState(project.name);
    const [slug, setSlug] = useState(project.slug);
    const [description, setDescription] = useState(project.description || "");
    const [spikeProtection, setSpikeProtection] = useState(true);
    const [autoResolveDays, setAutoResolveDays] = useState("14");
    const [allowedOrigins, setAllowedOrigins] = useState("");
    const [replayEnabled, setReplayEnabled] = useState(true);
    const [samplingRate, setSamplingRate] = useState(100);
    const [errorTriggered, setErrorTriggered] = useState(true);
    const [maskAllText, setMaskAllText] = useState(true);
    const [ignoreUrls, setIgnoreUrls] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        setSavedSuccess(false);

        try {
            await updateProjectSettings(project.id, {
                name,
                slug,
                description,
            });
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 3000);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
            {/* PROJECT DETAILS */}
            <div className="halo-card p-6 space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Project Details
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-white mb-1.5">
                            Project Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1.5">
                            Slug (Unique Identifier)
                        </label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white font-mono focus:outline-none focus:border-accent transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1.5">
                            Project ID (Immutable)
                        </label>
                        <input
                            type="text"
                            value={project.id}
                            disabled
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-muted font-mono cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-white mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Optional project description..."
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-sm text-white focus:outline-none focus:border-accent transition-colors resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* SPIKE PROTECTION */}
            <div className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Spike Protection
                </h2>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-white">Enable Spike Protection</p>
                        <p className="text-xs text-secondary mt-0.5">
                            Automatically rate-limit error event bursts when unexpected traffic spikes occur.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSpikeProtection(!spikeProtection)}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                            spikeProtection ? "bg-accent" : "bg-surface-elevated border border-border-strong"
                        }`}
                    >
                        <span
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                spikeProtection ? "translate-x-5" : "translate-x-0"
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* EVENT SETTINGS (AUTO-RESOLVE) */}
            <div className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Event Settings
                </h2>

                <div>
                    <label className="block text-sm font-medium text-white mb-1">
                        Auto Resolve Inactive Issues
                    </label>
                    <p className="text-xs text-secondary mb-3">
                        Automatically resolve issues if no new event occurrences are recorded for this duration.
                    </p>
                    <HaloSelect
                        value={autoResolveDays}
                        onChange={setAutoResolveDays}
                        options={AUTO_RESOLVE_OPTIONS}
                        ariaLabel="Auto Resolve Inactive Issues"
                    />
                </div>
            </div>

            {/* SESSION REPLAY CONFIGURATION */}
            <div className="halo-card p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Session Replay Configuration
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold border border-accent/20">
                        rrweb Engine
                    </span>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white">Enable Browser Session Recording</p>
                            <p className="text-xs text-secondary mt-0.5">
                                Capture DOM mutations, user clicks, and network requests leading up to frontend errors.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplayEnabled(!replayEnabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                replayEnabled ? "bg-accent" : "bg-surface-elevated border border-border-strong"
                            }`}
                        >
                            <span
                                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                    replayEnabled ? "translate-x-5" : "translate-x-0"
                                }`}
                            />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-xs font-medium text-white mb-1">
                                Sampling Rate ({samplingRate}%)
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={samplingRate}
                                onChange={(e) => setSamplingRate(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                            />
                            <p className="text-[11px] text-muted mt-1">
                                Fraction of non-error user sessions recorded continuously.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-white mb-1">
                                Error-Triggered Preservation
                            </label>
                            <HaloSelect
                                value={errorTriggered ? "enabled" : "disabled"}
                                onChange={(val) => setErrorTriggered(val === "enabled")}
                                options={ERROR_TRIGGERED_OPTIONS}
                                ariaLabel="Error-Triggered Preservation"
                                className="w-full"
                                triggerClassName="w-full"
                            />
                            <p className="text-[11px] text-muted mt-1">
                                Guarantees replay capture whenever an unhandled exception occurs.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-border space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-white">Mask All User Text</p>
                                <p className="text-[11px] text-secondary">
                                    Replaces all rendered alphanumeric text with asterisks for complete privacy.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMaskAllText(!maskAllText)}
                                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                                    maskAllText ? "bg-accent" : "bg-surface-elevated border border-border-strong"
                                }`}
                            >
                                <span
                                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                        maskAllText ? "translate-x-4" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-white mb-1">
                                Excluded URLs (Do not record)
                            </label>
                            <input
                                type="text"
                                value={ignoreUrls}
                                onChange={(e) => setIgnoreUrls(e.target.value)}
                                placeholder="/admin/sensitive, /billing/cards"
                                className="w-full px-3 py-2 rounded-lg border border-border-strong bg-surface-elevated text-xs text-white font-mono focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* CLIENT SECURITY / CORS */}
            <div className="halo-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Client Security & CORS
                </h2>

                <div>
                    <label className="block text-sm font-medium text-white mb-1">
                        Allowed Origin URLs
                    </label>
                    <p className="text-xs text-secondary mb-3">
                        Origins allowed to send browser telemetry to Halo SDK endpoint. One per line.
                    </p>
                    <textarea
                        value={allowedOrigins}
                        onChange={(e) => setAllowedOrigins(e.target.value)}
                        placeholder="https://app.example.com&#10;https://staging.example.com"
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border-strong bg-surface-elevated text-xs text-white font-mono focus:outline-none focus:border-accent transition-colors resize-none"
                    />
                </div>
            </div>

            {/* SAVE ACTION */}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="halo-btn halo-btn-primary"
                >
                    {isSaving ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Saving Changes...
                        </>
                    ) : (
                        <>
                            <Save size={14} />
                            Save Settings
                        </>
                    )}
                </button>

                {savedSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium animate-in fade-in">
                        <Check size={14} />
                        Settings saved successfully
                    </span>
                )}
            </div>
        </form>
    );
}
