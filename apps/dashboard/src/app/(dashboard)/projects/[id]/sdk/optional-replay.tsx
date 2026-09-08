"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CodeSnippet } from "./code-snippet";

export function OptionalReplaySection() {
    const [isOpen, setIsOpen] = useState(false);

    const replayInitCode = `import { HaloReplay } from "@halo-trace/replay";

const replay = new HaloReplay();
replay.start();`;

    return (
        <div className="pt-2">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className="flex items-center gap-2 text-sm font-medium text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
                <span>Optional: Browser replay</span>
                <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {isOpen && (
                <div className="mt-3 space-y-4 rounded-lg border border-border/70 bg-surface/50 p-5">
                    <p className="text-sm text-secondary leading-normal">
                        Capture the browser session leading up to a frontend error.
                    </p>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                            Install
                        </span>
                        <CodeSnippet
                            code="pnpm add @halo-trace/replay"
                            language="bash"
                        />
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                            Initialize
                        </span>
                        <CodeSnippet
                            code={replayInitCode}
                            language="typescript"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
