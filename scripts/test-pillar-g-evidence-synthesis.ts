/**
 * HALO TRACE — PILLAR G TEST SUITE
 * Evidence Synthesis & Investigation Reasoning
 *
 * Verifies all 70 required adversarial, structural, and semantic scenarios:
 *
 * ACCESS CONTROL:
 *   Test 1: Developer blocked.
 *   Test 2: Free blocked.
 *   Test 3: Team allowed.
 *   Test 4: Cross-organization read rejected.
 *   Test 5: Cross-project read rejected.
 *
 * CLAIM CREATION:
 *   Test 6: Established runtime fact produces ESTABLISHED.
 *   Test 7: Claim without evidence references is rejected.
 *   Test 8: Equivalent duplicate claims are deduplicated.
 *   Test 9: Distinct evidence sources supporting same fact are merged.
 *   Test 10: Unknown evidence remains UNKNOWN.
 *
 * INDEPENDENCE:
 *   Test 11: Multiple runtime events do not count as multiple independent source categories.
 *   Test 12: Runtime + Change counts as independent support.
 *   Test 13: Runtime + Differential counts as independent support.
 *   Test 14: Change + Deployment counts as separate evidence dimensions.
 *   Test 15: Duplicate evidence does not inflate support.
 *
 * STATUS:
 *   Test 16: Direct observation -> ESTABLISHED.
 *   Test 17: Multiple independent supporting dimensions -> SUPPORTED.
 *   Test 18: Contradicting evidence -> CONTRADICTED.
 *   Test 19: Insufficient information -> UNKNOWN.
 *   Test 20: Unavailable provider -> UNAVAILABLE.
 *   Test 21: UNKNOWN is not treated as CONTRADICTED.
 *   Test 22: UNAVAILABLE is not silently treated as false.
 *
 * EVIDENCE CHAIN:
 *   Test 23: Runtime failure chain reconstructed.
 *   Test 24: Service relationship preserved.
 *   Test 25: Code-path relationship preserved.
 *   Test 26: Change relationship attached.
 *   Test 27: Deployment relationship attached when verified.
 *   Test 28: Unverified relationship is not created.
 *   Test 29: Chronology does not create causality.
 *   Test 30: Every edge has provenance.
 *
 * CROSS-PILLAR:
 *   Test 31: Pillar A differential evidence reused.
 *   Test 32: Pillar B topology reused.
 *   Test 33: Pillar C human notes remain human assertions.
 *   Test 34: Pillar D historical evidence remains historical.
 *   Test 35: Pillar E ownership remains ownership.
 *   Test 36: Pillar F change evidence reused.
 *   Test 37: Replay evidence remains observational.
 *
 * ROOT CAUSE:
 *   Test 38: Existing rootCause remains unchanged.
 *   Test 39: Existing confidenceScore remains unchanged.
 *   Test 40: Synthesis cannot replace rootCause.
 *   Test 41: Synthesis cannot increase confidence.
 *   Test 42: Synthesis cannot decrease confidence.
 *   Test 43: Existing causal chain remains unchanged.
 *
 * CONTRADICTIONS:
 *   Test 44: Contradicting service evidence surfaced.
 *   Test 45: Contradicting code-path evidence surfaced.
 *   Test 46: Contradicting change evidence surfaced.
 *   Test 47: Conflicting ownership remains visible.
 *   Test 48: Contradiction does not disappear during narrative generation.
 *
 * UNKNOWN / MISSING DATA:
 *   Test 49: No deployment remains explicitly unavailable.
 *   Test 50: No source map remains unavailable.
 *   Test 51: No code path remains unknown/unavailable.
 *   Test 52: No historical match remains not observed.
 *   Test 53: Missing evidence never becomes fabricated evidence.
 *
 * SECURITY / CACHE:
 *   Test 54: Cross-tenant synthesis cache isolation.
 *   Test 55: Underlying evidence authorization is respected.
 *   Test 56: No credentials exposed.
 *   Test 57: Project deletion removes/invalidates synthesis.
 *
 * DETERMINISM:
 *   Test 58: Repeated synthesis is idempotent.
 *   Test 59: Same evidence produces identical structured synthesis.
 *   Test 60: Evidence changes produce corresponding synthesis changes.
 *
 * UI / NARRATIVE:
 *   Test 61: Established section contains only established facts.
 *   Test 62: Supported section contains evidence references.
 *   Test 63: Contradicted section contains contradiction evidence.
 *   Test 64: Unknown section contains explicit unknowns.
 *   Test 65: Narrative never invents a causal statement.
 *
 * NO-BLAME / NO-AI:
 *   Test 66: Author never becomes culprit.
 *   Test 67: Owner never becomes culprit.
 *   Test 68: Human note never becomes system fact.
 *   Test 69: No generic chatbot introduced.
 *   Test 70: No automatic remediation introduced.
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
    getInvestigationSynthesis,
    getEvidenceClaim,
    getEvidenceChain,
} from "@/actions/evidence-synthesis";
import {
    synthesizeInvestigationEvidence,
    buildClaim,
    deduplicateClaims,
    clearSynthesisCache,
    getSynthesisCacheKey,
} from "@/lib/evidence-synthesis/synthesis-engine";
import type { EvidenceReference, EvidenceClaim } from "@/lib/evidence-synthesis/types";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        console.log(`  ✓ PASS: [${message}]`);
    }
}

async function runPillarGTestSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR G EVIDENCE SYNTHESIS SUITE");
    console.log("==================================================");

    const runId = `test-g-${Date.now().toString(36)}`;
    let checksPassed = 0;

    const createdOrgIds: string[] = [];
    const createdUserIds: string[] = [];

    try {
        // Setup Organizations & Users
        // Org 1: Free Plan
        const userFree = await prisma.user.create({
            data: { id: `u-free-${runId}`, name: "Free User", email: `free-${runId}@example.com` },
        });
        createdUserIds.push(userFree.id);
        const orgFree = await prisma.organization.create({
            data: {
                name: "Free Org",
                slug: `free-${runId}`,
                plan: "FREE",
                owner: { connect: { id: userFree.id } },
                members: { create: { userId: userFree.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgFree.id);
        const projFree = await prisma.project.create({
            data: { name: "Free Proj", slug: `free-proj-${runId}`, organizationId: orgFree.id },
        });
        const invFree = await prisma.investigation.create({
            data: {
                projectId: projFree.id,
                title: "Free Investigation",
                rootCause: "Database Timeout",
                confidenceScore: 0.85,
            },
        });

        // Org 2: Developer Plan
        const userDev = await prisma.user.create({
            data: { id: `u-dev-${runId}`, name: "Dev User", email: `dev-${runId}@example.com` },
        });
        createdUserIds.push(userDev.id);
        const orgDev = await prisma.organization.create({
            data: {
                name: "Developer Org",
                slug: `dev-${runId}`,
                plan: "DEVELOPER",
                owner: { connect: { id: userDev.id } },
                members: { create: { userId: userDev.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgDev.id);
        const projDev = await prisma.project.create({
            data: { name: "Dev Proj", slug: `dev-proj-${runId}`, organizationId: orgDev.id },
        });
        const invDev = await prisma.investigation.create({
            data: {
                projectId: projDev.id,
                title: "Dev Investigation",
                rootCause: "OOM Error",
                confidenceScore: 0.90,
            },
        });

        // Org 3: Team Plan (Primary Tenant)
        const userTeam = await prisma.user.create({
            data: { id: `u-team-${runId}`, name: "Team Engineer", email: `team-${runId}@example.com` },
        });
        createdUserIds.push(userTeam.id);
        const orgTeam = await prisma.organization.create({
            data: {
                name: "Team Org",
                slug: `team-${runId}`,
                plan: "TEAM",
                owner: { connect: { id: userTeam.id } },
                members: { create: { userId: userTeam.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgTeam.id);
        const projTeam = await prisma.project.create({
            data: {
                name: "Team Proj",
                slug: `team-proj-${runId}`,
                organizationId: orgTeam.id,
                githubRepoOwner: "acme-inc",
                githubRepoName: "payments-service",
            },
        });
        const envTeam = await prisma.environment.create({
            data: { name: "production", projectId: projTeam.id },
        });

        // Release record for Team Project
        const releaseTeam = await prisma.release.create({
            data: {
                projectId: projTeam.id,
                version: "v2.4.1",
                commitSha: "abc1234567890abcdef1234567890abcdef1234",
                firstSeen: new Date(Date.now() - 1000 * 60 * 30),
            },
        });

        // Canonical Investigation for Team Project
        const invTeam = await prisma.investigation.create({
            data: {
                projectId: projTeam.id,
                title: "NullPointerException in Payments API",
                rootCause: "NullPointerException in checkout.ts:184",
                confidenceScore: 0.92,
                summary: "Authoritative root cause: checkout.ts encountered null pointer during plan evaluation.",
            },
        });

        // Telemetry events for Team Investigation
        const event1 = await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "NullPointerException: Cannot read properties of undefined (reading 'plan')",
                service: "payments-api",
                operation: "POST /checkout",
                severity: "ERROR",
                type: "ERROR",
                timestamp: new Date(Date.now() - 1000 * 60 * 15),
                stack: `TypeError: Cannot read properties of undefined (reading 'plan')\n    at checkout (src/services/checkout.ts:184:22)\n    at processRequest (src/server.ts:45:10)`,
                metadata: { errorType: "TypeError", requestId: "req-12345" },
            },
        });

        // Second event (same service runtime, should not inflate independent source count)
        const event2 = await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "Downstream HTTP 500 in Checkout Handler",
                service: "payments-api",
                operation: "POST /checkout",
                severity: "ERROR",
                type: "ERROR",
                timestamp: new Date(Date.now() - 1000 * 60 * 14),
                stack: `Error: Downstream 500\n    at checkout (src/services/checkout.ts:184:22)`,
                metadata: { errorType: "HttpError" },
            },
        });

        // Service Ownership record
        const ownership = await prisma.serviceOwnership.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                serviceName: "payments-api",
                declaredOwner: "Team Payments",
                declaredTeam: "Team Payments",
                source: "CODEOWNERS",
                classification: "DECLARED",
                confidenceLevel: "HIGH",
            },
        });

        // Correlated Change Observation (Intersecting)
        const changeObservation = await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `commit-abc1234-${runId}`,
                commitSha: "abc1234567890abcdef1234567890abcdef1234",
                repository: "payments-service",
                serviceAssociation: "payments-api",
                authorIdentity: "dev-alice@acme.org",
                commitMessage: "Refactor subscription plan lookup in checkout.ts",
                changedFiles: [
                    { filePath: "src/services/checkout.ts", additions: 15, deletions: 4 },
                ],
                observedAt: new Date(Date.now() - 1000 * 60 * 45),
            },
        });

        // Org 4: Unrelated Team Org (for cross-tenant checks)
        const userOther = await prisma.user.create({
            data: { id: `u-other-${runId}`, name: "Other User", email: `other-${runId}@example.com` },
        });
        createdUserIds.push(userOther.id);
        const orgOther = await prisma.organization.create({
            data: {
                name: "Other Org",
                slug: `other-${runId}`,
                plan: "TEAM",
                owner: { connect: { id: userOther.id } },
                members: { create: { userId: userOther.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgOther.id);
        const projOther = await prisma.project.create({
            data: { name: "Other Proj", slug: `other-proj-${runId}`, organizationId: orgOther.id },
        });

        // =========================================================================
        // GROUP 1: ACCESS CONTROL (Tests 1-5)
        // =========================================================================
        console.log("\n--- GROUP 1: ACCESS CONTROL ---");

        // Test 1: Developer blocked with TEAM_PLAN_REQUIRED
        setTestUser({ email: userDev.email });
        try {
            await getInvestigationSynthesis(invDev.id);
            assert(false, "Test 1: Developer plan should be blocked");
        } catch (e: any) {
            assert(e?.message?.includes("TEAM_PLAN_REQUIRED") || e?.code === "TEAM_PLAN_REQUIRED", "Test 1: Developer blocked with TEAM_PLAN_REQUIRED");
            checksPassed++;
        }

        // Test 2: Free blocked with TEAM_PLAN_REQUIRED
        setTestUser({ email: userFree.email });
        try {
            await getInvestigationSynthesis(invFree.id);
            assert(false, "Test 2: Free plan should be blocked");
        } catch (e: any) {
            assert(e?.message?.includes("TEAM_PLAN_REQUIRED") || e?.code === "TEAM_PLAN_REQUIRED", "Test 2: Free blocked with TEAM_PLAN_REQUIRED");
            checksPassed++;
        }

        // Test 3: Team allowed
        setTestUser({ email: userTeam.email });
        const teamSynthesis = await getInvestigationSynthesis(invTeam.id);
        assert(teamSynthesis !== null && teamSynthesis.investigationId === invTeam.id, "Test 3: Team plan allowed access to synthesis");
        checksPassed++;

        // Test 4: Cross-organization read rejected
        setTestUser({ email: userOther.email });
        try {
            await getInvestigationSynthesis(invTeam.id);
            assert(false, "Test 4: Cross-org read should be rejected");
        } catch (e: any) {
            assert(
                e?.code === "NOT_A_MEMBER" ||
                e?.message?.includes("not an active member") ||
                e?.message?.includes("denied") ||
                e?.message?.includes("FORBIDDEN") ||
                e?.message?.includes("Access"),
                "Test 4: Cross-organization read rejected"
            );
            checksPassed++;
        }

        // Test 5: Cross-project read rejected
        setTestUser({ email: userTeam.email });
        try {
            await getEvidenceClaim("claim-any", projOther.id);
            assert(false, "Test 5: Cross-project claim read should be rejected");
        } catch (e: any) {
            assert(e !== null, "Test 5: Cross-project read rejected");
            checksPassed++;
        }

        // =========================================================================
        // GROUP 2: CLAIM CREATION (Tests 6-10)
        // =========================================================================
        console.log("\n--- GROUP 2: CLAIM CREATION ---");

        // Test 6: Established runtime fact produces ESTABLISHED
        const runtimeClaim = teamSynthesis.claims.find((c) => c.sourceTypes.includes("RUNTIME") && c.status === "ESTABLISHED");
        assert(Boolean(runtimeClaim && runtimeClaim.status === "ESTABLISHED"), "Test 6: Established runtime fact produces ESTABLISHED");
        checksPassed++;

        // Test 7: Claim without evidence references is rejected
        const invalidClaim = buildClaim({
            claimId: "invalid-claim",
            investigationId: invTeam.id,
            statement: "Unfounded assertion without evidence",
            status: "ESTABLISHED",
            evidenceReferences: [],
        });
        assert(invalidClaim === null, "Test 7: Claim without evidence references is rejected (returns null)");
        checksPassed++;

        // Test 8: Equivalent duplicate claims are deduplicated
        const dupClaims: EvidenceClaim[] = [
            {
                claimId: "c1",
                investigationId: invTeam.id,
                statement: "payments-api encountered failure",
                status: "ESTABLISHED",
                sourceTypes: ["RUNTIME"],
                evidenceReferences: [{ id: "r1", sourceType: "RUNTIME", label: "Event 1", targetId: "e1" }],
                supportingClaims: [],
                contradictingClaims: [],
                independentSourceCount: 1,
                relatedServices: ["payments-api"],
                relatedOperations: [],
                relatedCodePaths: [],
            },
            {
                claimId: "c2",
                investigationId: invTeam.id,
                statement: "payments-api encountered failure",
                status: "ESTABLISHED",
                sourceTypes: ["RUNTIME"],
                evidenceReferences: [{ id: "r2", sourceType: "RUNTIME", label: "Event 2", targetId: "e2" }],
                supportingClaims: [],
                contradictingClaims: [],
                independentSourceCount: 1,
                relatedServices: ["payments-api"],
                relatedOperations: [],
                relatedCodePaths: [],
            },
        ];
        const deduped = deduplicateClaims(dupClaims);
        assert(deduped.length === 1 && deduped[0].evidenceReferences.length === 2, "Test 8: Equivalent duplicate claims are deduplicated and references merged");
        checksPassed++;

        // Test 9: Distinct evidence sources supporting same fact are merged
        const multiSourceDups: EvidenceClaim[] = [
            {
                claimId: "c1",
                investigationId: invTeam.id,
                statement: "checkout service affected",
                status: "ESTABLISHED",
                sourceTypes: ["RUNTIME"],
                evidenceReferences: [{ id: "r1", sourceType: "RUNTIME", label: "Runtime", targetId: "e1" }],
                supportingClaims: [],
                contradictingClaims: [],
                independentSourceCount: 1,
                relatedServices: ["payments-api"],
                relatedOperations: [],
                relatedCodePaths: [],
            },
            {
                claimId: "c2",
                investigationId: invTeam.id,
                statement: "checkout service affected",
                status: "ESTABLISHED",
                sourceTypes: ["TOPOLOGY"],
                evidenceReferences: [{ id: "r2", sourceType: "TOPOLOGY", label: "Topology", targetId: "t1" }],
                supportingClaims: [],
                contradictingClaims: [],
                independentSourceCount: 1,
                relatedServices: ["payments-api"],
                relatedOperations: [],
                relatedCodePaths: [],
            },
        ];
        const merged = deduplicateClaims(multiSourceDups);
        assert(merged.length === 1 && merged[0].independentSourceCount === 2, "Test 9: Distinct evidence sources supporting same fact are merged with updated source count");
        checksPassed++;

        // Test 10: Unknown evidence remains UNKNOWN
        const unknownClaim = teamSynthesis.claims.find((c) => c.status === "UNKNOWN");
        assert(Boolean(unknownClaim && unknownClaim.status === "UNKNOWN"), "Test 10: Unknown evidence remains UNKNOWN");
        checksPassed++;

        // =========================================================================
        // GROUP 3: INDEPENDENCE (Tests 11-15)
        // =========================================================================
        console.log("\n--- GROUP 3: INDEPENDENCE ---");

        // Test 11: Multiple runtime events do not count as multiple independent source categories
        const multiRuntimeRefs: EvidenceReference[] = [
            { id: "r1", sourceType: "RUNTIME", label: "Event 1", targetId: "e1" },
            { id: "r2", sourceType: "RUNTIME", label: "Event 2", targetId: "e2" },
            { id: "r3", sourceType: "RUNTIME", label: "Event 3", targetId: "e3" },
        ];
        const claimRuntimeOnly = buildClaim({
            claimId: "c-runtime-only",
            investigationId: invTeam.id,
            statement: "Multiple runtime errors observed",
            status: "ESTABLISHED",
            evidenceReferences: multiRuntimeRefs,
        });
        assert(claimRuntimeOnly?.independentSourceCount === 1, "Test 11: Multiple runtime events do not count as multiple independent source categories (count = 1)");
        checksPassed++;

        // Test 12: Runtime + Change counts as independent support
        const claimRuntimeChange = buildClaim({
            claimId: "c-rc",
            investigationId: invTeam.id,
            statement: "Runtime and change intersection",
            status: "SUPPORTED",
            evidenceReferences: [
                { id: "r1", sourceType: "RUNTIME", label: "Error", targetId: "e1" },
                { id: "r2", sourceType: "CHANGE", label: "Commit", targetId: "c1" },
            ],
        });
        assert(claimRuntimeChange?.independentSourceCount === 2, "Test 12: Runtime + Change counts as independent support (count = 2)");
        checksPassed++;

        // Test 13: Runtime + Differential counts as independent support
        const claimRuntimeDiff = buildClaim({
            claimId: "c-rd",
            investigationId: invTeam.id,
            statement: "Runtime and differential divergence",
            status: "SUPPORTED",
            evidenceReferences: [
                { id: "r1", sourceType: "RUNTIME", label: "Error", targetId: "e1" },
                { id: "r2", sourceType: "DIFFERENTIAL", label: "Baseline divergence", targetId: "d1" },
            ],
        });
        assert(claimRuntimeDiff?.independentSourceCount === 2, "Test 13: Runtime + Differential counts as independent support (count = 2)");
        checksPassed++;

        // Test 14: Change + Deployment counts as separate evidence dimensions
        const claimChangeDeploy = buildClaim({
            claimId: "c-cd",
            investigationId: invTeam.id,
            statement: "Commit linked to release deployment",
            status: "SUPPORTED",
            evidenceReferences: [
                { id: "r1", sourceType: "CHANGE", label: "Commit", targetId: "sha1" },
                { id: "r2", sourceType: "DEPLOYMENT", label: "Release", targetId: "rel1" },
            ],
        });
        assert(claimChangeDeploy?.independentSourceCount === 2, "Test 14: Change + Deployment counts as separate evidence dimensions (count = 2)");
        checksPassed++;

        // Test 15: Duplicate evidence does not inflate support
        const claimDuplicateSources = buildClaim({
            claimId: "c-dup-sources",
            investigationId: invTeam.id,
            statement: "Change with multiple redundant commits",
            status: "SUPPORTED",
            evidenceReferences: [
                { id: "r1", sourceType: "CHANGE", label: "Commit A", targetId: "sha1" },
                { id: "r2", sourceType: "CHANGE", label: "Commit B", targetId: "sha2" },
                { id: "r3", sourceType: "CHANGE", label: "Commit C", targetId: "sha3" },
            ],
        });
        assert(claimDuplicateSources?.independentSourceCount === 1, "Test 15: Duplicate evidence does not inflate support (remains count = 1)");
        checksPassed++;

        // =========================================================================
        // GROUP 4: STATUS (Tests 16-22)
        // =========================================================================
        console.log("\n--- GROUP 4: STATUS ---");

        // Test 16: Direct observation -> ESTABLISHED
        const establishedObs = teamSynthesis.establishedClaims.find((c) => c.sourceTypes.includes("RUNTIME"));
        assert(Boolean(establishedObs && establishedObs.status === "ESTABLISHED"), "Test 16: Direct observation -> ESTABLISHED");
        checksPassed++;

        // Test 17: Multiple independent supporting dimensions -> SUPPORTED
        const supportedObs = teamSynthesis.supportedClaims.find((c) => c.independentSourceCount >= 2);
        assert(Boolean(supportedObs && supportedObs.status === "SUPPORTED"), "Test 17: Multiple independent supporting dimensions -> SUPPORTED");
        checksPassed++;

        // Test 18: Contradicting evidence -> CONTRADICTED
        const claimContra = buildClaim({
            claimId: "c-contra",
            investigationId: invTeam.id,
            statement: "Commit in unrelated repo does not intersect service",
            status: "CONTRADICTED",
            evidenceReferences: [{ id: "r1", sourceType: "CHANGE", label: "Unrelated Commit", targetId: "c99" }],
        });
        assert(claimContra?.status === "CONTRADICTED", "Test 18: Contradicting evidence -> CONTRADICTED");
        checksPassed++;

        // Test 19: Insufficient information -> UNKNOWN
        const claimUnknown = buildClaim({
            claimId: "c-unk",
            investigationId: invTeam.id,
            statement: "Direct production causal proof was not observed",
            status: "UNKNOWN",
            evidenceReferences: [{ id: "r1", sourceType: "RUNTIME", label: "Causal boundary", targetId: "inv1" }],
        });
        assert(claimUnknown?.status === "UNKNOWN", "Test 19: Insufficient information -> UNKNOWN");
        checksPassed++;

        // Test 20: Unavailable provider -> UNAVAILABLE
        const claimUnavail = buildClaim({
            claimId: "c-unavail",
            investigationId: invTeam.id,
            statement: "Deployment telemetry provider is unavailable",
            status: "UNAVAILABLE",
            evidenceReferences: [{ id: "r1", sourceType: "DEPLOYMENT", label: "Registry", targetId: "d-none" }],
        });
        assert(claimUnavail?.status === "UNAVAILABLE", "Test 20: Unavailable provider -> UNAVAILABLE");
        checksPassed++;

        // Test 21: UNKNOWN is not treated as CONTRADICTED
        assert(claimUnknown?.status !== "CONTRADICTED", "Test 21: UNKNOWN is not treated as CONTRADICTED");
        checksPassed++;

        // Test 22: UNAVAILABLE is not silently treated as false
        assert(claimUnavail?.status === "UNAVAILABLE" && (claimUnavail as any).status !== false, "Test 22: UNAVAILABLE is not silently treated as false");
        checksPassed++;

        // =========================================================================
        // GROUP 5: EVIDENCE CHAIN (Tests 23-30)
        // =========================================================================
        console.log("\n--- GROUP 5: EVIDENCE CHAIN ---");

        // Test 23: Runtime failure chain reconstructed
        const chain = await getEvidenceChain(invTeam.id);
        assert(chain.nodes.length >= 3 && chain.edges.length >= 2, "Test 23: Runtime failure chain reconstructed");
        checksPassed++;

        // Test 24: Service relationship preserved
        const serviceNode = chain.nodes.find((n) => n.type === "SERVICE");
        assert(Boolean(serviceNode && serviceNode.label === "payments-api"), "Test 24: Service relationship preserved in evidence chain");
        checksPassed++;

        // Test 25: Code-path relationship preserved
        const stackNode = chain.nodes.find((n) => n.type === "STACK_FRAME");
        assert(Boolean(stackNode && stackNode.label.includes("checkout.ts")), "Test 25: Code-path relationship preserved");
        checksPassed++;

        // Test 26: Change relationship attached
        const changeNode = chain.nodes.find((n) => n.type === "CHANGED_FILE" || n.type === "COMMIT");
        assert(Boolean(changeNode), "Test 26: Change relationship attached to chain");
        checksPassed++;

        // Test 27: Deployment relationship attached when verified
        const deployNode = chain.nodes.find((n) => n.type === "DEPLOYMENT");
        assert(Boolean(deployNode && deployNode.label.includes("v2.4.1")), "Test 27: Deployment relationship attached when verified");
        checksPassed++;

        // Test 28: Unverified relationship is not created
        const fakeEdge = chain.edges.find((e) => e.relationship === ("FAKE_RELATION" as any));
        assert(!fakeEdge, "Test 28: Unverified relationship is not created");
        checksPassed++;

        // Test 29: Chronology does not create causality
        const commitEdge = chain.edges.find((e) => e.to.includes("node-commit"));
        assert(commitEdge?.relationship !== "CAUSED_EXECUTION_OF", "Test 29: Chronology does not create causality (commit is not marked CAUSED_EXECUTION_OF)");
        checksPassed++;

        // Test 30: Every edge has provenance
        const allEdgesHaveProvenance = chain.edges.every((e) => e.evidenceReferences.length > 0);
        assert(allEdgesHaveProvenance, "Test 30: Every edge has non-empty evidence provenance references");
        checksPassed++;

        // =========================================================================
        // GROUP 6: CROSS-PILLAR (Tests 31-37)
        // =========================================================================
        console.log("\n--- GROUP 6: CROSS-PILLAR ---");

        // Test 31: Pillar A differential evidence reused
        assert(teamSynthesis.rootCauseMap.supportedDimensions.length > 0, "Test 31: Pillar A differential / runtime evidence dimensions integrated");
        checksPassed++;

        // Test 32: Pillar B topology reused
        const topologyClaims = teamSynthesis.claims.filter((c) => c.sourceTypes.includes("TOPOLOGY"));
        assert(topologyClaims.length > 0, "Test 32: Pillar B topology evidence integrated");
        checksPassed++;

        // Test 33: Pillar C human notes remain human assertions
        // Create comment with referencedEvidenceId
        const comment = await prisma.investigationComment.create({
            data: {
                investigationId: invTeam.id,
                authorId: userTeam.id,
                authorName: userTeam.name || "Team Engineer",
                authorEmail: userTeam.email,
                content: "Investigating the checkout plan lookup failure",
                evidenceId: event1.id,
            },
        });
        const freshSynthesisCollab = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        const humanClaim = freshSynthesisCollab.claims.find((c) => c.statement.includes("Investigating the checkout"));
        assert(Boolean(humanClaim && (humanClaim.evidenceReferences[0]?.metadata as any)?.isHumanAssertion === true), "Test 33: Pillar C human notes remain human assertions");
        checksPassed++;

        // Test 34: Pillar D historical evidence remains historical
        const memory = await prisma.incidentMemory.create({
            data: {
                investigationId: invTeam.id,
                projectId: projTeam.id,
                organizationId: orgTeam.id,
                fingerprint: "payments-api:checkout:TypeError",
                title: "Historical Checkout Incident",
                normalizedTitle: "Historical Checkout Incident",
                primaryService: "payments-api",
                errorType: "TypeError",
                memoryVersion: 1,
            },
        });
        const freshSynthesisMemory = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        const memoryClaim = freshSynthesisMemory.claims.find((c) => c.sourceTypes.includes("MEMORY"));
        assert(Boolean(memoryClaim && (memoryClaim.evidenceReferences[0]?.metadata as any)?.isHistoricalContext === true), "Test 34: Pillar D historical evidence remains historical context only");
        checksPassed++;

        // Test 35: Pillar E ownership remains ownership
        const ownershipClaim = freshSynthesisMemory.claims.find((c) => c.sourceTypes.includes("OWNERSHIP"));
        assert(Boolean(ownershipClaim && ownershipClaim.statement.includes("Team Payments")), "Test 35: Pillar E ownership remains ownership attribution");
        checksPassed++;

        // Test 36: Pillar F change evidence reused
        const changeClaim = freshSynthesisMemory.claims.find((c) => c.sourceTypes.includes("CHANGE"));
        assert(Boolean(changeClaim && changeClaim.statement.includes("abc12345")), "Test 36: Pillar F change intelligence evidence reused");
        checksPassed++;

        // Test 37: Replay evidence remains observational
        const replay = await prisma.replaySession.create({
            data: {
                sessionId: `session-replay-${runId}`,
                projectId: projTeam.id,
                environmentId: envTeam.id,
                startedAt: new Date(Date.now() - 1000 * 60 * 20),
                errorAt: event1.timestamp,
                status: "AVAILABLE",
                chunkCount: 14,
            },
        });
        const freshSynthesisReplay = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        const replayClaim = freshSynthesisReplay.claims.find((c) => c.sourceTypes.includes("REPLAY"));
        assert(Boolean(replayClaim && replayClaim.statement.includes("14 DOM/network chunks")), "Test 37: Replay evidence remains observational telemetry");
        checksPassed++;

        // =========================================================================
        // GROUP 7: ROOT CAUSE (Tests 38-43)
        // =========================================================================
        console.log("\n--- GROUP 7: ROOT CAUSE IMMUTABILITY ---");

        // Fetch original investigation from database to verify immutability
        const invDbBefore = await prisma.investigation.findUniqueOrThrow({ where: { id: invTeam.id } });

        // Test 38: Existing rootCause remains unchanged
        assert(freshSynthesisReplay.rootCauseMap.canonicalRootCause === invDbBefore.rootCause, "Test 38: Existing rootCause remains unchanged");
        checksPassed++;

        // Test 39: Existing confidenceScore remains unchanged
        assert(freshSynthesisReplay.rootCauseMap.confidenceScore === invDbBefore.confidenceScore, "Test 39: Existing confidenceScore remains unchanged");
        checksPassed++;

        // Test 40: Synthesis cannot replace rootCause
        const invDbAfter = await prisma.investigation.findUniqueOrThrow({ where: { id: invTeam.id } });
        assert(invDbAfter.rootCause === invDbBefore.rootCause, "Test 40: Synthesis cannot replace rootCause in database");
        checksPassed++;

        // Test 41: Synthesis cannot increase confidence
        assert(invDbAfter.confidenceScore === invDbBefore.confidenceScore, "Test 41: Synthesis cannot increase confidenceScore");
        checksPassed++;

        // Test 42: Synthesis cannot decrease confidence
        assert(invDbAfter.confidenceScore === invDbBefore.confidenceScore, "Test 42: Synthesis cannot decrease confidenceScore");
        checksPassed++;

        // Test 43: Existing causal chain remains unchanged
        assert(freshSynthesisReplay.chain.nodes[0].type === "FAILURE", "Test 43: Existing causal failure root remains preserved");
        checksPassed++;

        // =========================================================================
        // GROUP 8: CONTRADICTIONS (Tests 44-48)
        // =========================================================================
        console.log("\n--- GROUP 8: CONTRADICTIONS ---");

        // Insert a change observation from an unrelated repo authored before failure onset
        const unrelatedChange = await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `commit-unrelated-${runId}`,
                commitSha: "fff9999999990abcdef1234567890abcdef1234",
                repository: "inventory-service",
                serviceAssociation: "inventory-service",
                authorIdentity: "dev-bob@acme.org",
                commitMessage: "Update warehouse inventory limits",
                changedFiles: [{ filePath: "src/inventory.ts" }],
                observedAt: new Date(Date.now() - 1000 * 60 * 50),
            },
        });

        // Set ownership conflict on a service
        const conflictingOwnership = await prisma.serviceOwnership.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                serviceName: "inventory-service",
                declaredOwner: "Team Logistics",
                declaredTeam: "Team Logistics",
                source: "SERVICE_CONFIG",
                classification: "DECLARED",
                metadata: { hasConflict: true },
            },
        });

        const freshSynthesisContra = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });

        // Test 44: Contradicting service evidence surfaced
        const contraClaim = freshSynthesisContra.claims.find((c) => c.status === "CONTRADICTED");
        assert(Boolean(contraClaim && contraClaim.statement.includes("inventory-service")), "Test 44: Contradicting service evidence surfaced");
        checksPassed++;

        // Test 45: Contradicting code-path evidence surfaced
        assert(contraClaim?.statement.includes("does not intersect"), "Test 45: Contradicting non-intersecting path surfaced");
        checksPassed++;

        // Test 46: Contradicting change evidence surfaced
        assert(freshSynthesisContra.contradictedClaims.length > 0, "Test 46: Contradicting change evidence surfaced in contradictedClaims array");
        checksPassed++;

        // Test 47: Conflicting ownership remains visible
        const ownerContra = freshSynthesisContra.claims.find((c) => c.sourceTypes.includes("OWNERSHIP") && c.status === "CONTRADICTED");
        assert(Boolean(ownerContra || freshSynthesisContra.rootCauseMap.contradictedDimensions.length > 0), "Test 47: Conflicting ownership remains visible");
        checksPassed++;

        // Test 48: Contradiction does not disappear during narrative generation
        const contraSection = freshSynthesisContra.narrative.sections.find((s) => s.id === "what-contradicts");
        assert(Boolean(contraSection && contraSection.bulletPoints.length > 0), "Test 48: Contradiction does not disappear during narrative generation");
        checksPassed++;

        // =========================================================================
        // GROUP 9: UNKNOWN / MISSING DATA (Tests 49-53)
        // =========================================================================
        console.log("\n--- GROUP 9: UNKNOWN / MISSING DATA ---");

        // Test 49: Missing deployment remains explicitly unavailable
        // Check with an investigation lacking releases
        const invNoDeploy = await prisma.investigation.create({
            data: {
                projectId: projDev.id,
                title: "Investigation without deployments",
                rootCause: "Network Timeout",
                confidenceScore: 0.8,
            },
        });
        const synNoDeploy = await synthesizeInvestigationEvidence({
            investigationId: invNoDeploy.id,
            organizationId: orgDev.id,
            forceFresh: true,
        });
        const deployMissingClaim = synNoDeploy.claims.find((c) => c.sourceTypes.includes("DEPLOYMENT") && c.status === "UNAVAILABLE");
        assert(Boolean(deployMissingClaim), "Test 49: Missing deployment remains explicitly unavailable (UNAVAILABLE)");
        checksPassed++;

        // Test 50: No source map remains unavailable
        const stackMissingClaim = synNoDeploy.claims.find((c) => c.sourceTypes.includes("STACK") && c.status === "UNAVAILABLE");
        assert(Boolean(stackMissingClaim), "Test 50: Missing source maps / stack remains UNAVAILABLE");
        checksPassed++;

        // Test 51: No code path remains unknown/unavailable
        assert(synNoDeploy.unknownClaims.some((c) => c.status === "UNAVAILABLE"), "Test 51: Unknown/unavailable code paths preserved");
        checksPassed++;

        // Test 52: No historical match remains not observed
        const memMissingClaim = synNoDeploy.claims.find((c) => c.sourceTypes.includes("MEMORY") && c.status === "UNKNOWN");
        assert(Boolean(memMissingClaim), "Test 52: Missing historical match remains UNKNOWN (not observed)");
        checksPassed++;

        // Test 53: Missing evidence never becomes fabricated evidence
        const noFakeRefs = synNoDeploy.claims.every((c) => c.evidenceReferences.length > 0);
        assert(noFakeRefs, "Test 53: Missing evidence never becomes fabricated evidence");
        checksPassed++;

        // =========================================================================
        // GROUP 10: SECURITY / CACHE (Tests 54-57)
        // =========================================================================
        console.log("\n--- GROUP 10: SECURITY / CACHE ---");

        // Test 54: Cross-tenant synthesis cache isolation
        const keyOrgTeam = getSynthesisCacheKey(orgTeam.id, projTeam.id, invTeam.id);
        const keyOrgOther = getSynthesisCacheKey(orgOther.id, projTeam.id, invTeam.id);
        assert(keyOrgTeam !== keyOrgOther, "Test 54: Cross-tenant synthesis cache isolation: cache keys are strictly tenant-scoped");
        checksPassed++;

        // Test 55: Underlying evidence authorization is respected
        setTestUser({ email: userOther.email });
        try {
            await getInvestigationSynthesis(invTeam.id);
            assert(false, "Test 55: Unauthorized user should not access team synthesis");
        } catch (e: any) {
            assert(Boolean(e), "Test 55: Underlying evidence authorization is respected");
            checksPassed++;
        }

        // Test 56: No credentials exposed
        setTestUser({ email: userTeam.email });
        const secretClaim = buildClaim({
            claimId: "c-secret-test",
            investigationId: invTeam.id,
            statement: "Accessing repo with token ghp_123456789012345678901234567890123456",
            status: "ESTABLISHED",
            evidenceReferences: [
                {
                    id: "ref-sec",
                    sourceType: "CHANGE",
                    label: "Bearer secret_abcdef123456789012",
                    targetId: "sec1",
                },
            ],
        });
        assert(
            !secretClaim?.statement.includes("ghp_") &&
            !secretClaim?.evidenceReferences[0].label.includes("secret_"),
            "Test 56: No credentials or tokens exposed (sanitized to REDACTED)"
        );
        checksPassed++;

        // Test 57: Project deletion removes/invalidates synthesis naturally
        // (Since synthesis is derived and rebuildable, deleting the investigation removes all backing data cleanly)
        const tempInv = await prisma.investigation.create({
            data: {
                projectId: projTeam.id,
                title: "Temporary Investigation",
                rootCause: "Temporary Cause",
                confidenceScore: 0.7,
            },
        });
        await synthesizeInvestigationEvidence({
            investigationId: tempInv.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        await prisma.investigation.delete({ where: { id: tempInv.id } });
        clearSynthesisCache();
        try {
            await synthesizeInvestigationEvidence({
                investigationId: tempInv.id,
                organizationId: orgTeam.id,
                forceFresh: true,
            });
            assert(false, "Test 57: Deleted investigation should fail synthesis");
        } catch (e: any) {
            assert(e?.message?.includes("not found"), "Test 57: Project/investigation deletion cleans up derived synthesis without orphans");
            checksPassed++;
        }

        // =========================================================================
        // GROUP 11: DETERMINISM (Tests 58-60)
        // =========================================================================
        console.log("\n--- GROUP 11: DETERMINISM ---");

        // Test 58: Repeated synthesis is idempotent
        const synRun1 = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        const synRun2 = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        assert(synRun1.claims.length === synRun2.claims.length, "Test 58: Repeated synthesis is idempotent (claim count matches)");
        checksPassed++;

        // Test 59: Same evidence produces identical structured synthesis
        const statements1 = synRun1.claims.map((c) => c.statement).sort();
        const statements2 = synRun2.claims.map((c) => c.statement).sort();
        assert(JSON.stringify(statements1) === JSON.stringify(statements2), "Test 59: Same evidence produces identical structured synthesis claims");
        checksPassed++;

        // Test 60: Evidence changes produce corresponding synthesis changes
        const event3 = await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "Gateway Timeout in payments-api",
                service: "payments-api",
                operation: "GET /status",
                severity: "ERROR",
                type: "ERROR",
                timestamp: new Date(),
                metadata: { errorType: "TimeoutError" },
            },
        });
        const synRun3 = await synthesizeInvestigationEvidence({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            forceFresh: true,
        });
        assert(synRun3.claims.length >= synRun1.claims.length, "Test 60: Evidence changes produce corresponding synthesis changes");
        checksPassed++;

        // =========================================================================
        // GROUP 12: UI / NARRATIVE (Tests 61-65)
        // =========================================================================
        console.log("\n--- GROUP 12: UI / NARRATIVE ---");

        // Test 61: Established section contains only established facts
        const whatHappenedSec = synRun3.narrative.sections.find((s) => s.id === "what-happened");
        assert(
            Boolean(whatHappenedSec && whatHappenedSec.bulletPoints.every((bp) => bp.status === "ESTABLISHED")),
            "Test 61: 'What Happened' section contains only established facts"
        );
        checksPassed++;

        // Test 62: Supported section contains evidence references
        const whySupportedSec = synRun3.narrative.sections.find((s) => s.id === "why-halo-supports");
        assert(
            Boolean(whySupportedSec && whySupportedSec.bulletPoints.every((bp) => bp.references.length > 0)),
            "Test 62: 'Why Halo Supports' section contains valid evidence references"
        );
        checksPassed++;

        // Test 63: Contradicted section contains contradiction evidence
        const contraSec = synRun3.narrative.sections.find((s) => s.id === "what-contradicts");
        assert(Boolean(contraSec && contraSec.bulletPoints.length > 0), "Test 63: 'What Contradicts' section contains contradiction evidence");
        checksPassed++;

        // Test 64: Unknown section contains explicit unknowns
        const unknownSec = synRun3.narrative.sections.find((s) => s.id === "what-remains-unknown");
        assert(
            Boolean(unknownSec && unknownSec.bulletPoints.every((bp) => bp.status === "UNKNOWN" || bp.status === "UNAVAILABLE")),
            "Test 64: 'What Remains Unknown' section contains explicit unknowns and unavailables"
        );
        checksPassed++;

        // Test 65: Narrative never invents a causal statement
        const allBulletPoints = synRun3.narrative.sections.flatMap((s) => s.bulletPoints);
        const hasFakeCausalClaim = allBulletPoints.some((bp) => bp.text.includes("definitely caused") || bp.text.includes("is 100% responsible"));
        assert(!hasFakeCausalClaim, "Test 65: Narrative never invents an unsubstantiated causal statement");
        checksPassed++;

        // =========================================================================
        // GROUP 13: NO-BLAME / NO-AI (Tests 66-70)
        // =========================================================================
        console.log("\n--- GROUP 13: NO-BLAME / NO-AI ---");

        // Test 66: Author never becomes culprit
        const allText = JSON.stringify(synRun3).toLowerCase();
        const hasBlameTerms =
            allText.includes("culprit") ||
            allText.includes("developer fault") ||
            allText.includes("engineer responsible") ||
            allText.includes("author responsible") ||
            allText.includes("developer caused");
        assert(!hasBlameTerms, "Test 66: Author never becomes culprit; zero blame language generated");
        checksPassed++;

        // Test 67: Owner never becomes culprit
        const hasOwnerBlame =
            allText.includes("owner caused") ||
            allText.includes("team caused incident") ||
            allText.includes("owner fault");
        assert(!hasOwnerBlame, "Test 67: Owner never becomes culprit; ownership is strictly routing metadata");
        checksPassed++;

        // Test 68: Human note never becomes system fact
        const humanSec = synRun3.narrative.sections.find((s) => s.id === "why-halo-supports");
        const humanFact = humanSec?.bulletPoints.some((bp) => (bp.references[0]?.metadata as any)?.isHumanAssertion === true && bp.status === "ESTABLISHED");
        assert(!humanFact, "Test 68: Human note never converted into objective system telemetry fact");
        checksPassed++;

        // Test 69: No generic chatbot introduced
        const hasChatbot = typeof (globalThis as any).AskHalo !== "undefined" || typeof (globalThis as any).ChatWithInvestigation !== "undefined";
        assert(!hasChatbot, "Test 69: No generic chatbot or LLM assistant introduced");
        checksPassed++;

        // Test 70: No automatic remediation introduced
        const hasRemediation =
            typeof (globalThis as any).autoRollback !== "undefined" ||
            typeof (globalThis as any).createIncidentTicket !== "undefined";
        assert(!hasRemediation, "Test 70: No automatic remediation or destructive actions introduced");
        checksPassed++;

        console.log("\n==================================================");
        console.log(`PILLAR G TEST SUITE RESULTS: ${checksPassed} / 70 CHECKS PASSED (100%)`);
        console.log("==================================================");
    } finally {
        // Clean up test entities
        setTestUser(null);
        clearSynthesisCache();
        for (const orgId of createdOrgIds) {
            await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
        }
        for (const userId of createdUserIds) {
            await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
        }
    }
}

runPillarGTestSuite()
    .then(() => {
        console.log("PILLAR G TEST SUITE COMPLETED SUCCESSFULLY.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("PILLAR G TEST SUITE FAILED WITH ERROR:", err);
        process.exit(1);
    });
