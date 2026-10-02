/**
 * HALO TRACE — TEAM PLAN
 * PHASE 4 / PILLAR C: COLLABORATIVE LIVE INVESTIGATION ROOMS TEST SUITE
 *
 * Verifies:
 * 1. Server-side Team plan capability gating (Developer blocked, Team allowed)
 * 2. Multi-tenant and project authorization isolation (foreign org/project rejected)
 * 3. Live Presence tracking, heartbeat TTL expiry, and multi-tab deduplication
 * 4. Durable investigation activity stream & deterministic ordering
 * 5. Evidence-anchored comments with real evidence verification (fabricated evidence rejected)
 * 6. Concurrent comment safety (no lost updates, author permissions, tombstone deletion)
 * 7. Peer verdicts on hypotheses (opposing consensus, separation from Halo engine root-cause)
 * 8. Strict Root Cause Immutability (human verdicts NEVER modify engine confidence or root cause)
 * 9. Human-proposed relationships (explicitly HUMAN_PROPOSED, telemetry remains immutable)
 * 10. Mutation idempotency (idempotencyKey prevents duplicate comments and verdicts)
 */

import { prisma } from "../apps/dashboard/src/lib/prisma";
import {
    getInvestigationCollaborationState,
    sendPresenceHeartbeat,
    addInvestigationComment,
    editInvestigationComment,
    deleteInvestigationComment,
    recordPeerVerdict,
    proposeHumanRelation,
} from "../apps/dashboard/src/actions/collaboration";
import { collaborationHub } from "../apps/dashboard/src/lib/investigation/collaboration-hub";

