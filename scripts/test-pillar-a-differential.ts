/**
 * Halo Trace — Pillar A Differential Trace Analysis Test Suite
 *
 * Covers:
 * 1. Zero-Hallucination Guard: Honest uncertainty when no baselines exist (hasBaseline: false, uncertainty: HIGH)
 * 2. Low-Sample Uncertainty: uncertainty: LOW when < 3 baselines exist
 * 3. High-Confidence Differential Analysis: Full latency delta, multiplier, tag divergence, and anomaly flags
 * 4. Tag & Parameter Divergence: Isolates novel parameters and values differing from baseline distributions
 * 5. Structural Execution Anomalies: Flags extreme latency multipliers and breadcrumb halting points
 * 6. Server-Side Entitlement Gating: Blocks Developer/Free plans with TEAM_PLAN_REQUIRED
 * 7. Tenant Isolation: Blocks foreign users from inspecting other organizations' traces
 * 8. Project Scope Verification: Rejects cross-project event mismatch attacks
 */

import { prisma } from "../apps/dashboard/src/lib/prisma";
import {
    computeDifferentialTrace,
    type DifferentialTraceAnalysis,
} from "../apps/dashboard/src/actions/differential-trace";
import { AuthorizationError } from "../apps/dashboard/src/lib/authorization";
import { OrganizationRole, MembershipStatus } from "../apps/dashboard/src/generated/prisma/client";

type TestResultRecord = {
    testName: string;
    expected: string;
    actual: string;
    passed: boolean;
};

const results: TestResultRecord[] = [];

