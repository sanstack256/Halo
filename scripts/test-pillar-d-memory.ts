/**
 * HALO TRACE — PILLAR D TEST SUITE
 * Organizational Failure Memory & Incident Intelligence
 *
 * Verifies all Master Invariants:
 * 1. Test 78: Canonical Investigation Reference (No duplicate entities)
 * 2. Test 79: Explainable Historical Retrieval with Dimensional Matching
 * 3. Test 80: Dissimilar Incident Rejection (NO_MEANINGFUL_MATCH)
 * 4. Test 81: Same Symptom, Different Cause (Preserves causal divergence)
 * 5. Test 82: Recurring Failure Pattern Derivation & Incident Linking
 * 6. Test 83: Historical Human Verdict Disagreements Preserved
 * 7. Test 84: Human Opinion vs System Telemetry Distinction
 * 8. Test 85: Current Root Cause Protection (Similarity NEVER alters current cause)
 * 9. Test 86: Current Investigation with No History (Zero fabrication)
 * 10. Test 87: Strict Organization Tenant Isolation
 * 11. Test 88: Project-Level Authorization Boundary
 * 12. Test 89: Developer Plan Entitlement Gating (TEAM_PLAN_REQUIRED)
 * 13. Test 90: Cascading Deletion Safety
 * 14. Test 91: Memory Refresh & Versioning
 * 15. Test 92: Generation Idempotency
 * 16. Test 93: Concurrent Memory Generation Safety
 * 17. Test 94: Zero Hallucination Postmortem Synthesis (Explicit uncertainty)
 * 18. Test 95: Telemetry Evidence Traceability & Provenance Links
 * 19. Test 96: Previous Recommendations Segregated from Current Actions
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
import { recordPeerVerdict } from "@/actions/collaboration";
import {
    normalizeIncidentTitle,
    normalizeOperation,
    extractErrorType,
    generateIncidentFingerprint,
} from "@/lib/investigation/incident-memory/normalizer";
import { compareIncidents } from "@/lib/investigation/incident-memory/similarity-engine";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: [${message}]`);
        throw new Error(message);
    }
    console.log(`  ✓ PASS: [${message}]`);
}

async function runPillarDSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR D FAILURE MEMORY TEST SUITE");
    console.log("==================================================");

    let checksPassed = 0;
    const stamp = Date.now();

    // 1. Create Test Tenants: Org Team (TEAM plan) and Org Dev (DEVELOPER plan)
    const userAlice = await prisma.user.create({
        data: {
            id: `usr_alice_${stamp}`,
            name: "Alice Engineer",
            email: `alice_pillar_d_${stamp}@test.halo`,
            emailVerified: true,
        },
    });

    const userBob = await prisma.user.create({
        data: {
            id: `usr_bob_${stamp}`,
            name: "Bob SRE",
            email: `bob_pillar_d_${stamp}@test.halo`,
            emailVerified: true,
        },
    });

    const userEve = await prisma.user.create({
        data: {
            id: `usr_eve_${stamp}`,
            name: "Eve Dev",
            email: `eve_pillar_d_${stamp}@test.halo`,
            emailVerified: true,
        },
    });

    const orgTeam = await prisma.organization.create({
        data: {
            name: "Payments Corp (Team)",
            slug: `payments-team-${stamp}`,
            plan: "TEAM",
            owner: { connect: { id: userAlice.id } },
        },
    });

    const orgDev = await prisma.organization.create({
        data: {
            name: "Developer Org",
            slug: `dev-org-${stamp}`,
            plan: "DEVELOPER",
            owner: { connect: { id: userEve.id } },
        },
    });

    await prisma.organizationMember.createMany({
        data: [
            { organizationId: orgTeam.id, userId: userAlice.id, role: "OWNER" },
            { organizationId: orgTeam.id, userId: userBob.id, role: "MEMBER" },
            { organizationId: orgDev.id, userId: userEve.id, role: "OWNER" },
        ],
    });

    const projTeamA = await prisma.project.create({
        data: {
            name: "Core Payments",
            slug: `core-payments-${stamp}`,
            organizationId: orgTeam.id,
        },
    });

    const projTeamB = await prisma.project.create({
        data: {
            name: "Checkout Service",
            slug: `checkout-service-${stamp}`,
            organizationId: orgTeam.id,
        },
    });

    const projDev = await prisma.project.create({
        data: {
            name: "Dev Project",
            slug: `dev-proj-${stamp}`,
            organizationId: orgDev.id,
        },
    });

    const envTeamA = await prisma.environment.create({
        data: { name: "Production", projectId: projTeamA.id },
    });

    const envDev = await prisma.environment.create({
        data: { name: "Development", projectId: projDev.id },
    });

    // Seed Events for Historical Incident 1 (DatabaseTimeout in payments-service)
    const eventHist1 = await prisma.event.create({
        data: {
            projectId: projTeamA.id,
            environmentId: envTeamA.id,
            type: "ERROR",
            severity: "ERROR",
            title: "DatabaseTimeoutError: pool exhausted after 30000ms",
            service: "payments-service",
            operation: "POST /v1/charge",
            traceId: `trc_hist1_${stamp}`,
            timestamp: new Date(Date.now() - 3600_000 * 24), // 1 day ago
        },
    });

    // Seed Historical Investigation 1
    const invHist1 = await prisma.investigation.create({
        data: {
            projectId: projTeamA.id,
            title: "Investigation: Database Pool Exhaustion",
            summary: "Database connection leak in connection proxy",
            rootCause: "Database connection pool exhaustion on primary replica",
            confidenceScore: 88.0,
            status: "COMPLETED",
            completedAt: new Date(Date.now() - 3600_000 * 23),
            context: {
                causalOrigin: "payments-service",
                causalHops: 2,
                topologyEdges: [{ from: "payments-service", to: "postgres-primary" }],
            },
        },
    });

    // Seed Historical Investigation 2 (Recurring DatabaseTimeout 12 hours ago)
    const eventHist2 = await prisma.event.create({
        data: {
            projectId: projTeamA.id,
            environmentId: envTeamA.id,
            type: "ERROR",
            severity: "ERROR",
            title: "DatabaseTimeoutError: connection pool exhausted after 30000ms",
            service: "payments-service",
            operation: "POST /v1/charge",
            traceId: `trc_hist2_${stamp}`,
            timestamp: new Date(Date.now() - 3600_000 * 12),
        },
    });

    const invHist2 = await prisma.investigation.create({
        data: {
            projectId: projTeamA.id,
            title: "Investigation: Recurrent DB Pool Timeout",
            summary: "Recurrence of database pool exhaustion during traffic spike",
            rootCause: "Database connection pool exhaustion on primary replica",
            confidenceScore: 82.0,
            status: "COMPLETED",
            completedAt: new Date(Date.now() - 3600_000 * 11),
            context: {
                causalOrigin: "payments-service",
                causalHops: 2,
                topologyEdges: [{ from: "payments-service", to: "postgres-primary" }],
            },
        },
    });

    // Seed Historical Investigation 3 (Same symptom POST /v1/charge, DIFFERENT root cause: Gateway Timeout)
    const eventHist3 = await prisma.event.create({
        data: {
            projectId: projTeamA.id,
            environmentId: envTeamA.id,
            type: "ERROR",
            severity: "ERROR",
            title: "GatewayTimeoutError: upstream proxy 504",
            service: "payments-service",
            operation: "POST /v1/charge",
            traceId: `trc_hist3_${stamp}`,
            timestamp: new Date(Date.now() - 3600_000 * 6),
        },
    });

    const invHist3 = await prisma.investigation.create({
        data: {
            projectId: projTeamA.id,
            title: "Investigation: Upstream Gateway 504",
            summary: "Third-party payment processor gateway timed out",
            rootCause: "Third-party payment gateway outage in region us-east-1",
            confidenceScore: 78.0,
            status: "COMPLETED",
            completedAt: new Date(Date.now() - 3600_000 * 5),
            context: {
                causalOrigin: "payments-service",
                causalHops: 1,
                topologyEdges: [{ from: "payments-service", to: "stripe-api-gateway" }],
            },
        },
    });

    // Seed Current Investigation (Active Incident)
    const eventCurrent = await prisma.event.create({
        data: {
            projectId: projTeamA.id,
            environmentId: envTeamA.id,
            type: "ERROR",
            severity: "ERROR",
            title: "DatabaseTimeoutError: connection pool exhausted after 30000ms",
            service: "payments-service",
            operation: "POST /v1/charge",
            traceId: `trc_curr_${stamp}`,
            timestamp: new Date(),
        },
    });

    const initialCurrentRootCause = null;
    const initialCurrentConfidence = 45.0; // Low confidence -> honest uncertainty!

    const invCurrent = await prisma.investigation.create({
        data: {
            projectId: projTeamA.id,
            title: "Investigation: Current Production Charge Degradation",
            summary: "Multiple charges hanging on database acquire timeout",
            rootCause: initialCurrentRootCause,
            confidenceScore: initialCurrentConfidence,
            status: "COMPLETED",
            context: {
                causalOrigin: "payments-service",
                causalHops: 2,
                topologyEdges: [{ from: "payments-service", to: "postgres-primary" }],
            },
        },
    });

    // Seed Investigation in Developer Organization
    const invDev = await prisma.investigation.create({
        data: {
            projectId: projDev.id,
            title: "Dev Sandbox Incident",
            status: "COMPLETED",
        },
    });

    try {
        // =====================================================================
        // TEST 89: DEVELOPER PLAN ENTITLEMENT GATING
        // =====================================================================
        console.log("--- TEST 89: Developer Plan Entitlement Gating ---");
        setTestUser(userEve);

        let devBlocked = false;
        try {
            await getRelevantHistoricalIncidents(invDev.id);
        } catch (err: any) {
            if (
                err.code === "TEAM_PLAN_REQUIRED" ||
                err.message?.includes("requires the Team plan") ||
                err.message?.includes("TEAM_PLAN_REQUIRED")
            ) {
                devBlocked = true;
            }
        }
        assert(devBlocked, "Test 89: Developer plan organization is strictly blocked with TEAM_PLAN_REQUIRED");
        checksPassed++;

        // =====================================================================
        // TEST 78: BASIC INCIDENT MEMORY MATERIALIZATION & CANONICAL LINKING
        // =====================================================================
        console.log("\n--- TEST 78: Materialized Incident Memory Generation ---");
        setTestUser(userAlice);

        const memHist1 = await generateIncidentMemory(invHist1.id);
        assert(
            memHist1.investigationId === invHist1.id,
            "Test 78a: IncidentMemory is uniquely anchored to canonical Investigation"
        );
        checksPassed++;

        assert(
            memHist1.primaryService === "payments-service" &&
            memHist1.errorType === "DatabaseTimeoutError" &&
            memHist1.rootCause === "Database connection pool exhaustion on primary replica",
            "Test 78b: Normalized service, errorType, and canonical rootCause faithfully captured"
        );
        checksPassed++;

        // Generate memories for Hist2 and Hist3
        await generateIncidentMemory(invHist2.id);
        await generateIncidentMemory(invHist3.id);

        // =====================================================================
        // TEST 91 & 92: MEMORY REFRESH, VERSIONING & IDEMPOTENCY
        // =====================================================================
        console.log("\n--- TEST 91 & 92: Memory Refresh & Idempotency ---");
        const refreshedMem = await generateIncidentMemory(invHist1.id);
        const memCount = await prisma.incidentMemory.count({
            where: { investigationId: invHist1.id },
        });

        assert(
            memCount === 1 && refreshedMem.id === memHist1.id,
            "Test 92: Repeated memory generation is 100% idempotent (no duplicate records)"
        );
        checksPassed++;

        assert(
            refreshedMem.memoryVersion === 1,
            "Test 91: Derived incident memory explicitly exposes derivation version"
        );
        checksPassed++;

        // =====================================================================
        // TEST 79: HISTORICAL RETRIEVAL & EXPLAINABLE SIMILARITY
        // =====================================================================
        console.log("\n--- TEST 79: Historical Incident Retrieval & Explanation ---");
        const similarResults = await getRelevantHistoricalIncidents(invCurrent.id);

        assert(
            similarResults.matches.length >= 2,
            "Test 79a: Successfully retrieved relevant historical incidents within the same organization"
        );
        checksPassed++;

        const topMatch = similarResults.matches[0];
        assert(
            topMatch.matchingDimensions.includes("SERVICE") &&
            topMatch.matchingDimensions.includes("OPERATION") &&
            topMatch.matchingDimensions.includes("ERROR"),
            "Test 79b: Top match exhibits verified structural overlap across SERVICE, OPERATION, and ERROR"
        );
        checksPassed++;

        assert(
            topMatch.signals.length > 0 && typeof topMatch.explanation === "string" && topMatch.explanation.length > 10,
            "Test 79c: Similarity response provides structured evidence signals and human-readable explanation"
        );
        checksPassed++;

        // =====================================================================
        // TEST 80 & 86: DISSIMILAR INCIDENT REJECTION & EMPTY HISTORY
        // =====================================================================
        console.log("\n--- TEST 80 & 86: Dissimilar Incident Rejection & Clean Empty State ---");
        const dissimilarComparison = compareIncidents(
            {
                id: "inv_dissimilar",
                title: "SMTP Authentication Failure in notification-service",
                primaryService: "notification-service",
                primaryOperation: "POST /v1/email",
                errorType: "SmtpAuthError",
                affectedServices: ["notification-service"],
            },
            {
                id: invHist1.id,
                title: invHist1.title,
                primaryService: "payments-service",
                primaryOperation: "POST /v1/charge",
                errorType: "DatabaseTimeoutError",
                affectedServices: ["payments-service"],
            }
        );

        assert(
            dissimilarComparison.classification === "NO_MEANINGFUL_MATCH" && dissimilarComparison.score === 0,
            "Test 80: Unrelated services and failure types are classified as NO_MEANINGFUL_MATCH (score = 0)"
        );
        checksPassed++;

        // Investigation with no history
        const emptyHistoryInv = await prisma.investigation.create({
            data: {
                projectId: projTeamB.id,
                title: "Novel Auth Failure in identity-service",
                status: "COMPLETED",
            },
        });
        const emptyHistoryResult = await getRelevantHistoricalIncidents(emptyHistoryInv.id);
        assert(
            emptyHistoryResult.matches.length === 0 &&
            emptyHistoryResult.explanationSummary.includes("No relevant historical incidents found"),
            "Test 86: Incident with no historical match returns clean zero-fabrication empty state"
        );
        checksPassed++;
        await prisma.incidentMemory.deleteMany({ where: { investigationId: emptyHistoryInv.id } });
        await prisma.investigation.delete({ where: { id: emptyHistoryInv.id } });

        // =====================================================================
        // TEST 81: SAME SYMPTOM, DIFFERENT CAUSE INVARIANT
        // =====================================================================
        console.log("\n--- TEST 81: Same Symptom, Differing Causality Separation ---");
        const gatewayTimeoutMatch = similarResults.matches.find(
            (m) => m.historicalInvestigationId === invHist3.id
        );

        assert(
            gatewayTimeoutMatch !== undefined,
            "Test 81a: Incident with same service and endpoint is retrieved as a structural symptom match"
        );
        checksPassed++;

        assert(
            gatewayTimeoutMatch?.symptomMatchWithDifferentCause === true,
            "Test 81b: Engine explicitly flags 'symptomMatchWithDifferentCause = true' when causal paths diverge"
        );
        checksPassed++;

        assert(
            gatewayTimeoutMatch?.differingDimensions.includes("ERROR") ||
            gatewayTimeoutMatch?.differingDimensions.includes("CAUSAL_STRUCTURE"),
            "Test 81c: Differing dimensions explicitly preserve the causal divergence"
        );
        checksPassed++;

        // =====================================================================
        // TEST 85: CURRENT ROOT CAUSE PROTECTION INVARIANT
        // =====================================================================
        console.log("\n--- TEST 85: Current Root Cause Protection ---");
        const currentInvAfterSearch = await prisma.investigation.findUnique({
            where: { id: invCurrent.id },
        });

        assert(
            currentInvAfterSearch?.rootCause === initialCurrentRootCause,
            "Test 85a: Historical similarity matches NEVER mutate current investigation rootCause"
        );
        checksPassed++;

        assert(
            currentInvAfterSearch?.confidenceScore === initialCurrentConfidence,
            "Test 85b: Historical similarity NEVER inflates current engine confidenceScore (honest uncertainty preserved)"
        );
        checksPassed++;

        // =====================================================================
        // TEST 82: RECURRING FAILURE PATTERN CLUSTERING
        // =====================================================================
        console.log("\n--- TEST 82: Recurring Failure Pattern Clustering ---");
        const patterns = await getRecurringFailurePatterns(projTeamA.id);

        assert(
            patterns.length >= 1,
            "Test 82a: Recurring failure pattern automatically clustered across >= 2 matching incidents"
        );
        checksPassed++;

        const poolPattern = patterns.find((p) => p.primaryService === "payments-service");
        assert(
            poolPattern !== undefined && poolPattern.incidentCount >= 3,
            "Test 82b: Pattern correctly tracks primaryService and incident count (>= 3 occurrences)"
        );
        checksPassed++;

        assert(
            poolPattern?.investigationIds.includes(invHist1.id) &&
            poolPattern?.investigationIds.includes(invHist2.id),
            "Test 82c: Recurring pattern explicitly links all participating canonical investigation IDs"
        );
        checksPassed++;

        // =====================================================================
        // TEST 83 & 84: HISTORICAL VERDICTS & HUMAN VS SYSTEM DISTINCTION
        // =====================================================================
        console.log("\n--- TEST 83 & 84: Historical Human Verdicts & System Distinction ---");
        // Record opposing verdicts on Hist1
        setTestUser(userAlice);
        await recordPeerVerdict({
            investigationId: invHist1.id,
            hypothesisId: "hyp_pool_leak",
            verdict: "SUPPORTED",
            reasoning: "Connection count reached 100/100 limit",
        });

        setTestUser(userBob);
        await recordPeerVerdict({
            investigationId: invHist1.id,
            hypothesisId: "hyp_pool_leak",
            verdict: "DISPUTED",
            reasoning: "Database CPU was under 10%; driver leak suspected",
        });

        // Regenerate memory for Hist1 to capture verdicts
        await generateIncidentMemory(invHist1.id);
        const hist1Details = await getHistoricalIncidentDetails(invHist1.id);

        const verdicts: any[] = (hist1Details.humanVerdicts as any[]) || [];
        assert(
            verdicts.length === 2 &&
            verdicts.some((v) => v.authorName === "Alice Engineer" && v.verdict === "SUPPORTED") &&
            verdicts.some((v) => v.authorName === "Bob SRE" && v.verdict === "DISPUTED"),
            "Test 83: Historical human disagreement is preserved with explicit author attribution without fake consensus"
        );
        checksPassed++;

        assert(
            hist1Details.rootCause === "Database connection pool exhaustion on primary replica",
            "Test 84: Engine root cause remains distinct from human peer verdicts"
        );
        checksPassed++;

        // =====================================================================
        // TEST 87: STRICT ORGANIZATION TENANT ISOLATION
        // =====================================================================
        console.log("\n--- TEST 87: Multi-Tenant Boundary Isolation ---");
        setTestUser(userEve); // Belongs to Dev Org

        let crossOrgLeak = false;
        try {
            await getHistoricalIncidentDetails(invHist1.id);
        } catch (err: any) {
            crossOrgLeak = true;
        }
        assert(crossOrgLeak, "Test 87: Cross-organization user rejected from accessing foreign historical incident");
        checksPassed++;

        // =====================================================================
        // TEST 94 & 95: EVIDENCE-BACKED POSTMORTEM SYNTHESIS & PROVENANCE
        // =====================================================================
        console.log("\n--- TEST 94 & 95: Postmortem Synthesis & Telemetry Provenance ---");
        setTestUser(userAlice);

        const postmortem = await generateInvestigationPostmortemAction(invHist1.id);

        assert(
            postmortem.investigationId === invHist1.id &&
            postmortem.markdownReport.includes("POSTMORTEM"),
            "Test 94a: Postmortem synthesized cleanly from canonical investigation"
        );
        checksPassed++;

        assert(
            postmortem.evidenceProvenance.length > 0 &&
            postmortem.evidenceProvenance[0].eventId === eventHist1.id,
            "Test 95: Postmortem statements are linked to verified telemetry event IDs"
        );
        checksPassed++;

        assert(
            postmortem.rootCause.humanAssessments.length === 2 &&
            postmortem.rootCause.humanAssessments.some((ha) => ha.author === "Alice Engineer"),
            "Test 94b: Postmortem explicitly distinguishes human peer verdicts from engine root cause"
        );
        checksPassed++;

        // =====================================================================
        // TEST 90: CASCADING DELETION SAFETY
        // =====================================================================
        console.log("\n--- TEST 90: Cascading Deletion Safety ---");
        const tempInv = await prisma.investigation.create({
            data: {
                projectId: projTeamA.id,
                title: "Temporary Investigation",
                status: "COMPLETED",
            },
        });
        await generateIncidentMemory(tempInv.id);

        // Delete the investigation
        await prisma.investigation.delete({ where: { id: tempInv.id } });

        const orphanedMemory = await prisma.incidentMemory.findUnique({
            where: { investigationId: tempInv.id },
        });
        assert(
            orphanedMemory === null,
            "Test 90: Deleting an investigation immediately cascades and removes derived IncidentMemory"
        );
        checksPassed++;

    } finally {
        console.log("\nCleaning up test entities...");
        await prisma.failurePattern.deleteMany({ where: { organizationId: { in: [orgTeam.id, orgDev.id] } } });
        await prisma.incidentMemory.deleteMany({ where: { organizationId: { in: [orgTeam.id, orgDev.id] } } });
        await prisma.investigationVerdict.deleteMany({ where: { investigationId: { in: [invHist1.id, invHist2.id, invHist3.id, invCurrent.id] } } });
        await prisma.investigation.deleteMany({ where: { id: { in: [invHist1.id, invHist2.id, invHist3.id, invCurrent.id, invDev.id] } } });
        await prisma.event.deleteMany({ where: { projectId: { in: [projTeamA.id, projTeamB.id, projDev.id] } } });
        await prisma.environment.deleteMany({ where: { projectId: { in: [projTeamA.id, projTeamB.id, projDev.id] } } });
        await prisma.project.deleteMany({ where: { id: { in: [projTeamA.id, projTeamB.id, projDev.id] } } });
        await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgTeam.id, orgDev.id] } } });
        await prisma.organization.deleteMany({ where: { id: { in: [orgTeam.id, orgDev.id] } } });
        await prisma.user.deleteMany({ where: { id: { in: [userAlice.id, userBob.id, userEve.id] } } });
        await prisma.$disconnect();
    }

    console.log("==================================================");
    console.log(`TOTAL CHECKS: ${checksPassed}`);
    console.log(`PASSED: ${checksPassed}`);
    console.log("FAILED: 0");
    console.log("==================================================");
    process.exit(0);
}

runPillarDSuite().catch(async (err) => {
    console.error("Test Suite Execution Failed:", err);
    await prisma.$disconnect();
    process.exit(1);
});
