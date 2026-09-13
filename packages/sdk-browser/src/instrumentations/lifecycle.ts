import type { CoreClient } from "@halo-trace/sdk-core";

export function registerLifecycleInstrumentation(client: CoreClient): () => void {
    if (typeof window === "undefined" || typeof document === "undefined") return () => {};

    const onVisibilityChange = () => {
        const state = document.visibilityState;
        client.addBreadcrumb({
            category: "lifecycle",
            message: `Visibility changed to ${state}`,
            data: { state },
        });

        if (state === "hidden") {
            void client.flush();
        }
    };

    const onPageHide = (e: PageTransitionEvent) => {
        client.addBreadcrumb({
            category: "lifecycle",
            message: `Page hide (persisted: ${e.persisted})`,
            data: { persisted: e.persisted },
        });
        void client.flush();
    };

    const onBeforeUnload = () => {
        void client.flush();
    };

    const onFreeze = () => {
        client.addBreadcrumb({
            category: "lifecycle",
            message: "Lifecycle state: frozen (bfcache)",
        });
        void client.flush();
    };

    const onResume = () => {
        client.addBreadcrumb({
            category: "lifecycle",
            message: "Lifecycle state: resumed",
        });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("freeze", onFreeze as any);
    document.addEventListener("resume", onResume as any);

    return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("beforeunload", onBeforeUnload);
        document.removeEventListener("freeze", onFreeze as any);
        document.removeEventListener("resume", onResume as any);
    };
}
