"use client";

import React, { useState } from "react";
import { Plus, BellRing, X } from "lucide-react";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { useRouter } from "next/navigation";
import type { MonitorType } from "@/generated/prisma/client";

interface ProjectOption {
    id: string;
    name: string;
}

interface CreateMonitorDialogProps {
    projects: ProjectOption[];
    selectedProjectId?: string;
    initialType?: MonitorType;
    trigger?: React.ReactNode;
    onCreated?: () => void;
}

export function CreateMonitorDialog({
    projects,
    selectedProjectId,
    initialType,
    trigger,
    onCreated,
}: CreateMonitorDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const handleOpen = () => {
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSuccess = () => {
        setIsOpen(false);
        router.refresh();
        if (onCreated) onCreated();
    };

    return (
        <>
            {trigger ? (
                <div onClick={handleOpen} className="cursor-pointer inline-flex">
                    {trigger}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleOpen}
                    className="halo-btn halo-btn-primary halo-btn-sm"
                >
                    <Plus size={14} />
                    <span>Create Monitor</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150">
                    <div
                        className="relative w-full max-w-2xl rounded-2xl bg-[#0b0f16] border border-[#222b38] p-6 space-y-6 text-xs font-mono max-h-[90vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                                    <BellRing size={16} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                        Configure New Monitor
                                    </h2>
                                    <p className="text-[11px] text-zinc-400 font-sans">
                                        Continuous alert evaluation against real telemetry and thresholds.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="text-zinc-500 hover:text-white p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Embedded Reusable Form */}
                        <MonitorForm
                            projects={projects}
                            initialProjectId={selectedProjectId}
                            initialType={initialType}
                            isModal={true}
                            onSuccess={handleSuccess}
                            onCancel={handleClose}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
