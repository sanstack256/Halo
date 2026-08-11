import type { Halo } from "./halo";

import {
    createRequestContext,
    runWithRequestContext,
} from "./request-context";

let installed = false;

export interface HttpInstrumentationOptions {
    endpoint: string;

    captureHeaders?: boolean;

    ignoreUrls?: string[];
}

export function registerHttpInstrumentation(
    halo: Halo,
    options: HttpInstrumentationOptions,
) {
    if (installed) {
        return;
    }

    if (
        typeof globalThis.fetch !==
        "function"
    ) {
        return;
    }

    const originalFetch =
        globalThis.fetch.bind(
            globalThis,
        );

    const endpoint =
        normalizeEndpoint(
            options.endpoint,
        );

    globalThis.fetch = async (
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> => {
        const url =
            getRequestUrl(input);

        /*
         * Never instrument Halo's
         * own ingestion requests.
         */
        if (
            shouldIgnore(
                url,
                endpoint,
                options.ignoreUrls,
            )
        ) {
            return originalFetch(
                input,
                init,
            );
        }

        const method =
            getRequestMethod(
                input,
                init,
            );

        const resource =
            getResource(url);

        /*
         * One context per request.
         *
         * requestId and traceId
         * therefore belong to the
         * same HTTP operation.
         */
        const requestContext =
            createRequestContext({
                method,
                url,
                resource,
            });

        return runWithRequestContext(
            requestContext,
            async () => {
                const startedAt =
                    performanceNow();

                const {
                    requestId,
                    traceId,
                } = requestContext;

                /*
                 * Request started.
                 */
                halo.addBreadcrumb({
                    category: "http",

                    message:
                        `${method} ${resource}`,

                    data: {
                        requestId,
                        traceId,
                        method,
                        resource,
                    },
                });

                try {
                    const response =
                        await originalFetch(
                            input,
                            init,
                        );

                    const durationMs =
                        Math.max(
                            0,
                            Math.round(
                                performanceNow() -
                                    startedAt,
                            ),
                        );

                    /*
                     * Automatically record
                     * the HTTP operation.
                     */
                    void halo
                        .capturePerformance({
                            title:
                                `${method} ${resource}`,

                            durationMs,

                            operation:
                                method,

                            resource,

                            status:
                                response.status,

                            requestId,

                            traceId,

                            metadata: {
                                http: {
                                    method,

                                    status:
                                        response.status,

                                    ok:
                                        response.ok,

                                    failed:
                                        response.status >=
                                        400,

                                    url,

                                    ...(options.captureHeaders
                                        ? {
                                              headers:
                                                  getSafeResponseHeaders(
                                                      response.headers,
                                                  ),
                                          }
                                        : {}),
                                },
                            },
                        })
                        .catch(() => {
                            /*
                             * Telemetry must
                             * never break the
                             * application.
                             */
                        });

                    /*
                     * Request completed.
                     */
                    halo.addBreadcrumb({
                        category: "http",

                        message:
                            `${method} ${resource} → ${response.status}`,

                        data: {
                            requestId,
                            traceId,
                            method,
                            resource,
                            status:
                                response.status,
                            durationMs,
                        },
                    });

                    /*
                     * Preserve the original
                     * fetch response.
                     */
                    return response;
                } catch (error) {
                    const durationMs =
                        Math.max(
                            0,
                            Math.round(
                                performanceNow() -
                                    startedAt,
                            ),
                        );

                    /*
                     * Network-level failure.
                     */
                    void halo
                        .capturePerformance({
                            title:
                                `${method} ${resource}`,

                            durationMs,

                            operation:
                                method,

                            resource,

                            status:
                                "ERROR",

                            requestId,

                            traceId,

                            metadata: {
                                http: {
                                    method,

                                    url,

                                    failed: true,

                                    error:
                                        normalizeError(
                                            error,
                                        ),

                                    ...(options.captureHeaders
                                        ? {
                                              requestHeaders:
                                                  getSafeRequestHeaders(
                                                      input,
                                                      init,
                                                  ),
                                          }
                                        : {}),
                                },
                            },
                        })
                        .catch(() => {});

                    halo.addBreadcrumb({
                        category: "http",

                        message:
                            `${method} ${resource} → network error`,

                        data: {
                            requestId,
                            traceId,
                            method,
                            resource,
                            durationMs,
                        },
                    });

                    /*
                     * Do not swallow the
                     * application's error.
                     */
                    throw error;
                }
            },
        );
    };

    installed = true;
}

/*
 * ==================================================
 * URL
 * ==================================================
 */

function getRequestUrl(
    input: RequestInfo | URL,
): string {
    if (
        typeof input === "string"
    ) {
        return input;
    }

    if (
        input instanceof URL
    ) {
        return input.toString();
    }

    return input.url;
}

/*
 * ==================================================
 * METHOD
 * ==================================================
 */

function getRequestMethod(
    input: RequestInfo | URL,
    init?: RequestInit,
): string {
    const method =
        init?.method ??
        (
            typeof input === "string" ||
            input instanceof URL
                ? "GET"
                : input.method
        ) ??
        "GET";

    return method.toUpperCase();
}

/*
 * ==================================================
 * RESOURCE
 * ==================================================
 */

function getResource(
    url: string,
): string {
    try {
        const parsed =
            new URL(
                url,
                "http://localhost",
            );

        return parsed.pathname;
    } catch {
        return url;
    }
}

/*
 * ==================================================
 * IGNORE
 * ==================================================
 */

function normalizeEndpoint(
    endpoint: string,
): string {
    return endpoint.replace(
        /\/+$/,
        "",
    );
}

function shouldIgnore(
    url: string,
    endpoint: string,
    ignoreUrls:
        | string[]
        | undefined,
): boolean {
    /*
     * Never instrument Halo's
     * own ingestion endpoint.
     */
    if (
        url === endpoint ||
        url.startsWith(
            `${endpoint}/`,
        )
    ) {
        return true;
    }

    /*
     * Additional user-defined
     * exclusions.
     */
    return (
        ignoreUrls?.some(
            ignored =>
                ignored.length > 0 &&
                url.includes(ignored),
        ) ?? false
    );
}

/*
 * ==================================================
 * PERFORMANCE
 * ==================================================
 */

function performanceNow(): number {
    if (
        typeof performance !==
        "undefined"
    ) {
        return performance.now();
    }

    return Date.now();
}

/*
 * ==================================================
 * ERROR
 * ==================================================
 */

function normalizeError(
    error: unknown,
): Record<string, unknown> {
    if (
        error instanceof Error
    ) {
        return {
            name: error.name,

            message:
                error.message,
        };
    }

    return {
        message:
            String(error),
    };
}

/*
 * ==================================================
 * SAFE HEADERS
 * ==================================================
 */

const SAFE_HEADERS =
    new Set([
        "accept",
        "content-type",
        "content-length",
        "user-agent",
        "cache-control",
        "accept-language",
        "accept-encoding",
    ]);

function getSafeRequestHeaders(
    input: RequestInfo | URL,
    init?: RequestInit,
): Record<string, string> {
    const headers =
        new Headers();

    if (
        typeof input !== "string" &&
        !(input instanceof URL)
    ) {
        input.headers?.forEach(
            (value, key) => {
                headers.set(
                    key,
                    value,
                );
            },
        );
    }

    if (init?.headers) {
        new Headers(
            init.headers,
        ).forEach(
            (value, key) => {
                headers.set(
                    key,
                    value,
                );
            },
        );
    }

    return filterSafeHeaders(
        headers,
    );
}

function getSafeResponseHeaders(
    headers: Headers,
): Record<string, string> {
    return filterSafeHeaders(
        headers,
    );
}

function filterSafeHeaders(
    headers: Headers,
): Record<string, string> {
    const result: Record<
        string,
        string
    > = {};

    headers.forEach(
        (value, key) => {
            const normalized =
                key.toLowerCase();

            if (
                SAFE_HEADERS.has(
                    normalized,
                )
            ) {
                result[normalized] =
                    value;
            }
        },
    );

    return result;
}