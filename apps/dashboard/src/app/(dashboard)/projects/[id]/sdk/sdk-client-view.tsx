"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowRight,
    CheckCircle2,
    Clock,
    RefreshCw,
    Send,
    Shield,
    Terminal,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    AlertCircle,
    Activity,
    Layers,
    Cpu,
    Video,
    Share2,
    Lock,
    Eye,
    KeyRound,
} from "lucide-react";
import { HaloLogo } from "@/components/ui/halo-logo";
import { CodeSnippet } from "./code-snippet";
import { triggerSdkVerificationEvent, getProjectSdkStatus, type ProjectSdkStatus } from "@/actions/project-sdk";
import { SDK_PUBLIC_ENDPOINT } from "@/lib/sdk-config";

export type Platform = "browser" | "react" | "nextjs" | "node";
export type PackageManager = "pnpm" | "npm" | "yarn";

interface Props {
    project: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
    };
    initialStatus: ProjectSdkStatus;
}

export function SdkClientView({ project, initialStatus }: Props) {
    const [platform, setPlatform] = useState<Platform>("browser");
    const [pkgManager, setPkgManager] = useState<PackageManager>("pnpm");
    const [status, setStatus] = useState<ProjectSdkStatus>(initialStatus);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTriggeringTest, setIsTriggeringTest] = useState(false);
    const [replayConfigOpen, setReplayConfigOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({
        tracing: false,
        sampling: false,
        scope: false,
        transport: false,
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const apiKey = status.apiKeys[0]?.prefix
        ? `${status.apiKeys[0].prefix}_••••••••`
        : "hl_live_your_project_key";

    // Auto-poll status every 6 seconds if waiting for telemetry
    useEffect(() => {
        if (status.hasTelemetry && status.hasReplay) return;

        const interval = setInterval(async () => {
            try {
                const updated = await getProjectSdkStatus(project.id);
                setStatus(updated);
            } catch {
                // Ignore transient errors
            }
        }, 6000);

        return () => clearInterval(interval);
    }, [project.id, status.hasTelemetry, status.hasReplay]);

    async function handleRefreshStatus() {
        setIsRefreshing(true);
        try {
            const updated = await getProjectSdkStatus(project.id);
            setStatus(updated);
        } catch (err) {
            console.error("Failed to refresh SDK status:", err);
        } finally {
            setIsRefreshing(false);
        }
    }

    async function handleSendTestEvent() {
        setIsTriggeringTest(true);
        try {
            await triggerSdkVerificationEvent(project.id);
            const updated = await getProjectSdkStatus(project.id);
            setStatus(updated);
        } catch (err) {
            console.error("Failed to send test event:", err);
        } finally {
            setIsTriggeringTest(false);
        }
    }

    function toggleAdvanced(section: string) {
        setAdvancedOpen((prev) => ({ ...prev, [section]: !prev[section] }));
    }

    // Package installation commands
    const getInstallCommand = () => {
        const prefix = pkgManager === "yarn" ? "yarn add" : pkgManager === "npm" ? "npm install" : "pnpm add";
        switch (platform) {
            case "browser":
                return `${prefix} @halo-trace/sdk`;
            case "react":
                return `${prefix} @halo-trace/sdk @halo-trace/sdk-react`;
            case "nextjs":
                return `${prefix} @halo-trace/sdk @halo-trace/sdk-nextjs`;
            case "node":
                return `${prefix} @halo-trace/sdk @halo-trace/sdk-node`;
        }
    };

    // Environment variable instructions
    const getEnvSnippet = () => {
        if (platform === "browser" || platform === "react") {
            return `NEXT_PUBLIC_HALO_API_KEY=${apiKey}\nNEXT_PUBLIC_HALO_ENDPOINT=${SDK_PUBLIC_ENDPOINT}`;
        }
        return `HALO_API_KEY=${apiKey}\nHALO_ENDPOINT=${SDK_PUBLIC_ENDPOINT}`;
    };

    // Initialization code per platform
    const getInitSnippet = () => {
        switch (platform) {
            case "browser":
                return `import { Halo } from "@halo-trace/sdk";

// Initialize Halo client once at application startup
Halo.init({
  apiKey: process.env.NEXT_PUBLIC_HALO_API_KEY,
  endpoint: process.env.NEXT_PUBLIC_HALO_ENDPOINT,
  environment: "production",
  release: "v1.0.0",
  replay: {
    enabled: true,
    errorTriggered: true, // Only persists full replay on errors or investigation triggers
    sampleRate: 0.0,      // 0% normal-session persistence (evidence-triggered only)
  },
});`;

            case "react":
                return `import React from "react";
import { HaloProvider, HaloErrorBoundary } from "@halo-trace/sdk/react";

export function App() {
  return (
    <HaloProvider
      apiKey={process.env.NEXT_PUBLIC_HALO_API_KEY}
      endpoint={process.env.NEXT_PUBLIC_HALO_ENDPOINT}
      environment="production"
      release="v1.0.0"
      replay={{ enabled: true, errorTriggered: true, sampleRate: 0.0 }}
    >
      <HaloErrorBoundary fallback={<div className="error-view">Something went wrong</div>}>
        <MainApplication />
      </HaloErrorBoundary>
    </HaloProvider>
  );
}`;

            case "nextjs":
                return `// 1. Server Route Handler (app/api/checkout/route.ts)
import { withHaloRoute } from "@halo-trace/sdk/nextjs/server";

export const POST = withHaloRoute(async (req) => {
  // Automatically extracts W3C traceparent and traces backend execution
  const body = await req.json();
  return Response.json({ success: true });
});

// 2. Client Root Provider (app/providers.tsx)
"use client";
import { HaloProvider } from "@halo-trace/sdk/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HaloProvider
      apiKey={process.env.NEXT_PUBLIC_HALO_API_KEY}
      endpoint={process.env.NEXT_PUBLIC_HALO_ENDPOINT}
      replay={{ enabled: true, errorTriggered: true, sampleRate: 0.0 }}
    >
      {children}
    </HaloProvider>
  );
}`;

            case "node":
                return `import { NodeClient, runWithContext } from "@halo-trace/sdk/node";

const halo = new NodeClient({
  apiKey: process.env.HALO_API_KEY,
  endpoint: process.env.HALO_ENDPOINT,
  service: "checkout-worker",
  environment: "production",
});

// Request-scoped tracing via AsyncLocalStorage
await runWithContext({ traceId: "req_checkout_01" }, async () => {
  // Subsequent logs, HTTP calls, and exceptions inherit this trace context
  halo.captureMessage("Processing payment");
});`;
        }
    };

    return (
        <div className="w-full max-w-[920px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-12">
            {/* Top of Page — Heading & Context */}
            <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted mb-2">
                    <span>Projects</span>
                    <span>/</span>
                    <span className="text-secondary">{project.name}</span>
                    <span>/</span>
                    <span className="text-accent">SDK</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-primary">
                    Connect your application to Halo
                </h1>
                <p className="mt-2 text-sm sm:text-base text-secondary leading-relaxed">
                    Install the SDK to send runtime evidence from your application to this project.
                </p>

                {/* Technical Architecture Flow */}
                <div className="mt-6 rounded-xl border border-border bg-[#03060a] p-4 sm:p-5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-accent" />
                        <span>Unified Runtime Evidence Pipeline</span>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
                        <div className="flex-1 rounded-lg border border-border/80 bg-surface/80 p-3 text-center">
                            <span className="text-muted block text-[10px] uppercase">Origin</span>
                            <span className="text-primary font-medium mt-0.5 block">Application</span>
                        </div>

                        <div className="text-muted text-center font-sans hidden md:block">→</div>
                        <div className="text-muted text-center font-sans md:hidden">↓</div>

                        <div className="flex-1 rounded-lg border border-accent/30 bg-accent/5 p-3 text-center">
                            <span className="text-accent block text-[10px] uppercase">Telemetry</span>
                            <span className="text-[#5bbcff] font-semibold mt-0.5 block">Halo SDK</span>
                        </div>

                        <div className="text-muted text-center font-sans hidden md:block">→</div>
                        <div className="text-muted text-center font-sans md:hidden">↓</div>

                        <div className="flex-[1.5] rounded-lg border border-border/80 bg-surface/80 p-3 text-center">
                            <span className="text-muted block text-[10px] uppercase">Runtime Evidence</span>
                            <span className="text-secondary font-medium mt-0.5 block">
                                Errors · Traces · Requests · Replay · Context
                            </span>
                        </div>

                        <div className="text-muted text-center font-sans hidden md:block">→</div>
                        <div className="text-muted text-center font-sans md:hidden">↓</div>

                        <div className="flex-1 rounded-lg border border-[#35d08a]/30 bg-[#35d08a]/5 p-3 text-center">
                            <span className="text-[#35d08a] block text-[10px] uppercase">Resolution</span>
                            <span className="text-[#35d08a] font-medium mt-0.5 block">Investigation</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Selector */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Choose Your Platform
                    </span>
                    <span className="text-xs text-muted">
                        Tailored for implemented SDK packages
                    </span>
                </div>

                <div className="flex flex-wrap gap-2 p-1 rounded-lg border border-border bg-surface">
                    <button
                        type="button"
                        onClick={() => setPlatform("browser")}
                        className={`flex-1 min-w-[110px] py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-all text-center ${
                            platform === "browser"
                                ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                                : "text-secondary hover:text-primary hover:bg-surface-elevated"
                        }`}
                    >
                        Browser
                    </button>
                    <button
                        type="button"
                        onClick={() => setPlatform("react")}
                        className={`flex-1 min-w-[110px] py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-all text-center ${
                            platform === "react"
                                ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                                : "text-secondary hover:text-primary hover:bg-surface-elevated"
                        }`}
                    >
                        React
                    </button>
                    <button
                        type="button"
                        onClick={() => setPlatform("nextjs")}
                        className={`flex-1 min-w-[110px] py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-all text-center ${
                            platform === "nextjs"
                                ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                                : "text-secondary hover:text-primary hover:bg-surface-elevated"
                        }`}
                    >
                        Next.js
                    </button>
                    <button
                        type="button"
                        onClick={() => setPlatform("node")}
                        className={`flex-1 min-w-[110px] py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-all text-center ${
                            platform === "node"
                                ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                                : "text-secondary hover:text-primary hover:bg-surface-elevated"
                        }`}
                    >
                        Node.js
                    </button>
                    <div
                        className="flex-1 min-w-[130px] py-2 px-3 rounded-md text-xs sm:text-sm font-medium text-muted/60 text-center cursor-not-allowed border border-dashed border-border/60 flex items-center justify-center gap-1.5"
                        title="Mobile SDKs are actively in development"
                    >
                        <span>Mobile</span>
                        <span className="text-[10px] rounded bg-surface-raised px-1.5 py-0.5 text-muted">Soon</span>
                    </div>
                </div>
            </div>

            {/* Step 01: Install */}
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm font-semibold text-muted">01</span>
                        <div>
                            <h2 className="text-base font-semibold text-primary">Install</h2>
                            <p className="mt-0.5 text-sm text-secondary">
                                Add the Halo SDK package for your runtime.
                            </p>
                        </div>
                    </div>

                    {/* Package manager toggle */}
                    <div className="flex items-center rounded-md border border-border bg-surface p-0.5 text-xs font-mono">
                        <button
                            type="button"
                            onClick={() => setPkgManager("pnpm")}
                            className={`px-2.5 py-1 rounded transition-colors ${
                                pkgManager === "pnpm" ? "bg-surface-raised text-primary" : "text-muted hover:text-secondary"
                            }`}
                        >
                            pnpm
                        </button>
                        <button
                            type="button"
                            onClick={() => setPkgManager("npm")}
                            className={`px-2.5 py-1 rounded transition-colors ${
                                pkgManager === "npm" ? "bg-surface-raised text-primary" : "text-muted hover:text-secondary"
                            }`}
                        >
                            npm
                        </button>
                        <button
                            type="button"
                            onClick={() => setPkgManager("yarn")}
                            className={`px-2.5 py-1 rounded transition-colors ${
                                pkgManager === "yarn" ? "bg-surface-raised text-primary" : "text-muted hover:text-secondary"
                            }`}
                        >
                            yarn
                        </button>
                    </div>
                </div>

                <CodeSnippet
                    code={getInstallCommand()}
                    language="bash"
                    filename="Terminal"
                />

                {platform === "browser" && (
                    <p className="text-xs text-muted flex items-center gap-1.5">
                        <span className="text-secondary font-mono">CDN Alternative:</span>
                        <span>Load directly via script tag using <code className="text-primary font-mono text-[11px]">&lt;script src="https://cdn.halo.run/sdk/halo.global.js"&gt;</code></span>
                    </p>
                )}
            </div>

            {/* Step 02: Configure */}
            <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-muted">02</span>
                    <div>
                        <h2 className="text-base font-semibold text-primary">Configure</h2>
                        <p className="mt-0.5 text-sm text-secondary">
                            Store your project credential in your application&apos;s environment.
                        </p>
                    </div>
                </div>

                {!status.hasApiKey ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-sm">
                            <p className="font-medium text-amber-200">No active API key found for this project</p>
                            <p className="text-amber-200/70 text-xs">
                                Create an API key to authenticate runtime evidence from your application.
                            </p>
                            <Link
                                href={`/projects/${project.id}/api-keys`}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline mt-2"
                            >
                                <KeyRound className="h-3.5 w-3.5" />
                                <span>Generate an API Key in Project Settings →</span>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <CodeSnippet
                        code={getEnvSnippet()}
                        language="env"
                        filename=".env.production"
                    />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted border-l-2 border-border pl-3">
                    <p>
                        <strong className="text-secondary font-medium">Security note:</strong> Never commit secrets to source control. Browser keys authenticate ingestion exclusively for this project.
                    </p>
                    <Link
                        href={`/projects/${project.id}/api-keys`}
                        className="inline-flex items-center gap-1 text-accent hover:underline shrink-0"
                    >
                        <span>Manage Keys</span>
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            </div>

            {/* Step 03: Initialize */}
            <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-muted">03</span>
                    <div>
                        <h2 className="text-base font-semibold text-primary">Initialize</h2>
                        <p className="mt-0.5 text-sm text-secondary">
                            Create the Halo client once at application startup.
                        </p>
                    </div>
                </div>

                <CodeSnippet
                    code={getInitSnippet()}
                    language="typescript"
                    filename={
                        platform === "react" ? "src/App.tsx" : platform === "nextjs" ? "app/api/route.ts" : platform === "node" ? "src/server.ts" : "src/main.ts"
                    }
                />
            </div>

            {/* SDK Capabilities Grid */}
            <div className="space-y-4 pt-4 border-t border-border">
                <div>
                    <h3 className="text-base font-semibold text-primary">SDK Capabilities</h3>
                    <p className="mt-0.5 text-sm text-secondary">
                        Halo SDK captures unified runtime evidence across multiple telemetry surfaces.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Errors</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            Runtime exceptions with sourcemap stack traces, uncaught rejections, and context.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Tracing</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            W3C <code className="text-primary font-mono text-[11px]">traceparent</code> injection connecting frontend actions to backend spans.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
                            <Video className="h-3.5 w-3.5" />
                            <span>Session Replay</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            Temporal DOM mutation reconstruction with canvas, WebGL, and user feedback.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
                            <Cpu className="h-3.5 w-3.5" />
                            <span>Context</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            Correlate evidence by user identity, session state, release tag, and environment.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-secondary text-xs font-semibold uppercase tracking-wider">
                            <Activity className="h-3.5 w-3.5" />
                            <span>HTTP & Network</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            Safe fetch and XHR interception with duration, status codes, and failure metrics.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-secondary text-xs font-semibold uppercase tracking-wider">
                            <Terminal className="h-3.5 w-3.5" />
                            <span>Console Logs</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            Safe log, info, warn, and error capture with recursion loop guards.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-secondary text-xs font-semibold uppercase tracking-wider">
                            <Layers className="h-3.5 w-3.5" />
                            <span>SPA Navigation</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            Automatic pushState/popstate route changes and page lifecycle state transitions.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface p-3.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-secondary text-xs font-semibold uppercase tracking-wider">
                            <HaloLogo size={14} className="h-3.5 w-3.5" />
                            <span>Web Vitals</span>
                        </div>
                        <p className="text-xs text-secondary leading-normal">
                            FCP, LCP, CLS, and custom performance metrics measured via PerformanceObserver.
                        </p>
                    </div>
                </div>
            </div>

            {/* Session Replay (First-Class Module) */}
            <div className="space-y-4 rounded-xl border border-border bg-[#03060a] p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <Video className="h-4 w-4 text-accent" />
                        <h3 className="text-base font-semibold text-primary">Session Replay</h3>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-mono text-accent">
                            Evidence-Triggered
                        </span>
                    </div>
                    {status.hasReplay && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#35d08a]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{status.totalReplays} {status.totalReplays === 1 ? "Replay" : "Replays"} captured</span>
                        </span>
                    )}
                </div>

                <p className="text-sm text-secondary leading-relaxed">
                    Replay captures the browser context around events worth investigating. Halo observes lightweight runtime signals locally in a bounded buffer and persists replay evidence only when an error, interaction trigger, or configured sampling rule captures it.
                </p>

                <CodeSnippet
                    code={`// Enable evidence-triggered Session Replay in Halo options
replay: {
  enabled: true,
  errorTriggered: true,         // Retains events in local buffer, persists only on errors/triggers (default: true)
  sampleRate: 0.0,              // Normal-session sampling rate (default: 0.0 = zero normal persistence)
  preErrorBufferSeconds: 60,    // Local circular buffer retained in browser memory (default: 60s)
  postErrorDurationSeconds: 30, // Duration to continue capturing aftermath after trigger (default: 30s)
  recordCanvas: true,           // GPU-accelerated Canvas 2D & WebGL frame capture (optional)
}`}
                    language="typescript"
                    filename="Replay Configuration"
                />

                <button
                    type="button"
                    onClick={() => setReplayConfigOpen(!replayConfigOpen)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                    <span>{replayConfigOpen ? "Hide replay configuration details" : "Show advanced replay options & controls"}</span>
                    {replayConfigOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {replayConfigOpen && (
                    <div className="pt-3 border-t border-border/70 space-y-3 text-xs text-secondary">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                            <div className="rounded border border-border/60 bg-surface/60 p-3 space-y-1">
                                <span className="text-primary font-semibold">errorTriggered: true</span>
                                <p className="font-sans text-muted">Buffers events in memory and commits the replay to Halo only when an error or trigger occurs.</p>
                            </div>
                            <div className="rounded border border-border/60 bg-surface/60 p-3 space-y-1">
                                <span className="text-primary font-semibold">sampleRate: 0.0</span>
                                <p className="font-sans text-muted">Sampling rate for normal sessions without errors. Set to 0 to eliminate normal session storage completely.</p>
                            </div>
                            <div className="rounded border border-border/60 bg-surface/60 p-3 space-y-1">
                                <span className="text-primary font-semibold">halo.replay.capture()</span>
                                <p className="font-sans text-muted">Explicit manual trigger to snapshot current ring buffer and persist browser evidence on demand.</p>
                            </div>
                            <div className="rounded border border-border/60 bg-surface/60 p-3 space-y-1">
                                <span className="text-primary font-semibold">recordCanvas: boolean</span>
                                <p className="font-sans text-muted">Captures hardware-accelerated 2D and WebGL canvas animations alongside DOM mutations.</p>
                            </div>
                            <div className="rounded border border-border/60 bg-surface/60 p-3 space-y-1">
                                <span className="text-primary font-semibold">openFeedbackModal()</span>
                                <p className="font-sans text-muted">Triggers client user feedback widget directly linked to active replay session ID.</p>
                            </div>
                            <div className="rounded border border-border/60 bg-surface/60 p-3 space-y-1">
                                <span className="text-primary font-semibold">maskAllInputs: boolean</span>
                                <p className="font-sans text-muted">Obfuscates text input fields before serialization to ensure zero credential leakage.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Privacy by Default & Correlation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                {/* Privacy by Default */}
                <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Shield className="h-4 w-4 text-accent" />
                        <span>Privacy by default</span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                        Replay masks sensitive content before upload and applies defensive filtering during ingestion:
                    </p>
                    <ul className="space-y-1.5 text-xs text-muted list-disc list-inside">
                        <li><strong className="text-secondary">Input Masking:</strong> Passwords, credit cards, and CVVs are redacted.</li>
                        <li><strong className="text-secondary">Sanitized URLs:</strong> Sensitive query params (<code className="text-primary font-mono text-[10px]">token</code>, <code className="text-primary font-mono text-[10px]">secret</code>) are scrubbed.</li>
                        <li><strong className="text-secondary">Header Stripping:</strong> <code className="text-primary font-mono text-[10px]">Authorization</code> and <code className="text-primary font-mono text-[10px]">Cookie</code> headers are removed.</li>
                        <li><strong className="text-secondary">Circular Safety:</strong> Safe JSON serialization handles cyclic references.</li>
                    </ul>
                </div>

                {/* Context & Correlation */}
                <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Share2 className="h-4 w-4 text-accent" />
                        <span>Everything shares context</span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                        One runtime session connects browser replay, requests, distributed traces, and errors:
                    </p>
                    <div className="rounded border border-border/60 bg-[#03060a] p-3 text-center font-mono text-[11px] text-accent">
                        Session ↔ Replay ↔ Request ↔ Trace ↔ Error ↔ Investigation
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                        When an incident occurs, Halo connects the frontend user action directly to backend traces without manual stitching.
                    </p>
                </div>
            </div>

            {/* Step 04: Verify Your Connection */}
            <div className="space-y-5 pt-4 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                        <span className="font-mono text-sm font-semibold text-muted">04</span>
                        <div>
                            <h2 className="text-base font-semibold text-primary">Verify your connection</h2>
                            <p className="mt-0.5 text-sm text-secondary">
                                Send a test event to verify runtime evidence arrives in Halo.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefreshStatus}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-accent" : ""}`} />
                            <span>Check now</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleSendTestEvent}
                            disabled={isTriggeringTest || !status.hasApiKey}
                            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-[#05070b] hover:bg-accent-hover transition-colors disabled:opacity-50"
                        >
                            <Send className={`h-3.5 w-3.5 ${isTriggeringTest ? "animate-pulse" : ""}`} />
                            <span>Send test event</span>
                        </button>
                    </div>
                </div>

                {/* Verification Code Example */}
                <CodeSnippet
                    code={`await halo.captureMessage("Hello from Halo");`}
                    language="typescript"
                    filename="Test Event Verification"
                />

                {/* Real-Time Connection State Card */}
                <div className="rounded-xl border border-border bg-[#03060a] p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {status.hasTelemetry ? (
                                <div className="h-3 w-3 rounded-full bg-[#35d08a] shadow-[0_0_8px_rgba(53,208,138,0.5)]" />
                            ) : (
                                <div className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-primary">
                                        {status.hasTelemetry ? "SDK connected" : "Waiting for runtime evidence..."}
                                    </span>
                                    {status.hasTelemetry && (
                                        <span className="rounded-full bg-[#35d08a]/10 px-2 py-0.5 text-[10px] font-medium text-[#35d08a]">
                                            Telemetry received
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted mt-0.5" suppressHydrationWarning>
                                    {status.hasTelemetry && status.latestEvent
                                        ? `Last event: "${status.latestEvent.title}" (${status.latestEvent.type}) ${mounted ? `received at ${new Date(status.latestEvent.timestamp).toLocaleTimeString()}` : "received"}`
                                        : "Send an event from your application code or use the 'Send test event' button above."}
                                </p>
                            </div>
                        </div>

                        {status.hasTelemetry && status.latestEvent && (
                            <Link
                                href={`/projects/${project.id}/events`}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline shrink-0"
                            >
                                <span>View event</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* SDK Connected — What Happens Next */}
            {status.hasTelemetry && (
                <div className="rounded-xl border border-[#35d08a]/30 bg-[#35d08a]/5 p-5 sm:p-6 space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-primary flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#35d08a]" />
                            <span>SDK Connected & Active</span>
                        </h3>
                        <p className="mt-1 text-xs text-secondary leading-relaxed">
                            Your application is transmitting runtime evidence to Halo. Navigate into your project control planes:
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        <Link
                            href={`/projects/${project.id}/events`}
                            className="rounded-lg border border-border/80 bg-surface/80 p-3 hover:border-accent/40 hover:bg-surface-elevated transition-all text-left group"
                        >
                            <span className="text-xs font-semibold text-primary group-hover:text-accent block">Events →</span>
                            <span className="text-[11px] text-muted block mt-1">{status.totalEvents} total recorded</span>
                        </Link>

                        <Link
                            href={`/projects/${project.id}/issues`}
                            className="rounded-lg border border-border/80 bg-surface/80 p-3 hover:border-accent/40 hover:bg-surface-elevated transition-all text-left group"
                        >
                            <span className="text-xs font-semibold text-primary group-hover:text-accent block">Issues →</span>
                            <span className="text-[11px] text-muted block mt-1">Fingerprinted clusters</span>
                        </Link>

                        <Link
                            href={`/projects/${project.id}/replays`}
                            className="rounded-lg border border-border/80 bg-surface/80 p-3 hover:border-accent/40 hover:bg-surface-elevated transition-all text-left group"
                        >
                            <span className="text-xs font-semibold text-primary group-hover:text-accent block">Replays →</span>
                            <span className="text-[11px] text-muted block mt-1">{status.totalReplays} sessions captured</span>
                        </Link>

                        <Link
                            href={`/projects/${project.id}/investigations/new`}
                            className="rounded-lg border border-border/80 bg-surface/80 p-3 hover:border-accent/40 hover:bg-surface-elevated transition-all text-left group"
                        >
                            <span className="text-xs font-semibold text-primary group-hover:text-accent block">Investigate →</span>
                            <span className="text-[11px] text-muted block mt-1">AI Root-cause engine</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* Advanced Configuration Accordions */}
            <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
                    Advanced Integrations & Reference
                </h3>

                {/* Tracing Accordion */}
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleAdvanced("tracing")}
                        className="w-full flex items-center justify-between p-4 text-left text-sm font-medium text-primary hover:bg-surface-elevated transition-colors"
                    >
                        <span>Distributed Tracing & W3C traceparent</span>
                        {advancedOpen.tracing ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </button>
                    {advancedOpen.tracing && (
                        <div className="p-4 pt-0 border-t border-border/60 space-y-3 text-xs text-secondary">
                            <p>
                                Halo automatically generates and propagates standard W3C <code className="text-primary font-mono text-[11px]">traceparent</code> headers across all outbound fetch and XMLHttpRequest calls.
                            </p>
                            <CodeSnippet
                                code={`// Manual span creation in browser or backend
const span = halo.startSpan("checkout.process_cart", "http.client");
// span.spanId and span.parentSpanId are tracked automatically`}
                                language="typescript"
                            />
                        </div>
                    )}
                </div>

                {/* Scope & Identity Accordion */}
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleAdvanced("scope")}
                        className="w-full flex items-center justify-between p-4 text-left text-sm font-medium text-primary hover:bg-surface-elevated transition-colors"
                    >
                        <span>User Identification & Custom Tags</span>
                        {advancedOpen.scope ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </button>
                    {advancedOpen.scope && (
                        <div className="p-4 pt-0 border-t border-border/60 space-y-3 text-xs text-secondary">
                            <p>
                                Associate all subsequent telemetry with user identity and environment tags:
                            </p>
                            <CodeSnippet
                                code={`halo.setUser({ id: "usr_123", email: "user@example.com", username: "alex" });
halo.setTag("customerTier", "enterprise");
halo.setContext("billing", { plan: "pro", activeSub: true });`}
                                language="typescript"
                            />
                        </div>
                    )}
                </div>

                {/* Sampling Accordion */}
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleAdvanced("sampling")}
                        className="w-full flex items-center justify-between p-4 text-left text-sm font-medium text-primary hover:bg-surface-elevated transition-colors"
                    >
                        <span>Sampling & Rate Limiting</span>
                        {advancedOpen.sampling ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </button>
                    {advancedOpen.sampling && (
                        <div className="p-4 pt-0 border-t border-border/60 space-y-3 text-xs text-secondary">
                            <p>
                                Control high-volume telemetry ingestion with deterministic sampling:
                            </p>
                            <CodeSnippet
                                code={`Halo.init({
  apiKey: "hl_live_...",
  sampleRate: 0.5,        // Ingest 50% of general informational events
  tracesSampleRate: 0.2,  // Sample 20% of performance spans
  // NOTE: Error events are ALWAYS 100% preserved regardless of sampling
});`}
                                language="typescript"
                            />
                        </div>
                    )}
                </div>

                {/* Transport Accordion */}
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                    <button
                        type="button"
                        onClick={() => toggleAdvanced("transport")}
                        className="w-full flex items-center justify-between p-4 text-left text-sm font-medium text-primary hover:bg-surface-elevated transition-colors"
                    >
                        <span>Batch Transport & Offline Resilience</span>
                        {advancedOpen.transport ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </button>
                    {advancedOpen.transport && (
                        <div className="p-4 pt-0 border-t border-border/60 space-y-3 text-xs text-secondary">
                            <p>
                                Halo buffers events in memory and flushes in batches of 30 items or every 2,000ms. If a network interruption occurs, requests retry with exponential backoff and jitter.
                            </p>
                            <CodeSnippet
                                code={`// Force an immediate flush before application exit
await halo.flush();`}
                                language="typescript"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
