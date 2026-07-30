"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function CreateProjectDialog() {
    const [open, setOpen] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [description, setDescription] = useState("");

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                New Project
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Project</DialogTitle>

                        <DialogDescription>
                            Create a new application that will send telemetry to Halo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                        <div className="space-y-2">
                            <label
                                htmlFor="project-name"
                                className="text-sm font-medium text-zinc-200"
                            >
                                Project Name
                            </label>

                            <input
                                id="project-name"
                                type="text"
                                placeholder="e.g. halo-api"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-400"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="description"
                                className="text-sm font-medium text-zinc-200"
                            >
                                Description
                                <span className="ml-1 text-zinc-500">(optional)</span>
                            </label>

                            <textarea
                                id="description"
                                rows={4}
                                placeholder="Short description about this project..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-400"
                            />
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            disabled={!projectName.trim()}
                        >
                            Create Project
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}