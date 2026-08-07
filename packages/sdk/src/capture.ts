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
            (error) => {
                void halo.captureException(error);
            }
        );

        process.on(
            "unhandledRejection",
            (reason) => {
                void halo.captureException(reason);
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