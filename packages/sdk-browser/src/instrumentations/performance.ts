import type { CoreClient } from "@halo-trace/sdk-core";

export function registerPerformanceInstrumentation(client: CoreClient): () => void {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
        return () => {};
    }

    const observers: PerformanceObserver[] = [];

    const safeObserve = (type: string, callback: (entries: PerformanceEntryList) => void) => {
        try {
            if (PerformanceObserver.supportedEntryTypes && !PerformanceObserver.supportedEntryTypes.includes(type)) {
                return;
            }
            const observer = new PerformanceObserver((list) => {
                callback(list.getEntries());
            });
            observer.observe({ type, buffered: true } as any);
            observers.push(observer);
        } catch {
            // Feature not supported in this browser version
        }
    };

    // 1. Paint timing (FCP)
    safeObserve("paint", (entries) => {
        for (const entry of entries) {
            if (entry.name === "first-contentful-paint") {
                client.addBreadcrumb({
                    category: "performance",
                    message: `First Contentful Paint: ${Math.round(entry.startTime)}ms`,
                    data: { fcpMs: Math.round(entry.startTime) },
                });
            }
        }
    });

    // 2. Largest Contentful Paint (LCP)
    safeObserve("largest-contentful-paint", (entries) => {
        const last = entries[entries.length - 1];
        if (last) {
            client.addBreadcrumb({
                category: "performance",
                message: `Largest Contentful Paint: ${Math.round(last.startTime)}ms`,
                data: { lcpMs: Math.round(last.startTime) },
            });
        }
    });

    // 3. Long Tasks (>50ms)
    safeObserve("longtask", (entries) => {
        for (const entry of entries) {
            if (entry.duration >= 100) {
                client.addBreadcrumb({
                    category: "performance",
                    message: `Long task blocking main thread: ${Math.round(entry.duration)}ms`,
                    level: "WARNING",
                    data: { durationMs: Math.round(entry.duration), startTime: Math.round(entry.startTime) },
                });
            }
        }
    });

    // 4. Cumulative Layout Shift (CLS)
    let clsValue = 0;
    safeObserve("layout-shift", (entries) => {
        for (const entry of entries) {
            if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
            }
        }
        if (clsValue > 0.1) {
            client.addBreadcrumb({
                category: "performance",
                message: `Cumulative Layout Shift: ${clsValue.toFixed(3)}`,
                data: { cls: clsValue },
            });
        }
    });

    return () => {
        for (const obs of observers) {
            try {
                obs.disconnect();
            } catch {
                // ignore
            }
        }
    };
}
