/**
 * Halo Trace Explore — Real SDK Telemetry Generator
 * Generates rich, realistic, correlated telemetry through the real Halo SDK and live ingestion endpoint.
 */

import { Halo } from "../packages/sdk/src/halo";
import { prisma } from "../apps/dashboard/src/lib/prisma";
import { generateApiKey } from "../apps/dashboard/src/lib/api-key";
import * as fs from "fs";
import * as path from "path";

const ENDPOINT = "http://localhost:3000/api";
const PRIMARY_PROJECT_ID = "cmsj10w380000erihmy7j5222"; // halo-test-app (Primary Org)
const SECONDARY_PROJECT_ID = "cmtg8a5y20001opitcsxo6x8i"; // Project A (Eval Test Org - for multi-tenant isolation)

async function getOrCreateKey(projectId: string, name: string) {
    const env = await prisma.environment.findFirst({ where: { projectId } });
    if (!env) throw new Error(`No environment found for project ${projectId}`);

    const existing = await prisma.apiKey.findFirst({ where: { projectId, name } });
    if (existing) {
        await prisma.apiKey.delete({ where: { id: existing.id } });
    }

    const { key, prefix, keyHash } = await generateApiKey();
    await prisma.apiKey.create({
        data: {
            name,
            prefix,
            keyHash,
            projectId,
            environmentId: env.id,
        },
    });
    return key;
}

