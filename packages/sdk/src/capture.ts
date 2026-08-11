import type { Halo } from "./halo";

export function registerGlobalHandlers(
    halo: Halo,
) {
    /*
     * ==============================================
     * NODE.JS
     * ==============================================
     */

    if (
        typeof process !== "undefined" &&
        typeof process.on === "function"
    ) {
        process.on(
            "uncaughtException",
            async error => {
                try {
                    await halo.captureException(
                        error,
                    );

                    await halo.flush();
                } finally {
                    process.exit(1);
                }
            },
        );

        process.on(
            "unhandledRejection",
            async reason => {
                try {
                    await halo.captureException(
                        reason,
                    );

                    await halo.flush();
                } finally {
                    process.exit(1);
                }
            },
        );
    }

    /*
     * ==============================================
     * BROWSER
     * ==============================================
     */

    if (
        typeof window !==
        "undefined"
    ) {
        window.addEventListener(
            "error",
            event => {
                void halo
                    .captureException(
                        event.error ??
                            event.message,
                    )
                    .catch(() => {});
            },
        );

        window.addEventListener(
            "unhandledrejection",
            event => {
                void halo
                    .captureException(
                        event.reason,
                    )
                    .catch(() => {});
            },
        );
    }
}