import type { CoreClient } from "@halo-trace/sdk-core";
import { safeSerialize } from "@halo-trace/sdk-core";

const CONSOLE_LEVELS = ["log", "info", "warn", "error", "debug"] as const;

export function registerConsoleInstrumentation(client: CoreClient): () => void {
    if (typeof console === "undefined") return () => {};

    const originals: Partial<Record<(typeof CONSOLE_LEVELS)[number], any>> = {};
    let isInternal = false;

    for (const level of CONSOLE_LEVELS) {
        if (typeof console[level] === "function") {
            originals[level] = console[level];
            console[level] = function (...args: any[]) {
                // Call native first to preserve developer experience
                try {
                    originals[level]!.apply(console, args);
                } catch {
                    // ignore
                }

                if (isInternal) return;
                isInternal = true;

                try {
                    const message = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(safeSerialize(arg, 2, 200, 10)))).join(" ");
                    const safeArgs = args.map((arg) => safeSerialize(arg, 3, 500, 20));

                    client.addBreadcrumb({
                        category: "console",
                        message: message.slice(0, 1000),
                        level: level === "error" ? "ERROR" : level === "warn" ? "WARNING" : "INFO",
                        data: {
                            level,
                            arguments: safeArgs,
                        },
                    });
                } catch {
                    // Safe guard
                } finally {
                    isInternal = false;
                }
            };
        }
    }

    return () => {
        for (const [level, fn] of Object.entries(originals)) {
            (console as any)[level] = fn;
        }
    };
}