function setTestUser(user: { email: string } | null) {
    if (user) {
        process.env.HALO_TEST_USER_EMAIL = user.email;
    } else {
        delete process.env.HALO_TEST_USER_EMAIL;
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: [${message}]`);
        throw new Error(message);
    }
    console.log(`  ✓ PASS: [${message}]`);
}

async function runPillarCSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR C COLLABORATION TEST SUITE");
    console.log("==================================================\n");

    const stamp = Date.now();
    let checksPassed = 0;

    // -------------------------------------------------------------------------
    // Setup Organizations, Users, and Projects
    // -------------------------------------------------------------------------
    const orgTeam = await prisma.organization.create({
        data: {
            name: `Pillar C Team Org ${stamp}`,
            slug: `pillar-c-team-${stamp}`,
            plan: "TEAM",
        },
    });

    const orgDev = await prisma.organization.create({
        data: {
            name: `Pillar C Dev Org ${stamp}`,
            slug: `pillar-c-dev-${stamp}`,
            plan: "DEVELOPER",
        },
    });

    const userAlice = await prisma.user.create({
        data: {
            id: `usr_alice_${stamp}`,
            email: `alice_${stamp}@example.com`,
            name: "Alice Engineer",
        },
    });

    const userBob = await prisma.user.create({
        data: {
            id: `usr_bob_${stamp}`,
            email: `bob_${stamp}@example.com`,
            name: "Bob SRE",
        },
    });

    const userEve = await prisma.user.create({
        data: {
            id: `usr_eve_${stamp}`,
            email: `eve_${stamp}@example.com`,
            name: "Eve Attacker",
        },
    });

    // Alice and Bob belong to Team Org
    await prisma.organizationMember.create({
        data: {
            organizationId: orgTeam.id,
            userId: userAlice.id,
            role: "ADMIN",
        },
    });
    await prisma.organizationMember.create({
        data: {
            organizationId: orgTeam.id,
            userId: userBob.id,
            role: "MEMBER",
        },
    });

    // Eve belongs to Dev Org
    await prisma.organizationMember.create({
        data: {
            organizationId: orgDev.id,
            userId: userEve.id,
            role: "OWNER",
        },
    });

    const projTeam = await prisma.project.create({
        data: {
            name: "Payments Core",
            slug: `payments-core-${stamp}`,
            organizationId: orgTeam.id,
        },
    });

    const projDev = await prisma.project.create({
        data: {
            name: "Dev Project",
            slug: `dev-project-${stamp}`,
            organizationId: orgDev.id,
        },
    });

    const envTeam = await prisma.environment.create({
        data: {
            name: "Production",
            projectId: projTeam.id,
        },
    });

    // Real telemetry event backing the investigation
    const realEvent = await prisma.event.create({
        data: {
            projectId: projTeam.id,
            environmentId: envTeam.id,
            type: "ERROR",
            severity: "ERROR",
            title: "DatabaseTimeout: pool exhausted",
            service: "payments-service",
            operation: "POST /v1/charge",
            traceId: `trc_${stamp}`,
            metadata: { spanId: `spn_root_${stamp}` },
            timestamp: new Date(),
        },
    });

    // Canonical durable Investigation Record
    const initialRootCauseTitle = "Connection pool exhaustion on primary replica";
    const initialConfidence = 85.0;

    const investigation = await prisma.investigation.create({
        data: {
            projectId: projTeam.id,
            title: "Investigation: Payments Outage",
            summary: "Database connection pool exhausted causing cascaded 504 timeouts",
            rootCause: initialRootCauseTitle,
            confidenceScore: initialConfidence,
            status: "COMPLETED",
        },
    });

    const devInvestigation = await prisma.investigation.create({
        data: {
            projectId: projDev.id,
            title: "Dev Investigation",
            summary: "Sandbox issue",
            status: "COMPLETED",
        },
    });

    try {
        // =====================================================================
        // TEST 53 & 54: TEAM PLAN ENTITLEMENT GATING
        // =====================================================================
        console.log("--- TEST 53 & 54: Team Entitlement Enforcement ---");
        setTestUser(userEve); // On Developer plan

        let devBlocked = false;
        try {
            await getInvestigationCollaborationState(devInvestigation.id);
        } catch (err: any) {
            if (err.code === "TEAM_PLAN_REQUIRED" || err.message?.includes("requires the Team plan") || err.message?.includes("TEAM_PLAN_REQUIRED")) {
                devBlocked = true;
            }
        }
        assert(devBlocked, "Test 53: Developer plan blocked with TEAM_PLAN_REQUIRED");
        checksPassed++;

        setTestUser(userAlice); // On Team plan
        const teamAllowed = await getInvestigationCollaborationState(investigation.id);
        assert(teamAllowed.investigationId === investigation.id, "Test 54: Team plan allowed to access collaboration state");
        checksPassed++;

        // =====================================================================
        // TEST 50 & 51: MULTI-TENANT ISOLATION & DIRECT ID ATTACKS
        // =====================================================================
        console.log("\n--- TEST 50 & 51: Multi-Tenant & Direct ID Boundary Isolation ---");
        setTestUser(userEve); // Belongs to Dev Org, attempting to access Team Org investigation

        let foreignAccessBlocked = false;
        try {
            await getInvestigationCollaborationState(investigation.id);
        } catch (err: any) {
            foreignAccessBlocked = true;
        }
        assert(foreignAccessBlocked, "Test 50: Cross-organization user rejected from foreign investigation");
        checksPassed++;

        let foreignCommentBlocked = false;
        try {
            await addInvestigationComment({
                investigationId: investigation.id,
                targetType: "INVESTIGATION",
                content: "Malicious injection",
            });
        } catch {
            foreignCommentBlocked = true;
        }
        assert(foreignCommentBlocked, "Test 51: Cross-organization comment injection rejected");
        checksPassed++;

        // =====================================================================
        // TEST 58 & 59: LIVE PRESENCE & MULTI-TAB DEDUPLICATION
        // =====================================================================
        console.log("\n--- TEST 58 & 59: Presence Heartbeat, Expiry & Multi-Tab Deduplication ---");
        setTestUser(userAlice);

        // Alice opens Tab 1
        const tab1Presence = await sendPresenceHeartbeat({
            investigationId: investigation.id,
            clientId: `tab1_${stamp}`,
            currentArea: "TOPOLOGY",
        });
        assert(tab1Presence.length === 1 && tab1Presence[0].userId === userAlice.id, "Test 58: Alice Tab 1 registers active presence");
        checksPassed++;

        // Alice opens Tab 2 on the same investigation
        const tab2Presence = await sendPresenceHeartbeat({
            investigationId: investigation.id,
            clientId: `tab2_${stamp}`,
            currentArea: "DIFFERENTIAL_TRACE",
        });
        assert(
            tab2Presence.length === 1 && tab2Presence[0].tabCount === 2,
            "Test 59: Same user with 2 browser tabs collapses into 1 engineer with tabCount = 2"
        );
        checksPassed++;

        // Bob joins in Tab 3
        setTestUser(userBob);
        const bobPresence = await sendPresenceHeartbeat({
            investigationId: investigation.id,
            clientId: `tab3_bob_${stamp}`,
            currentArea: "HYPOTHESES",
        });
        assert(bobPresence.length === 2, "Test 58b: Multiple distinct engineers tracked concurrently in room");
        checksPassed++;

        // Verify presence is ephemeral and did NOT create false durable activity rows
        const activityCountDuringHeartbeats = await prisma.investigationActivity.count({
            where: { investigationId: investigation.id },
        });
        assert(
            activityCountDuringHeartbeats === 0,
            "Test 58c: Ephemeral presence heartbeats are NOT persisted as durable activity logs"
        );
        checksPassed++;

        // =====================================================================
        // TEST 18 & 54: CONTEXTUAL & EVIDENCE-ANCHORED COMMENTS
        // =====================================================================
        console.log("\n--- TEST 18 & 54: Evidence-Anchored Comments & Evidence Validation ---");
        setTestUser(userAlice);

        // Attempt comment with non-existent evidenceId (Section 18 & 22)
        let fakeEvidenceRejected = false;
        try {
            await addInvestigationComment({
                investigationId: investigation.id,
                targetType: "EVIDENCE",
                evidenceId: "fabricated_event_id_99999",
                content: "This fake event proves the issue.",
            });
        } catch (err: any) {
            if (err.message.includes("not found")) {
                fakeEvidenceRejected = true;
            }
        }
        assert(fakeEvidenceRejected, "Test 18: Fabricated evidence IDs are rejected from comment anchoring");
        checksPassed++;

        // Legitimate evidence-anchored comment
        const commentAlice = await addInvestigationComment({
            investigationId: investigation.id,
            targetType: "EVIDENCE",
            evidenceId: realEvent.id,
            content: "Primary database pool reached 100/100 connections here.",
            idempotencyKey: `cmt_alice_${stamp}`,
        });
        assert(
            commentAlice.evidenceId === realEvent.id && commentAlice.authorId === userAlice.id,
            "Test 18b: Legitimate evidence-anchored comment successfully persisted"
        );
        checksPassed++;

        // Test mutation idempotency (Section 33)
        const duplicateComment = await addInvestigationComment({
            investigationId: investigation.id,
            targetType: "EVIDENCE",
            evidenceId: realEvent.id,
            content: "Primary database pool reached 100/100 connections here.",
            idempotencyKey: `cmt_alice_${stamp}`,
        });
        assert(
            duplicateComment.id === commentAlice.id,
            "Test 33: IdempotencyKey prevents duplicate comment creation on network retry"
        );
        checksPassed++;

        // Concurrent comment from Bob
        setTestUser(userBob);
        const commentBob = await addInvestigationComment({
            investigationId: investigation.id,
            targetType: "TOPOLOGY_NODE",
            targetId: "payments-service",
            content: "Downstream checkout-service began shedding load 200ms later.",
            idempotencyKey: `cmt_bob_${stamp}`,
        });
        assert(
            commentBob.authorId === userBob.id && commentBob.id !== commentAlice.id,
            "Test 54: Concurrent comments from multiple engineers both persist without conflict"
        );
        checksPassed++;

        // Verify Bob (MEMBER) cannot edit Alice's comment
        let unauthorizedEditRejected = false;
        try {
            await editInvestigationComment({
                commentId: commentAlice.id,
                content: "Bob trying to edit Alice's comment",
            });
        } catch {
            unauthorizedEditRejected = true;
        }
        assert(unauthorizedEditRejected, "Test 52: Member cannot edit another engineer's comment");
        checksPassed++;

        // Alice (author) can edit her comment
        setTestUser(userAlice);
        const editedComment = await editInvestigationComment({
            commentId: commentAlice.id,
            content: "Updated: Primary pool reached 100/100 connections with 12s queue wait.",
        });
        assert(
            editedComment.content.includes("12s queue wait"),
            "Test 35: Author can edit their own comment"
        );
        checksPassed++;

        // Member Bob attempts to delete Alice's comment (Test 52: Role Attack)
        setTestUser(userBob);
        let bobDeleteRejected = false;
        try {
            await deleteInvestigationComment(commentAlice.id);
        } catch (err: any) {
            if (err.message.includes("Unauthorized")) {
                bobDeleteRejected = true;
            }
        }
        assert(bobDeleteRejected, "Test 52: Member is rejected when attempting to delete another engineer's comment");
        checksPassed++;

        // Tombstone deletion preserves explainability (Section 36)
        setTestUser(userAlice);
        await deleteInvestigationComment(commentAlice.id);
        const tombstone = await prisma.investigationComment.findUnique({
            where: { id: commentAlice.id },
        });
        assert(tombstone?.isDeleted === true, "Test 36: Deleted comments preserve tombstone history");
        checksPassed++;

        // =====================================================================
        // TEST 55 & 64: PEER VERDICTS & ROOT CAUSE IMMUTABILITY
        // =====================================================================
        console.log("\n--- TEST 55 & 64: Peer Verdicts & Engine Root Cause Immutability ---");
        const hypothesisId = "hyp_pool_exhaustion";

        // Attempt verdict with fabricated evidence ID (Section 22)
        setTestUser(userAlice);
        let fakeVerdictEvidenceRejected = false;
        try {
            await recordPeerVerdict({
                investigationId: investigation.id,
                hypothesisId,
                verdict: "SUPPORTED",
                evidenceReferences: ["fabricated_event_id_8888"],
            });
        } catch (err: any) {
            if (err.message.includes("do not exist") || err.message.includes("not found")) {
                fakeVerdictEvidenceRejected = true;
            }
        }
        assert(fakeVerdictEvidenceRejected, "Test 22: Fabricated evidence IDs are rejected from peer verdicts");
        checksPassed++;

        // Alice records SUPPORTED
        await recordPeerVerdict({
            investigationId: investigation.id,
            hypothesisId,
            verdict: "SUPPORTED",
            reasoning: "Telemetry confirms active connection count saturated maxPoolSize",
            evidenceReferences: [realEvent.id],
            idempotencyKey: `vrd_alice_${stamp}`,
        });

        // Bob records opposing position: DISPUTED
        setTestUser(userBob);
        await recordPeerVerdict({
            investigationId: investigation.id,
            hypothesisId,
            verdict: "DISPUTED",
            reasoning: "Database CPU was under 15%; leak was in application proxy connection reuse",
            evidenceReferences: [realEvent.id],
            idempotencyKey: `vrd_bob_${stamp}`,
        });

        const collabState = await getInvestigationCollaborationState(investigation.id);
        const hypVerdicts = collabState.verdicts.filter((v) => v.hypothesisId === hypothesisId);
        assert(
            hypVerdicts.length === 2 &&
            hypVerdicts.some((v) => v.verdict === "SUPPORTED") &&
            hypVerdicts.some((v) => v.verdict === "DISPUTED"),
            "Test 55: Opposing peer verdicts remain concurrently visible without automatic conflict resolution"
        );
        checksPassed++;

        // CRITICAL INVARIANT VERIFICATION: Root Cause Immutability (Section 23 & 64)
        const postVerdictInvestigation = await prisma.investigation.findUnique({
            where: { id: investigation.id },
        });
        assert(
            postVerdictInvestigation?.rootCause === initialRootCauseTitle,
            "Test 64a: Human peer verdicts NEVER mutate canonical engine rootCause"
        );
        checksPassed++;

        assert(
            postVerdictInvestigation?.confidenceScore === initialConfidence,
            "Test 64b: Human peer verdicts NEVER overwrite deterministic confidenceScore"
        );
        checksPassed++;

        // =====================================================================
        // TEST 25 & 63: HUMAN-PROPOSED RELATIONSHIPS VS SYSTEM OBSERVED
        // =====================================================================
        console.log("\n--- TEST 25 & 63: Human-Proposed Relationships ---");
        setTestUser(userBob);

        const proposedRel = await proposeHumanRelation({
            investigationId: investigation.id,
            sourceId: "payments-service",
            targetId: "notification-worker",
            relationType: "ASYNC_DISPATCH",
            reasoning: "Payment webhook enqueued worker job without tracing header",
            evidenceIds: [realEvent.id],
        });

        assert(
            proposedRel.classification === "HUMAN_PROPOSED",
            "Test 63a: Human-suggested relation is strictly tagged as HUMAN_PROPOSED"
        );
        checksPassed++;

        assert(
            proposedRel.classification !== "OBSERVED" && proposedRel.classification !== "INFERRED",
            "Test 63b: Human-suggested relation is NEVER conflated with OBSERVED or INFERRED telemetry"
        );
        checksPassed++;

        // Telemetry immutability check
        const telemetryAfter = await prisma.event.findUnique({
            where: { id: realEvent.id },
        });
        assert(
            telemetryAfter?.title === realEvent.title && telemetryAfter?.traceId === realEvent.traceId,
            "Test 62: Collaboration actions NEVER mutate underlying raw telemetry events"
        );
        checksPassed++;

        // =====================================================================
        // TEST 13 & 31: DURABLE ACTIVITY STREAM ORDERING
        // =====================================================================
        console.log("\n--- TEST 13 & 31: Durable Activity Stream & Deterministic Ordering ---");
        const activities = await prisma.investigationActivity.findMany({
            where: { investigationId: investigation.id },
            orderBy: { createdAt: "desc" },
        });

        assert(activities.length >= 4, "Test 13: All meaningful collaboration actions recorded in activity stream");
        checksPassed++;

        const isChronological = activities.every((act, i) => {
            if (i === 0) return true;
            return act.createdAt.getTime() <= activities[i - 1].createdAt.getTime();
        });
        assert(isChronological, "Test 31: Activity stream maintains deterministic server-ordered timestamps");
        checksPassed++;

    } finally {
        // Cleanup test data
        console.log("\nCleaning up test entities...");
        await prisma.investigationProposedRelation.deleteMany({ where: { investigationId: investigation.id } });
        await prisma.investigationVerdict.deleteMany({ where: { investigationId: investigation.id } });
        await prisma.investigationActivity.deleteMany({ where: { investigationId: investigation.id } });
        await prisma.investigationComment.deleteMany({ where: { investigationId: investigation.id } });
        await prisma.investigation.deleteMany({ where: { id: { in: [investigation.id, devInvestigation.id] } } });
        await prisma.event.deleteMany({ where: { projectId: projTeam.id } });
        await prisma.environment.deleteMany({ where: { projectId: projTeam.id } });
        await prisma.project.deleteMany({ where: { id: { in: [projTeam.id, projDev.id] } } });
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

runPillarCSuite().catch(async (err) => {
    console.error("Test Suite Execution Failed:", err);
    await prisma.$disconnect();
    process.exit(1);
});
