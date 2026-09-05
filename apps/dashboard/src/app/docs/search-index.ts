export interface SearchDocItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  keywords: string[];
  content: string;
}

export const SEARCH_DOC_INDEX: SearchDocItem[] = [
  {
    id: "overview",
    category: "Getting Started",
    title: "Overview & Evidence-First Philosophy",
    summary: "The Halo philosophy, automated investigations, and verified evidence vs raw logs.",
    keywords: ["philosophy", "evidence", "paradigm", "unknowns", "hallucination", "observability", "causal chain", "root cause"],
    content: `Traditional observability tools deluge engineering teams with raw logs, disconnected dashboards, and alert storms.
When an outage strikes, engineers spend 80% of their time correlating timestamps and hypothesizing what occurred.
Halo operates on an evidence-first paradigm: every error, trace, and metric is treated as evidentiary data.
Halo's automated investigation engine links signals together into an immutable Causal Chain, computes confidence scores,
and isolates the exact source code commit and database query responsible.
Evidence Integrity: Unlike black-box AI tools that hallucinate explanations, Halo separates verified evidence from unknowns
(such as uncaptured request bodies or disabled database query logs), ensuring zero false confidence.`,
  },
  {
    id: "quickstart",
    category: "Getting Started",
    title: "Quickstart Guide",
    summary: "Install and initialize the official Halo SDK in Node.js or TypeScript applications.",
    keywords: ["quickstart", "install", "npm", "pnpm", "sdk", "initialize", "setup", "captureError", "checkout-api"],
    content: `Install the official Halo SDK into your Node.js or TypeScript application in one command:
pnpm add @halo-trace/sdk
Initialize Halo at the entry point of your service (e.g. server.ts or instrumentation.ts):
import { Halo } from "@halo-trace/sdk";
const halo = new Halo({
  apiKey: process.env.HALO_API_KEY,
  service: "checkout-api",
  environment: "production",
  release: "v2.14.0",
});
Capture any unexpected runtime fault:
try {
  await processPayment(payload);
} catch (error) {
  await halo.captureError(error, {
    tags: { tenantId: "tenant_992", paymentMethod: "stripe" },
    metadata: { orderTotal: 189.50 },
  });
  throw error;
}`,
  },
  {
    id: "architecture",
    category: "Getting Started",
    title: "System Architecture & Telemetry Pipeline",
    summary: "Asynchronous 3-layer architecture: in-process queue, ingestion normalizer, and investigation engine.",
    keywords: ["architecture", "pipeline", "queue", "ring buffer", "http2", "overhead", "normalizer", "correlator"],
    content: `Halo's pipeline is divided into three asynchronous layers to ensure near-zero overhead on customer production applications:
Layer 1: In-Process Queue. Non-blocking ring buffer that flushes batches over HTTP/2 without adding latency to customer request threads.
Layer 2: Ingestion & Normalizer. High-throughput stream parser extracting stack frames, SQL fingerprints, distributed trace IDs, and breadcrumbs.
Layer 3: Investigation Engine. Causal graph builder reconstructing state progressions, correlating anomalies, and synthesizing root cause reports.`,
  },
  {
    id: "logs-ingestion",
    category: "Logs & Telemetry",
    title: "Ingestion Model & Payload Format",
    summary: "Low-latency HTTP event ingestion (/api/ingest/events) with automatic 250ms batching.",
    keywords: ["ingestion", "batch", "payload", "events", "api", "json", "endpoint", "severity", "traceId", "NullPointerException"],
    content: `Halo ingests events via a low-latency HTTP endpoint (/api/ingest/events). The client automatically batches events
every 250ms or when 50 items accumulate, preventing burst contention.
Payload Structure POST /api/ingest/events:
events: type ERROR, title NullPointerException: Cannot read properties of undefined,
message User checkout session expired prior to payment dispatch, timestamp, service checkout-api,
release v2.14.0, severity ERROR, traceId a3f87c2e4d1a9b7c, tags endpoint /api/checkout region us-east-1,
stack NullPointerException at UserService.process user.ts:89:14.`,
  },
  {
    id: "logs-structured",
    category: "Logs & Telemetry",
    title: "Structured Logging & Custom Metadata",
    summary: "Log structured business events with typed metadata, severities, and indexed tags.",
    keywords: ["structured", "logging", "captureMessage", "metadata", "tags", "severity", "warning", "retry", "stripe"],
    content: `You can log structured information with arbitrary typed metadata. Halo automatically indexes parameters, allowing fast query
searches and correlation with concurrent trace trees.
Structured Message Capture:
await halo.captureMessage("Payment retry sequence initiated", {
  severity: "WARNING",
  metadata: {
    attempt: 3,
    maxRetries: 5,
    gatewayResponseCode: 504,
    latencyMs: 3410,
  },
  tags: {
    gateway: "stripe-emea",
    customerTier: "enterprise",
  },
});`,
  },
  {
    id: "logs-traces",
    category: "Logs & Telemetry",
    title: "Spans & Distributed Tracing",
    summary: "Context propagation across microservices using withRequestContext and W3C traceparent.",
    keywords: ["spans", "traces", "distributed tracing", "withRequestContext", "traceparent", "traceId", "correlation", "operation"],
    content: `Halo tracks distributed spans across HTTP client calls and downstream database queries. Incoming requests automatically inherit
the halo-trace-id header or W3C traceparent.
Tracing with Request Context:
import { Halo } from "@halo-trace/sdk";
await halo.withRequestContext(
  {
    traceId: req.headers["x-trace-id"] || halo.generateId(),
    operation: "POST /checkout",
    resource: "orders-table",
  },
  async () => {
    // Any nested halo.captureError or halo.captureMessage automatically inherits this trace context
    await runCheckoutTransaction();
  }
);`,
  },
  {
    id: "logs-breadcrumbs",
    category: "Logs & Telemetry",
    title: "Breadcrumbs & Rolling Context Buffer",
    summary: "Record rolling sequences of auth, database, and HTTP actions preceding runtime failures.",
    keywords: ["breadcrumbs", "rolling buffer", "addBreadcrumb", "auth", "jwt", "database", "sql", "history"],
    content: `Breadcrumbs capture the sequence of events preceding a fault. The Halo SDK automatically records outbound fetch calls,
database client calls, and navigation transitions into a rolling buffer of the last 100 items.
Manual Breadcrumbs:
halo.addBreadcrumb({
  category: "auth",
  message: "JWT token validation succeeded for user_8471",
  level: "INFO",
  data: { scope: ["read:orders", "write:orders"], expiresAt: 1788640000 },
});
halo.addBreadcrumb({
  category: "database",
  message: "SELECT * FROM orders WHERE id = $1",
  level: "INFO",
  data: { durationMs: 42, rowsReturned: 1 },
});`,
  },
  {
    id: "investigations-how",
    category: "Investigations Engine",
    title: "Automated Root-Cause Discovery",
    summary: "How Halo spawns investigations, pulls trace trees within ±120s, and resolves source commits.",
    keywords: ["investigation", "root cause", "incident", "correlator", "resolver", "artifact", "hypothesis"],
    content: `When an alert fires in conventional tools, an on-call engineer receives an incident with zero context.
In Halo, firing events immediately spawn an Investigation:
1. Telemetry Correlator: Pulls trace trees, database queries, and session replays happening within ±120s of the incident.
2. Causal Chain Builder: Traverses upstream caller links to identify the originating root trigger.
3. Source Resolver: Maps minified production stack frames to exact Git commit SHAs, line numbers, and author blame.
4. Hypothesis Ranker: Scores potential failure causes by mathematical evidence weight.
Each investigation generates a persistent Investigation Artifact containing the evidence timeline, linked sources,
confidence score, and verified knowns/unknowns.`,
  },
  {
    id: "investigations-causal-chain",
    category: "Investigations Engine",
    title: "Causal Chain Reconstruction",
    summary: "Step-by-step state transition graph tracing error provenance across microservice dependencies.",
    keywords: ["causal chain", "provenance", "graph", "state transition", "blocked by", "database query", "source commit"],
    content: `Instead of showing isolated errors, Halo builds a step-by-step state transition graph showing:
ERROR: NullPointerException at UserService.java:247
caused by: REQUEST: POST /api/checkout (trace_id: a3f87c2e)
depends on: TRACE: checkout.handler (duration: 1.847s)
blocked by: DATABASE: SELECT * FROM orders WHERE user_id = ? (latency 2.4s, 94th percentile spike)
origin commit: SOURCE: app/api/checkout/route.ts (line 89, getUserOrders).`,
  },
  {
    id: "investigations-evidence-graph",
    category: "Investigations Engine",
    title: "Evidence Graph & Confidence Scoring",
    summary: "Objective scoring (0.0 to 1.0) based on temporal proximity, trace propagation, and commit blame.",
    keywords: ["evidence graph", "confidence score", "temporal proximity", "trace propagation", "fingerprint", "ranking"],
    content: `Halo calculates an objective Confidence Score (0.0 to 1.0) based on three mathematical criteria:
1. Temporal Proximity: Did the database latency spike occur strictly before the downstream timeout exception?
2. Trace Propagation: Did the trace ID flow directly from the HTTP gateway to the worker?
3. Fingerprint Match: Does the stack frame map to code changed in the most recent service deployment?`,
  },
  {
    id: "investigations-gaps",
    category: "Investigations Engine",
    title: "Unknowns & Evidence Gaps",
    summary: "Explicitly surfacing uncaptured payloads, sanitized secrets, and system blindspots.",
    keywords: ["unknowns", "evidence gaps", "blindspots", "sanitization", "redaction", "uncaptured"],
    content: `When a system fails due to uninstrumented third-party APIs or scrubbed payload bodies, Halo does not guess.
It explicitly highlights Evidence Gaps:
UNKNOWN: Request payload body was not captured (Sanitization Rule #4 applied).
Surfacing missing telemetry prevents engineers from acting on incomplete assumptions.`,
  },
  {
    id: "features-replay",
    category: "Platform Features",
    title: "Session Replay & Pre-Error Buffer",
    summary: "DOM mutation recording with zero-bandwidth circular buffer (preErrorBufferSeconds) and privacy masks.",
    keywords: ["session replay", "replay", "dom", "buffer", "preErrorBufferSeconds", "maskAllInputs", "video", "reproduce"],
    content: `The @halo-trace/replay client records browser DOM mutations, clicks, and network requests into an in-memory
circular buffer (up to 60 seconds). If no error occurs, the recording is discarded, preserving bandwidth and privacy.
When an error strikes, the buffer is dispatched and linked directly to the Investigation.
Client Browser Initialization:
import { initReplay } from "@halo-trace/replay";
initReplay({
  apiKey: "hl_live_...",
  projectId: "proj_checkout",
  preErrorBufferSeconds: 60,
  maskAllInputs: true,
  blockClasses: ["halo-hide", "sensitive-card-data"],
});`,
  },
  {
    id: "features-source",
    category: "Platform Features",
    title: "Source Investigation & Git Context",
    summary: "Connect GitHub/GitLab to map stack traces to commit blame, pull requests, and inline code diffs.",
    keywords: ["source investigation", "github", "gitlab", "commit", "blame", "pull request", "stack trace", "mapping"],
    content: `Connect your GitHub or GitLab repositories under Project Settings. Halo automatically retrieves the corresponding commit
source tree whenever a stack trace is reported.
Zero developer machine paths: Sanitizes local absolute paths into verified repository relative paths.
Inline syntax view: Inspect lines ±15 around the throwing expression without leaving the dashboard.
Commit & PR blame: Identifies which pull request introduced the breaking change.`,
  },
  {
    id: "features-monitors",
    category: "Platform Features",
    title: "Monitors, Anomaly Detection & Alerts",
    summary: "Proactive alert rules, error rate thresholds, SLO burn rates, and PagerDuty/Slack routing.",
    keywords: ["monitors", "alerts", "threshold", "error rate", "slo", "slack", "pagerduty", "webhook", "email"],
    content: `Set proactive alerts across custom queries, error spikes, or SLO burn rates.
Supported Monitor Types:
Alert if checkout failure rate > 2% over 5m window:
name: "High Checkout Failure Rate",
type: "ERROR_RATE",
thresholdValue: 2.0, // percent
thresholdWindow: 5,   // minutes
query: "service:checkout-api AND status:ERROR",
alertConfig: {
  channels: ["SLACK_WEBHOOK", "PAGERDUTY", "EMAIL"],
  autoSpawnInvestigation: true
}`,
  },
  {
    id: "features-autofix",
    category: "Platform Features",
    title: "Autofix Engine & PR Generation",
    summary: "Automated pull request patch generation with regression tests based on proven root causes.",
    keywords: ["autofix", "ai patch", "pull request", "code fix", "regression test", "automated repair"],
    content: `Once an Investigation establishes high confidence (> 0.85) in the root cause, Halo can draft a pull-request-ready code patch.
The patch addresses the missing null check, unhandled promise, or invalid database query and includes a regression test.
Eliminates tedious manual bug fix drafting for common production regressions.`,
  },
  {
    id: "sdk-setup",
    category: "SDK & API Reference",
    title: "SDK Installation & Configuration",
    summary: "Client constructor options: apiKey, service, environment, release, and endpoint.",
    keywords: ["sdk", "constructor", "options", "apiKey", "service", "environment", "release", "endpoint", "hl_live"],
    content: `The @halo-trace/sdk library is available on npm, yarn, and pnpm:
pnpm add @halo-trace/sdk
Constructor Options:
apiKey (string, required): Live ingestion key starting with hl_live_...
service (string, optional): Service identifier (e.g. api-gateway)
environment (string, optional): Default production or staging
release (string, optional): Semver string or Git commit SHA`,
  },
  {
    id: "sdk-capture",
    category: "SDK & API Reference",
    title: "Manual Capture & User Identity API",
    summary: "Explicit APIs for captureError, captureMessage, and linking user session identity.",
    keywords: ["captureError", "captureMessage", "setUser", "user", "identity", "tags", "severity", "fatal", "api"],
    content: `Halo provides explicit capture APIs for catching exceptions and recording custom business events:
1. Capture Error:
await halo.captureError(new Error("Database connection pool exhausted"), {
  severity: "FATAL",
  tags: { dbHost: "db-primary.internal" },
});
2. Capture Message:
await halo.captureMessage("Worker queue scaling threshold reached", {
  severity: "WARNING",
  metadata: { activeJobs: 450, workers: 8 },
});
3. User Identity Linking:
halo.setUser({
  id: "usr_99812",
  email: "alex@enterprise.com",
  username: "alex_dev",
});`,
  },
  {
    id: "sdk-middleware",
    category: "SDK & API Reference",
    title: "Express & Next.js Framework Middleware",
    summary: "Automatic request instrumentation, unhandled rejection capture, and trace header injection.",
    keywords: ["express", "nextjs", "middleware", "request context", "error handler", "node", "server", "http"],
    content: `Plug Halo into your Express or Next.js server to automatically instrument incoming requests, catch unhandled rejections,
and bind distributed trace headers:
Express Middleware Integration:
import express from "express";
import { Halo } from "@halo-trace/sdk";
const app = express();
const halo = new Halo({ apiKey: process.env.HALO_API_KEY });
// Request handler
app.use((req, res, next) => {
  halo.withRequestContext(
    {
      traceId: req.headers["x-trace-id"] || halo.generateId(),
      operation: \`\${req.method} \${req.path}\`,
    },
    next
  );
});
// Error handler
app.use((err, req, res, next) => {
  halo.captureError(err, {
    metadata: { path: req.path, query: req.query },
  });
  res.status(500).json({ error: "Internal server error" });
});
app.listen(3000);`,
  },
];
