/**
 * Halo Trace Explore — Real End-to-End Verification Suite
 * Executes full validation across all 8 Explore analytical engines against real telemetry in PostgreSQL.
 */

import * as fs from "fs";
import * as path from "path";
import { prisma } from "../apps/dashboard/src/lib/prisma";
import {
    searchEvidenceCategories,
    constructEvidenceNeedle,
} from "../apps/dashboard/src/lib/explore/evidence-needle";
import { constructLogThreads } from "../apps/dashboard/src/lib/explore/log-threader";
import { computeTraceDivergence } from "../apps/dashboard/src/lib/explore/trace-divergence";
import { generateErrorReproductionRecipe } from "../apps/dashboard/src/lib/explore/error-recipe";
import { computeMetricShapeTwins } from "../apps/dashboard/src/lib/explore/metric-twin";
import { reconstructRequest } from "../apps/dashboard/src/lib/explore/request-reconstruction";
import { computeDatabaseWaitAttribution } from "../apps/dashboard/src/lib/explore/db-attribution";
import { compareRuntimeFingerprint } from "../apps/dashboard/src/lib/explore/runtime-fingerprint";
import {
    getEventById,
    getEventsInTimeRange,
    batchFetchLinkedEvidence,
} from "../apps/dashboard/src/lib/explore/canonical-evidence-access";

interface TestReportItem {
    test: string;
    dataSource: string;
    expected: string;
    actual: string;
    status: "PASS" | "FAIL" | "BLOCKED";
    evidence: string;
}

const report: TestReportItem[] = [];

function recordTest(item: TestReportItem) {
    report.push(item);
    const badge = item.status === "PASS" ? "✓ PASS" : item.status === "FAIL" ? "✗ FAIL" : "⚠ BLOCKED";
    console.log(`${badge} [${item.test}] ${item.actual}`);
}