export async function generateE2ETelemetry() {
    console.log("=== Halo Trace Explore: Initializing Real Telemetry Generation ===");

    const primaryKey = await getOrCreateKey(PRIMARY_PROJECT_ID, "e2e-primary-key");
    const secondaryKey = await getOrCreateKey(SECONDARY_PROJECT_ID, "e2e-secondary-key");

    console.log("Primary API Key generated for halo-test-app:", primaryKey.slice(0, 18) + "...");
    console.log("Secondary API Key generated for Project A (Eval Org):", secondaryKey.slice(0, 18) + "...");

    const primaryHalo = new Halo({
        apiKey: primaryKey,
        endpoint: ENDPOINT,
        service: "checkout-service",
        release: "v2.4.0",
        environment: "Production",
        autoCapture: false,
        captureHttp: false,
    });

    const manifest: Record<string, any> = {
        primaryProjectId: PRIMARY_PROJECT_ID,
        secondaryProjectId: SECONDARY_PROJECT_ID,
        generatedAt: new Date().toISOString(),
        scenarios: {},
    };

    const now = Date.now();
    const t = (offsetMs: number) => new Date(now - 120000 + offsetMs).toISOString();

    // =========================================================================
    // SCENARIO A: HEALTHY REQUEST (Multi-span, breadcrumbs, logs, 200 OK)
    // =========================================================================
    console.log("\n[1/9] Ingesting Scenario A: Healthy Request...");
    const reqA = `req_healthy_${now}`;
    const trcA = `trc_healthy_${now}`;
    const sesA = `ses_healthy_${now}`;

    primaryHalo.startSession();
    await primaryHalo.capturePerformance({
        title: "POST /api/checkout",
        operation: "http.server",
        resource: "/api/checkout",
        service: "checkout-service",
        status: 200,
        durationMs: 125,
        requestId: reqA,
        traceId: trcA,
        metadata: {
            method: "POST",
            url: "/api/checkout",
            route: "/api/checkout",
            host: "api.halo.internal",
            headers: {
                "content-type": "application/json",
                "user-agent": "HaloClient/2.4.0 (macOS; x64)",
                "accept": "application/json",
            },
            clientIp: "192.168.1.101",
            body: { cartId: "cart_88921", total: 49.99 },
            httpResponse: { status: 200, durationMs: 125 },
        },
    });

    await primaryHalo.capturePerformance({
        title: "checkout.validateCart",
        operation: "app.internal",
        service: "checkout-service",
        status: 200,
        durationMs: 35,
        requestId: reqA,
        traceId: trcA,
    });

    await primaryHalo.capturePerformance({
        title: "payment.chargeCard",
        operation: "payment.charge",
        service: "payment-service",
        status: 200,
        durationMs: 70,
        requestId: reqA,
        traceId: trcA,
    });

    await primaryHalo.capture({
        type: "LOG",
        severity: "INFO",
        title: "Order processed successfully",
        message: "Order placed successfully. Transaction ID: tx_99210",
        service: "checkout-service",
        requestId: reqA,
        traceId: trcA,
        sessionId: sesA,
    });

    manifest.scenarios.scenarioA = {
        name: "Healthy Request",
        requestId: reqA,
        traceId: trcA,
        sessionId: sesA,
        service: "checkout-service",
        status: 200,
        durationMs: 125,
    };

    // =========================================================================
    // SCENARIO B: FAILED REQUEST WITH MULTI-SPAN TRACE (Propagated IDs)
    // =========================================================================
    console.log("[2/9] Ingesting Scenario B: Failed Request with Multi-Span Trace...");
    const reqB = `req_failed_${now}`;
    const trcB = `trc_failed_${now}`;
    const sesB = `ses_failed_${now}`;

    await primaryHalo.capturePerformance({
        title: "POST /api/orders/checkout",
        operation: "http.server",
        resource: "/api/orders/checkout",
        service: "order-service",
        status: 500,
        durationMs: 1200,
        requestId: reqB,
        traceId: trcB,
        metadata: {
            method: "POST",
            url: "/api/orders/checkout",
            route: "/api/orders/checkout",
            headers: {
                "content-type": "application/json",
                "x-request-id": reqB,
            },
            clientIp: "10.0.4.12",
            body: { orderId: "ord_9901" },
            httpResponse: { status: 500, durationMs: 1200 },
        },
    });

    await primaryHalo.capturePerformance({
        title: "order.validateInventory",
        operation: "app.internal",
        service: "order-service",
        status: 200,
        durationMs: 45,
        requestId: reqB,
        traceId: trcB,
    });

    await primaryHalo.capturePerformance({
        title: "payment.chargeStripe",
        operation: "http.client",
        service: "payment-service",
        status: 500,
        durationMs: 850,
        requestId: reqB,
        traceId: trcB,
    });

    await primaryHalo.capture({
        type: "ERROR",
        severity: "ERROR",
        title: "PaymentGatewayTimeoutException: Stripe upstream gateway timeout after 800ms",
        message: "Stripe upstream gateway timeout after 800ms",
        stack: "PaymentGatewayTimeoutException: Stripe upstream gateway timeout after 800ms\n  at PaymentService.charge (src/payment.ts:42:15)\n  at OrderService.checkout (src/order.ts:88:9)",
        fingerprint: `fp_stripe_timeout_${now}`,
        service: "payment-service",
        requestId: reqB,
        traceId: trcB,
        sessionId: sesB,
        tags: { errorCategory: "timeout", provider: "stripe" },
    });

    manifest.scenarios.scenarioB = {
        name: "Failed Multi-Span Request",
        requestId: reqB,
        traceId: trcB,
        sessionId: sesB,
        fingerprint: `fp_stripe_timeout_${now}`,
        service: "order-service",
        status: 500,
    };

    // =========================================================================
    // SCENARIO C: FAILED REQUEST WITH MISSING TELEMETRY (Gaps, No DB, No Body)
    // =========================================================================
    console.log("[3/9] Ingesting Scenario C: Missing Telemetry...");
    const reqC = `req_missing_${now}`;
    const trcC = `trc_missing_${now}`;

    // Total duration 600ms, but only a single 120ms span was emitted &rarr; 480ms gap!
    await primaryHalo.capturePerformance({
        title: "POST /api/legacy/export",
        operation: "http.server",
        resource: "/api/legacy/export",
        service: "export-service",
        status: 500,
        durationMs: 600,
        requestId: reqC,
        traceId: trcC,
        metadata: {
            method: "POST",
            url: "/api/legacy/export",
            route: "/api/legacy/export",
            // NO body captured
            // NO safe headers captured
        },
    });

    await primaryHalo.capturePerformance({
        title: "export.initiate",
        operation: "app.internal",
        service: "export-service",
        status: 200,
        durationMs: 120,
        requestId: reqC,
        traceId: trcC,
    });

    await primaryHalo.capture({
        type: "ERROR",
        severity: "ERROR",
        title: "ExportProcessCrash: Unhandled termination in legacy worker",
        message: "Unhandled termination in legacy worker",
        fingerprint: `fp_export_crash_${now}`,
        service: "export-service",
        requestId: reqC,
        traceId: trcC,
    });

    manifest.scenarios.scenarioC = {
        name: "Missing Telemetry (Unmeasured Gap & No DB)",
        requestId: reqC,
        traceId: trcC,
        service: "export-service",
        fingerprint: `fp_export_crash_${now}`,
        totalDurationMs: 600,
        capturedSpanDurationMs: 120,
        expectedGapMs: 480,
    };

    // =========================================================================
    // SCENARIO D: MULTIPLE FAILURES + SUCCESS COMPARATORS (Anti-false causality)
    // =========================================================================
    console.log("[4/9] Ingesting Scenario D: Failure Population vs Success Comparators...");
    const lockFingerprint = `fp_lock_timeout_${now}`;

    // 4 Failures with lockFingerprint
    const failureEventIds: string[] = [];
    for (let i = 0; i < 4; i++) {
        const fReq = `req_lock_fail_${i}_${now}`;
        const fTrc = `trc_lock_fail_${i}_${now}`;
        const region = i < 2 ? "us-east-1" : "eu-west-1"; // Region varies across failures

        await primaryHalo.capturePerformance({
            title: "POST /api/inventory/lock",
            operation: "http.server",
            service: "inventory-service",
            status: 500,
            durationMs: 550,
            requestId: fReq,
            traceId: fTrc,
            tags: { region, environment: "Production" },
            metadata: {
                paymentMethod: "apple_pay", // Condition A (present in all failures)
                cartTier: "vip",
            },
        });

        await primaryHalo.capture({
            type: "ERROR",
            severity: "ERROR",
            title: "InventoryLockTimeoutException: Timed out acquiring redis lock",
            message: "Timed out acquiring redis lock on sku cluster",
            fingerprint: lockFingerprint,
            service: "inventory-service",
            requestId: fReq,
            traceId: fTrc,
            tags: { region, environment: "Production" },
            metadata: {
                paymentMethod: "apple_pay",
                cartTier: "vip",
            },
        });
    }

    // 4 Success Comparators in same service
    for (let i = 0; i < 4; i++) {
        const sReq = `req_lock_succ_${i}_${now}`;
        const sTrc = `trc_lock_succ_${i}_${now}`;
        const paymentMethod = i < 2 ? "apple_pay" : "credit_card"; // apple_pay is ALSO present in successes!

        await primaryHalo.capturePerformance({
            title: "POST /api/inventory/lock",
            operation: "http.server",
            service: "inventory-service",
            status: 200,
            durationMs: 140,
            requestId: sReq,
            traceId: sTrc,
            tags: { region: "us-east-1", environment: "Production" },
            metadata: {
                paymentMethod,
                cartTier: "standard",
            },
        });
    }

    // Isolated 1/1 Failure (for testing LIMITED 1/1 non-required safety boundary)
    const singleIsoFingerprint = `fp_isolated_single_${now}`;
    const isoReq = `req_isolated_${now}`;
    const isoTrc = `trc_isolated_${now}`;

    await primaryHalo.capturePerformance({
        title: "POST /api/isolated/run",
        operation: "http.server",
        service: "inventory-service",
        status: 500,
        durationMs: 300,
        requestId: isoReq,
        traceId: isoTrc,
        metadata: { os: "linux" },
    });

    await primaryHalo.capture({
        type: "ERROR",
        severity: "ERROR",
        title: "SingleOccurrenceAnomalyException: Rare unrepeated failure",
        message: "Rare unrepeated failure in isolated worker",
        fingerprint: singleIsoFingerprint,
        service: "inventory-service",
        requestId: isoReq,
        traceId: isoTrc,
        metadata: { os: "linux" },
    });

    manifest.scenarios.scenarioD = {
        name: "Reproduction Matrix Populations",
        sharedFingerprint: lockFingerprint,
        failureCount: 4,
        successComparatorCount: 4,
        conditionA: "apple_pay",
        isolatedSingleFingerprint: singleIsoFingerprint,
        isolatedRequestId: isoReq,
        isolatedTraceId: isoTrc,
    };

    // =========================================================================
    // SCENARIO E: TWO COMPARABLE TRACES WITH REAL DIVERGENCE
    // =========================================================================
    console.log("[5/9] Ingesting Scenario E: Trace Divergence...");
    const trcDivA = `trc_div_target_${now}`;
    const trcDivB = `trc_div_ref_${now}`;
    const divService = "shipping-rate-service";

    // Trace A (Target execution - 4 spans)
    const spansA = [
        { title: "shipping.calculateRates", op: "http.ingress", dur: 350, status: 200 },
        { title: "auth.verifyToken", op: "auth.verify", dur: 40, status: 200 },
        { title: "inventory.fetchWeight", op: "inventory.query", dur: 65, status: 200 },
        { title: "carrier.fetchFedExRate", op: "carrier.fetch", dur: 210, status: 200 },
    ];
    for (const s of spansA) {
        await primaryHalo.capturePerformance({
            title: s.title,
            operation: s.op,
            service: divService,
            durationMs: s.dur,
            status: s.status,
            traceId: trcDivA,
        });
    }

    // Trace B (Reference execution - 5 spans, diverges at span 5 with retry fallback)
    const spansB = [
        { title: "shipping.calculateRates", op: "http.ingress", dur: 620, status: 200 },
        { title: "auth.verifyToken", op: "auth.verify", dur: 40, status: 200 },
        { title: "inventory.fetchWeight", op: "inventory.query", dur: 65, status: 200 },
        { title: "carrier.fetchFedExRate", op: "carrier.fetch", dur: 205, status: 200 },
        { title: "carrier.fallbackRates", op: "carrier.retry", dur: 280, status: 200 }, // DIVERGENCE!
    ];
    for (const s of spansB) {
        await primaryHalo.capturePerformance({
            title: s.title,
            operation: s.op,
            service: divService,
            durationMs: s.dur,
            status: s.status,
            traceId: trcDivB,
        });
    }

    // Shallow single-span trace pair
    const trcShallow1 = `trc_shallow_1_${now}`;
    const trcShallow2 = `trc_shallow_2_${now}`;
    await primaryHalo.capturePerformance({
        title: "health.ping",
        operation: "http.ingress",
        service: "ping-service",
        durationMs: 12,
        status: 200,
        traceId: trcShallow1,
    });
    await primaryHalo.capturePerformance({
        title: "health.ping",
        operation: "http.ingress",
        service: "ping-service",
        durationMs: 14,
        status: 200,
        traceId: trcShallow2,
    });

    manifest.scenarios.scenarioE = {
        name: "Trace Divergence",
        targetTraceId: trcDivA,
        referenceTraceId: trcDivB,
        service: divService,
        divergenceAtSpanIndex: 4,
        shallowTrace1: trcShallow1,
        shallowTrace2: trcShallow2,
    };

    // =========================================================================
    // SCENARIO F: METRIC SHAPE SAMPLES (Sufficient series + sparse series)
    // =========================================================================
    console.log("[6/9] Ingesting Scenario F: Metric Shape Telemetry...");
    // Emit 6 performance events across the last 6 hours for current window (1 per hour)
    const metricSamples = [10, 15, 20, 95, 30, 12];
    for (let i = 0; i < metricSamples.length; i++) {
        await primaryHalo.capture({
            type: "TRACE",
            title: "GET /api/metrics/latency-test",
            operation: "http.server",
            service: "checkout-service",
            durationMs: metricSamples[i],
            status: 200,
            timestamp: new Date(now - (6 - i) * 3600000).toISOString(),
        });
    }

    // Emit 6 historical events 24 hours prior (historical twin)
    const historicalSamples = [11, 14, 22, 90, 28, 11];
    for (let i = 0; i < historicalSamples.length; i++) {
        await primaryHalo.capture({
            type: "TRACE",
            title: "GET /api/metrics/latency-test",
            operation: "http.server",
            service: "checkout-service",
            durationMs: historicalSamples[i],
            status: 200,
            timestamp: new Date(now - 24 * 3600000 - (6 - i) * 3600000).toISOString(),
        });
    }

    manifest.scenarios.scenarioF = {
        name: "Metric Shape Series",
        sampleCount: metricSamples.length,
        values: metricSamples,
    };

    // =========================================================================
    // SCENARIO G: REAL DATABASE TELEMETRY (Attributed DB wait vs No DB)
    // =========================================================================
    console.log("[7/9] Ingesting Scenario G: Database Telemetry...");
    const reqDb = `req_db_${now}`;
    const trcDb = `trc_db_${now}`;

    // Root Request: 520ms
    await primaryHalo.capturePerformance({
        title: "POST /api/orders",
        operation: "http.server",
        resource: "/api/orders",
        service: "order-service",
        status: 200,
        durationMs: 520,
        requestId: reqDb,
        traceId: trcDb,
    });

    // 3 Real DB Spans: 35ms + 110ms + 75ms = 220ms total DB wait!
    await primaryHalo.capturePerformance({
        title: "SELECT * FROM users WHERE id = $1",
        operation: "db.query",
        service: "order-service",
        status: 200,
        durationMs: 35,
        requestId: reqDb,
        traceId: trcDb,
        metadata: {
            system: "postgresql",
            statement: "SELECT * FROM users WHERE id = $1",
            table: "users",
        },
    });

    await primaryHalo.capturePerformance({
        title: "SELECT * FROM inventory WHERE sku = $1",
        operation: "db.query",
        service: "order-service",
        status: 200,
        durationMs: 110,
        requestId: reqDb,
        traceId: trcDb,
        metadata: {
            system: "postgresql",
            statement: "SELECT * FROM inventory WHERE sku = $1",
            table: "inventory",
        },
    });

    await primaryHalo.capturePerformance({
        title: "UPDATE orders SET status = $1 WHERE id = $2",
        operation: "db.query",
        service: "order-service",
        status: 200,
        durationMs: 75,
        requestId: reqDb,
        traceId: trcDb,
        metadata: {
            system: "postgresql",
            statement: "UPDATE orders SET status = $1 WHERE id = $2",
            table: "orders",
        },
    });

    // Request with NO database telemetry
    const reqNoDb = `req_nodb_${now}`;
    const trcNoDb = `trc_nodb_${now}`;
    await primaryHalo.capturePerformance({
        title: "GET /api/cache/status",
        operation: "http.server",
        resource: "/api/cache/status",
        service: "cache-service",
        status: 200,
        durationMs: 30,
        requestId: reqNoDb,
        traceId: trcNoDb,
    });

    manifest.scenarios.scenarioG = {
        name: "Database Attribution",
        withDbRequestId: reqDb,
        withDbTraceId: trcDb,
        expectedDbWaitMs: 220,
        expectedRequestDurationMs: 520,
        expectedUnattributedMs: 300,
        withoutDbRequestId: reqNoDb,
        withoutDbTraceId: trcNoDb,
    };

    // =========================================================================
    // SCENARIO H: RUNTIME / INFRASTRUCTURE FINGERPRINT
    // =========================================================================
    console.log("[8/9] Ingesting Scenario H: Runtime Fingerprint Difference...");
    const trcInfraFail = `trc_infra_fail_${now}`;
    const trcInfraRef = `trc_infra_ref_${now}`;
    const infraService = "worker-service";

    // Failure Execution: Node 22, host pod-alpha, region us-east-1
    await primaryHalo.capturePerformance({
        title: "worker.executeJob",
        operation: "worker.task",
        service: infraService,
        status: 500,
        durationMs: 800,
        traceId: trcInfraFail,
        tags: {
            region: "us-east-1",
            runtime: "Node.js 22.4.1",
            host: "worker-pod-alpha",
            os: "Linux 6.6",
        },
    });

    await primaryHalo.capture({
        type: "ERROR",
        severity: "ERROR",
        title: "WorkerCrashException: Segmentation fault during native addon execution",
        message: "Segmentation fault during native addon execution",
        fingerprint: `fp_infra_crash_${now}`,
        service: infraService,
        traceId: trcInfraFail,
        tags: {
            region: "us-east-1",
            runtime: "Node.js 22.4.1",
            host: "worker-pod-alpha",
            os: "Linux 6.6",
        },
    });

    // Reference Successful Execution: Node 20, host pod-beta, region us-east-1
    await primaryHalo.capturePerformance({
        title: "worker.executeJob",
        operation: "worker.task",
        service: infraService,
        status: 200,
        durationMs: 350,
        traceId: trcInfraRef,
        tags: {
            region: "us-east-1",
            runtime: "Node.js 20.15.0",
            host: "worker-pod-beta",
            os: "Linux 6.6",
        },
    });

    manifest.scenarios.scenarioH = {
        name: "Infrastructure Runtime Fingerprint",
        failureTraceId: trcInfraFail,
        referenceTraceId: trcInfraRef,
        service: infraService,
        matchingAttributes: ["region", "os"],
        differentAttributes: ["runtime", "host"],
    };

    // =========================================================================
    // SCENARIO I: MULTI-TENANT ISOLATION (Project A in Eval Org)
    // =========================================================================
    console.log("[9/9] Ingesting Scenario I: Multi-Tenant Cross-Org Isolation...");
    const secondaryHalo = new Halo({
        apiKey: secondaryKey,
        endpoint: ENDPOINT,
        service: "eval-secret-service",
        release: "v1.0.0",
        environment: "production",
        autoCapture: false,
        captureHttp: false,
    });

    const trcTenant = `trc_eval_secret_${now}`;
    await secondaryHalo.capturePerformance({
        title: "POST /api/eval/secret-compute",
        operation: "http.server",
        service: "eval-secret-service",
        status: 200,
        durationMs: 80,
        traceId: trcTenant,
    });

    await secondaryHalo.capture({
        type: "LOG",
        severity: "INFO",
        title: "Eval confidential log entry",
        message: "This confidential entry belongs to Eval Test Org and must NEVER leak to primary org.",
        service: "eval-secret-service",
        traceId: trcTenant,
    });

    manifest.scenarios.scenarioI = {
        name: "Cross-Org Multi-Tenant Isolation",
        secondaryProjectId: SECONDARY_PROJECT_ID,
        secondaryTraceId: trcTenant,
    };

    // Flush all queues through real HTTP ingestion
    console.log("\nFlushing all SDK queues to live ingestion endpoint...");
    await primaryHalo["queue"].flush();
    await secondaryHalo["queue"].flush();

    // Small delay to ensure all DB writes settle
    await new Promise((r) => setTimeout(r, 1500));

    // Save manifest for E2E tests and report
    const manifestDir = path.resolve(process.cwd(), "scratch");
    if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "e2e-manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    console.log("\n=== Telemetry Ingestion Complete! Manifest saved to:", manifestPath, "===");
    return manifest;
}

if (require.main === module) {
    generateE2ETelemetry()
        .then(() => process.exit(0))
        .catch((e) => {
            console.error("Fatal in E2E generator:", e);
            process.exit(1);
        });
}
