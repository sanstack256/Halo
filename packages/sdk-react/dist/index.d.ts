import React, { Component, ReactNode, ErrorInfo, ComponentType } from 'react';
import { BrowserClient } from '@halo-trace/sdk-browser';
export * from '@halo-trace/sdk-browser';
import { HaloUser } from '@halo-trace/sdk-types';

interface HaloErrorBoundaryProps {
    client?: BrowserClient;
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    children?: ReactNode;
}
interface State {
    hasError: boolean;
    error: Error | null;
}
declare class HaloErrorBoundary extends Component<HaloErrorBoundaryProps, State> {
    constructor(props: HaloErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    reset: () => void;
    render(): ReactNode;
}

interface HaloProviderProps {
    client: BrowserClient;
    children: ReactNode;
}
declare const HaloProvider: React.FC<HaloProviderProps>;
declare function useHalo(): BrowserClient | null;

declare function useHaloUser(user?: HaloUser): void;
declare function useHaloBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void;

declare function withHaloProfiler<P extends object>(WrappedComponent: ComponentType<P>, name?: string): React.FC<P>;

export { HaloErrorBoundary, type HaloErrorBoundaryProps, HaloProvider, type HaloProviderProps, useHalo, useHaloBreadcrumb, useHaloUser, withHaloProfiler };
