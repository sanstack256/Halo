import type { CoreClient } from "@halo-trace/sdk-core";

export function registerProcessInstrumentation(client: CoreClient, exitOnUncaught: boolean = false): () => void {
    if (typeof process === "undefined" || typeof process.on !== "function") return () => {};

    const onUncaughtException = async (error: Error) => {
        try {
            client.captureException(error, {
                severity: "FATAL",
                metadata: { fatal: true, uncaughtException: true },
            });
            await client.flush();
        } catch {
            // Safety
        } finally {
            if (exitOnUncaught) {
                process.exit(1);
            }
        }
    };

    const onUnhandledRejection = async (reason: unknown) => {
        try {
            const err = reason instanceof Error ? reason : new Error(String(reason));
            client.captureException(err, {
                severity: "ERROR",
                metadata: { unhandledRejection: true },
            });
            await client.flush();
        } catch {
            // Safety
        }
    };

    const onBeforeExit = async () => {
        try {
            await client.flush();
        } catch {
            // ignore
        }
    };

    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);
    process.on("beforeExit", onBeforeExit);

    return () => {
        process.removeListener("uncaughtException", onUncaughtException);
        process.removeListener("unhandledRejection", onUnhandledRejection);
        process.removeListener("beforeExit", onBeforeExit);
    };
}