function recordTest(name: string, expected: string, actual: string, passed: boolean) {
    results.push({ testName: name, expected, actual, passed });
    const mark = passed ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${mark}: [${name}]`);
    if (!passed) {
        console.error(`      Expected: ${expected}`);
        console.error(`      Actual:   ${actual}`);
    }
}

async function runPillarATestSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR A DIFFERENTIAL TRACE TEST SUITE");
    console.log("==================================================\n");

    const runId = Date.now().toString(36);

    // Setup Test Entities
    // 1. Team Org & User
    const userTeam = await prisma.user.create({
        data: {
            id: `usr-team-${runId}`,
            email: `team-${runId}@example.com`,
            name: "Team Lead User",
        },
    });

    const orgTeam = await prisma.organization.create({
        data: {
            id: `org-team-${runId}`,
            name: `Team Org ${runId}`,
            slug: `team-org-${runId}`,
            plan: "TEAM",
            owner: { connect: { id: userTeam.id } },
        },
    });

    await prisma.user.update({
        where: { id: userTeam.id },
        data: { organizationId: orgTeam.id },
    });

    await prisma.organizationMember.create({
        data: {
            organizationId: orgTeam.id,
            userId: userTeam.id,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
        },
    });

    const projectTeam = await prisma.project.create({
        data: {
            id: `proj-team-${runId}`,
            name: `Team Project ${runId}`,
            slug: `team-proj-${runId}`,
            organizationId: orgTeam.id,
        },
    });

    const envTeam = await prisma.environment.create({
        data: {
            name: "Production",
            projectId: projectTeam.id,
        },
    });

    // 2. Developer Org & User
    const userDev = await prisma.user.create({
        data: {
            id: `usr-dev-${runId}`,
            email: `dev-${runId}@example.com`,
            name: "Dev User",
        },
    });

    const orgDev = await prisma.organization.create({
        data: {
            id: `org-dev-${runId}`,
            name: `Dev Org ${runId}`,
            slug: `dev-org-${runId}`,
            plan: "DEVELOPER",
            owner: { connect: { id: userDev.id } },
        },
    });

    await prisma.user.update({
        where: { id: userDev.id },
        data: { organizationId: orgDev.id },
    });

    await prisma.organizationMember.create({
        data: {
            organizationId: orgDev.id,
            userId: userDev.id,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
        },
    });

    const projectDev = await prisma.project.create({
        data: {
            id: `proj-dev-${runId}`,
            name: `Dev Project ${runId}`,
            slug: `dev-proj-${runId}`,
            organizationId: orgDev.id,
        },
    });

    const envDev = await prisma.environment.create({
        data: {
            name: "Production",
            projectId: projectDev.id,
        },
    });

    // 3. Foreign Org & User (for cross-tenant attacks)
    const userForeign = await prisma.user.create({
        data: {
            id: `usr-foreign-${runId}`,
            email: `foreign-${runId}@example.com`,
            name: "Foreign User",
        },
    });

    const orgForeign = await prisma.organization.create({
        data: {
            id: `org-foreign-${runId}`,
            name: `Foreign Org ${runId}`,
            slug: `foreign-org-${runId}`,
            plan: "TEAM",
            owner: { connect: { id: userForeign.id } },
        },
    });

    await prisma.user.update({
        where: { id: userForeign.id },
        data: { organizationId: orgForeign.id },
    });

    await prisma.organizationMember.create({
        data: {
            organizationId: orgForeign.id,
            userId: userForeign.id,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
        },
    });

    try {
        // =========================================================================
        // GROUP 1: Zero-Hallucination & Uncertainty Handling
        // =========================================================================
        console.log("--- GROUP 1: Zero-Hallucination & Uncertainty Checks ---");

        const isolatedFailingEvent = await prisma.event.create({
            data: {
                id: `evt-failing-nobaseline-${runId}`,
                projectId: projectTeam.id,
                environmentId: envTeam.id,
                title: "Unhandled Checkout Exception",
                operation: "POST /checkout",
                service: "order-service",
                type: "TRACE",
                severity: "ERROR",
                status: "500",
                durationMs: 850,
                timestamp: new Date(),
                tags: { env: "production", cartSize: 4 },
                metadata: { error: "Database timeout" },
            },
        });

        // 1.1 Unauthenticated caller check
        let unauthRejected = false;
        try {
            await computeDifferentialTrace(projectTeam.id, isolatedFailingEvent.id);
        } catch (e: any) {
            unauthRejected = e instanceof AuthorizationError && e.code === "UNAUTHENTICATED";
        }
        recordTest(
            "Blocks unauthenticated caller",
            "true",
            String(unauthRejected),
            unauthRejected
        );

        // 1.2 Zero Baselines check (Honest Zero-Hallucination reporting)
        const noBaselineResult = await computeDifferentialTrace(
            projectTeam.id,
            isolatedFailingEvent.id,
            userTeam.id
        );

        recordTest(
            "Zero baselines: hasBaseline is false",
            "false",
            String(noBaselineResult.hasBaseline),
            noBaselineResult.hasBaseline === false
        );

        recordTest(
            "Zero baselines: baselineCount is 0",
            "0",
            String(noBaselineResult.baselineCount),
            noBaselineResult.baselineCount === 0
        );

        recordTest(
            "Zero baselines: baselineAverageDurationMs is null",
            "null",
            String(noBaselineResult.baselineAverageDurationMs),
            noBaselineResult.baselineAverageDurationMs === null
        );

        recordTest(
            "Zero baselines: uncertainty is HIGH",
            "HIGH",
            noBaselineResult.uncertainty,
            noBaselineResult.uncertainty === "HIGH"
        );

        recordTest(
            "Zero baselines: structuralAnomalies notes missing baselines",
            "true",
            String(noBaselineResult.structuralAnomalies.some((s) => s.includes("Baseline unavailable"))),
            noBaselineResult.structuralAnomalies.some((s) => s.includes("Baseline unavailable"))
        );

        // =========================================================================
        // GROUP 2: Low-Sample Baselines (1-2 runs)
        // =========================================================================
        console.log("\n--- GROUP 2: Low-Sample Uncertainty Checks ---");

        // Insert 2 baseline events
        await prisma.event.createMany({
            data: [
                {
                    id: `evt-base-1-${runId}`,
                    projectId: projectTeam.id,
                    environmentId: envTeam.id,
                    title: "Checkout Success",
                    operation: "POST /checkout",
                    service: "order-service",
                    type: "TRACE",
                    severity: "INFO",
                    status: "200",
                    durationMs: 120,
                    timestamp: new Date(Date.now() - 3600 * 1000),
                    tags: { env: "production", region: "us-east-1" },
                },
                {
                    id: `evt-base-2-${runId}`,
                    projectId: projectTeam.id,
                    environmentId: envTeam.id,
                    title: "Checkout Success",
                    operation: "POST /checkout",
                    service: "order-service",
                    type: "TRACE",
                    severity: "INFO",
                    status: "200",
                    durationMs: 140,
                    timestamp: new Date(Date.now() - 1800 * 1000),
                    tags: { env: "production", region: "us-east-1" },
                },
            ],
        });

        const lowSampleResult = await computeDifferentialTrace(
            projectTeam.id,
            isolatedFailingEvent.id,
            userTeam.id
        );

        recordTest(
            "Low sample: hasBaseline is true",
            "true",
            String(lowSampleResult.hasBaseline),
            lowSampleResult.hasBaseline === true
        );

        recordTest(
            "Low sample: baselineCount is 2",
            "2",
            String(lowSampleResult.baselineCount),
            lowSampleResult.baselineCount === 2
        );

        recordTest(
            "Low sample: baselineAverageDurationMs is 130",
            "130",
            String(lowSampleResult.baselineAverageDurationMs),
            lowSampleResult.baselineAverageDurationMs === 130
        );

        recordTest(
            "Low sample: uncertainty is LOW (<3 runs)",
            "LOW",
            lowSampleResult.uncertainty,
            lowSampleResult.uncertainty === "LOW"
        );

        // =========================================================================
        // GROUP 3: High-Confidence Analysis & Divergence Matrix (3+ runs)
        // =========================================================================
        console.log("\n--- GROUP 3: High-Confidence Differential Analysis & Divergence ---");

        // Insert 3 more baseline events to reach 5 total
        await prisma.event.createMany({
            data: [
                {
                    id: `evt-base-3-${runId}`,
                    projectId: projectTeam.id,
                    environmentId: envTeam.id,
                    title: "Checkout Success",
                    operation: "POST /checkout",
                    service: "order-service",
                    type: "TRACE",
                    severity: "INFO",
                    status: "200",
                    durationMs: 130,
                    timestamp: new Date(Date.now() - 1200 * 1000),
                    tags: { env: "production", region: "us-east-1", currency: "USD" },
                },
                {
                    id: `evt-base-4-${runId}`,
                    projectId: projectTeam.id,
                    environmentId: envTeam.id,
                    title: "Checkout Success",
                    operation: "POST /checkout",
                    service: "order-service",
                    type: "TRACE",
                    severity: "INFO",
                    status: "200",
                    durationMs: 110,
                    timestamp: new Date(Date.now() - 600 * 1000),
                    tags: { env: "production", region: "us-east-1", currency: "USD" },
                },
                {
                    id: `evt-base-5-${runId}`,
                    projectId: projectTeam.id,
                    environmentId: envTeam.id,
                    title: "Checkout Success",
                    operation: "POST /checkout",
                    service: "order-service",
                    type: "TRACE",
                    severity: "INFO",
                    status: "200",
                    durationMs: 100,
                    timestamp: new Date(Date.now() - 300 * 1000),
                    tags: { env: "production", region: "us-east-1", currency: "USD" },
                },
            ],
        });

        // Create failing event with latency multiplier > 6x, novel parameter, and divergent region
        const divergentFailingEvent = await prisma.event.create({
            data: {
                id: `evt-failing-divergent-${runId}`,
                projectId: projectTeam.id,
                environmentId: envTeam.id,
                title: "Unhandled Checkout Exception",
                operation: "POST /checkout",
                service: "order-service",
                type: "TRACE",
                severity: "ERROR",
                status: "500",
                durationMs: 840, // Baseline avg is (120+140+130+110+100)/5 = 120ms. Multiplier is 7x!
                timestamp: new Date(),
                tags: {
                    env: "production",
                    region: "eu-west-1", // Divergent from us-east-1!
                    loyaltyDiscountCode: "VIP_2026", // Novel parameter!
                },
                breadcrumbs: [
                    { category: "http", message: "POST /cart/validate" },
                    { category: "auth", message: "Token verified" },
                    { category: "payment", message: "Gateway connection timeout" },
                ],
            },
        });

        const highConfResult = await computeDifferentialTrace(
            projectTeam.id,
            divergentFailingEvent.id,
            userTeam.id
        );

        recordTest(
            "High confidence: baselineCount is 5",
            "5",
            String(highConfResult.baselineCount),
            highConfResult.baselineCount === 5
        );

        recordTest(
            "High confidence: baselineAverageDurationMs is 120ms",
            "120",
            String(highConfResult.baselineAverageDurationMs),
            highConfResult.baselineAverageDurationMs === 120
        );

        recordTest(
            "High confidence: durationDeltaMs is 720ms",
            "720",
            String(highConfResult.durationDeltaMs),
            highConfResult.durationDeltaMs === 720
        );

        recordTest(
            "High confidence: durationMultiplier is 7",
            "7",
            String(highConfResult.durationMultiplier),
            highConfResult.durationMultiplier === 7
        );

        recordTest(
            "High confidence: uncertainty is NONE",
            "NONE",
            highConfResult.uncertainty,
            highConfResult.uncertainty === "NONE"
        );

        // Check Divergent Tags
        const regionTag = highConfResult.divergentTags.find((t) => t.key === "region");
        recordTest(
            "Tag divergence: isolates 'region' with HIGH significance",
            "HIGH",
            regionTag?.significance || "NOT_FOUND",
            regionTag?.significance === "HIGH" &&
                regionTag.failingValue === "eu-west-1" &&
                regionTag.baselineCommonValue === "us-east-1"
        );

        const novelTag = highConfResult.divergentTags.find((t) => t.key === "loyaltyDiscountCode");
        recordTest(
            "Tag divergence: isolates novel parameter 'loyaltyDiscountCode' with MEDIUM significance",
            "MEDIUM",
            novelTag?.significance || "NOT_FOUND",
            novelTag?.significance === "MEDIUM" &&
                novelTag.failingValue === "VIP_2026"
        );

        // Check Structural Anomalies
        recordTest(
            "Structural anomaly: flags extreme latency divergence (>3x)",
            "true",
            String(highConfResult.structuralAnomalies.some((s) => s.includes("Extreme latency divergence"))),
            highConfResult.structuralAnomalies.some((s) => s.includes("Extreme latency divergence"))
        );

        recordTest(
            "Structural anomaly: flags execution halt after 3 breadcrumb events",
            "true",
            String(highConfResult.structuralAnomalies.some((s) => s.includes("halted after 3 breadcrumb events"))),
            highConfResult.structuralAnomalies.some((s) => s.includes("halted after 3 breadcrumb events"))
        );

        // =========================================================================
        // GROUP 4: Plan Capability & Entitlement Gating
        // =========================================================================
        console.log("\n--- GROUP 4: Plan Capability & Entitlement Enforcement ---");

        const devEvent = await prisma.event.create({
            data: {
                id: `evt-dev-failing-${runId}`,
                projectId: projectDev.id,
                environmentId: envDev.id,
                title: "Dev Service Error",
                operation: "GET /users",
                service: "user-service",
                type: "TRACE",
                severity: "ERROR",
                timestamp: new Date(),
            },
        });

        let devPlanRejected = false;
        let devPlanErrorCode = "";
        try {
            await computeDifferentialTrace(projectDev.id, devEvent.id, userDev.id);
        } catch (e: any) {
            if (e instanceof AuthorizationError) {
                devPlanRejected = true;
                devPlanErrorCode = e.code;
            }
        }

        recordTest(
            "Blocks Developer plan organization from computing differential trace",
            "TEAM_PLAN_REQUIRED",
            devPlanErrorCode,
            devPlanRejected && devPlanErrorCode === "TEAM_PLAN_REQUIRED"
        );

        // =========================================================================
        // GROUP 5: Tenant Isolation & Scope Security
        // =========================================================================
        console.log("\n--- GROUP 5: Tenant Isolation & Cross-Project Protection ---");

        // 5.1 Foreign user trying to analyze Team Org's event
        let foreignUserBlocked = false;
        try {
            await computeDifferentialTrace(
                projectTeam.id,
                divergentFailingEvent.id,
                userForeign.id
            );
        } catch (e: any) {
            foreignUserBlocked = e instanceof AuthorizationError;
        }

        recordTest(
            "Blocks foreign user from inspecting other org's differential trace",
            "true",
            String(foreignUserBlocked),
            foreignUserBlocked
        );

        // 5.2 Mismatched project and event (Project Dev passed, but event belongs to Project Team)
        let mismatchedEventBlocked = false;
        try {
            await computeDifferentialTrace(
                projectTeam.id,
                devEvent.id, // devEvent belongs to projectDev!
                userTeam.id
            );
        } catch (e: any) {
            mismatchedEventBlocked = e instanceof AuthorizationError && e.code === "FORBIDDEN";
        }

        recordTest(
            "Blocks event ID not belonging to target project",
            "true",
            String(mismatchedEventBlocked),
            mismatchedEventBlocked
        );

    } finally {
        // Cleanup entities
        console.log("\nCleaning up test entities...");
        await prisma.event.deleteMany({
            where: {
                projectId: { in: [projectTeam.id, projectDev.id] },
            },
        });
        await prisma.environment.deleteMany({
            where: {
                projectId: { in: [projectTeam.id, projectDev.id] },
            },
        });
        await prisma.project.deleteMany({
            where: {
                id: { in: [projectTeam.id, projectDev.id] },
            },
        });
        await prisma.organizationMember.deleteMany({
            where: {
                organizationId: { in: [orgTeam.id, orgDev.id, orgForeign.id] },
            },
        });
        await prisma.organization.deleteMany({
            where: {
                id: { in: [orgTeam.id, orgDev.id, orgForeign.id] },
            },
        });
        await prisma.user.deleteMany({
            where: {
                id: { in: [userTeam.id, userDev.id, userForeign.id] },
            },
        });
    }

    console.log("\n==================================================");
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`TOTAL CHECKS: ${results.length}`);
    console.log(`PASSED: ${passedCount}`);
    console.log(`FAILED: ${results.length - passedCount}`);
    console.log("==================================================");

    if (passedCount !== results.length) {
        process.exit(1);
    }
}

runPillarATestSuite().catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});
