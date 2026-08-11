export interface HaloRequestContext {
    requestId: string;

    traceId: string;

    method?: string;

    url?: string;

    resource?: string;

    startedAt?: number;
}

let currentContext:
    | HaloRequestContext
    | undefined;

export function createRequestContext(
    values?: Partial<HaloRequestContext>,
): HaloRequestContext {
    return {
        requestId:
            values?.requestId ??
            createId("req"),

        traceId:
            values?.traceId ??
            createId("trace"),

        method:
            values?.method,

        url:
            values?.url,

        resource:
            values?.resource,

        startedAt:
            values?.startedAt ??
            Date.now(),
    };
}

export function getRequestContext():
    | HaloRequestContext
    | undefined {
    return currentContext;
}

export async function runWithRequestContext<T>(
    context: HaloRequestContext,
    callback: () => Promise<T>,
): Promise<T> {
    const previous =
        currentContext;

    currentContext = context;

    try {
        return await callback();
    } finally {
        currentContext =
            previous;
    }
}

function createId(
    prefix: string,
): string {
    return `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 12)}`;
}