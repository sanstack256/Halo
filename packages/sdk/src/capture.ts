import type { Halo } from "./halo";

export function registerGlobalHandlers(
    halo: Halo
) {
    // Node.js
    if (
        typeof process !== "undefined" &&
        typeof process.on === "function"
    ) {
        process.on(
            "uncaughtException",
            async (error) => {
                try {
                    await halo.captureException(error);
                    await halo.flush();
                } finally {
                    process.exit(1);
                }
            }
        );

        process.on(
            "unhandledRejection",
            async (reason) => {
                try {
                    await halo.captureException(reason);
                    await halo.flush();
                } finally {
                    process.exit(1);
                }
            }
        );
    }

    // Browser
    if (typeof window !== "undefined") {
        window.addEventListener(
            "error",
            (event) => {
                void halo.captureException(
                    event.error ?? event.message
                );
            }
        );

        window.addEventListener(
            "unhandledrejection",
            (event) => {
                void halo.captureException(
                    event.reason
                );
            }
        );
    }
}