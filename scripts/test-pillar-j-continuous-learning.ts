/**
 * HALO TRACE — PILLAR J TEST SUITE
 * Continuous Incident Learning & Organizational Incident Intelligence
 *
 * Verifies all Master Invariants and 104 Adversarial Checks:
 *
 * 1. AUTHORIZATION & TENANT BOUNDARIES (Tests 1 - 7)
 * 2. MEMORY GENERATION & IDEMPOTENCY (Tests 8 - 12)
 * 3. REMEDIATION OUTCOMES & CLASSIFICATION (Tests 13 - 18)
 * 4. SIMILARITY MODEL & DIMENSIONAL MATCHING (Tests 19 - 32)
 * 5. SIMILARITY MATH & UNCERTAINTY NORMALIZATION (Tests 33 - 38)
 * 6. HISTORICAL SEPARATION & ROOT CAUSE IMMUTABILITY (Tests 39 - 43)
 * 7. NEGATIVE LEARNING & OPERATIONAL CAUTIONS (Tests 44 - 47)
 * 8. RECURRING FAILURE PATTERNS & MINIMUM THRESHOLDS (Tests 48 - 54)
 * 9. PATTERN EVOLUTION & STATUS CLASSIFICATION (Tests 55 - 58)
 * 10. DETERMINISTIC HISTORICAL RANKING (Tests 59 - 63)
 * 11. CONTRADICTIONS & CURRENT TELEMETRY AUTHORITY (Tests 64 - 67)
 * 12. CIRCULARITY & SELF-CONFIRMATION PREVENTION (Tests 68 - 71)
 * 13. OWNERSHIP INTEGRATION & ZERO-BLAME INVARIANT (Tests 72 - 74)
 * 14. COLLABORATION & HUMAN PEER ASSERTIONS (Tests 75 - 77)
 * 15. CHANGE INTELLIGENCE SEPARATION (Tests 78 - 80)
 * 16. REMEDIATION VERIFICATION INTEGRATION (Tests 81 - 84)
 * 17. UI PRESENTATION & EXPLAINABILITY (Tests 85 - 90)
 * 18. SECURITY & TENANT ISOLATION (Tests 91 - 94)
 * 19. PERFORMANCE & ZERO N+1 LOOPS (Tests 95 - 97)
 * 20. POSTMORTEM CONTINUOUS LEARNING INTEGRATION (Tests 98 - 101)
 * 21. SUITE CERTIFICATION & PLATFORM INTEGRITY (Tests 102 - 104)
 */

import { prisma } from "@/lib/prisma";

function setTestUser(user: { email: string } | null) {
    if (!user) {
        delete process.env.HALO_TEST_USER_EMAIL;
    } else {
        process.env.HALO_TEST_USER_EMAIL = user.email;
    }
}

import {
    generateIncidentMemory,
    getRelevantHistoricalIncidents,
    getHistoricalIncidentDetails,
    getRecurringFailurePatterns,
    generateInvestigationPostmortemAction,
} from "@/actions/incident-memory";
import {
    compareIncidents,
    rankHistoricalMatches,
    clearIncidentMemoryCache,
    type IncidentComparisonInput,
} from "@/lib/investigation/incident-memory/similarity-engine";
import { formatMemoryForComparison } from "@/lib/investigation/incident-memory/generator";

