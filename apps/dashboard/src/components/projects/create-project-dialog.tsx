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

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="halo-btn halo-btn-primary"
            >
                <Plus size={15} />
                New Project
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Project</DialogTitle>
                        <DialogDescription>
                            Create a new application to capture errors, traces, and automated root cause analysis.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
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
                            disabled={!projectName.trim() || isCreating}
                            className="halo-btn halo-btn-primary"
                            onClick={async () => {
                                setIsCreating(true);
                                try {
                                    await createProject(
                                        projectName.trim(),
                                        description.trim() || undefined
                                    );

                                    setOpen(false);
                                    setProjectName("");
                                    setDescription("");
                                    router.refresh();
                                } catch (err) {
                                    console.error(err);
                                } finally {
                                    setIsCreating(false);
                                }
                            }}
                        >
                            {isCreating ? "Creating…" : "Create Project"}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}