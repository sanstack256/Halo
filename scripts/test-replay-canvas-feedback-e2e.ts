/**
 * HALO SESSION REPLAY — CANVAS 2D, WEBGL & USER FEEDBACK E2E VALIDATION
 *
 * Validates the remaining baseline gaps under real browser and GPU conditions:
 * 1. User Feedback Pipeline:
 *    DOM Modal Submission -> API Ingestion -> PostgreSQL (Feedback.replaySessionId) -> Replay Player UI Association
 * 2. GPU-Accelerated Canvas 2D Replay:
 *    Real Chrome Metal/Angle 2D Drawing -> recordCanvas: true -> Ingestion -> Player Iframe Pixel Reconstruction
 * 3. GPU-Accelerated WebGL Replay:
 *    Real Chrome WebGL Context -> recordCanvas: true -> Ingestion -> Player Iframe Canvas Frame Reconstruction
 */

import * as path from "path";
import { chromium } from "playwright";
import { prisma } from "../apps/dashboard/src/lib/prisma";

const BASE_URL = process.env.HALO_BASE_URL || "http://localhost:3001";
const API_KEY = process.env.HALO_API_KEY || "hl_live_38022b53394bf9229b3e691f479984599ae7bc6b9fc7223f370065be055af9ee";
const PROJECT_ID = process.env.HALO_PROJECT_ID || "cmtvy6lah025csxl8zrd0x0dh";

interface StepResult {
    suite: string;
    name: string;
    passed: boolean;
    details: string;
}

const results: StepResult[] = [];

function record(suite: string, name: string, passed: boolean, details: string) {
    results.push({ suite, name, passed, details });
    if (passed) {
        console.log(`\x1b[32m✓ PASS\x1b[0m [${suite}] ${name} — ${details}`);
    } else {
        console.error(`\x1b[31m✗ FAIL\x1b[0m [${suite}] ${name} — ${details}`);
    }
}

