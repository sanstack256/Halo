/**
 * Halo Checkout Incident Test Scenario
 * =====================================
 * Sends a realistic multi-service incident to Halo with rich correlated telemetry.
 *
 * Journey:
 *   Browser session start
 *   → User navigates to /checkout
 *   → User fills form and submits
 *   → checkout-service receives POST /api/checkout  (traceId: T1, spanId: S1)
 *       → checkout-service validates cart           (T1, S2, parentSpanId: S1)
 *       → checkout-service calls payment-service    (T1, S3, parentSpanId: S1)
 *           → payment-service calls payment provider (T1, S4, parentSpanId: S3) — 200 OK
 *           → payment-service queries database       (T1, S5, parentSpanId: S3) — TIMES OUT
 *           → payment-service returns 500
 *       → checkout-service returns 500
 *   → Browser receives 500, tries to access response.data.orderId
 *   → TypeError: Cannot read properties of undefined (reading 'orderId')
 *
 * Evidence gaps (intentional):
 *   ✗ No internal DB infrastructure metrics (WHY the database timed out is unknown)
 *
 * Competing hypotheses supported by evidence:
 *   PAYMENT PROVIDER FAILURE: contradicted — payment provider returned 200 OK
 *   DATABASE TIMEOUT: supported — DB span has duration 31,200ms, status 504
 *
 * Usage:
 *   HALO_API_KEY=<key> npx tsx packages/sdk/src/test-checkout-scenario.ts
 */

import { Halo } from "./halo.js";

const API_KEY = process.env.HALO_API_KEY ?? "YOUR_HALO_API_KEY";
const ENDPOINT = process.env.HALO_ENDPOINT ?? "http://localhost:3000/api";
const RELEASE = "v1.4.2";
const ENVIRONMENT = "production";

if (API_KEY === "YOUR_HALO_API_KEY") {
    console.error("[scenario] ERROR: Set HALO_API_KEY env variable.\n  HALO_API_KEY=<key> npx tsx packages/sdk/src/test-checkout-scenario.ts");
    process.exit(1);
}

const TRACE_ID = `trc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const SESSION_ID = `hs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const REQUEST_ID = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const USER_ID = `usr_demo_${Math.random().toString(36).slice(2, 8)}`;

const SPAN_CHECKOUT_REQUEST  = `sp_${Math.random().toString(36).slice(2, 10)}`; // root
const SPAN_CHECKOUT_VALIDATE = `sp_${Math.random().toString(36).slice(2, 10)}`;
const SPAN_PAYMENT_AUTHORIZE = `sp_${Math.random().toString(36).slice(2, 10)}`;
const SPAN_PAYMENT_PROVIDER  = `sp_${Math.random().toString(36).slice(2, 10)}`;
const SPAN_DATABASE_LOOKUP   = `sp_${Math.random().toString(36).slice(2, 10)}`;

console.log("[scenario] Trace ID  :", TRACE_ID);
console.log("[scenario] Session ID:", SESSION_ID);
console.log("[scenario] Request ID:", REQUEST_ID);

const T = Date.now();
const ms = (offset: number) => new Date(T + offset).toISOString();

const halo = new Halo({
    apiKey: API_KEY,
    endpoint: ENDPOINT,
    release: RELEASE,
    environment: ENVIRONMENT,
    sessionId: SESSION_ID,
    autoCapture: false,
    captureHttp: false,
});

halo.setUser({ id: USER_ID, email: "masked@example.com" });
halo.setTag("region", "us-east-1");
halo.setTag("deploymentId", `dep_${Math.random().toString(36).slice(2, 10)}`);

// ---------------------------------------------------------------------------
// 1. Browser breadcrumbs — the user journey before failure
// ---------------------------------------------------------------------------

