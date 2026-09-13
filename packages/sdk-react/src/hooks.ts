import { useEffect } from "react";
import type { HaloUser } from "@halo-trace/sdk-types";
import { useHalo } from "./context";

export function useHaloUser(user?: HaloUser): void {
    const halo = useHalo();
    useEffect(() => {
        if (!halo || !user) return;
        halo.setUser(user);
    }, [halo, user]);
}

export function useHaloBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    const halo = useHalo();
    useEffect(() => {
        if (!halo) return;
        halo.addBreadcrumb({
            category,
            message,
            data,
        });
    }, [halo, category, message, data]);
}
