"use client";

import { useState } from "react";
import { Users, UserPlus, Shield, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { addOrganizationMember, removeOrganizationMember, updateMemberRole, type OrgMemberView } from "@/actions/organization-members";
import { OrganizationRole } from "@/generated/prisma/client";

export function MembersClient({
    initialMembers,
    currentCount,
    maxAllowed,
    currentPlan,
}: {
    initialMembers: OrgMemberView[];
    currentCount: number;
    maxAllowed: number | null;
    currentPlan: string;
}) {
    const [members, setMembers] = useState<OrgMemberView[]>(initialMembers);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<OrganizationRole>(OrganizationRole.MEMBER);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const isAtLimit = maxAllowed !== null && currentCount >= maxAllowed;

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim()) return;

        setIsSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            await addOrganizationMember(email.trim(), role);
            setSuccess(`Member ${email} added successfully.`);
            setEmail("");
            window.location.reload();
        } catch (err: any) {
            setError(err.message || "Failed to invite member");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleRoleChange(memberId: string, newRole: OrganizationRole) {
        try {
            await updateMemberRole(memberId, newRole);
            setMembers((prev) =>
                prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
            );
        } catch (err: any) {
            alert(err.message || "Failed to update role");
        }
    }

    async function handleRemove(memberId: string, memberEmail: string) {
        if (!confirm(`Are you sure you want to remove ${memberEmail} from the organization?`)) return;

        try {
            await removeOrganizationMember(memberId);
            setMembers((prev) => prev.filter((m) => m.id !== memberId));
        } catch (err: any) {
            alert(err.message || "Failed to remove member");
        }
    }

    return (
        <div className="space-y-8">
            {/* Capacity Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#121316] border border-[#27272a] rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-400 font-medium">Team Seats</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {currentCount} <span className="text-zinc-500 text-sm font-normal">/ {maxAllowed ?? "Unlimited"}</span>
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-300">
                        <Users size={18} />
                    </div>
                </div>

                <div className="bg-[#121316] border border-[#27272a] rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-400 font-medium">Plan Tier</p>
                        <p className="text-xl font-semibold text-emerald-400 mt-1 capitalize">{currentPlan.toLowerCase()} Plan</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                        <Shield size={18} />
                    </div>
                </div>

                <div className="bg-[#121316] border border-[#27272a] rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-400 font-medium">Active Seats</p>
                        <p className="text-2xl font-bold text-white mt-1">{members.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                        <UserPlus size={18} />
                    </div>
                </div>
            </div>

            {/* Invite Form or Upgrade Notice */}
            {isAtLimit ? (
                <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-5 flex items-start gap-4">
                    <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-amber-200">Seat Limit Reached ({maxAllowed} seats)</h4>
                        <p className="text-xs text-amber-300/80 leading-relaxed">
                            Your organization has reached the maximum of {maxAllowed} member{maxAllowed === 1 ? "" : "s"} allowed on the {currentPlan} plan. Upgrade to the Team plan to expand seat capacity up to 10 members.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-[#121316] border border-[#27272a] rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-white mb-1">Add Team Member</h3>
                    <p className="text-xs text-zinc-400 mb-4">Grant an engineer access to this organization and its projects.</p>

                    <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="email"
                            placeholder="engineer@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as OrganizationRole)}
                            className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                        >
                            <option value={OrganizationRole.MEMBER}>Member (Standard Access)</option>
                            <option value={OrganizationRole.ADMIN}>Admin (Manage Members & Settings)</option>
                        </select>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <UserPlus size={14} />
                            {isSubmitting ? "Adding..." : "Add Member"}
                        </button>
                    </form>

                    {error && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                            <CheckCircle2 size={14} />
                            <span>{success}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Members Table */}
            <div className="bg-[#121316] border border-[#27272a] rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[#27272a]">
                    <h3 className="text-sm font-semibold text-white">Organization Members</h3>
                </div>

                <div className="divide-y divide-[#27272a]">
                    {members.map((m) => (
                        <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-semibold text-xs text-zinc-300">
                                    {(m.name || m.email).slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white">{m.name}</p>
                                        {m.isOwner && (
                                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                                                Owner
                                            </span>
                                        )}
                                        <span className="text-[10px] font-mono text-zinc-500">
                                            {m.status.toLowerCase()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400">{m.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {m.isOwner ? (
                                    <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                                        OWNER
                                    </span>
                                ) : (
                                    <select
                                        value={m.role}
                                        onChange={(e) => handleRoleChange(m.id, e.target.value as OrganizationRole)}
                                        className="bg-zinc-900 border border-zinc-800 text-xs font-mono rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-zinc-700"
                                    >
                                        <option value={OrganizationRole.MEMBER}>MEMBER</option>
                                        <option value={OrganizationRole.ADMIN}>ADMIN</option>
                                    </select>
                                )}

                                {!m.isOwner && (
                                    <button
                                        onClick={() => handleRemove(m.id, m.email)}
                                        className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5 rounded hover:bg-rose-950/20"
                                        title="Remove member"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