halo.addBreadcrumb({ timestamp: ms(0),     category: "navigation",     message: "User navigated to /checkout",              data: { url: "/checkout", referrer: "/cart" } });
halo.addBreadcrumb({ timestamp: ms(3200),  category: "ui.interaction", message: "User clicked 'Proceed to Payment'",        data: { target: "button", text: "Proceed to Payment" } });
halo.addBreadcrumb({ timestamp: ms(7400),  category: "ui.input",       message: "User began entering card details",         data: { field: "card-number (masked)" } });
halo.addBreadcrumb({ timestamp: ms(18900), category: "ui.input",       message: "User entered shipping address",            data: { field: "address" } });
halo.addBreadcrumb({ timestamp: ms(24100), category: "ui.interaction", message: "User clicked 'Complete Purchase'",         data: { target: "button", text: "Complete Purchase" } });
halo.addBreadcrumb({ timestamp: ms(24300), category: "http.request",   message: "POST /api/checkout initiated",            data: { method: "POST", url: "/api/checkout", traceId: TRACE_ID, requestId: REQUEST_ID } });
halo.addBreadcrumb({ timestamp: ms(55800), category: "http.response",  message: "POST /api/checkout failed with HTTP 500", data: { method: "POST", url: "/api/checkout", status: 500, durationMs: 31500, traceId: TRACE_ID } });
halo.addBreadcrumb({ timestamp: ms(55810), category: "app.error",      message: "TypeError thrown accessing response.data.orderId", data: { type: "TypeError", route: "/checkout/payment" } });

// ---------------------------------------------------------------------------
// 2. Checkout request span — root (failed)
// ---------------------------------------------------------------------------

await halo.capturePerformance({
    title: "POST /api/checkout",
    operation: "http.server",
    resource: "/api/checkout",
    service: "checkout-service",
    status: "500",
    durationMs: 31500,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    metadata: {
        spanId: SPAN_CHECKOUT_REQUEST,
        httpMethod: "POST",
        httpPath: "/api/checkout",
        httpStatusCode: 500,
        userId: USER_ID,
        sessionId: SESSION_ID,
        timestamp: ms(24300),
    },
});
console.log("[scenario] Sent: checkout request span (root, S1) — FAILED 500");

// ---------------------------------------------------------------------------
// 3. Checkout validation span — child of S1 (succeeded)
// ---------------------------------------------------------------------------

await halo.capturePerformance({
    title: "checkout.validate",
    operation: "validation",
    resource: "cart-validation",
    service: "checkout-service",
    status: "200",
    durationMs: 120,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    metadata: {
        spanId: SPAN_CHECKOUT_VALIDATE,
        parentSpanId: SPAN_CHECKOUT_REQUEST,
        validationResult: "PASSED",
        itemCount: 3,
        cartTotal: 129.97,
        timestamp: ms(24310),
    },
});
console.log("[scenario] Sent: checkout validation span (S2, parent=S1) — PASSED");

// ---------------------------------------------------------------------------
// 4. Payment authorization span — child of S1 (failed: DB timeout propagated)
// ---------------------------------------------------------------------------

await halo.capturePerformance({
    title: "payment.authorize",
    operation: "payment.authorization",
    resource: "payment-api",
    service: "payment-service",
    status: "500",
    durationMs: 31350,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    metadata: {
        spanId: SPAN_PAYMENT_AUTHORIZE,
        parentSpanId: SPAN_CHECKOUT_REQUEST,
        errorReason: "downstream_dependency_failure",
        dependencyFailed: "database",
        timestamp: ms(24450),
    },
});
console.log("[scenario] Sent: payment authorize span (S3, parent=S1) — FAILED 500");

// ---------------------------------------------------------------------------
// 5. Payment provider request — child of S3 (SUCCEEDED — refutes provider hypothesis)
// ---------------------------------------------------------------------------

await halo.capturePerformance({
    title: "payment-provider.charge",
    operation: "http.client",
    resource: "https://api.stripe.example.com/v1/charges",
    service: "payment-service",
    status: "200",
    durationMs: 380,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    metadata: {
        spanId: SPAN_PAYMENT_PROVIDER,
        parentSpanId: SPAN_PAYMENT_AUTHORIZE,
        provider: "stripe",
        chargeStatus: "succeeded",
        chargeAmount: 12997,
        chargeCurrency: "usd",
        timestamp: ms(24470),
    },
});
console.log("[scenario] Sent: payment provider span (S4, parent=S3) — 200 OK (provider NOT at fault)");

