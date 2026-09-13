import type { CoreClient } from "@halo-trace/sdk-core";

export function registerErrorInstrumentation(
    client: CoreClient,
    onFatalError?: (err: Error) => void
): () => void {
    if (typeof window === "undefined") return () => {};

    let inErrorHandler = false;

    const errorHandler = (
        event: ErrorEvent | Event
    ): void => {
        if (inErrorHandler) return;
        inErrorHandler = true;

        try {
            if ("error" in event && event.error) {
                const err = event.error instanceof Error ? event.error : new Error(String(event.error));
                client.captureException(err, {
                    metadata: {
                        filename: (event as ErrorEvent).filename,
                        lineno: (event as ErrorEvent).lineno,
                        colno: (event as ErrorEvent).colno,
                    },
                });
                onFatalError?.(err);
            } else if ("target" in event && event.target && (event.target as any).tagName) {
                // Resource loading error (script, link, img)
                const target = event.target as HTMLElement;
                const src = target.getAttribute("src") || target.getAttribute("href") || "";
                client.captureException(new Error(`Failed to load resource: <${target.tagName.toLowerCase()}> ${src}`), {
                    severity: "WARNING",
                    metadata: {
                        resource: src,
                        tagName: target.tagName.toLowerCase(),
                    },
                });
            } else if ("message" in event) {
                client.captureException(new Error((event as ErrorEvent).message));
            }
        } catch {
            // Safety: never break application execution
        } finally {
            inErrorHandler = false;
        }
    };

    const rejectionHandler = (event: PromiseRejectionEvent): void => {
        if (inErrorHandler) return;
        inErrorHandler = true;

        try {
            const reason = event.reason;
            const err = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : "Unhandled Promise Rejection");
            client.captureException(err, {
                metadata: {
                    unhandledRejection: true,
                },
            });
            onFatalError?.(err);
        } catch {
            // Safety
        } finally {
            inErrorHandler = false;
        }
    };

    window.addEventListener("error", errorHandler, true);
    window.addEventListener("unhandledrejection", rejectionHandler);

    return () => {
        window.removeEventListener("error", errorHandler, true);
        window.removeEventListener("unhandledrejection", rejectionHandler);
    };
}
