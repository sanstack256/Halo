"use client";

import { useState } from "react";
import { createProject } from "@/actions/project";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function CreateProjectDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [description, setDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleCreate = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!projectName.trim() || isCreating) return;

        setIsCreating(true);
        setErrorMessage(null);

        try {
            const project = await createProject(
                projectName.trim(),
                description.trim() || undefined
            );

            setOpen(false);
            setProjectName("");
            setDescription("");
            router.push(`/projects/${project.id}`);
            router.refresh();
        } catch (err) {
            console.error("Failed to create project:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to create project. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setErrorMessage(null);
                    setOpen(true);
                }}
                className="halo-btn halo-btn-primary"
            >
                <Plus size={15} />
                New Project
            </button>

            <Dialog open={open} onOpenChange={(val) => {
                setOpen(val);
                if (!val) setErrorMessage(null);
            }}>
                <DialogContent className="max-w-lg">
                    <form onSubmit={handleCreate}>
                        <DialogHeader>
                            <DialogTitle>Create Project</DialogTitle>
                            <DialogDescription>
                                Create a new application to capture errors, traces, and automated root cause analysis.
                            </DialogDescription>
                        </DialogHeader>

                        {errorMessage && (
                            <div className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-red-300">
                                {errorMessage}
                            </div>
                        )}

                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="project-name"
                                    className="block text-xs font-medium text-white"
                                >
                                    Project Name <span className="text-error">*</span>
                                </label>

                                <input
                                    id="project-name"
                                    type="text"
                                    placeholder="e.g. payment-service"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="w-full rounded-lg border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm text-white placeholder:text-muted outline-none transition focus:border-accent"
                                    autoFocus
                                    disabled={isCreating}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label
                                    htmlFor="description"
                                    className="block text-xs font-medium text-white"
                                >
                                    Description <span className="text-secondary font-normal">(optional)</span>
                                </label>

                                <textarea
                                    id="description"
                                    rows={3}
                                    placeholder="Brief overview of this service..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full resize-none rounded-lg border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm text-white placeholder:text-muted outline-none transition focus:border-accent"
                                    disabled={isCreating}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                className="halo-btn halo-btn-secondary"
                                onClick={() => setOpen(false)}
                                disabled={isCreating}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={!projectName.trim() || isCreating}
                                className="halo-btn halo-btn-primary"
                            >
                                {isCreating ? "Creating…" : "Create Project"}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}