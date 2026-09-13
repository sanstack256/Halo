import React, { createContext, useContext, type ReactNode } from "react";
import type { BrowserClient } from "@halo-trace/sdk-browser";

const HaloContext = createContext<BrowserClient | null>(null);

export interface HaloProviderProps {
    client: BrowserClient;
    children: ReactNode;
}

export const HaloProvider: React.FC<HaloProviderProps> = ({ client, children }) => {
    return <HaloContext.Provider value={client}>{children}</HaloContext.Provider>;
};

export function useHalo(): BrowserClient | null {
    const ctx = useContext(HaloContext);
    if (ctx) return ctx;
    if (typeof window !== "undefined" && (window as any).__HALO_SDK__) {
        return (window as any).__HALO_SDK__;
    }
    return null;
}
