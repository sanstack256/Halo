"use client";

import { useState } from "react";
import { updateOrganizationSettings } from "@/actions/settings";
import { Check, Loader2, Save, Zap } from "lucide-react";
import Link from "next/link";
import type { PlanId } from "@/lib/plans";

type OrganizationSettingsFormProps = {
    organization: {
        id: string;
        name: string;
        slug: string;
        planId: PlanId;
        planName: string;
        planTagline: string;
        maxProjects: number;
        maxMembers: number;
        maxEventsPerMonth: number;
        retentionDays: number;
    };
};

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
}

export function OrganizationSettingsForm({ organization }: OrganizationSettingsFormProps) {
    const [name, setName] = useState(organization.name);
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateOrganizationSettings({ name });
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    }

    const isFree = organization.planId === "FREE";

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Info */}
            <div className="halo-card p-6 space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    General
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs font-medium text-white mb-1.5">
                            Organization Name
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
                            Organization Slug
                        </label>
                        <input
                            type="text"
                            value={organization.slug}
                            disabled
                            className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-muted font-mono cursor-not-allowed"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-white mb-1.5">
                        Organization ID
                    </label>
                    <input
                        type="text"
                        value={organization.id}
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-muted font-mono cursor-not-allowed"
                    />
                    <p className="text-xs text-secondary mt-1.5">
                        Use this ID when configuring SDK and API integrations.
                    </p>
                </div>
            </div>

            {/* Plan & Subscription */}
            <div className="halo-card p-6 space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Plan &amp; Subscription
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">
                                Halo {organization.planName}
                            </p>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                organization.planId === "FREE"
                                    ? "text-muted border-border bg-surface"
                                    : "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                            }`}>
                                {organization.planId === "FREE" ? "Free" : "Active"}
                            </span>
                        </div>
                        <p className="text-xs text-secondary">{organization.planTagline}</p>
                    </div>

                    {isFree && (
                        <Link href="/pricing" className="halo-btn halo-btn-primary flex-shrink-0">
                            <Zap size={13} />
                            Upgrade Plan
                        </Link>
                    )}
                    {!isFree && (
                        <Link href="/settings/billing" className="halo-btn halo-btn-secondary flex-shrink-0">
                            Manage Subscription
                        </Link>
                    )}
                </div>

                {/* Limits at a glance */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: "Projects", value: organization.maxProjects === 999 ? "Unlimited" : organization.maxProjects },
                        { label: "Members", value: organization.maxMembers === 999 ? "Unlimited" : organization.maxMembers },
                        { label: "Events / mo", value: fmt(organization.maxEventsPerMonth) },
                        { label: "Retention", value: `${organization.retentionDays}d` },
                    ].map(({ label, value }) => (
                        <div key={label} className="p-3 rounded-lg bg-surface border border-border text-center">
                            <p className="text-sm font-semibold text-white">{value}</p>
                            <p className="text-xs text-muted mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Save row */}
            <div className="flex items-center gap-3">
                <button type="submit" disabled={isSaving} className="halo-btn halo-btn-primary">
                    {isSaving ? (
                        <><Loader2 size={14} className="animate-spin" />Saving…</>
                    ) : (
                        <><Save size={14} />Save Organization</>
                    )}
                </button>
                {savedSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <Check size={14} /> Saved
                    </span>
                )}
            </div>
        </form>
    );
}
