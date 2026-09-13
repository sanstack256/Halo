import React, { Component, type ComponentType } from "react";
import { useHalo } from "./context";

export function withHaloProfiler<P extends object>(
    WrappedComponent: ComponentType<P>,
    name: string = WrappedComponent.displayName || WrappedComponent.name || "Component"
): React.FC<P> {
    return function HaloProfiledComponent(props: P) {
        const halo = useHalo();
        const start = performance.now();

        React.useEffect(() => {
            const mountDuration = Math.round(performance.now() - start);
            if (halo) {
                halo.addBreadcrumb({
                    category: "performance",
                    message: `Component <${name}> mounted in ${mountDuration}ms`,
                    data: { component: name, durationMs: mountDuration },
                });
            }
        }, [halo]);

        return <WrappedComponent {...props} />;
    };
}
