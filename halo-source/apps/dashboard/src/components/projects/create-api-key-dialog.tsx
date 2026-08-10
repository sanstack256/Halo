"use client";

import { useState } from "react";

import { createApiKey } from "@/actions/api-key";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type Props = {
    projectId: string;
};

export default function CreateApiKeyDialog({
    projectId,
}: Props) {
    const router = useRouter();

    const [open, setOpen] = useState(false);

    const [name, setName] = useState("");

    const [generatedKey, setGeneratedKey] = useState("");

    const [loading, setLoading] = useState(false);

    function resetDialog() {
    setGeneratedKey("");
    setName("");
    setOpen(false);

    router.refresh();
}


    async function handleCreate() {
        setLoading(true);

        try {
            const key = await createApiKey(projectId, name);

            setGeneratedKey(key);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Button
                onClick={() => {
                    setGeneratedKey("");
                    setName("");
                    setOpen(true);
                }}
            >
                Generate API Key
            </Button>

            <Dialog
                open={open}
                onOpenChange={setOpen}
            >
                <DialogContent className="max-w-xl">
                    {!generatedKey ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Generate API Key
                                </DialogTitle>

                                <DialogDescription>
                                    This key will be shown only once.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-2">
                                <label className="text-sm">
                                    Key Name
                                </label>

                                <input
                                    value={name}
                                    onChange={(e) =>
                                        setName(e.target.value)
                                    }
                                    placeholder="Production SDK"
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    disabled={!name || loading}
                                    onClick={handleCreate}
                                >
                                    Generate
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    API Key Created
                                </DialogTitle>

                                <DialogDescription>
                                    Copy it now. You won't be able to see it again.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="rounded-lg bg-zinc-950 p-4 font-mono break-all">
                                {generatedKey}
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        navigator.clipboard.writeText(generatedKey)
                                    }
                                >
                                    Copy
                                </Button>

                                <Button onClick={resetDialog}>
                                    Done
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}