// ---------------------------------------------------------------------------
// 6. Database lookup span — child of S3 (TIMED OUT — primary failure)
//    Internal DB reason is NOT available (intentional telemetry gap)
// ---------------------------------------------------------------------------

await halo.capturePerformance({
    title: "database.lookup — payment_methods WHERE user_id",
    operation: "db.query",
    resource: "payment_methods",
    service: "payment-service",
    status: "504",
    durationMs: 31200,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    metadata: {
        spanId: SPAN_DATABASE_LOOKUP,
        parentSpanId: SPAN_PAYMENT_AUTHORIZE,
        dbSystem: "postgresql",
        dbName: "payments_db",
        dbTable: "payment_methods",
        dbOperation: "SELECT",
        dbStatement: "SELECT * FROM payment_methods WHERE user_id = $1 AND status = $2",
        dbTimeoutMs: 30000,
        dbError: "statement timeout",
        // Internal DB infrastructure metrics NOT available (intentional gap)
        // Connection pool status, lock contention, I/O wait: unknown
        timestamp: ms(24900),
    },
});
console.log("[scenario] Sent: database lookup span (S5, parent=S3) — TIMED OUT 31.2s");

// ---------------------------------------------------------------------------
// 7. Browser observation of the HTTP 500
// ---------------------------------------------------------------------------

await halo.capturePerformance({
    title: "HTTP 500 — POST /api/checkout",
    operation: "http.client",
    resource: "/api/checkout",
    service: "browser",
    status: "500",
    durationMs: 31500,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    metadata: {
        httpMethod: "POST",
        httpPath: "/api/checkout",
        httpStatusCode: 500,
        sessionId: SESSION_ID,
        userId: USER_ID,
        route: "/checkout/payment",
        timestamp: ms(55800),
    },
});
console.log("[scenario] Sent: browser HTTP failure trace");

// ---------------------------------------------------------------------------
// 8. Frontend TypeError — downstream cascade of the database timeout
// ---------------------------------------------------------------------------

const stack = `TypeError: Cannot read properties of undefined (reading 'orderId')
    at CheckoutConfirmation (src/pages/checkout/payment.tsx:87:42)
    at processOrder (src/pages/checkout/payment.tsx:61:18)
    at async handleCheckoutSubmit (src/pages/checkout/payment.tsx:45:24)
    at HTMLButtonElement.onClick (src/pages/checkout/payment.tsx:32:5)`;

await halo.capture({
    type: "ERROR",
    title: "TypeError: Cannot read properties of undefined (reading 'orderId')",
    message: "Cannot read properties of undefined (reading 'orderId')",
    severity: "ERROR",
    stack,
    sessionId: SESSION_ID,
    requestId: REQUEST_ID,
    traceId: TRACE_ID,
    service: "browser",
    resource: "/checkout/payment",
    operation: "checkout.submit",
    metadata: {
        route: "/checkout/payment",
        userId: USER_ID,
        sessionId: SESSION_ID,
        fileName: "src/pages/checkout/payment.tsx",
        lineNumber: 87,
        columnNumber: 42,
        httpStatus: 500,
        httpPath: "/api/checkout",
        traceId: TRACE_ID,
        requestId: REQUEST_ID,
        immediateFailureSite: "CheckoutConfirmation component",
        upstreamFailure: "POST /api/checkout returned 500 (database timeout in payment service)",
        timestamp: ms(55810),
    },
});
console.log("[scenario] Sent: frontend TypeError");

// ---------------------------------------------------------------------------

await halo.flush();

console.log("\n[scenario] All telemetry sent successfully.");
console.log("[scenario] Open Halo → Issues → find the TypeError → Investigate");
console.log("[scenario] Expected: database timeout identified as primary failure,");
console.log("[scenario]           payment provider hypothesis refuted by 200 OK,");
console.log("[scenario]           internal DB reason explicitly Unknown (telemetry gap).");
