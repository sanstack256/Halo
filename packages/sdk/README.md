# @halo-trace/sdk

The official unified telemetry, observability, error monitoring, and session replay SDK platform for Halo Trace.

Halo provides one consolidated SDK architecture spanning core instrumentation, browser telemetry, Node.js runtime tracing, React error boundaries, Next.js server/client wrappers, and full-fidelity session replay with GPU-accelerated canvas capture and user feedback.

---

## Architectural Hierarchy

```
                    @halo-trace/sdk-core
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
  @halo-trace/sdk-browser  sdk-node      sdk-mobile-core
            │
      ┌─────┼───────┐
      ▼     ▼       ▼
    React Next.js Replay
```

Every platform package builds on the unified `@halo-trace/sdk-core` pipeline, ensuring consistent scoping, session states, W3C trace propagation, privacy boundary scrubbing, and retry-resilient batch transports.

---

## Installation

### pnpm
```bash
pnpm add @halo-trace/sdk
```

### npm
```bash
npm install @halo-trace/sdk
```

### yarn
```bash
yarn add @halo-trace/sdk
```

---

## Quick Start

### 1. Unified Automatic Initialization

In any modern browser or Node.js application:

```ts
import { Halo } from "@halo-trace/sdk";

// Automatically selects BrowserClient or NodeClient based on runtime environment
Halo.init({
    apiKey: process.env.HALO_API_KEY || "hl_live_...",
    endpoint: "https://app.halo.run/api",
    environment: "production",
    release: "v3.2.0",
    replay: {
        enabled: true,
        errorTriggered: true, // Only persist replay when an error or feedback occurs
        sampleRate: 1.0,
    },
});
```

---

## Platform Subpath Modules

`@halo-trace/sdk` provides dedicated, tree-shakable subpath entries for modern module bundlers:

### Browser Telemetry (`@halo-trace/sdk/browser`)
Captures unhandled errors (`window.onerror`), unhandled promise rejections, resource loading failures, safe `console.*` telemetry, single-page app navigations, page lifecycle states (`visibilitychange`, `pagehide`, `freeze`), performance metrics (Web Vitals), and outbound HTTP `traceparent` injection.

```ts
import { init, BrowserClient } from "@halo-trace/sdk/browser";

const client = init({
    apiKey: "hl_live_...",
    endpoint: "/api",
    captureConsole: true,
    captureHttp: true,
    captureNavigation: true,
});
```

### Node.js Telemetry (`@halo-trace/sdk/node`)
Captures unhandled exceptions (`uncaughtException`), unhandled promise rejections, process exit states (`beforeExit`), incoming/outgoing HTTP requests, system metrics (OS, CPU, memory), and provides `AsyncLocalStorage` request-scoped trace context management.

```ts
import { NodeClient, runWithContext, getTraceId } from "@halo-trace/sdk/node";

const node = new NodeClient({
    apiKey: process.env.HALO_API_KEY!,
    endpoint: "https://app.halo.run/api",
    service: "payment-worker",
});

await runWithContext({ traceId: "custom_trace_id" }, async () => {
    // Every call within this block inherits traceId
    console.log("Current trace:", getTraceId());
});
```

### React Integration (`@halo-trace/sdk/react`)
Provides declarative `<HaloErrorBoundary>` component stack tracing, `HaloProvider`, and custom hooks.

```tsx
import React from "react";
import { HaloErrorBoundary, HaloProvider, useHalo } from "@halo-trace/sdk/react";

export function App() {
    return (
        <HaloProvider apiKey="hl_live_..." environment="production">
            <HaloErrorBoundary
                fallback={<div className="error-card">Something went wrong.</div>}
                onError={(err, info) => console.log("Caught:", err, info.componentStack)}
            >
                <MainApplication />
            </HaloErrorBoundary>
        </HaloProvider>
    );
}

function MainApplication() {
    const { captureMessage, addBreadcrumb } = useHalo();
    return <button onClick={() => captureMessage("Button clicked")}>Track</button>;
}
```

### Next.js Integration (`@halo-trace/sdk/nextjs`)
Isomorphic integration supporting both Client Components and App Router Route Handlers / Server Actions with automatic W3C `traceparent` propagation and error boundary capturing.

```ts
// app/api/checkout/route.ts
import { withHaloRoute } from "@halo-trace/sdk/nextjs/server";

export const POST = withHaloRoute(async (req) => {
    // Automatically extracts traceparent headers and associates server spans
    const data = await req.json();
    return Response.json({ success: true, orderId: "ord_123" });
});
```

### Session Replay & Feedback (`@halo-trace/sdk/replay`)
Full DOM mutation reconstruction, temporal random-access seeking, GPU-accelerated Canvas 2D / WebGL frame recording, multi-vector privacy masking, and user feedback submission.

```ts
import { Halo } from "@halo-trace/sdk";

const halo = Halo.init({
    apiKey: "hl_live_...",
    replay: { enabled: true },
});

// Programmatically prompt user feedback modal linked to active replay session:
halo.replay.openFeedbackModal({
    title: "Report an Issue",
    placeholder: "What went wrong?",
});
```

---

## Distributed Tracing & W3C Standards

Halo instruments outbound `fetch()` and `XMLHttpRequest` calls by injecting standard W3C `traceparent` headers:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              │  └───────────────┬──────────────┘ └───────┬──────┘ └─ flags
           version       32-hex traceId        16-hex spanId
```

Child operations within Node.js or Next.js extract incoming headers using `TraceContextManager` or `parseTraceParent()`, establishing end-to-end distributed causality from browser interactions down to backend microservices.

---

## Multi-Vector Privacy Defense

Halo enforces strict client-side sanitization before any telemetry payload leaves the device:
- **Sensitive Inputs**: Passwords, credit card numbers, CVVs, and inputs matching sensitive fields are masked.
- **Sensitive Headers**: `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization` headers are stripped.
- **Sensitive URLs**: Query string parameters (`token`, `auth`, `password`, `key`, `secret`) are redacted to `[REDACTED]`.
- **Safe Serialization**: Circular object references and deep hierarchies are safely handled without browser crashes.

---

## Standalone Browser Script (IIFE)

For applications without npm build pipelines, load the bundled script:

```html
<script src="https://cdn.halo.run/sdk/halo.global.js"></script>
<script>
    Halo.init({
        apiKey: "hl_live_...",
        endpoint: "https://app.halo.run/api",
        replay: { enabled: true }
    });
</script>
```

---

## Verification & Testing

The Halo SDK platform is verified across 135+ automated end-to-end checks:
- **SDK Platform Core & Integrations**: 23/23 checks passed
- **GPU Canvas 2D & WebGL Replay & Feedback**: 9/9 checks passed
- **Adversarial Security & Transport**: 25/25 checks passed
- **Comprehensive Lifecycle & Telemetry Audit**: 40/40 checks passed
- **Session Replay Baseline Parity**: 38/38 checks passed

---

## License

MIT © Halo Trace
