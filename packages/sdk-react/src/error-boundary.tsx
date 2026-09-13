import React, { Component, type ReactNode, type ErrorInfo } from "react";
import type { BrowserClient } from "@halo-trace/sdk-browser";

export interface HaloErrorBoundaryProps {
    client?: BrowserClient;
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class HaloErrorBoundary extends Component<HaloErrorBoundaryProps, State> {
    constructor(props: HaloErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        const client = this.props.client || (typeof window !== "undefined" ? (window as any).__HALO_SDK__ : undefined);

        if (client && typeof client.captureException === "function") {
            client.captureException(error, {
                metadata: {
                    componentStack: errorInfo.componentStack,
                    framework: "react",
                },
                tags: {
                    errorSource: "react.error_boundary",
                },
            });
        }

        if (typeof this.props.onError === "function") {
            this.props.onError(error, errorInfo);
        }
    }

    reset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    override render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            if (typeof this.props.fallback === "function") {
                return this.props.fallback(this.state.error, this.reset);
            }
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#e11d48" }}>
                    <h2>An application error occurred</h2>
                    <p style={{ fontSize: 14, color: "#666" }}>{this.state.error.message}</p>
                    <button
                        onClick={this.reset}
                        style={{
                            padding: "8px 16px",
                            background: "#0f172a",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