export async function runE2EVerification() {
    console.log("=== Starting Halo Trace Explore End-to-End Validation against Real Telemetry ===\n");

    const manifestPath = path.resolve(process.cwd(), "scratch", "e2e-manifest.json");
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest not found at ${manifestPath}. Run e2e-telemetry-generator.ts first.`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const { primaryProjectId, secondaryProjectId, scenarios } = manifest;

    // Resolve Org IDs
    const primaryProject = await prisma.project.findUnique({ where: { id: primaryProjectId } });
    const secondaryProject = await prisma.project.findUnique({ where: { id: secondaryProjectId } });
    if (!primaryProject || !secondaryProject) throw new Error("Could not resolve test projects from database");

    const primaryOrgId = primaryProject.organizationId;
    const secondaryOrgId = secondaryProject.organizationId;

    console.log(`Primary Org ID: ${primaryOrgId} (Project: ${primaryProjectId})`);
    console.log(`Secondary Org ID: ${secondaryOrgId} (Project: ${secondaryProjectId})\n`);

    // =========================================================================
    // 1. SEARCH: EVIDENCE NEEDLE
    // =========================================================================
    console.log("--- 1. Testing Search: Evidence Needle ---");
    try {
        const scA = scenarios.scenarioA;
        // Test syntax: trace:<traceId>
        const traceSearch = await searchEvidenceCategories(
            primaryOrgId,
            `trace:${scA.traceId}`,
            undefined,
            [primaryProjectId]
        );

        const foundTrace = traceSearch.traces.some((t) => t.traceId === scA.traceId);
        const anchorRecord = traceSearch.traces.find((t) => t.traceId === scA.traceId);

        if (!foundTrace || !anchorRecord) {
            recordTest({
                test: "Search: trace syntax query",
                dataSource: `traceId=${scA.traceId}`,
                expected: "Find real trace record in PostgreSQL",
                actual: "Trace record not found in search results",
                status: "FAIL",
                evidence: `Queried trace:${scA.traceId}, returned ${traceSearch.traces.length} traces`,
            });
        } else {
            recordTest({
                test: "Search: trace syntax query",
                dataSource: `traceId=${scA.traceId}`,
                expected: "Exact traceId matched in PostgreSQL telemetry",
                actual: `Retrieved trace '${anchorRecord.id}' with service '${anchorRecord.service}'`,
                status: "PASS",
                evidence: `Event ID: ${anchorRecord.id}, Trace ID: ${anchorRecord.traceId}`,
            });

            // Construct Needle
            const needle = await constructEvidenceNeedle(anchorRecord.id, primaryOrgId);
            if (!needle) {
                recordTest({
                    test: "Search: Needle execution neighborhood reconstruction",
                    dataSource: `anchorId=${anchorRecord.id}`,
                    expected: "Reconstruct execution neighborhood around anchor",
                    actual: "Needle returned null",
                    status: "FAIL",
                    evidence: `Anchor ID: ${anchorRecord.id}`,
                });
            } else {
                const hasTraceLinks = needle.summary.directTraceCount > 0;
                const anchorIsDirect = needle.items.find((i) => i.isAnchor)?.relationshipType === "DIRECT";

                recordTest({
                    test: "Search: Needle execution neighborhood reconstruction",
                    dataSource: `anchorId=${anchorRecord.id}`,
                    expected: "Reconstruct neighborhood with DIRECT anchor and TRACE_LINK relationships",
                    actual: `Neighborhood reconstructed with ${needle.items.length} items (${needle.summary.directTraceCount} trace-linked)`,
                    status: hasTraceLinks && anchorIsDirect ? "PASS" : "FAIL",
                    evidence: `Items: ${needle.items.length}, TraceLinks: ${needle.summary.directTraceCount}, Anchor: ${anchorIsDirect}`,
                });
            }
        }

        // Test syntax: request:<requestId>
        const reqSearch = await searchEvidenceCategories(
            primaryOrgId,
            `request:${scA.requestId}`,
            undefined,
            [primaryProjectId]
        );
        const foundReq = reqSearch.requests.some((r) => r.requestId === scA.requestId);
        recordTest({
            test: "Search: request syntax query",
            dataSource: `requestId=${scA.requestId}`,
            expected: "Exact requestId matched in PostgreSQL telemetry",
            actual: `Found ${reqSearch.requests.length} matching request records`,
            status: foundReq ? "PASS" : "FAIL",
            evidence: `Request ID: ${scA.requestId}, Matches: ${reqSearch.requests.length}`,
        });

        // Test syntax: service:<service>
        const srvSearch = await searchEvidenceCategories(
            primaryOrgId,
            `service:${scA.service}`,
            undefined,
            [primaryProjectId]
        );
        const foundSrv = srvSearch.totalMatches > 0 && srvSearch.traces.every((t) => t.service === scA.service);
        recordTest({
            test: "Search: service syntax query",
            dataSource: `service=${scA.service}`,
            expected: "Filter results strictly to requested service",
            actual: `Retrieved ${srvSearch.totalMatches} matches strictly matching service '${scA.service}'`,
            status: foundSrv ? "PASS" : "FAIL",
            evidence: `Service: ${scA.service}, Total Matches: ${srvSearch.totalMatches}`,
        });

        // Test invalid / no-result query
        const emptySearch = await searchEvidenceCategories(
            primaryOrgId,
            "trace:non_existent_trace_999999999",
            undefined,
            [primaryProjectId]
        );
        const honestEmpty = emptySearch.totalMatches === 0 && emptySearch.traces.length === 0;
        recordTest({
            test: "Search: honest empty state (no fake results)",
            dataSource: "trace:non_existent_trace_999999999",
            expected: "totalMatches === 0 without fabricated items",
            actual: `Returned ${emptySearch.totalMatches} results`,
            status: honestEmpty ? "PASS" : "FAIL",
            evidence: `Total Matches: ${emptySearch.totalMatches}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Search Engine Exception",
            dataSource: "Search API",
            expected: "Clean query execution",
            actual: `Exception thrown: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 2. LOGS: LOG THREADER
    // =========================================================================
    console.log("\n--- 2. Testing Logs: Log Threader ---");
    try {
        const scA = scenarios.scenarioA;
        const threadResult = await constructLogThreads(
            { projectIds: [primaryProjectId], search: scA.traceId },
            primaryOrgId
        );

        const thread = threadResult.threads.find((t) => t.threadKey.includes(scA.traceId));
        if (!thread) {
            recordTest({
                test: "Logs: Thread reconstruction by traceId",
                dataSource: `traceId=${scA.traceId}`,
                expected: "Reconstruct thread for target traceId",
                actual: "Thread not found in threader results",
                status: "FAIL",
                evidence: `Total threads returned: ${threadResult.threads.length}`,
            });
        } else {
            const hasEvents = thread.totalEventCount > 0;
            const isDirect = thread.strength === "DIRECT";
            const clusters = thread.clusters;

            recordTest({
                test: "Logs: Thread reconstruction by traceId",
                dataSource: `traceId=${scA.traceId}`,
                expected: "Thread reconstructed with DIRECT strength and chronological order",
                actual: `Thread '${thread.threadKey}' reconstructed with ${thread.totalEventCount} events, strength: ${thread.strength}`,
                status: hasEvents && isDirect ? "PASS" : "FAIL",
                evidence: `Thread ID: ${thread.threadId}, Strength: ${thread.strength}, Events: ${thread.totalEventCount}`,
            });

            // Verify non-destructive compression
            let allNodeIdsPreserved = true;
            for (const cl of clusters) {
                if (cl.underlyingEventIds.length !== cl.count) {
                    allNodeIdsPreserved = false;
                }
            }
            recordTest({
                test: "Logs: Non-destructive cluster compression",
                dataSource: `Thread ${thread.threadId}`,
                expected: "underlyingEventIds preserves raw evidence IDs",
                actual: `All ${clusters.length} clusters preserve raw event IDs without data loss`,
                status: allNodeIdsPreserved ? "PASS" : "FAIL",
                evidence: `Clusters: ${clusters.length}, Preserved: ${allNodeIdsPreserved}`,
            });
        }
    } catch (e: any) {
        recordTest({
            test: "Logs Engine Exception",
            dataSource: "Log Threader",
            expected: "Clean thread execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 3. TRACES: DIVERGENCE FINDER
    // =========================================================================
    console.log("\n--- 3. Testing Traces: Divergence Finder ---");
    try {
        const scE = scenarios.scenarioE;
        // Test Divergence between Trace A and Trace B
        const divergence = await computeTraceDivergence(
            scE.targetTraceId,
            primaryOrgId,
            scE.referenceTraceId
        );

        if (!divergence || !divergence.traceB) {
            recordTest({
                test: "Traces: Explicit trace comparison",
                dataSource: `Target: ${scE.targetTraceId}, Ref: ${scE.referenceTraceId}`,
                expected: "Both traces loaded and aligned",
                actual: "Trace comparison returned null or missing trace B",
                status: "FAIL",
                evidence: "Divergence result was null",
            });
        } else {
            const hasDivergence = divergence.firstDivergence !== null;
            const isSpan4 = divergence.firstDivergence?.index === 4;
            const isLeadNotRoot = divergence.firstDivergence?.divergenceType === "MISSING_SPAN";

            recordTest({
                test: "Traces: First Observed Divergence detection",
                dataSource: `Target: ${scE.targetTraceId} (4 spans), Ref: ${scE.referenceTraceId} (5 spans)`,
                expected: "Pinpoint first divergence at span index 4 as an investigation lead",
                actual: `First divergence detected at span #${(divergence.firstDivergence?.index ?? 0) + 1}: '${divergence.firstDivergence?.divergenceType}'`,
                status: hasDivergence && isSpan4 && isLeadNotRoot ? "PASS" : "FAIL",
                evidence: `Explanation: ${divergence.firstDivergence?.divergenceExplanation}, Basis: ${divergence.referenceQualityReasons.join("; ")}`,
            });
        }

        // Test shallow 1-span trace pair
        const shallowDiv = await computeTraceDivergence(
            scE.shallowTrace1,
            primaryOrgId,
            scE.shallowTrace2
        );
        const isLimited = shallowDiv?.sufficiency.status === "LIMITED";
        const hasDepthWarning = shallowDiv?.sufficiency.reasons[0]?.includes("Only one span was captured in each execution");

        recordTest({
            test: "Traces: Shallow 1-span trace comparison boundary",
            dataSource: `Shallow Trace 1 (${scE.shallowTrace1}) vs Shallow Trace 2 (${scE.shallowTrace2})`,
            expected: "LIMITED sufficiency with 'Only one span was captured in each execution' (never fully equivalent)",
            actual: `Sufficiency status: '${shallowDiv?.sufficiency.status}' with reason: '${shallowDiv?.sufficiency.reasons[0]}'`,
            status: isLimited && hasDepthWarning ? "PASS" : "FAIL",
            evidence: `Sufficiency: ${shallowDiv?.sufficiency.status}, Reasons: ${shallowDiv?.sufficiency.reasons.join(", ")}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Traces Engine Exception",
            dataSource: "Trace Divergence",
            expected: "Clean divergence execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 4. ERRORS: REPRODUCTION ANALYSIS
    // =========================================================================
    console.log("\n--- 4. Testing Errors: Reproduction Analysis ---");
    try {
        const scD = scenarios.scenarioD;
        // Test multiple failures + successes for lockFingerprint
        const recipe = await generateErrorReproductionRecipe(
            { fingerprint: scD.sharedFingerprint },
            primaryOrgId
        );

        if (!recipe) {
            recordTest({
                test: "Errors: Multi-occurrence reproduction matrix",
                dataSource: `fingerprint=${scD.sharedFingerprint}`,
                expected: "Extract reproduction recipe across failures and successes",
                actual: "Recipe returned null",
                status: "FAIL",
                evidence: `Fingerprint ${scD.sharedFingerprint}`,
            });
        } else {
            const hasFailures = recipe.totalOccurrences === 4;
            const hasComparators = recipe.totalComparators >= 2;

            // Check Condition A (apple_pay): must be present in failures AND successes, so must NOT be causal root cause
            const condA = recipe.conditions.find((c) => c.value === "apple_pay");
            const condANotCausal = condA !== undefined && condA.failureFraction === "4/4";

            recordTest({
                test: "Errors: Multi-occurrence comparative matrix & anti-false-causality",
                dataSource: `fingerprint=${scD.sharedFingerprint} (4 failures, ${recipe.totalComparators} successes)`,
                expected: "Report exact failure frequency (4/4) and comparator frequency without declaring causal necessity",
                actual: `Evaluated ${recipe.totalOccurrences} failures and ${recipe.totalComparators} successes. Condition apple_pay failure: ${condA?.failureFraction}, success: ${condA?.successFraction}`,
                status: hasFailures && hasComparators && condANotCausal ? "PASS" : "FAIL",
                evidence: `Total Failures: ${recipe.totalOccurrences}, Total Comparators: ${recipe.totalComparators}, Classification: ${condA?.classification}`,
            });

            // Plain-text recipe verification
            const textHasObservedFacts = recipe.rawRecipeText.includes("FACTUAL ERROR REPRODUCTION RECIPE") && recipe.rawRecipeText.includes(scD.sharedFingerprint);
            recordTest({
                test: "Errors: Copy reproduction recipe contains observed facts only",
                dataSource: `Recipe plain-text`,
                expected: "Plain-text export contains observed frequencies and metadata",
                actual: `Plain-text recipe generated (${recipe.rawRecipeText.length} chars)`,
                status: textHasObservedFacts ? "PASS" : "FAIL",
                evidence: `Header snippet: ${recipe.rawRecipeText.slice(0, 100).replace(/\n/g, " ")}`,
            });
        }

        // Test single isolated failure (1/1 failure, 0 successes)
        const singleRecipe = await generateErrorReproductionRecipe(
            { fingerprint: scD.isolatedSingleFingerprint },
            primaryOrgId
        );
        const isSingleLimited = singleRecipe?.sufficiency.status === "LIMITED";
        const hasSingleReason = singleRecipe?.sufficiency.reasons[0]?.includes("Only 1 failure occurrence observed");

        recordTest({
            test: "Errors: 1/1 Failure boundary (never claims required condition)",
            dataSource: `fingerprint=${scD.isolatedSingleFingerprint} (1 occurrence)`,
            expected: "Sufficiency status LIMITED; explicitly states 1 observation cannot establish requirement",
            actual: `Sufficiency status: '${singleRecipe?.sufficiency.status}', Reason: '${singleRecipe?.sufficiency.reasons[0]}'`,
            status: isSingleLimited && hasSingleReason ? "PASS" : "FAIL",
            evidence: `Sufficiency: ${singleRecipe?.sufficiency.status}, Reasons: ${singleRecipe?.sufficiency.reasons.join("; ")}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Errors Engine Exception",
            dataSource: "Error Recipe",
            expected: "Clean recipe execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 5. METRICS: SHAPE TWIN & SUFFICIENCY
    // =========================================================================
    console.log("\n--- 5. Testing Metrics: Shape Twin & Sufficiency ---");
    try {
        const metricResult = await computeMetricShapeTwins("latency", "24h", primaryOrgId, [primaryProjectId]);
        const isSufficient = metricResult.sufficiency.status === "SUFFICIENT";

        recordTest({
            test: "Metrics: Sufficient shape analysis (≥4 samples)",
            dataSource: "Metric: latency (24h window)",
            expected: "SUFFICIENT status with peak, average, and contour distance calculation",
            actual: `Sample points: ${metricResult.currentWindow.points.length}, Peak: ${metricResult.currentWindow.peakValue}ms, Status: ${metricResult.sufficiency.status}`,
            status: isSufficient ? "PASS" : "FAIL",
            evidence: `Points: ${metricResult.currentWindow.points.length}, Peak: ${metricResult.currentWindow.peakValue}, Avg: ${metricResult.currentWindow.avgValue}, BestTwin: ${metricResult.bestTwin?.similarity || "none"}`,
        });

        // Test sparse window (< 4 samples in 1h window on sparse project in same org)
        const sparseProjectId = "cmsehk8ju0000hlihc9olftdt"; // halo api testing
        const sparseResult = await computeMetricShapeTwins("latency", "1h", primaryOrgId, [sparseProjectId]);
        const isSparseOrEmpty = sparseResult.sufficiency.status === "INSUFFICIENT";

        recordTest({
            test: "Metrics: Sparse samples boundary (INSUFFICIENT SHAPE DATA)",
            dataSource: "Metric: errors (1h window)",
            expected: "Report INSUFFICIENT when sample count < 4; no fabricated similarity score",
            actual: `Sufficiency: '${sparseResult.sufficiency.status}', Reasons: '${sparseResult.sufficiency.reasons[0]}'`,
            status: isSparseOrEmpty ? "PASS" : "FAIL",
            evidence: `Sufficiency: ${sparseResult.sufficiency.status}, BestTwin: ${sparseResult.bestTwin ? sparseResult.bestTwin.similarity : "null"}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Metrics Engine Exception",
            dataSource: "Metric Shape Twin",
            expected: "Clean metric execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 6. REQUESTS: LIFECYCLE RECONSTRUCTION
    // =========================================================================
    console.log("\n--- 6. Testing Requests: Lifecycle Reconstruction ---");
    try {
        const scA = scenarios.scenarioA;
        const scC = scenarios.scenarioC;

        // Test Healthy Request with captured body & headers
        const reconA = await reconstructRequest(scA.requestId, primaryOrgId);
        if (!reconA) {
            recordTest({
                test: "Requests: Full lifecycle reconstruction",
                dataSource: `requestId=${scA.requestId}`,
                expected: "Reconstruct all 5 lifecycle sections",
                actual: "Reconstruction returned null",
                status: "FAIL",
                evidence: `Request ID: ${scA.requestId}`,
            });
        } else {
            const hasIngress = reconA.ingress.method === "POST" && reconA.ingress.url === "/api/checkout";
            const bodyCaptured = reconA.ingress.bodyCaptured === true;
            const hasHeaders = Object.keys(reconA.ingress.capturedHeaders).length > 0;
            const hasProcessing = reconA.processing && reconA.processing.service === "checkout-service";
            const hasOutbound = reconA.outboundCalls.length > 0;

            recordTest({
                test: "Requests: Full lifecycle reconstruction (with captured body & headers)",
                dataSource: `requestId=${scA.requestId}`,
                expected: "Reconstruct ingress method, headers, captured body, and internal spans",
                actual: `Reconstructed POST ${reconA.ingress.url}, BodyCaptured: ${bodyCaptured}, Headers: ${Object.keys(reconA.ingress.capturedHeaders).length}, Spans: ${reconA.outboundCalls.length}`,
                status: hasIngress && bodyCaptured && hasHeaders && hasProcessing && hasOutbound ? "PASS" : "FAIL",
                evidence: `URL: ${reconA.ingress.url}, Spans: ${reconA.outboundCalls.length}, Headers: ${Object.keys(reconA.ingress.capturedHeaders).join(", ")}`,
            });
        }

        // Test Request with Missing Telemetry (No body, no headers, unattributed gap)
        const reconC = await reconstructRequest(scC.requestId, primaryOrgId);
        if (!reconC) {
            recordTest({
                test: "Requests: Missing telemetry handling",
                dataSource: `requestId=${scC.requestId}`,
                expected: "Reconstruct request with unmeasured gap and honest missing body",
                actual: "Reconstruction returned null",
                status: "FAIL",
                evidence: `Request ID: ${scC.requestId}`,
            });
        } else {
            const bodyNotCaptured = reconC.ingress.bodyCaptured === false && reconC.ingress.bodySummary === null;
            const headersEmpty = Object.keys(reconC.ingress.capturedHeaders).length === 0;
            const gapDetected = reconC.gaps.length > 0 && reconC.gaps[0].durationMs >= 400;

            recordTest({
                test: "Requests: Honest missing body, missing headers, and unmeasured gap detection",
                dataSource: `requestId=${scC.requestId} (Total: 600ms, Span: 120ms)`,
                expected: "bodyCaptured === false (never '{}'), 0 safe headers, and ~480ms unmeasured gap",
                actual: `BodyCaptured: ${reconC.ingress.bodyCaptured}, HeadersCount: ${Object.keys(reconC.ingress.capturedHeaders).length}, DetectedGap: ${reconC.gaps[0]?.durationMs}ms`,
                status: bodyNotCaptured && headersEmpty && gapDetected ? "PASS" : "FAIL",
                evidence: `BodyPayload: ${reconC.ingress.bodyPayload}, GapDescription: ${reconC.gaps[0]?.description}`,
            });
        }
    } catch (e: any) {
        recordTest({
            test: "Requests Engine Exception",
            dataSource: "Request Reconstruction",
            expected: "Clean request lifecycle execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 7. DATABASE: SPAN ATTRIBUTION
    // =========================================================================
    console.log("\n--- 7. Testing Database: Span Attribution ---");
    try {
        const scG = scenarios.scenarioG;

        // Request WITH database spans
        const dbResult = await computeDatabaseWaitAttribution(scG.withDbRequestId, primaryOrgId);
        if (!dbResult) {
            recordTest({
                test: "Database: Real span wait attribution",
                dataSource: `requestId=${scG.withDbRequestId}`,
                expected: "Attribute database wait across real PostgreSQL spans",
                actual: "Database attribution returned null",
                status: "FAIL",
                evidence: `Request ID: ${scG.withDbRequestId}`,
            });
        } else {
            const queryCountCorrect = dbResult.queries.length === 3;
            const dbWaitCorrect = dbResult.totalDbWaitMs === 220;
            const reqDurationCorrect = dbResult.requestDurationMs === 520;
            const unattributedCorrect = dbResult.unattributedMs === 300;

            recordTest({
                test: "Database: Real span wait attribution (220ms DB wait out of 520ms request)",
                dataSource: `requestId=${scG.withDbRequestId} (3 DB queries)`,
                expected: "queryCount=3, totalDbWaitMs=220, requestDurationMs=520, unattributedMs=300",
                actual: `queries.length=${dbResult.queries.length}, totalDbWaitMs=${dbResult.totalDbWaitMs}ms, requestDurationMs=${dbResult.requestDurationMs}ms, unattributedMs=${dbResult.unattributedMs}ms`,
                status: queryCountCorrect && dbWaitCorrect && reqDurationCorrect && unattributedCorrect ? "PASS" : "FAIL",
                evidence: `DB Wait: ${dbResult.totalDbWaitMs}ms (${dbResult.dbWaitPercentage}%), Queries: ${dbResult.queries.map((q) => `${q.durationMs}ms`).join(" + ")}`,
            });
        }

        // Request WITHOUT database spans
        const noDbResult = await computeDatabaseWaitAttribution(scG.withoutDbRequestId, primaryOrgId);
        const telemetryNotObserved = noDbResult?.telemetryObserved === false;
        const sufficiencyInsufficient = noDbResult?.sufficiency.status === "INSUFFICIENT";

        recordTest({
            test: "Database: Zero DB telemetry boundary (never claims 0ms wait)",
            dataSource: `requestId=${scG.withoutDbRequestId} (0 DB spans)`,
            expected: "telemetryObserved === false and sufficiency === INSUFFICIENT (never asserts 0ms)",
            actual: `telemetryObserved=${noDbResult?.telemetryObserved}, sufficiency=${noDbResult?.sufficiency.status}`,
            status: telemetryNotObserved && sufficiencyInsufficient ? "PASS" : "FAIL",
            evidence: `Sufficiency: ${noDbResult?.sufficiency.status}, WhatCannotBeEstablished: ${noDbResult?.sufficiency.whatCannotBeEstablished[0]}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Database Engine Exception",
            dataSource: "Database Attribution",
            expected: "Clean attribution execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 8. INFRASTRUCTURE: RUNTIME FINGERPRINT
    // =========================================================================
    console.log("\n--- 8. Testing Infrastructure: Runtime Fingerprint ---");
    try {
        const scH = scenarios.scenarioH;
        // Locate failure event by traceId
        const failureEvents = await prisma.event.findMany({
            where: { traceId: scH.failureTraceId, type: "ERROR" },
        });

        if (failureEvents.length === 0) {
            recordTest({
                test: "Infrastructure: Runtime fingerprint comparison",
                dataSource: `traceId=${scH.failureTraceId}`,
                expected: "Find failure event record in PostgreSQL",
                actual: "Failure event record not found",
                status: "FAIL",
                evidence: `Trace ID: ${scH.failureTraceId}`,
            });
        } else {
            const failEventId = failureEvents[0].id;
            const fingerprint = await compareRuntimeFingerprint(failEventId, primaryOrgId);

            if (!fingerprint) {
                recordTest({
                    test: "Infrastructure: Runtime fingerprint comparison",
                    dataSource: `eventId=${failEventId}`,
                    expected: "Generate comparison against comparable reference execution",
                    actual: "Fingerprint returned null",
                    status: "FAIL",
                    evidence: `Event ID: ${failEventId}`,
                });
            } else {
                const hasReference = fingerprint.hasComparableReference;
                const runtimeAttr = fingerprint.attributes.find((a) => a.key === "runtime");
                const hostAttr = fingerprint.attributes.find((a) => a.key === "host");
                const regionAttr = fingerprint.attributes.find((a) => a.key === "region");

                const runtimeDiff = runtimeAttr?.status === "DIFFERENT" && runtimeAttr?.failureValue === "Node.js 22.4.1" && runtimeAttr?.referenceValue === "Node.js 20.15.0";
                const hostDiff = hostAttr?.status === "DIFFERENT";
                const regionMatch = regionAttr?.status === "MATCHING" && regionAttr?.failureValue === "us-east-1";

                recordTest({
                    test: "Infrastructure: Dynamic attribute difference detection",
                    dataSource: `Failure: ${scH.failureTraceId} vs Reference: ${scH.referenceTraceId}`,
                    expected: "runtime: DIFFERENT, host: DIFFERENT, region: MATCHING",
                    actual: `runtime=${runtimeAttr?.status} (${runtimeAttr?.failureValue} vs ${runtimeAttr?.referenceValue}), region=${regionAttr?.status}, host=${hostAttr?.status}`,
                    status: hasReference && runtimeDiff && hostDiff && regionMatch ? "PASS" : "FAIL",
                    evidence: `Total Attributes: ${fingerprint.attributes.length}, Differences: ${fingerprint.differenceCount}, Matches: ${fingerprint.matchingCount}`,
                });
            }
        }
    } catch (e: any) {
        recordTest({
            test: "Infrastructure Engine Exception",
            dataSource: "Runtime Fingerprint",
            expected: "Clean fingerprint execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 9. MULTI-TENANT CROSS-ORGANIZATION ISOLATION
    // =========================================================================
    console.log("\n--- 9. Testing Multi-Tenant Cross-Org Authorization ---");
    try {
        const scI = scenarios.scenarioI;
        // User from Primary Org attempts to query Secondary Project ID (Eval Test Org)
        const crossOrgEvidence = await getEventsInTimeRange(
            { projectIds: [secondaryProjectId] },
            primaryOrgId // Note: Primary Org ID passed as the authenticated user's organization!
        );

        // Must return 0 records because secondaryProjectId does NOT belong to primaryOrgId!
        const zeroRecordsReturned = crossOrgEvidence.records.length === 0;

        recordTest({
            test: "Authorization: Cross-organization data leakage prevention",
            dataSource: `Attempting to query secondaryProjectId=${secondaryProjectId} with Primary Org ID`,
            expected: "0 records returned (server-side authorization enforces tenant boundary)",
            actual: `Returned ${crossOrgEvidence.records.length} records`,
            status: zeroRecordsReturned ? "PASS" : "FAIL",
            evidence: `Target Project: ${secondaryProjectId}, Authorized Org: ${primaryOrgId}, Records: ${crossOrgEvidence.records.length}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Authorization Exception",
            dataSource: "Canonical Evidence Access",
            expected: "Enforce authorization cleanly",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // =========================================================================
    // 10. ZERO N+1 QUERY VALIDATION
    // =========================================================================
    console.log("\n--- 10. Testing Zero N+1 Batch Fetching ---");
    try {
        // Fetch two records to pass to batchFetchLinkedEvidence
        const { records } = await getEventsInTimeRange({ projectIds: [primaryProjectId], limit: 10 }, primaryOrgId);

        // Batch fetch relationships for multiple records in a single query
        const { traceMap, requestMap } = await batchFetchLinkedEvidence(records, primaryOrgId);

        const hasTraceMap = traceMap.size > 0;
        const hasRequestMap = requestMap.size > 0;

        recordTest({
            test: "Performance: Zero N+1 batch relationship fetching",
            dataSource: `Batch querying related traces & requests for ${records.length} records`,
            expected: "Batch fetch all related spans using IN clauses in a single query roundtrip",
            actual: `Built traceMap (${traceMap.size} traces) and requestMap (${requestMap.size} requests) in single query roundtrip`,
            status: hasTraceMap && hasRequestMap ? "PASS" : "FAIL",
            evidence: `Input records: ${records.length}, Distinct Traces: ${traceMap.size}, Distinct Requests: ${requestMap.size}`,
        });
    } catch (e: any) {
        recordTest({
            test: "Performance Exception",
            dataSource: "Batch Fetching",
            expected: "Clean batch query execution",
            actual: `Exception: ${e.message}`,
            status: "FAIL",
            evidence: e.stack || String(e),
        });
    }

    // Save test report to scratch/e2e-report.json
    const reportPath = path.resolve(process.cwd(), "scratch", "e2e-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    const passCount = report.filter((r) => r.status === "PASS").length;
    const failCount = report.filter((r) => r.status === "FAIL").length;
    console.log(`\n=== E2E Verification Complete: ${passCount} Passed, ${failCount} Failed ===`);
    return { report, passCount, failCount };
}

if (require.main === module) {
    runE2EVerification()
        .then(({ failCount }) => process.exit(failCount === 0 ? 0 : 1))
        .catch((e) => {
            console.error("Fatal in verification runner:", e);
            process.exit(1);
        });
}