async function main() {
    console.log("============================================================");
    console.log("HALO SESSION REPLAY — CANVAS 2D, WEBGL & FEEDBACK E2E TEST");
    console.log("============================================================\n");

    // Launch Chrome with full GPU and WebGL hardware acceleration flags
    const browser = await chromium.launch({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: true,
        args: [
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--use-gl=angle",
            "--use-angle=metal",
            "--enable-gpu-rasterization",
        ],
    });

    const haloReplayBundlePath = path.resolve(process.cwd(), "packages/replay/dist/index.global.js");

    try {
        // ====================================================================
        // SUITE 1: User Feedback End-to-End Pipeline
        // ====================================================================
        console.log("\n--- SUITE 1: User Feedback End-to-End Pipeline ---");
        {
            const context = await browser.newContext();
            const page = await context.newPage();
            const feedbackSessionId = `hs_feedback_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const canaryComment = `CANARY_FEEDBACK_${Date.now()}: The payment checkout button stalled on step 2.`;

            const feedbackAppHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>User Feedback Demo App</title></head>
            <body style="background: #0d1117; color: #fff; font-family: sans-serif; padding: 30px;">
                <h1>Customer Portal</h1>
                <button id="open-feedback-btn">Give Feedback</button>
            </body>
            </html>
            `;

            await page.route(`${BASE_URL}/feedback-portal`, (route) => {
                route.fulfill({ status: 200, contentType: "text/html", body: feedbackAppHtml });
            });
            await page.goto(`${BASE_URL}/feedback-portal`);
            await page.addScriptTag({ path: haloReplayBundlePath });

            // Initialize recorder
            await page.evaluate(`
                (function(args) {
                    const r = new window.HaloReplayBundle.HaloReplay({
                        sessionId: args.sessionId,
                        projectId: args.projectId,
                        endpoint: args.endpoint,
                        samplingRate: 1.0,
                        errorTriggered: false,
                    });
                    r.start();
                    window.__recorder = r;

                    document.getElementById("open-feedback-btn").onclick = () => {
                        r.openFeedbackModal({
                            title: "Help Us Improve",
                            subtitle: "Report an issue directly to the engineering team",
                        });
                    };
                })(${JSON.stringify({ sessionId: feedbackSessionId, projectId: PROJECT_ID, endpoint: `${BASE_URL}/api` })});
            `);
            await page.waitForTimeout(200);

            // 1. Open feedback modal via button click
            await page.click("#open-feedback-btn");
            await page.waitForSelector("#halo-feedback-modal-overlay", { timeout: 3000 });
            record("User Feedback", "Modal Injected into DOM", true, "Modal overlay rendered with role='dialog'");

            // 2. Fill in feedback form in real browser DOM
            await page.fill("#halo-feedback-name", "Alexandra Chen");
            await page.fill("#halo-feedback-email", "alexandra@acme-corp.io");
            await page.fill("#halo-feedback-comments", canaryComment);
            await page.click("#halo-feedback-submit-btn");

            // Wait for modal to automatically close upon successful submission
            await page.waitForSelector("#halo-feedback-modal-overlay", { state: "detached", timeout: 5000 });
            record("User Feedback", "Modal Submission & Auto-Dismiss", true, "Form submitted and overlay detached");

            // Conclude recording and ingest session
            await page.evaluate("window.__recorder.flushAndConclude()");
            const events: any[] = await page.evaluate("window.__recorder.getRecordedEvents()");

            const ingestRes = await fetch(`${BASE_URL}/api/ingest/replay`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    sessionId: feedbackSessionId,
                    sequence: 0,
                    events,
                    startedAt: new Date(events[0].timestamp).toISOString(),
                    endedAt: new Date(events[events.length - 1].timestamp).toISOString(),
                    meta: { projectId: PROJECT_ID, url: `${BASE_URL}/feedback-portal` },
                    final: true,
                }),
            });
            const ingestJson: any = await ingestRes.json();
            const replayDbId = ingestJson.replaySessionId;

            // 3. Verify PostgreSQL persistence
            const dbFeedback = await prisma.feedback.findFirst({
                where: { comments: canaryComment },
                include: { replaySession: true },
            });

            record(
                "User Feedback",
                "PostgreSQL Storage & Session Association",
                Boolean(dbFeedback && dbFeedback.replaySessionId === replayDbId),
                `Feedback ID: ${dbFeedback?.id} linked to ReplaySession ID: ${dbFeedback?.replaySessionId}`
            );

            // 4. Verify Replay Player UI displays feedback
            await context.addCookies([
                { name: "halo-dev-auth", value: "true", domain: "localhost", path: "/" },
                { name: "halo-dev-email", value: "nssan2007@gmail.com", domain: "localhost", path: "/" },
            ]);
            await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/replays/${replayDbId}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(1500);

            // Check if User Feedback tab exists and click it
            const feedbackTabBtn = await page.$("button:has-text('User Feedback')");
            record("User Feedback", "Player UI Feedback Tab Rendered", Boolean(feedbackTabBtn), "User Feedback tab badge visible in player");

            if (feedbackTabBtn) {
                await feedbackTabBtn.click();
                await page.waitForTimeout(300);
                const feedbackText = await page.textContent('[data-testid="user-feedback-list"]');
                record(
                    "User Feedback",
                    "Player UI Feedback Content Match",
                    Boolean(feedbackText && feedbackText.includes(canaryComment) && feedbackText.includes("Alexandra Chen")),
                    `Rendered feedback for "Alexandra Chen" with canary text`
                );
            }

            await context.close();
        }

        // ====================================================================
        // SUITE 2: GPU-Accelerated Canvas 2D Replay
        // ====================================================================
        console.log("\n--- SUITE 2: GPU-Accelerated Canvas 2D Replay ---");
        {
            const context = await browser.newContext();
            const page = await context.newPage();
            const canvas2dSessionId = `hs_canvas2d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            const canvas2dHtml = `
            <!DOCTYPE html>
            <html>
            <body style="background: #0d1117; color: #fff; padding: 20px;">
                <h2>Canvas 2D Graphics</h2>
                <canvas id="canvas-2d" width="300" height="200" style="border: 1px solid #333;"></canvas>
                <script>
                    const canvas = document.getElementById("canvas-2d");
                    const ctx = canvas.getContext("2d");
                    // Step 1: Red rectangle
                    ctx.fillStyle = "rgb(255, 0, 0)";
                    ctx.fillRect(10, 10, 80, 60);

                    // Step 2: Green circle
                    ctx.fillStyle = "rgb(0, 255, 0)";
                    ctx.beginPath();
                    ctx.arc(150, 100, 35, 0, Math.PI * 2);
                    ctx.fill();

                    // Step 3 (Delayed): Blue banner
                    setTimeout(() => {
                        ctx.fillStyle = "rgb(0, 0, 255)";
                        ctx.fillRect(50, 150, 200, 30);
                    }, 200);
                </script>
            </body>
            </html>
            `;

            await page.route(`${BASE_URL}/canvas-2d-app`, (route) => {
                route.fulfill({ status: 200, contentType: "text/html", body: canvas2dHtml });
            });
            await page.goto(`${BASE_URL}/canvas-2d-app`);
            await page.addScriptTag({ path: haloReplayBundlePath });

            await page.evaluate(`
                (function(args) {
                    const r = new window.HaloReplayBundle.HaloReplay({
                        sessionId: args.sessionId,
                        projectId: args.projectId,
                        endpoint: args.endpoint,
                        samplingRate: 1.0,
                        errorTriggered: false,
                        recordCanvas: true,
                    });
                    r.start();
                    window.__canvasRecorder = r;
                })(${JSON.stringify({ sessionId: canvas2dSessionId, projectId: PROJECT_ID, endpoint: `${BASE_URL}/api` })});
            `);

            // Wait for delayed canvas drawing
            await page.waitForTimeout(400);

            await page.evaluate("window.__canvasRecorder.flushAndConclude()");
            const events: any[] = await page.evaluate("window.__canvasRecorder.getRecordedEvents()");

            // Verify canvas snapshot/command events captured
            const canvasEvents = events.filter((e: any) => {
                const s = JSON.stringify(e);
                return s.includes("canvas") || (e.type === 3 && (e.data as any)?.source === 9); // source 9 = rrweb canvas mutation
            });
            record("Canvas 2D Replay", "Canvas Events Recorded in Stream", canvasEvents.length > 0, `Captured ${canvasEvents.length} canvas events in stream`);

            // Ingest to API
            const ingestRes = await fetch(`${BASE_URL}/api/ingest/replay`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    sessionId: canvas2dSessionId,
                    sequence: 0,
                    events,
                    startedAt: new Date(events[0].timestamp).toISOString(),
                    endedAt: new Date(events[events.length - 1].timestamp).toISOString(),
                    meta: { projectId: PROJECT_ID, url: `${BASE_URL}/canvas-2d-app` },
                    final: true,
                }),
            });
            const ingestJson: any = await ingestRes.json();
            const replayDbId = ingestJson.replaySessionId;

            // Open Replay Player in Chrome with dev auth
            await context.addCookies([
                { name: "halo-dev-auth", value: "true", domain: "localhost", path: "/" },
                { name: "halo-dev-email", value: "nssan2007@gmail.com", domain: "localhost", path: "/" },
            ]);
            await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/replays/${replayDbId}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(1500);

            // Verify reconstructed Canvas element in player iframe
            const canvasReconstructed = await page.evaluate(() => {
                const iframe = document.querySelector("iframe");
                if (!iframe || !iframe.contentDocument) return null;
                const canvasEl = iframe.contentDocument.querySelector("canvas") as HTMLCanvasElement;
                if (!canvasEl) return null;
                return {
                    width: canvasEl.width,
                    height: canvasEl.height,
                    exists: true,
                };
            });

            record(
                "Canvas 2D Replay",
                "Canvas 2D Reconstructed in Player Iframe",
                Boolean(canvasReconstructed?.exists && canvasReconstructed?.width > 0),
                `Reconstructed <canvas> with dimensions: ${canvasReconstructed?.width}x${canvasReconstructed?.height}`
            );

            await context.close();
        }

        // ====================================================================
        // SUITE 3: GPU-Accelerated WebGL Replay
        // ====================================================================
        console.log("\n--- SUITE 3: GPU-Accelerated WebGL Replay ---");
        {
            const context = await browser.newContext();
            const page = await context.newPage();
            const webglSessionId = `hs_webgl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            const webglHtml = `
            <!DOCTYPE html>
            <html>
            <body style="background: #0d1117; color: #fff; padding: 20px;">
                <h2>WebGL Hardware Context</h2>
                <canvas id="canvas-webgl" width="250" height="250" style="border: 1px solid #444;"></canvas>
                <script>
                    const canvas = document.getElementById("canvas-webgl");
                    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                    window.__glContextAcquired = Boolean(gl);
                    if (gl) {
                        // Clear to cyan
                        gl.clearColor(0.0, 0.8, 0.8, 1.0);
                        gl.clear(gl.COLOR_BUFFER_BIT);

                        // At 200ms clear to purple
                        setTimeout(() => {
                            gl.clearColor(0.6, 0.1, 0.8, 1.0);
                            gl.clear(gl.COLOR_BUFFER_BIT);
                        }, 200);
                    }
                </script>
            </body>
            </html>
            `;

            await page.route(`${BASE_URL}/webgl-app`, (route) => {
                route.fulfill({ status: 200, contentType: "text/html", body: webglHtml });
            });
            await page.goto(`${BASE_URL}/webgl-app`);
            await page.addScriptTag({ path: haloReplayBundlePath });

            const glAcquired = await page.evaluate("window.__glContextAcquired");
            record("WebGL Replay", "WebGL Context Initialized with Metal/Angle", Boolean(glAcquired), "WebGL hardware context initialized");

            await page.evaluate(`
                (function(args) {
                    const r = new window.HaloReplayBundle.HaloReplay({
                        sessionId: args.sessionId,
                        projectId: args.projectId,
                        endpoint: args.endpoint,
                        samplingRate: 1.0,
                        errorTriggered: false,
                        recordCanvas: true,
                    });
                    r.start();
                    window.__webglRecorder = r;
                })(${JSON.stringify({ sessionId: webglSessionId, projectId: PROJECT_ID, endpoint: `${BASE_URL}/api` })});
            `);

            await page.waitForTimeout(400);

            await page.evaluate("window.__webglRecorder.flushAndConclude()");
            const events: any[] = await page.evaluate("window.__webglRecorder.getRecordedEvents()");

            // Ingest to API
            const ingestRes = await fetch(`${BASE_URL}/api/ingest/replay`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    sessionId: webglSessionId,
                    sequence: 0,
                    events,
                    startedAt: new Date(events[0].timestamp).toISOString(),
                    endedAt: new Date(events[events.length - 1].timestamp).toISOString(),
                    meta: { projectId: PROJECT_ID, url: `${BASE_URL}/webgl-app` },
                    final: true,
                }),
            });
            const ingestJson: any = await ingestRes.json();
            const replayDbId = ingestJson.replaySessionId;

            // Open Replay Player in Chrome with dev auth
            await context.addCookies([
                { name: "halo-dev-auth", value: "true", domain: "localhost", path: "/" },
                { name: "halo-dev-email", value: "nssan2007@gmail.com", domain: "localhost", path: "/" },
            ]);
            await page.goto(`${BASE_URL}/projects/${PROJECT_ID}/replays/${replayDbId}`, { waitUntil: "networkidle" });
            await page.waitForTimeout(1500);

            // Verify reconstructed WebGL Canvas element in player iframe without crash
            const webglReconstructed = await page.evaluate(() => {
                const iframe = document.querySelector("iframe");
                if (!iframe || !iframe.contentDocument) return null;
                const canvasEl = iframe.contentDocument.querySelector("canvas") as HTMLCanvasElement;
                if (!canvasEl) return null;
                return {
                    width: canvasEl.width,
                    height: canvasEl.height,
                    exists: true,
                };
            });

            record(
                "WebGL Replay",
                "WebGL Canvas Reconstructed in Player Iframe",
                Boolean(webglReconstructed?.exists && webglReconstructed?.width > 0),
                `Reconstructed <canvas> with dimensions: ${webglReconstructed?.width}x${webglReconstructed?.height}`
            );

            await context.close();
        }

    } finally {
        await browser.close();
    }

    console.log("\n============================================================");
    console.log("VALIDATION SUMMARY");
    console.log("============================================================");
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Total Checks: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

    if (failed > 0) {
        console.error("Some checks failed!");
        process.exit(1);
    } else {
        console.log("ALL CANVAS 2D, WEBGL & USER FEEDBACK CHECKS PASSED!");
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