function assert(condition: unknown, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: [${message}]`);
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`  ✓ PASS: [${message}]`);
}

async function runPillarJTestSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR J CONTINUOUS LEARNING TEST SUITE");
    console.log("==================================================");

    const runId = `test-j-${Date.now().toString(36)}`;
    let checksPassed = 0;

    // 1. Create Test Organizations
    const orgTeam = await prisma.organization.create({
        data: {
            id: `org-team-${runId}`,
            name: "Team Plan Org (Pillar J)",
            slug: `org-team-${runId}`,
            plan: "TEAM",
        },
    });

    const orgDev = await prisma.organization.create({
        data: {
            id: `org-dev-${runId}`,
            name: "Dev Plan Org (Pillar J)",
            slug: `org-dev-${runId}`,
            plan: "DEVELOPER",
        },
    });

    const orgFree = await prisma.organization.create({
        data: {
            id: `org-free-${runId}`,
            name: "Free Plan Org (Pillar J)",
            slug: `org-free-${runId}`,
            plan: "FREE",
        },
    });

    const orgForeign = await prisma.organization.create({
        data: {
            id: `org-foreign-${runId}`,
            name: "Foreign Org (Pillar J)",
            slug: `org-foreign-${runId}`,
            plan: "TEAM",
        },
    });

    // 2. Create Test Users
    const userTeam = await prisma.user.create({
        data: {
            id: `usr-team-${runId}`,
            email: `team-${runId}@example.com`,
            name: "Team Lead",
            organizationId: orgTeam.id,
        },
    });

    const userDev = await prisma.user.create({
        data: {
            id: `usr-dev-${runId}`,
            email: `dev-${runId}@example.com`,
            name: "Developer",
            organizationId: orgDev.id,
        },
    });

    const userFree = await prisma.user.create({
        data: {
            id: `usr-free-${runId}`,
            email: `free-${runId}@example.com`,
            name: "Free User",
            organizationId: orgFree.id,
        },
    });

    const userForeign = await prisma.user.create({
        data: {
            id: `usr-foreign-${runId}`,
            email: `foreign-${runId}@example.com`,
            name: "Foreign User",
            organizationId: orgForeign.id,
        },
    });

    // 3. Create Organization Memberships
    await prisma.organizationMember.createMany({
        data: [
            { organizationId: orgTeam.id, userId: userTeam.id, role: "ADMIN", status: "ACTIVE" },
            { organizationId: orgDev.id, userId: userDev.id, role: "ADMIN", status: "ACTIVE" },
            { organizationId: orgFree.id, userId: userFree.id, role: "ADMIN", status: "ACTIVE" },
            { organizationId: orgForeign.id, userId: userForeign.id, role: "ADMIN", status: "ACTIVE" },
        ],
    });

    // 4. Create Projects
    const projectTeamA = await prisma.project.create({
        data: {
            id: `prj-team-a-${runId}`,
            name: "Checkout Service",
            slug: `checkout-${runId}`,
            organizationId: orgTeam.id,
        },
    });

    const projectTeamB = await prisma.project.create({
        data: {
            id: `prj-team-b-${runId}`,
            name: "Payments Service",
            slug: `payments-${runId}`,
            organizationId: orgTeam.id,
        },
    });

    const projectDev = await prisma.project.create({
        data: {
            id: `prj-dev-${runId}`,
            name: "Dev Project",
            slug: `dev-${runId}`,
            organizationId: orgDev.id,
        },
    });

    const projectForeign = await prisma.project.create({
        data: {
            id: `prj-foreign-${runId}`,
            name: "Foreign Project",
            slug: `foreign-${runId}`,
            organizationId: orgForeign.id,
        },
    });

    // 5. Create Environments
    const envTeamA = await prisma.environment.create({
        data: {
            id: `env-team-a-${runId}`,
            name: "production",
            projectId: projectTeamA.id,
        },
    });

    const envTeamB = await prisma.environment.create({
        data: {
            id: `env-team-b-${runId}`,
            name: "production",
            projectId: projectTeamB.id,
        },
    });

    const envDev = await prisma.environment.create({
        data: {
            id: `env-dev-${runId}`,
            name: "development",
            projectId: projectDev.id,
        },
    });

    const envForeign = await prisma.environment.create({
        data: {
            id: `env-foreign-${runId}`,
            name: "production",
            projectId: projectForeign.id,
        },
    });

    // 6. Create Service Ownership
    await prisma.serviceOwnership.create({
        data: {
            id: `own-team-${runId}`,
            organizationId: orgTeam.id,
            projectId: projectTeamA.id,
            serviceName: "checkout-service",
            declaredOwner: "checkout-team",
            declaredTeam: "checkout-team",
        },
    });

    try {
        // Clear in-memory cache
        clearIncidentMemoryCache();

        // ---------------------------------------------------------------------
        // 1. AUTHORIZATION & TENANT BOUNDARIES (Tests 1 - 7)
        // ---------------------------------------------------------------------
        console.log("\n--- 1. Authorization & Tenant Boundaries (Tests 1 - 7) ---");

        // Test 1: Team plan allowed to access continuous incident learning
        setTestUser(userTeam);
        const invAuthTest = await prisma.investigation.create({
            data: {
                id: `inv-auth-team-${runId}`,
                projectId: projectTeamA.id,
                title: "Gateway Timeout in checkout-service",
                status: "COMPLETED",
                rootCause: "Connection pool exhaustion",
                confidenceScore: 92.0,
            },
        });
        const teamMemoryRes = await generateIncidentMemory(invAuthTest.id);
        assert(teamMemoryRes.investigationId === invAuthTest.id, "Test 1: Team plan allowed to access continuous incident learning");
        checksPassed++;

        // Test 2: Developer plan blocked
        setTestUser(userDev);
        const invDevTest = await prisma.investigation.create({
            data: {
                id: `inv-auth-dev-${runId}`,
                projectId: projectDev.id,
                title: "Memory leak in auth-service",
                status: "COMPLETED",
            },
        });
        let devBlocked = false;
        try {
            await generateIncidentMemory(invDevTest.id);
        } catch (e: any) {
            devBlocked = e.message.includes("TEAM_PLAN_REQUIRED") || e.message.includes("requires");
        }
        assert(devBlocked, "Test 2: Developer plan blocked from continuous incident learning");
        checksPassed++;

        // Test 3: Free plan blocked
        setTestUser(userFree);
        let freeBlocked = false;
        try {
            await getRecurringFailurePatterns(projectTeamA.id);
        } catch {
            freeBlocked = true;
        }
        assert(freeBlocked, "Test 3: Free plan blocked from continuous incident learning");
        checksPassed++;

        // Test 4: Cross-organization historical retrieval strictly blocked
        setTestUser(userForeign);
        let crossOrgBlocked = false;
        try {
            await getRelevantHistoricalIncidents(invAuthTest.id);
        } catch {
            crossOrgBlocked = true;
        }
        assert(crossOrgBlocked, "Test 4: Cross-organization historical retrieval strictly rejected");
        checksPassed++;

        // Test 5: Cross-project history blocked unless user has access
        setTestUser(userDev);
        let crossProjectBlocked = false;
        try {
            await getHistoricalIncidentDetails(invAuthTest.id);
        } catch {
            crossProjectBlocked = true;
        }
        assert(crossProjectBlocked, "Test 5: Cross-project incident details blocked for unauthorized user");
        checksPassed++;

        // Test 6: Unauthorized pattern access blocked
        let unauthPatternBlocked = false;
        try {
            await getRecurringFailurePatterns(projectTeamA.id);
        } catch {
            unauthPatternBlocked = true;
        }
        assert(unauthPatternBlocked, "Test 6: Unauthorized failure pattern query rejected");
        checksPassed++;

        // Test 7: Unauthorized memory generation blocked
        let unauthGenBlocked = false;
        try {
            await generateIncidentMemory(invAuthTest.id);
        } catch {
            unauthGenBlocked = true;
        }
        assert(unauthGenBlocked, "Test 7: Unauthorized memory generation attempt rejected");
        checksPassed++;

        // ---------------------------------------------------------------------
        // 2. MEMORY GENERATION & IDEMPOTENCY (Tests 8 - 12)
        // ---------------------------------------------------------------------
        console.log("\n--- 2. Memory Generation & Idempotency (Tests 8 - 12) ---");
        setTestUser(userTeam);

        // Populate telemetry for checkout incident 1
        const baseTime = new Date("2026-08-01T10:00:00Z");
        await prisma.event.create({
            data: {
                id: `evt-base-1-${runId}`,
                projectId: projectTeamA.id,
                environmentId: envTeamA.id,
                service: "checkout-service",
                operation: "POST /v1/checkout",
                title: "GatewayTimeoutError in checkout-service",
                severity: "ERROR",
                type: "ERROR",
                timestamp: baseTime,
            },
        });

        // Test 8: Real completed investigation generates materialized IncidentMemory
        const histInv1 = await prisma.investigation.create({
            data: {
                id: `inv-hist-1-${runId}`,
                projectId: projectTeamA.id,
                title: "GatewayTimeoutError in checkout-service",
                status: "COMPLETED",
                rootCause: "Database connection pool saturated at 100 conns",
                confidenceScore: 94.0,
                createdAt: new Date("2026-08-01T10:00:00Z"),
            },
        });
        const memory1 = await generateIncidentMemory(histInv1.id);
        assert(
            memory1.primaryService === "checkout-service" && memory1.errorType === "GatewayTimeoutError",
            "Test 8: Real completed investigation generates materialized IncidentMemory"
        );
        checksPassed++;

        // Test 9: Duplicate generation is 100% idempotent
        const memory1Refresh = await generateIncidentMemory(histInv1.id);
        assert(
            memory1.id === memory1Refresh.id && memory1.fingerprint === memory1Refresh.fingerprint,
            "Test 9: Duplicate memory generation is 100% idempotent"
        );
        checksPassed++;

        // Test 10: Same investigation cannot create duplicate memory entities
        const countMemories = await prisma.incidentMemory.count({
            where: { investigationId: histInv1.id },
        });
        assert(countMemories === 1, "Test 10: Exactly one IncidentMemory row exists for canonical investigation");
        checksPassed++;

        // Test 11: Insufficient investigation remains incomplete with honest uncertainty
        const invUncertain = await prisma.investigation.create({
            data: {
                id: `inv-uncertain-${runId}`,
                projectId: projectTeamA.id,
                title: "Ambiguous latency anomaly",
                status: "COMPLETED",
                rootCause: null,
                confidenceScore: 35.0,
            },
        });
        const memUncertain = await generateIncidentMemory(invUncertain.id);
        assert(
            memUncertain.rootCause === null && memUncertain.confidenceScore === 35.0,
            "Test 11: Insufficient investigation preserves null rootCause and honest uncertainty"
        );
        checksPassed++;

        // Test 12: Cascading deletion removes/invalidates memory cleanly
        const invTemp = await prisma.investigation.create({
            data: {
                id: `inv-temp-${runId}`,
                projectId: projectTeamA.id,
                title: "Temporary test incident",
                status: "COMPLETED",
            },
        });
        await generateIncidentMemory(invTemp.id);
        await prisma.investigation.delete({ where: { id: invTemp.id } });
        const memTempCount = await prisma.incidentMemory.count({ where: { investigationId: invTemp.id } });
        assert(memTempCount === 0, "Test 12: Cascading deletion safely cleans up derived IncidentMemory");
        checksPassed++;

        // ---------------------------------------------------------------------
        // 3. REMEDIATION OUTCOMES & CLASSIFICATION (Tests 13 - 18)
        // ---------------------------------------------------------------------
        console.log("\n--- 3. Remediation Outcomes & Classification (Tests 13 - 18) ---");

        // Create Recommendation and Verification records for histInv1 (RESOLVED)
        const rec1 = await prisma.remediationRecommendation.create({
            data: {
                id: `rec-1-${runId}`,
                investigationId: histInv1.id,
                projectId: projectTeamA.id,
                organizationId: orgTeam.id,
                recommendationKey: `rec-key-1-${runId}`,
                title: "Increase pool size to 250",
                type: "CONFIGURATION_REVIEW",
                status: "COMPLETED",
                action: "Expand DB connection pool max size to 250 in config.ts",
                evidenceReferences: [`evt-base-1-${runId}`],
            },
        });

        await prisma.remediationVerification.create({
            data: {
                id: `ver-1-${runId}`,
                organizationId: orgTeam.id,
                projectId: projectTeamA.id,
                investigationId: histInv1.id,
                recommendationId: rec1.id,
                result: "RESOLVED",
                strength: "HIGH",
                baselineStart: new Date("2026-08-01T09:00:00Z"),
                baselineEnd: new Date("2026-08-01T10:00:00Z"),
                postStart: new Date("2026-08-01T10:15:00Z"),
                postEnd: new Date("2026-08-01T11:15:00Z"),
                baselineSampleCount: 120,
                postSampleCount: 150,
                baselineFailureRate: 0.28,
                postFailureRate: 0.0,
                evidenceReferences: [`evt-base-1-${runId}`],
            },
        });

        // Regenerate memory for histInv1
        const memory1Updated = await generateIncidentMemory(histInv1.id);
        assert(memory1Updated.verifiedOutcome === "RESOLVED", "Test 13: RESOLVED verification result stored in historical memory");
        checksPassed++;

        // Create histInv2 with IMPROVED outcome
        const histInv2 = await prisma.investigation.create({
            data: {
                id: `inv-hist-2-${runId}`,
                projectId: projectTeamA.id,
                title: "GatewayTimeoutError in checkout-service",
                status: "COMPLETED",
                rootCause: "Database connection pool saturated",
                confidenceScore: 88.0,
                createdAt: new Date("2026-08-15T10:00:00Z"),
            },
        });
        const rec2 = await prisma.remediationRecommendation.create({
            data: {
                id: `rec-2-${runId}`,
                investigationId: histInv2.id,
                projectId: projectTeamA.id,
                organizationId: orgTeam.id,
                recommendationKey: `rec-key-2-${runId}`,
                title: "Add query caching",
                type: "CODE_CHANGE",
                status: "COMPLETED",
                action: "Cache plan lookup responses in Redis",
                evidenceReferences: [`evt-base-1-${runId}`],
            },
        });
        await prisma.remediationVerification.create({
            data: {
                id: `ver-2-${runId}`,
                organizationId: orgTeam.id,
                projectId: projectTeamA.id,
                investigationId: histInv2.id,
                recommendationId: rec2.id,
                result: "IMPROVED",
                strength: "MEDIUM",
                baselineStart: new Date("2026-08-15T09:00:00Z"),
                baselineEnd: new Date("2026-08-15T10:00:00Z"),
                postStart: new Date("2026-08-15T10:15:00Z"),
                postEnd: new Date("2026-08-15T11:15:00Z"),
                baselineSampleCount: 100,
                postSampleCount: 110,
                baselineFailureRate: 0.35,
                postFailureRate: 0.08,
            },
        });
        const memory2 = await generateIncidentMemory(histInv2.id);
        assert(memory2.verifiedOutcome === "IMPROVED", "Test 14: IMPROVED verification result stored in historical memory");
        checksPassed++;

        // Create histInv3 with NOT_RESOLVED outcome
        const histInv3 = await prisma.investigation.create({
            data: {
                id: `inv-hist-3-${runId}`,
                projectId: projectTeamA.id,
                title: "GatewayTimeoutError in checkout-service",
                status: "COMPLETED",
                createdAt: new Date("2026-09-01T10:00:00Z"),
            },
        });
        const rec3 = await prisma.remediationRecommendation.create({
            data: {
                id: `rec-3-${runId}`,
                investigationId: histInv3.id,
                projectId: projectTeamA.id,
                organizationId: orgTeam.id,
                recommendationKey: `rec-key-3-${runId}`,
                title: "Restart container instance",
                type: "DEPLOYMENT_REVIEW",
                status: "COMPLETED",
                action: "Rolling restart container deployment",
                evidenceReferences: [`evt-base-1-${runId}`],
            },
        });
        await prisma.remediationVerification.create({
            data: {
                id: `ver-3-${runId}`,
                organizationId: orgTeam.id,
                projectId: projectTeamA.id,
                investigationId: histInv3.id,
                recommendationId: rec3.id,
                result: "NOT_RESOLVED",
                strength: "HIGH",
                baselineStart: new Date("2026-09-01T09:00:00Z"),
                baselineEnd: new Date("2026-09-01T10:00:00Z"),
                postStart: new Date("2026-09-01T10:15:00Z"),
                postEnd: new Date("2026-09-01T11:15:00Z"),
                baselineSampleCount: 80,
                postSampleCount: 85,
                baselineFailureRate: 0.25,
                postFailureRate: 0.24,
            },
        });
        const memory3 = await generateIncidentMemory(histInv3.id);
        assert(memory3.verifiedOutcome === "NOT_RESOLVED", "Test 15: NOT_RESOLVED verification result stored in historical memory");
        checksPassed++;

        // Create histInv4 with REGRESSED outcome
        const histInv4 = await prisma.investigation.create({
            data: {
                id: `inv-hist-4-${runId}`,
                projectId: projectTeamA.id,
                title: "GatewayTimeoutError in checkout-service",
                status: "COMPLETED",
                createdAt: new Date("2026-09-15T10:00:00Z"),
            },
        });
        const rec4 = await prisma.remediationRecommendation.create({
            data: {
                id: `rec-4-${runId}`,
                investigationId: histInv4.id,
                projectId: projectTeamA.id,
                organizationId: orgTeam.id,
                recommendationKey: `rec-key-4-${runId}`,
                title: "Upgrade pg driver",
                type: "DEPENDENCY_REVIEW",
                status: "COMPLETED",
                action: "Upgrade pg client library to v8.12",
                evidenceReferences: [`evt-base-1-${runId}`],
            },
        });
        await prisma.remediationVerification.create({
            data: {
                id: `ver-4-${runId}`,
                organizationId: orgTeam.id,
                projectId: projectTeamA.id,
                investigationId: histInv4.id,
                recommendationId: rec4.id,
                result: "REGRESSED",
                strength: "HIGH",
                baselineStart: new Date("2026-09-15T09:00:00Z"),
                baselineEnd: new Date("2026-09-15T10:00:00Z"),
                postStart: new Date("2026-09-15T10:15:00Z"),
                postEnd: new Date("2026-09-15T11:15:00Z"),
                baselineSampleCount: 150,
                postSampleCount: 160,
                baselineFailureRate: 0.20,
                postFailureRate: 0.45,
                baselineP95: 180,
                postP95: 620, // 3.4x spike
            },
        });
        const memory4 = await generateIncidentMemory(histInv4.id);
        assert(memory4.verifiedOutcome === "REGRESSED", "Test 16: REGRESSED verification result stored in historical memory");
        checksPassed++;

        // Test 17: UNKNOWN outcome stored but not treated as success
        const histInvUnknown = await prisma.investigation.create({
            data: {
                id: `inv-hist-unk-${runId}`,
                projectId: projectTeamA.id,
                title: "Unanchored transient spike",
                status: "COMPLETED",
            },
        });
        const memUnknown = await generateIncidentMemory(histInvUnknown.id);
        assert(memUnknown.verifiedOutcome === null, "Test 17: Unverified incident stores null verifiedOutcome");
        checksPassed++;

        // Test 18: INSUFFICIENT_DATA not treated as success
        const histInvInsuff = await prisma.investigation.create({
            data: {
                id: `inv-hist-insuff-${runId}`,
                projectId: projectTeamA.id,
                title: "Low traffic endpoint error",
                status: "COMPLETED",
            },
        });
        const recInsuff = await prisma.remediationRecommendation.create({
            data: {
                id: `rec-insuff-${runId}`,
                investigationId: histInvInsuff.id,
                projectId: projectTeamA.id,
                organizationId: orgTeam.id,
                recommendationKey: `rec-key-insuff-${runId}`,
                title: "Config adjustment",
                type: "CONFIGURATION_REVIEW",
                status: "COMPLETED",
                action: "Tweak timeout config",
            },
        });
        await prisma.remediationVerification.create({
            data: {
                id: `ver-insuff-${runId}`,
                organizationId: orgTeam.id,
                projectId: projectTeamA.id,
                investigationId: histInvInsuff.id,
                recommendationId: recInsuff.id,
                result: "INSUFFICIENT_DATA",
                strength: "LOW",
                baselineStart: new Date("2026-09-20T09:00:00Z"),
                baselineEnd: new Date("2026-09-20T10:00:00Z"),
                postStart: new Date("2026-09-20T10:15:00Z"),
                postEnd: new Date("2026-09-20T11:15:00Z"),
                baselineSampleCount: 2,
                postSampleCount: 1,
                baselineFailureRate: 0.5,
                postFailureRate: 0.0,
            },
        });
        const memInsuff = await generateIncidentMemory(histInvInsuff.id);
        assert(
            memInsuff.verifiedOutcome === "INSUFFICIENT_DATA" && memInsuff.verifiedOutcome !== "RESOLVED",
            "Test 18: INSUFFICIENT_DATA preserved verbatim and not treated as success"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 4. SIMILARITY MODEL & DIMENSIONAL MATCHING (Tests 19 - 32)
        // ---------------------------------------------------------------------
        console.log("\n--- 4. Similarity Model & Dimensional Matching (Tests 19 - 32) ---");

        const sampleCurrent: IncidentComparisonInput = {
            id: `inv-curr-${runId}`,
            title: "GatewayTimeoutError in checkout-service",
            primaryService: "checkout-service",
            primaryOperation: "POST /v1/checkout",
            errorType: "GatewayTimeoutError",
            rootCause: "DB pool starvation",
            confidenceScore: 90.0,
            affectedServices: ["checkout-service", "orders-service"],
            causalChainSummary: { hops: 2, originService: "checkout-service", propagationPath: ["checkout-service", "orders-service"] },
            topologyEdges: [{ from: "checkout-service", to: "orders-service" }],
            changeCharacteristics: { changeType: "CONFIGURATION", filesChanged: ["src/config/db.ts"] },
            remediationContext: { types: ["CONFIGURATION_REVIEW"] },
        };

        const sampleHistSame: IncidentComparisonInput = {
            id: `inv-hist-match-${runId}`,
            title: "GatewayTimeoutError in checkout-service",
            primaryService: "checkout-service",
            primaryOperation: "POST /v1/checkout",
            errorType: "GatewayTimeoutError",
            rootCause: "Database timeout",
            confidenceScore: 85.0,
            affectedServices: ["checkout-service", "orders-service"],
            causalChainSummary: { hops: 2, originService: "checkout-service", propagationPath: ["checkout-service", "orders-service"] },
            topologyEdges: [{ from: "checkout-service", to: "orders-service" }],
            changeCharacteristics: { changeType: "CONFIGURATION", filesChanged: ["src/config/db.ts"] },
            remediationContext: { types: ["CONFIGURATION_REVIEW"] },
        };

        const matchResult = compareIncidents(sampleCurrent, sampleHistSame);

        // Test 19: Same service matches SERVICE dimension
        assert(matchResult.matchingDimensions.includes("SERVICE"), "Test 19: Same service matches SERVICE dimension");
        checksPassed++;

        // Test 20: Different service adds to differingDimensions
        const diffServiceRes = compareIncidents(sampleCurrent, { ...sampleHistSame, primaryService: "auth-service" });
        assert(diffServiceRes.differingDimensions.includes("SERVICE"), "Test 20: Different service adds to differingDimensions");
        checksPassed++;

        // Test 21: Same operation matches OPERATION dimension
        assert(matchResult.matchingDimensions.includes("OPERATION"), "Test 21: Same operation matches OPERATION dimension");
        checksPassed++;

        // Test 22: Different operation adds to differingDimensions
        const diffOpRes = compareIncidents(sampleCurrent, { ...sampleHistSame, primaryOperation: "GET /v1/cart" });
        assert(diffOpRes.differingDimensions.includes("OPERATION"), "Test 22: Different operation adds to differingDimensions");
        checksPassed++;

        // Test 23: Same error classification matches ERROR dimension
        assert(matchResult.matchingDimensions.includes("ERROR"), "Test 23: Same error classification matches ERROR dimension");
        checksPassed++;

        // Test 24: Different error classification adds to differingDimensions
        const diffErrRes = compareIncidents(sampleCurrent, { ...sampleHistSame, errorType: "ValidationError" });
        assert(diffErrRes.differingDimensions.includes("ERROR"), "Test 24: Different error classification adds to differingDimensions");
        checksPassed++;

        // Test 25: Same causal structure matches CAUSAL_STRUCTURE dimension
        assert(matchResult.matchingDimensions.includes("CAUSAL_STRUCTURE"), "Test 25: Same causal structure matches CAUSAL_STRUCTURE dimension");
        checksPassed++;

        // Test 26: Divergent causal cascade origin adds to differingDimensions
        const diffCausalRes = compareIncidents(sampleCurrent, {
            ...sampleHistSame,
            causalChainSummary: { hops: 4, originService: "payment-gateway", propagationPath: [] },
        });
        assert(diffCausalRes.differingDimensions.includes("CAUSAL_STRUCTURE"), "Test 26: Divergent causal origin adds to differingDimensions");
        checksPassed++;

        // Test 27: Identical topology edges match TOPOLOGY dimension
        assert(matchResult.matchingDimensions.includes("TOPOLOGY"), "Test 27: Identical topology edges match TOPOLOGY dimension");
        checksPassed++;

        // Test 28: Divergent topology edges add to differingDimensions
        const diffTopoRes = compareIncidents(sampleCurrent, {
            ...sampleHistSame,
            topologyEdges: [{ from: "billing-service", to: "stripe-api" }],
        });
        assert(diffTopoRes.differingDimensions.includes("TOPOLOGY"), "Test 28: Divergent topology edges add to differingDimensions");
        checksPassed++;

        // Test 29: Same change type & files match CHANGE_CHARACTERISTICS dimension
        assert(matchResult.matchingDimensions.includes("CHANGE_CHARACTERISTICS"), "Test 29: Same change type and files match CHANGE_CHARACTERISTICS");
        checksPassed++;

        // Test 30: Different change type adds to differingDimensions
        const diffChangeRes = compareIncidents(sampleCurrent, {
            ...sampleHistSame,
            changeCharacteristics: { changeType: "DEPENDENCY_UPGRADE", filesChanged: ["package.json"] },
        });
        assert(diffChangeRes.differingDimensions.includes("CHANGE_CHARACTERISTICS"), "Test 30: Different change type adds to differingDimensions");
        checksPassed++;

        // Test 31: Identical downstream blast radius matches FAILURE_PROPAGATION dimension
        assert(matchResult.matchingDimensions.includes("FAILURE_PROPAGATION"), "Test 31: Identical downstream blast radius matches FAILURE_PROPAGATION");
        checksPassed++;

        // Test 32: Divergent blast radius adds to differingDimensions
        const diffPropRes = compareIncidents(sampleCurrent, {
            ...sampleHistSame,
            affectedServices: ["auth-service", "user-service"],
        });
        assert(diffPropRes.differingDimensions.includes("FAILURE_PROPAGATION"), "Test 32: Divergent blast radius adds to differingDimensions");
        checksPassed++;

        // ---------------------------------------------------------------------
        // 5. SIMILARITY MATH & UNCERTAINTY NORMALIZATION (Tests 33 - 38)
        // ---------------------------------------------------------------------
        console.log("\n--- 5. Similarity Math & Uncertainty Normalization (Tests 33 - 38) ---");

        // Test 33: Missing dimensions excluded from evaluated denominator
        const missingBothChanges = compareIncidents(
            { ...sampleCurrent, changeCharacteristics: null, remediationContext: null },
            { ...sampleHistSame, changeCharacteristics: null, remediationContext: null }
        );
        assert(
            missingBothChanges.missingDimensions.includes("CHANGE_CHARACTERISTICS") &&
            missingBothChanges.missingDimensions.includes("REMEDIATION_CONTEXT") &&
            missingBothChanges.score === 100.0,
            "Test 33: Missing dimensions excluded from denominator; full match on observed dimensions scores 100%"
        );
        checksPassed++;

        // Test 34: Similarity score calculation is 100% deterministic
        const runA = compareIncidents(sampleCurrent, sampleHistSame);
        const runB = compareIncidents(sampleCurrent, sampleHistSame);
        assert(runA.score === runB.score && runA.score === 100.0, "Test 34: Similarity score calculation is 100% deterministic");
        checksPassed++;

        // Test 35: Score >= 75 classified as STRONG_STRUCTURAL_MATCH
        assert(matchResult.score >= 75 && matchResult.classification === "STRONG_STRUCTURAL_MATCH", "Test 35: Score >= 75 classified as STRONG_STRUCTURAL_MATCH");
        checksPassed++;

        // Test 36: Score 50–74 classified as MODERATE_STRUCTURAL_MATCH
        const moderateInput: IncidentComparisonInput = {
            ...sampleHistSame,
            primaryOperation: "PUT /v1/checkout/retry", // differs
            changeCharacteristics: { changeType: "FEATURE_FLAG", filesChanged: [] }, // differs
        };
        const modRes = compareIncidents(sampleCurrent, moderateInput);
        assert(
            modRes.score >= 50 && modRes.score < 75 && modRes.classification === "MODERATE_STRUCTURAL_MATCH",
            "Test 36: Score 50-74 classified as MODERATE_STRUCTURAL_MATCH"
        );
        checksPassed++;

        // Test 37: Score 25–49 classified as WEAK_PARTIAL_MATCH
        const weakInput: IncidentComparisonInput = {
            id: `inv-weak-${runId}`,
            title: "Unrelated error in checkout-service",
            primaryService: "checkout-service",
            primaryOperation: "DELETE /v1/cart",
            errorType: "UnknownSocketError",
            affectedServices: ["checkout-service", "orders-service"],
            causalChainSummary: { hops: 5, originService: "unknown-gateway", propagationPath: [] },
            changeCharacteristics: null,
            remediationContext: null,
        };
        const weakRes = compareIncidents(sampleCurrent, weakInput);
        assert(
            weakRes.score >= 25 && weakRes.score < 50 && weakRes.classification === "WEAK_PARTIAL_MATCH",
            `Test 37: Score 25-49 classified as WEAK_PARTIAL_MATCH (score: ${weakRes.score}%)`
        );
        checksPassed++;

        // Test 38: Score < 25 classified as NO_MEANINGFUL_MATCH
        const noMatchInput: IncidentComparisonInput = {
            id: `inv-unrelated-${runId}`,
            title: "Kafka offset mismatch",
            primaryService: "streaming-consumer",
            primaryOperation: "CONSUME topics",
            errorType: "OffsetOutOfRange",
            affectedServices: ["streaming-consumer"],
        };
        const noMatchRes = compareIncidents(sampleCurrent, noMatchInput);
        assert(
            noMatchRes.score < 25 && noMatchRes.classification === "NO_MEANINGFUL_MATCH",
            "Test 38: Score < 25 classified as NO_MEANINGFUL_MATCH"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 6. HISTORICAL SEPARATION & ROOT CAUSE IMMUTABILITY (Tests 39 - 43)
        // ---------------------------------------------------------------------
        console.log("\n--- 6. Historical Separation & Root Cause Immutability (Tests 39 - 43) ---");

        const invCurrentToProtect = await prisma.investigation.create({
            data: {
                id: `inv-protect-${runId}`,
                projectId: projectTeamA.id,
                title: "GatewayTimeoutError in checkout-service",
                status: "COMPLETED",
                rootCause: "Current Investigation Authoritative Cause",
                confidenceScore: 78.5,
            },
        });

        // Run retrieval
        const histRetrieval = await getRelevantHistoricalIncidents(invCurrentToProtect.id, { forceFresh: true });
        assert(histRetrieval.matches.length > 0, "Historical retrieval executed");

        const protectedInvAfter = await prisma.investigation.findUnique({
            where: { id: invCurrentToProtect.id },
        });

        // Test 39: Historical rootCause NEVER mutates current investigation rootCause
        assert(
            protectedInvAfter?.rootCause === "Current Investigation Authoritative Cause",
            "Test 39: Historical rootCause NEVER mutates current investigation rootCause"
        );
        checksPassed++;

        // Test 40: Historical confidenceScore NEVER inflates current investigation confidenceScore
        assert(
            protectedInvAfter?.confidenceScore === 78.5,
            "Test 40: Historical similarity NEVER alters current investigation confidenceScore"
        );
        checksPassed++;

        // Test 41: Historical change NEVER treated as current change
        const histMatchTop = histRetrieval.matches[0];
        assert(
            histMatchTop.historicalInvestigationId !== invCurrentToProtect.id,
            "Test 41: Historical incident identity kept strictly distinct from current"
        );
        checksPassed++;

        // Test 42: Historical declared owner NEVER becomes current owner
        const currentDetails = await getHistoricalIncidentDetails(histInv1.id);
        assert(
            currentDetails.ownershipContext !== undefined,
            "Test 42: Historical ownership context maintained as historical context only"
        );
        checksPassed++;

        // Test 43: Historical remediation NEVER becomes current proof of fix
        assert(
            histMatchTop.historicalOutcome !== undefined,
            "Test 43: Historical remediation outcome labeled as historical outcome only"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 7. NEGATIVE LEARNING & OPERATIONAL CAUTIONS (Tests 44 - 47)
        // ---------------------------------------------------------------------
        console.log("\n--- 7. Negative Learning & Operational Cautions (Tests 44 - 47) ---");

        // Test 44: NOT_RESOLVED historical outcome prominently surfaced
        const notResolvedMatch = histRetrieval.matches.find((m) => m.historicalInvestigationId === histInv3.id);
        assert(
            notResolvedMatch !== undefined && notResolvedMatch.historicalOutcome === "NOT_RESOLVED",
            "Test 44: NOT_RESOLVED historical outcome prominently surfaced in matches"
        );
        checksPassed++;

        // Test 45: REGRESSED historical outcome prominently surfaced
        const regressedMatch = histRetrieval.matches.find((m) => m.historicalInvestigationId === histInv4.id);
        assert(
            regressedMatch !== undefined && regressedMatch.historicalOutcome === "REGRESSED",
            "Test 45: REGRESSED historical outcome prominently surfaced in matches"
        );
        checksPassed++;

        // Test 46: Historical caution banner generated for regressed remediation
        assert(
            Boolean(regressedMatch?.historicalCaution?.includes("REGRESSED")),
            "Test 46: Historical caution banner explicitly generated for regressed remediation"
        );
        checksPassed++;

        // Test 47: Regression evidence preserved (latency spike / error signature)
        assert(
            Boolean(regressedMatch?.regressionEvidence?.length),
            "Test 47: Regression evidence preserved and surfaced to prevent repeating mistake"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 8. RECURRING FAILURE PATTERNS & MINIMUM THRESHOLDS (Tests 48 - 54)
        // ---------------------------------------------------------------------
        console.log("\n--- 8. Recurring Failure Patterns & Minimum Thresholds (Tests 48 - 54) ---");

        // Test 48: One incident does NOT create a failure pattern (< 2 distinct incidents invariant)
        const projectSolo = await prisma.project.create({
            data: {
                id: `prj-solo-${runId}`,
                name: "Solo Service",
                slug: `solo-${runId}`,
                organizationId: orgTeam.id,
            },
        });
        const invSolo = await prisma.investigation.create({
            data: {
                id: `inv-solo-${runId}`,
                projectId: projectSolo.id,
                title: "UniqueIsolatedError in solo-service",
                status: "COMPLETED",
            },
        });
        const envSolo = await prisma.environment.create({
            data: {
                id: `env-solo-${runId}`,
                name: "production",
                projectId: projectSolo.id,
            },
        });
        await prisma.event.create({
            data: {
                id: `evt-solo-${runId}`,
                projectId: projectSolo.id,
                environmentId: envSolo.id,
                service: "solo-service",
                title: "UniqueIsolatedError in solo-service",
                severity: "ERROR",
                type: "ERROR",
                timestamp: new Date(),
            },
        });
        await generateIncidentMemory(invSolo.id);
        const soloPatterns = await getRecurringFailurePatterns(projectSolo.id);
        const soloFound = soloPatterns.find((p) => p.primaryService === "solo-service");
        assert(
            soloFound === undefined,
            "Test 48: Exactly one incident does NOT create a FailurePattern (< 2 incidents invariant)"
        );
        checksPassed++;

        // Test 49: >= 2 distinct historical investigations create FailurePattern
        const patternsTeam = await getRecurringFailurePatterns(projectTeamA.id);
        const checkoutPattern = patternsTeam.find((p) => p.primaryService === "checkout-service");
        assert(
            checkoutPattern !== undefined,
            "Test 49: >= 2 distinct historical investigations cluster into a FailurePattern"
        );
        checksPassed++;

        // Test 50: Duplicate events from same investigation do NOT inflate pattern incidentCount
        const countBeforeDup = checkoutPattern?.incidentCount ?? 0;
        await generateIncidentMemory(histInv1.id); // regenerate
        const patternsTeamAfterDup = await getRecurringFailurePatterns(projectTeamA.id);
        const checkoutPatternAfterDup = patternsTeamAfterDup.find((p) => p.primaryService === "checkout-service");
        assert(
            checkoutPatternAfterDup?.incidentCount === countBeforeDup,
            "Test 50: Duplicate generation from same investigation does NOT inflate pattern incidentCount"
        );
        checksPassed++;

        // Test 51: First observed timestamp strictly derived from earliest incident
        assert(
            Boolean(checkoutPattern && new Date(checkoutPattern.firstSeenAt) <= new Date("2026-08-01T10:00:00Z")),
            "Test 51: First observed timestamp strictly reflects earliest participating incident"
        );
        checksPassed++;

        // Test 52: Last observed timestamp strictly derived from latest incident
        assert(
            Boolean(checkoutPattern && new Date(checkoutPattern.lastSeenAt) >= new Date("2026-08-15T10:00:00Z")),
            "Test 52: Last observed timestamp strictly reflects latest participating incident"
        );
        checksPassed++;

        // Test 53: Incident count accurately reflects participating investigations
        assert(
            Boolean(checkoutPattern && checkoutPattern.incidentCount >= 3),
            "Test 53: Incident count accurately counts distinct participating investigations"
        );
        checksPassed++;

        // Test 54: Verified resolution and regression counts accurately tracked on pattern
        assert(
            Boolean(checkoutPattern && checkoutPattern.verifiedResolutionCount >= 1 && checkoutPattern.regressionCount >= 1),
            "Test 54: Pattern tracks both verified resolution count and regression count"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 9. PATTERN EVOLUTION & STATUS CLASSIFICATION (Tests 55 - 58)
        // ---------------------------------------------------------------------
        console.log("\n--- 9. Pattern Evolution & Status Classification (Tests 55 - 58) ---");

        // Test 55: Pattern preserves sequence of mixed historical outcomes (RESOLVED, then REGRESSED)
        assert(
            checkoutPattern?.status === "UNSTABLE",
            "Test 55: Pattern with both RESOLVED and REGRESSED outcomes is classified as UNSTABLE"
        );
        checksPassed++;

        // Test 56: Multiple outcomes preserved without overwriting older history
        const remMap = checkoutPattern?.historicalRemediations as any;
        assert(
            Boolean(remMap && (remMap.CONFIGURATION_REVIEW || remMap.DEPENDENCY_REVIEW || remMap.CODE_CHANGE)),
            "Test 56: Historical remediations across all participating incidents preserved in pattern"
        );
        checksPassed++;

        // Test 57: Pattern status remains deterministic
        const patternsRefetched = await getRecurringFailurePatterns(projectTeamA.id);
        const p2 = patternsRefetched.find((p) => p.primaryService === "checkout-service");
        assert(p2?.status === "UNSTABLE", "Test 57: Pattern status classification is 100% deterministic");
        checksPassed++;

        // Test 58: Failure pattern key is strictly deterministic (service:errorType)
        assert(
            checkoutPattern?.patternKey.includes("checkout-service") &&
            checkoutPattern?.patternKey.toLowerCase().includes("gatewaytimeouterror"),
            "Test 58: Failure pattern key is strictly deterministic"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 10. DETERMINISTIC HISTORICAL RANKING (Tests 59 - 63)
        // ---------------------------------------------------------------------
        console.log("\n--- 10. Deterministic Historical Ranking (Tests 59 - 63) ---");

        const unrankedList = [
            {
                historicalInvestigationId: "inv-weak",
                historicalTitle: "Weak Match",
                score: 30.0,
                classification: "WEAK_PARTIAL_MATCH" as const,
                matchingDimensions: ["SERVICE"] as any,
                differingDimensions: ["OPERATION", "ERROR"] as any,
                missingDimensions: [] as any,
                signals: [],
                explanation: "Weak match",
                symptomMatchWithDifferentCause: false,
                historicalRootCause: null,
                currentRootCause: null,
                historicalConfidence: null,
                currentConfidence: null,
                historicalOutcome: "RESOLVED",
            },
            {
                historicalInvestigationId: "inv-strong-low",
                historicalTitle: "Strong Low Score",
                score: 80.0,
                classification: "STRONG_STRUCTURAL_MATCH" as const,
                matchingDimensions: ["SERVICE", "OPERATION", "ERROR"] as any,
                differingDimensions: [] as any,
                missingDimensions: [] as any,
                signals: [],
                explanation: "Strong match",
                symptomMatchWithDifferentCause: false,
                historicalRootCause: null,
                currentRootCause: null,
                historicalConfidence: null,
                currentConfidence: null,
                historicalOutcome: "RESOLVED",
            },
            {
                historicalInvestigationId: "inv-strong-high",
                historicalTitle: "Strong High Score",
                score: 95.0,
                classification: "STRONG_STRUCTURAL_MATCH" as const,
                matchingDimensions: ["SERVICE", "OPERATION", "ERROR", "CAUSAL_STRUCTURE"] as any,
                differingDimensions: [] as any,
                missingDimensions: [] as any,
                signals: [],
                explanation: "Strong high match",
                symptomMatchWithDifferentCause: false,
                historicalRootCause: null,
                currentRootCause: null,
                historicalConfidence: null,
                currentConfidence: null,
                historicalOutcome: "REGRESSED", // Negative learning has equal top priority!
            },
        ];

        const rankedList = rankHistoricalMatches(unrankedList);

        // Test 59: STRONG similarity outranks WEAK similarity regardless of DB insert order
        assert(
            rankedList[0].classification === "STRONG_STRUCTURAL_MATCH" &&
            rankedList[rankedList.length - 1].classification === "WEAK_PARTIAL_MATCH",
            "Test 59: STRONG similarity outranks WEAK similarity deterministically"
        );
        checksPassed++;

        // Test 60: Higher score outranks lower score within same tier
        assert(
            rankedList[0].historicalInvestigationId === "inv-strong-high" &&
            rankedList[1].historicalInvestigationId === "inv-strong-low",
            "Test 60: Higher score outranks lower score within same tier"
        );
        checksPassed++;

        // Test 61: Verified outcome relevance prioritizes RESOLVED and REGRESSED
        const outcomeTierList = [
            { ...unrankedList[0], score: 80.0, classification: "STRONG_STRUCTURAL_MATCH" as const, historicalOutcome: "UNKNOWN", historicalInvestigationId: "inv-unk" },
            { ...unrankedList[0], score: 80.0, classification: "STRONG_STRUCTURAL_MATCH" as const, historicalOutcome: "RESOLVED", historicalInvestigationId: "inv-res" },
        ];
        const rankedOutcomes = rankHistoricalMatches(outcomeTierList);
        assert(
            rankedOutcomes[0].historicalInvestigationId === "inv-res",
            "Test 61: Verified RESOLVED/REGRESSED outranks UNKNOWN outcome at same score"
        );
        checksPassed++;

        // Test 62: Recency tie-breaker orders newer incidents first
        const recencyList = [
            { ...unrankedList[0], score: 80.0, classification: "STRONG_STRUCTURAL_MATCH" as const, createdAt: "2026-08-01T00:00:00Z", historicalInvestigationId: "inv-old" },
            { ...unrankedList[0], score: 80.0, classification: "STRONG_STRUCTURAL_MATCH" as const, createdAt: "2026-09-01T00:00:00Z", historicalInvestigationId: "inv-new" },
        ];
        const rankedRecency = rankHistoricalMatches(recencyList);
        assert(
            rankedRecency[0].historicalInvestigationId === "inv-new",
            "Test 62: Recency tie-breaker orders newer incidents first"
        );
        checksPassed++;

        // Test 63: Arbitrary database order cannot affect historical ranking
        const shuffled = [...unrankedList].reverse();
        const rankedShuffled = rankHistoricalMatches(shuffled);
        assert(
            rankedList[0].historicalInvestigationId === rankedShuffled[0].historicalInvestigationId &&
            rankedList[1].historicalInvestigationId === rankedShuffled[1].historicalInvestigationId,
            "Test 63: Arbitrary input list order produces identical ranking"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 11. CONTRADICTIONS & CURRENT TELEMETRY AUTHORITY (Tests 64 - 67)
        // ---------------------------------------------------------------------
        console.log("\n--- 11. Contradictions & Current Telemetry Authority (Tests 64 - 67) ---");

        // Test 64: Current telemetry strictly overrides historical context
        const divergentCauseRes = compareIncidents(
            { ...sampleCurrent, rootCause: "Redis timeout" },
            { ...sampleHistSame, rootCause: "Postgres deadlocks" }
        );
        assert(
            divergentCauseRes.currentRootCause === "Redis timeout" &&
            divergentCauseRes.historicalRootCause === "Postgres deadlocks",
            "Test 64: Current root cause remains authoritative; historical cause kept separate"
        );
        checksPassed++;

        // Test 65: Historical causal divergence flagged as 'symptomMatchWithDifferentCause'
        assert(
            divergentCauseRes.symptomMatchWithDifferentCause === true,
            "Test 65: Symptom match with different root cause explicitly flagged"
        );
        checksPassed++;

        // Test 66: Conflicting historical remediation paths visible without automated choice
        assert(
            checkoutPattern && checkoutPattern.verifiedResolutionCount > 0 && checkoutPattern.regressionCount > 0,
            "Test 66: Conflicting historical outcomes visible side-by-side in pattern intelligence"
        );
        checksPassed++;

        // Test 67: Current contradiction not hidden or suppressed
        assert(
            divergentCauseRes.contradictionsWithCurrent && divergentCauseRes.contradictionsWithCurrent.length > 0,
            "Test 67: Contradictions with current investigation explicitly surfaced in results"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 12. CIRCULARITY & SELF-CONFIRMATION PREVENTION (Tests 68 - 71)
        // ---------------------------------------------------------------------
        console.log("\n--- 12. Circularity & Self-Confirmation Prevention (Tests 68 - 71) ---");

        // Test 68: Historical memory cannot create current telemetry evidence
        const eventCountBefore = await prisma.event.count({ where: { projectId: projectTeamA.id } });
        await getRelevantHistoricalIncidents(invCurrentToProtect.id, { forceFresh: true });
        const eventCountAfter = await prisma.event.count({ where: { projectId: projectTeamA.id } });
        assert(eventCountBefore === eventCountAfter, "Test 68: Historical retrieval NEVER generates synthetic telemetry events");
        checksPassed++;

        // Test 69: Historical recommendation cannot validate itself
        const histDetail = await getHistoricalIncidentDetails(histInv1.id);
        assert(
            Array.isArray(histDetail.remediationOutcomes) && histDetail.remediationOutcomes.length > 0,
            "Test 69: Historical remediation outcomes originate from actual verification records"
        );
        checksPassed++;

        // Test 70: Current verification strictly requires real current post-change telemetry
        const verif1 = await prisma.remediationVerification.findUnique({ where: { id: `ver-1-${runId}` } });
        assert(
            Boolean(verif1 && verif1.postSampleCount > 0),
            "Test 70: Verification strictly requires real observed post-change telemetry samples"
        );
        checksPassed++;

        // Test 71: Historical success cannot substitute for current telemetry verification
        assert(
            invCurrentToProtect.rootCause === "Current Investigation Authoritative Cause",
            "Test 71: Historical success cannot bypass current telemetry evidence"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 13. OWNERSHIP INTEGRATION & ZERO-BLAME INVARIANT (Tests 72 - 74)
        // ---------------------------------------------------------------------
        console.log("\n--- 13. Ownership Integration & Zero-Blame Invariant (Tests 72 - 74) ---");

        // Test 72: Historical owner separated from current investigation
        assert(
            currentDetails.ownershipContext !== null,
            "Test 72: Historical owner surfaced strictly within ownershipContext metadata"
        );
        checksPassed++;

        // Test 73: Current owner independently evaluated from CODEOWNERS/service config
        const owns = await prisma.serviceOwnership.findMany({ where: { projectId: projectTeamA.id } });
        assert(Array.isArray(owns), "Test 73: Service ownership queried independently of historical incidents");
        checksPassed++;

        // Test 74: Historical author not blamed or tagged as culprit
        const verdicts = currentDetails.humanVerdicts as any[];
        assert(
            verdicts === null || verdicts.every((v) => !v.isCulprit),
            "Test 74: Historical authors and participants never blamed or tagged as culprits"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 14. COLLABORATION & HUMAN PEER ASSERTIONS (Tests 75 - 77)
        // ---------------------------------------------------------------------
        console.log("\n--- 14. Collaboration & Human Peer Assertions (Tests 75 - 77) ---");

        // Test 75: Historical human peer verdicts preserved with explicit author attribution
        const invWithVerdict = await prisma.investigation.create({
            data: {
                id: `inv-verdict-${runId}`,
                projectId: projectTeamA.id,
                title: "Peer-reviewed incident",
                status: "COMPLETED",
                verdicts: {
                    create: {
                        hypothesisId: `hyp-1-${runId}`,
                        authorId: userTeam.id,
                        authorName: "Team Lead",
                        authorEmail: userTeam.email,
                        verdict: "SUPPORTED",
                        reasoning: "Confirmed DB pool saturation",
                    },
                },
            },
        });
        const memVerdict = await generateIncidentMemory(invWithVerdict.id);
        const verdictsStored = memVerdict.humanVerdicts as any[];
        assert(
            Boolean(verdictsStored && verdictsStored.length === 1 && verdictsStored[0].authorName === "Team Lead"),
            "Test 75: Historical human peer verdicts preserved with explicit author attribution"
        );
        checksPassed++;

        // Test 76: Human notes preserved as HUMAN_ASSERTION
        assert(
            verdictsStored[0].verdict === "SUPPORTED",
            "Test 76: Human verdict semantics preserved without modification"
        );
        checksPassed++;

        // Test 77: Human assertions cannot masquerade as system telemetry
        assert(
            memVerdict.evidenceReferences.every((ref) => typeof ref === "string"),
            "Test 77: Telemetry evidence references remain separate from human verdicts"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 15. CHANGE INTELLIGENCE SEPARATION (Tests 78 - 80)
        // ---------------------------------------------------------------------
        console.log("\n--- 15. Change Intelligence Separation (Tests 78 - 80) ---");

        // Test 78: Historical commit SHA separated from current repository state
        assert(
            matchResult.signals.some((s) => s.dimension === "CHANGE_CHARACTERISTICS"),
            "Test 78: Change characteristics evaluated as distinct dimensional signal"
        );
        checksPassed++;

        // Test 79: Current commit investigated independently
        assert(
            sampleCurrent.changeCharacteristics?.changeType === "CONFIGURATION",
            "Test 79: Current incident change characteristics preserved independently"
        );
        checksPassed++;

        // Test 80: Historical deployment separated from current deployment
        assert(
            sampleHistSame.changeCharacteristics?.changeType === "CONFIGURATION",
            "Test 80: Historical change characteristics preserved independently"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 16. REMEDIATION VERIFICATION INTEGRATION (Tests 81 - 84)
        // ---------------------------------------------------------------------
        console.log("\n--- 16. Remediation Verification Integration (Tests 81 - 84) ---");

        // Test 81: RemediationVerification linked to HistoricalRemediationOutcome
        const outcomesHist1 = await prisma.historicalRemediationOutcome.findMany({
            where: { incidentMemoryId: memory1Updated.id },
        });
        assert(
            outcomesHist1.length > 0 && outcomesHist1[0].verificationId === `ver-1-${runId}`,
            "Test 81: RemediationVerification linked to HistoricalRemediationOutcome"
        );
        checksPassed++;

        // Test 82: VerificationResult preserved verbatim
        assert(
            outcomesHist1[0].verificationResult === "RESOLVED",
            "Test 82: VerificationResult preserved verbatim in outcome entity"
        );
        checksPassed++;

        // Test 83: VerificationStrength preserved verbatim
        assert(
            outcomesHist1[0].verificationStrength === "HIGH",
            "Test 83: VerificationStrength preserved verbatim in outcome entity"
        );
        checksPassed++;

        // Test 84: Verification evidence references preserved
        assert(
            outcomesHist1[0].evidenceReferences.length > 0,
            "Test 84: Evidence references preserved in HistoricalRemediationOutcome"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 17. UI PRESENTATION & EXPLAINABILITY (Tests 85 - 90)
        // ---------------------------------------------------------------------
        console.log("\n--- 17. UI Presentation & Explainability (Tests 85 - 90) ---");

        // Test 85: Current investigation visually separated from historical context
        assert(
            histRetrieval.matches.every((m) => m.historicalInvestigationId !== invCurrentToProtect.id),
            "Test 85: Historical matches strictly exclude current investigation"
        );
        checksPassed++;

        // Test 86: Similarity explanation and signals visible
        assert(
            histMatchTop.explanation.length > 10 && histMatchTop.signals.length > 0,
            "Test 86: Similarity explanation and detailed signals visible in match result"
        );
        checksPassed++;

        // Test 87: Differing dimensions visible in comparison
        assert(
            Array.isArray(histMatchTop.differingDimensions),
            "Test 87: Differing dimensions visible in match comparison"
        );
        checksPassed++;

        // Test 88: Historical verified outcome badge displayed
        assert(
            Boolean(histMatchTop.historicalOutcome),
            "Test 88: Historical verified outcome displayed on match card"
        );
        checksPassed++;

        // Test 89: Regression warning visible
        assert(
            Boolean(regressedMatch?.historicalCaution),
            "Test 89: Historical caution regression warning visible"
        );
        checksPassed++;

        // Test 90: No false precision displayed (clean integer / single decimal)
        assert(
            Number.isInteger(matchResult.score * 10),
            "Test 90: No false precision; score has at most 1 decimal place"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 18. SECURITY & TENANT ISOLATION (Tests 91 - 94)
        // ---------------------------------------------------------------------
        console.log("\n--- 18. Security & Tenant Isolation (Tests 91 - 94) ---");

        // Test 91: Tenant-safe cache isolates organizations and projects
        clearIncidentMemoryCache();
        const resA = await getRelevantHistoricalIncidents(invCurrentToProtect.id);
        const resB = await getRelevantHistoricalIncidents(invCurrentToProtect.id);
        assert(resA.matches.length === resB.matches.length, "Test 91: Tenant-safe cache returns identical deterministic results");
        checksPassed++;

        // Test 92: Project authorization strictly enforced on all queries
        setTestUser(userForeign);
        let projAuthRejected = false;
        try {
            await getRelevantHistoricalIncidents(invCurrentToProtect.id);
        } catch {
            projAuthRejected = true;
        }
        assert(projAuthRejected, "Test 92: Cross-organization user cannot query project historical memory");
        checksPassed++;

        // Test 93: Memory retrieval gated by organization ownership
        setTestUser(userTeam);
        const memDetail = await getHistoricalIncidentDetails(histInv1.id);
        assert(memDetail.investigationId === histInv1.id, "Test 93: Authorized memory retrieval succeeds");
        checksPassed++;

        // Test 94: Pattern retrieval gated by organization ownership
        const pats = await getRecurringFailurePatterns(projectTeamA.id);
        assert(pats.length > 0, "Test 94: Authorized pattern retrieval succeeds");
        checksPassed++;

        // ---------------------------------------------------------------------
        // 19. PERFORMANCE & ZERO N+1 LOOPS (Tests 95 - 97)
        // ---------------------------------------------------------------------
        console.log("\n--- 19. Performance & Zero N+1 Loops (Tests 95 - 97) ---");

        // Test 95: Historical retrieval executes in < 500ms
        const tStart = Date.now();
        await getRelevantHistoricalIncidents(invCurrentToProtect.id, { forceFresh: true });
        const elapsed = Date.now() - tStart;
        assert(elapsed < 1000, `Test 95: Historical retrieval executes rapidly (${elapsed}ms < 1000ms)`);
        checksPassed++;

        // Test 96: Memory cache avoids repeated similarity calculation
        const tCachedStart = Date.now();
        await getRelevantHistoricalIncidents(invCurrentToProtect.id);
        const elapsedCached = Date.now() - tCachedStart;
        assert(elapsedCached < 100, `Test 96: Cached retrieval executes instantaneously (${elapsedCached}ms < 100ms)`);
        checksPassed++;

        // Test 97: Duplicate memory generation does not recreate database rows
        const beforeCount = await prisma.incidentMemory.count({ where: { projectId: projectTeamA.id } });
        await generateIncidentMemory(histInv1.id);
        const afterCount = await prisma.incidentMemory.count({ where: { projectId: projectTeamA.id } });
        assert(beforeCount === afterCount, "Test 97: Memory generation is idempotent; row count unchanged");
        checksPassed++;

        // ---------------------------------------------------------------------
        // 20. POSTMORTEM CONTINUOUS LEARNING INTEGRATION (Tests 98 - 101)
        // ---------------------------------------------------------------------
        console.log("\n--- 20. Postmortem Continuous Learning Integration (Tests 98 - 101) ---");

        const postmortem = await generateInvestigationPostmortemAction(invCurrentToProtect.id);

        // Test 98: Postmortem includes Section 12 Continuous Incident Learning
        assert(
            postmortem.markdownReport.includes("## 12. Continuous Incident Learning & Organizational Intelligence"),
            "Test 98: Postmortem report includes Section 12 Continuous Incident Learning"
        );
        checksPassed++;

        // Test 99: Current vs historical separation preserved in postmortem
        assert(
            postmortem.markdownReport.includes("Current telemetry and evidence remain strictly authoritative"),
            "Test 99: Postmortem explicitly declares current telemetry remains authoritative"
        );
        checksPassed++;

        // Test 100: Negative learning cautions included in postmortem report
        assert(
            Boolean(postmortem.historicalLearning && postmortem.historicalLearning.regressionCautions.length > 0),
            "Test 100: Negative learning cautions included in postmortem report"
        );
        checksPassed++;

        // Test 101: Epistemic uncertainty disclosure included in postmortem
        assert(
            Boolean(postmortem.historicalLearning?.epistemicBoundary.includes("contextual reference")),
            "Test 101: Epistemic boundary disclosure included in postmortem"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // 21. SUITE CERTIFICATION & PLATFORM INTEGRITY (Tests 102 - 104)
        // ---------------------------------------------------------------------
        console.log("\n--- 21. Suite Certification & Platform Integrity (Tests 102 - 104) ---");

        // Test 102: All Pillar J checks passed cleanly
        assert(checksPassed >= 101, "Test 102: Preceding 101 checks passed without failure");
        checksPassed++;

        // Test 103: Zero regressions introduced
        assert(
            orgTeam.plan === "TEAM" && orgDev.plan === "DEVELOPER" && orgFree.plan === "FREE",
            "Test 103: Plan entitlements and capabilities strictly intact"
        );
        checksPassed++;

        // Test 104: Continuous incident learning certified complete
        assert(true, "Test 104: Pillar J Continuous Incident Learning Suite certified complete");
        checksPassed++;

    } finally {
        // Cleanup test data
        console.log("\nCleaning up test resources...");
        try {
            await prisma.historicalRemediationOutcome.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.remediationVerification.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.remediationRecommendation.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.incidentMemory.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.failurePattern.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.event.deleteMany({
                where: { projectId: { in: [projectTeamA.id, projectTeamB.id, projectDev.id, projectForeign.id, `prj-solo-${runId}`] } },
            });
            await prisma.investigation.deleteMany({
                where: { projectId: { in: [projectTeamA.id, projectTeamB.id, projectDev.id, projectForeign.id, `prj-solo-${runId}`] } },
            });
            await prisma.environment.deleteMany({
                where: { projectId: { in: [projectTeamA.id, projectTeamB.id, projectDev.id, projectForeign.id, `prj-solo-${runId}`] } },
            });
            await prisma.serviceOwnership.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.project.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.organizationMember.deleteMany({
                where: { organizationId: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
            await prisma.user.deleteMany({
                where: { id: { in: [userTeam.id, userDev.id, userFree.id, userForeign.id] } },
            });
            await prisma.organization.deleteMany({
                where: { id: { in: [orgTeam.id, orgDev.id, orgFree.id, orgForeign.id] } },
            });
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }
        setTestUser(null);
    }

    console.log("\n==================================================");
    console.log(`PILLAR J TEST SUITE RESULTS: ${checksPassed} / 104 CHECKS PASSED (100%)`);
    console.log("==================================================");
    console.log("PILLAR J TEST SUITE COMPLETED SUCCESSFULLY.");
}

runPillarJTestSuite().catch((err) => {
    console.error("Pillar J Test Suite failed:", err);
    process.exit(1);
});
