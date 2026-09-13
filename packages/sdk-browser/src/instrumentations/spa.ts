import type { CoreClient } from "@halo-trace/sdk-core";
import { sanitizeUrl } from "@halo-trace/sdk-core";

export function registerSpaInstrumentation(client: CoreClient): () => void {
    if (typeof window === "undefined" || !window.history) return () => {};

    let currentUrl = sanitizeUrl(window.location.href);

    const recordNavigation = (toUrl: string, type: "pushState" | "replaceState" | "popstate" | "hashchange") => {
        const sanitizedTo = sanitizeUrl(toUrl);
        if (sanitizedTo === currentUrl) return;

        const from = currentUrl;
        currentUrl = sanitizedTo;

        client.addBreadcrumb({
            category: "navigation",
            message: `Navigated from ${from} to ${sanitizedTo}`,
            data: {
                from,
                to: sanitizedTo,
                type,
            },
        });
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args: any[]) {
        const res = originalPushState.apply(this, args as any);
        try {
            const url = args[2] ? String(args[2]) : window.location.href;
            recordNavigation(url, "pushState");
        } catch {
            // ignore
        }
        return res;
    };

    window.history.replaceState = function (...args: any[]) {
        const res = originalReplaceState.apply(this, args as any);
        try {
            const url = args[2] ? String(args[2]) : window.location.href;
            recordNavigation(url, "replaceState");
        } catch {
            // ignore
        }
        return res;
    };

    const onPopState = () => recordNavigation(window.location.href, "popstate");
    const onHashChange = () => recordNavigation(window.location.href, "hashchange");

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);

    return () => {
        window.history.pushState = originalPushState;
        window.history.replaceState = originalReplaceState;
        window.removeEventListener("popstate", onPopState);
        window.removeEventListener("hashchange", onHashChange);
    };
}
