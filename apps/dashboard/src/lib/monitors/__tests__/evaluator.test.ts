import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import { evaluateMonitor, evaluateMonitorsForProject } from "@/lib/monitors/evaluator";
import { parseMonitorQuery, buildQueryWhereConditions } from "@/lib/monitors/query-parser";
import { createEvent } from "@/actions/event";

async function runTests() {
    console.log("==================================================");
    console.log("STARTING MONITOR EVALUATOR TEST SUITE");
    console.log("==================================================");

    // Setup isolated test project and environment
    const testOrg = await prisma.organization.upsert({
        where: { slug: "eval-test-org" },
        create: { name: "Eval Test Org", slug: "eval-test-org" },
        update: {},
    });

    const projectA = await prisma.project.upsert({
        where: { organizationId_slug: { organizationId: testOrg.id, slug: "proj-a" } },
        create: { name: "Project A", slug: "proj-a", organizationId: testOrg.id },
        update: {},
    });

    const projectB = await prisma.project.upsert({
        where: { organizationId_slug: { organizationId: testOrg.id, slug: "proj-b" } },
        create: { name: "Project B", slug: "proj-b", organizationId: testOrg.id },
        update: {},
    });

    const envA = await prisma.environment.upsert({
        where: { projectId_name: { projectId: projectA.id, name: "production" } },
        create: { name: "production", projectId: projectA.id },
        update: {},
    });

    const envB = await prisma.environment.upsert({
        where: { projectId_name: { projectId: projectB.id, name: "production" } },
        create: { name: "production", projectId: projectB.id },
        update: {},
    });

    // Cleanup any existing monitors and events for test projects
    await prisma.monitorAlertNotification.deleteMany({
        where: { alert: { monitor: { projectId: { in: [projectA.id, projectB.id] } } } },
    });
    await prisma.monitorAlert.deleteMany({
        where: { monitor: { projectId: { in: [projectA.id, projectB.id] } } },
    });
    await prisma.investigation.deleteMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
    });
    await prisma.monitor.deleteMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
    });
    await prisma.event.deleteMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
    });

    console.log("✓ Test setup cleaned and initialized.");

    // -------------------------------------------------------------------------
    // TEST 1: Query Parser
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Query Parser ---");
    const parsed1 = parseMonitorQuery("service:web-client severity:ERROR checkout");
    assert.deepStrictEqual(parsed1.services, ["web-client"]);
    assert.deepStrictEqual(parsed1.severities, ["ERROR"]);
    assert.deepStrictEqual(parsed1.freeText, ["checkout"]);
    console.log("✓ parseMonitorQuery correctly parses service, severity, and free-text.");

    // -------------------------------------------------------------------------
    // TEST 2: Monitor creation with zero matching events -> HEALTHY
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Monitor creation with zero events -> HEALTHY ---");
    const monitor1 = await prisma.monitor.create({
        data: {
            name: "Payment Failure Monitor",
            type: "ERROR",
            status: "HEALTHY",
            severity: "ERROR",
            projectId: projectA.id,
            thresholdValue: 4,
            thresholdWindow: 10,
            query: "service:web-client",
        },
    });

    const evalRes1 = await evaluateMonitor(monitor1.id);
    assert.strictEqual(evalRes1?.newState, "HEALTHY");
    assert.strictEqual(evalRes1?.matchingCount, 0);
    assert.strictEqual(evalRes1?.isThresholdViolated, false);
    assert.strictEqual(evalRes1?.alertCreated, false);
    console.log("✓ Monitor with zero events evaluates to HEALTHY.");

    // -------------------------------------------------------------------------
    // TEST 3: Events in Project B or non-matching service do not trigger Project A
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Project Isolation & Service Filtering ---");
    const now = new Date();

    // Event in Project B
    await createEvent({
        projectId: projectB.id,
        environmentId: envB.id,
        type: "ERROR",
        severity: "ERROR",
        title: "Project B Error",
        service: "web-client",
        timestamp: now.toISOString(),
    });

    // Event in Project A with different service
    await createEvent({
        projectId: projectA.id,
        environmentId: envA.id,
        type: "ERROR",
        severity: "ERROR",
        title: "Auth Error",
        service: "auth-service",
        timestamp: now.toISOString(),
    });

    const evalRes2 = await evaluateMonitor(monitor1.id, now);
    assert.strictEqual(evalRes2?.matchingCount, 0, "Non-matching service and foreign project must not count");
    assert.strictEqual(evalRes2?.newState, "HEALTHY");
    console.log("✓ Foreign project and different service are strictly isolated.");

    // -------------------------------------------------------------------------
    // TEST 4: Telemetry arrives: 3 events (below threshold) -> remains HEALTHY
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Ingestion below threshold (count = 3) -> HEALTHY ---");
    for (let i = 1; i <= 3; i++) {
        await createEvent({
            projectId: projectA.id,
            environmentId: envA.id,
            type: "ERROR",
            severity: "ERROR",
            title: `Payment failure ${i}`,
            service: "web-client",
            timestamp: new Date(now.getTime() + i * 1000).toISOString(),
        });
    }

    const evalRes3 = await evaluateMonitor(monitor1.id, new Date(now.getTime() + 5000));
    assert.strictEqual(evalRes3?.matchingCount, 3);
    assert.strictEqual(evalRes3?.isThresholdViolated, false);
    assert.strictEqual(evalRes3?.newState, "HEALTHY");
    console.log("✓ Count = 3 (< threshold 4) keeps monitor HEALTHY.");

    // -------------------------------------------------------------------------
    // TEST 5: 4th Event arrives -> Transitions HEALTHY -> FIRING & Creates Alert
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Ingestion reaches threshold (count = 4) -> HEALTHY -> FIRING ---");
    await createEvent({
        projectId: projectA.id,
        environmentId: envA.id,
        type: "ERROR",
        severity: "ERROR",
        title: "Payment failure 4",
        service: "web-client",
        timestamp: new Date(now.getTime() + 6000).toISOString(),
    });

    // Ingestion automatically triggered evaluation and transitioned monitor to FIRING
    const mAfter4 = await prisma.monitor.findUnique({ where: { id: monitor1.id } });
    assert.strictEqual(mAfter4?.status, "FIRING", "Ingesting 4th event must automatically transition monitor to FIRING");

    const activeAlerts = await prisma.monitorAlert.findMany({
        where: { monitorId: monitor1.id, status: "OPEN" },
    });
    assert.strictEqual(activeAlerts.length, 1, "Exactly one OPEN alert should exist");
    assert.strictEqual(activeAlerts[0].observedValue, 4);

    const evalRes4 = await evaluateMonitor(monitor1.id, new Date(now.getTime() + 7000));
    assert.strictEqual(evalRes4?.matchingCount, 4);
    assert.strictEqual(evalRes4?.isThresholdViolated, true);
    assert.strictEqual(evalRes4?.newState, "FIRING");
    assert.strictEqual(evalRes4?.alertCreated, false, "Alert was already created during event ingestion");
    console.log("✓ 4th event automatically transitioned monitor to FIRING and persisted OPEN alert.");

    // -------------------------------------------------------------------------
    // TEST 6: Continuous Firing: 5th Event arrives -> Updates Alert without Duplicate
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Continuous Firing (count = 5) -> No Duplicate Alert ---");
    await createEvent({
        projectId: projectA.id,
        environmentId: envA.id,
        type: "ERROR",
        severity: "ERROR",
        title: "Payment failure 5",
        service: "web-client",
        timestamp: new Date(now.getTime() + 8000).toISOString(),
    });

    const evalRes5 = await evaluateMonitor(monitor1.id, new Date(now.getTime() + 9000));
    assert.strictEqual(evalRes5?.matchingCount, 5);
    assert.strictEqual(evalRes5?.isThresholdViolated, true);
    assert.strictEqual(evalRes5?.newState, "FIRING");
    assert.strictEqual(evalRes5?.stateChanged, false);
    assert.strictEqual(evalRes5?.alertCreated, false, "Must not create duplicate alert for continuous episode");

    const allAlerts = await prisma.monitorAlert.findMany({
        where: { monitorId: monitor1.id },
    });
    assert.strictEqual(allAlerts.length, 1, "Still only 1 alert record for continuous episode");
    assert.strictEqual(allAlerts[0].observedValue, 5, "Active alert updated with new observed value");
    console.log("✓ Continuous firing updates existing alert episode with 0 duplicate alerts.");

    // -------------------------------------------------------------------------
    // TEST 7: Events Age Out of Rolling Window -> Recovers FIRING -> HEALTHY
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Events age out of window -> Auto-Recovery to HEALTHY ---");
    // Advance evaluation time by 15 minutes (past the 10m window)
    const futureTime = new Date(now.getTime() + 15 * 60 * 1000);

    const evalRes6 = await evaluateMonitor(monitor1.id, futureTime);
    assert.strictEqual(evalRes6?.matchingCount, 0);
    assert.strictEqual(evalRes6?.isThresholdViolated, false);
    assert.strictEqual(evalRes6?.newState, "HEALTHY");
    assert.strictEqual(evalRes6?.stateChanged, true);

    const resolvedAlert = await prisma.monitorAlert.findUnique({
        where: { id: allAlerts[0].id },
    });
    assert.strictEqual(resolvedAlert?.status, "RESOLVED", "Alert must be auto-resolved upon recovery");
    assert.ok(resolvedAlert?.resolvedAt, "resolvedAt timestamp must be set");
    console.log("✓ Monitor recovers to HEALTHY and automatically resolves active alert.");

    // -------------------------------------------------------------------------
    // TEST 8: Disabled Monitor does not evaluate or alert
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Disabled monitor does not evaluate ---");
    await prisma.monitor.update({
        where: { id: monitor1.id },
        data: { status: "DISABLED" },
    });

    const evalRes7 = await evaluateMonitor(monitor1.id);
    assert.strictEqual(evalRes7?.newState, "DISABLED");
    assert.strictEqual(evalRes7?.alertCreated, false);
    console.log("✓ Disabled monitor is ignored.");

    // Cleanup
    await prisma.monitorAlertNotification.deleteMany({
        where: { alert: { monitor: { projectId: { in: [projectA.id, projectB.id] } } } },
    });
    await prisma.monitorAlert.deleteMany({
        where: { monitor: { projectId: { in: [projectA.id, projectB.id] } } },
    });
    await prisma.monitor.deleteMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
    });
    await prisma.event.deleteMany({
        where: { projectId: { in: [projectA.id, projectB.id] } },
    });

    console.log("\n==================================================");
    console.log("ALL MONITOR EVALUATOR TESTS PASSED WITH 0 ERRORS!");
    console.log("==================================================");
}

runTests()
    .catch((err) => {
        console.error("TEST FAILED:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
