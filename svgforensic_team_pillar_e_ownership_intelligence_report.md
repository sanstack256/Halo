# HALO TRACE — FORENSIC MASTER REPORT
## PHASE 6 / PILLAR E: OWNERSHIP INTELLIGENCE & ENGINEERING RESPONSIBILITY

---

### EXECUTIVE SUMMARY
Phase 6 / Pillar E introduces **Ownership Intelligence & Engineering Responsibility** into Halo Trace. The master objective is answering:
- **Who owns the affected system?**
- **Who is responsible for the relevant service?**
- **What code area is associated with the failure?**
- **What team is declared to own it?**
- **What historical evidence supports the association?**
- **How certain is the ownership information?**
- **Where does declared ownership end and inference begin?**

**Strict Boundaries Enforced:**
Zero developer blame, zero automatic developer assignment, zero productivity analytics, zero employee surveillance, zero HR functionality, zero Slack/PagerDuty automation, zero generic chatbot, zero modification of root cause or confidence score, and zero Developer/Free plan capability leakage.

All 8 test suites (**223 / 223 checks, 100%**) passed with zero failures and zero regressions.

---

### 1. Existing Ownership Architecture
Prior to Pillar E:
- Services were dynamically discovered from telemetry spans (`Event.service`, `Event.operation`, `Event.resource`).
- Ownership was either unassigned or loosely derived from unstructured tag metadata (`tags.team` or `tags.owner`), with zero persistence, zero conflict detection, and no CODEOWNERS awareness.
- Telemetry events lacked structured code ownership attribution, and investigations presented no unified ownership context or incident routing recommendations.
- Capabilities registry (`apps/dashboard/src/lib/capabilities.ts`) already reserved `TEAM_OWNERSHIP_INTELLIGENCE`, requiring plan `TEAM`.

---

### 2. Ownership Sources
The resolution pipeline deterministically prioritizes and evaluates the following sources:
1. `SERVICE_CONFIG`: Explicit service configuration records in `ServiceOwnership` table.
2. `CODEOWNERS`: Authoritative rule-matching from repository root (`.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS`).
3. `HISTORICAL_INCIDENT`: Previous completed investigations involving the service from `IncidentMemory`.
4. `HUMAN_ASSERTION`: Human engineer assertions recorded via `ServiceOwnershipAssertion`.
5. `SOURCE_CORRELATION`: File path / stack frame mappings from active telemetry.
6. `UNKNOWN`: Strict fallback when no ownership metadata exists (never fabricates teams).

---

### 3. Declared vs Inferred Ownership
Every ownership association is strictly classified into one of five mutually exclusive states:
- `DECLARED`: Explicit CODEOWNERS match or explicit `ServiceOwnership` configuration.
- `INFERRED`: Derived from repository path or tag heuristics without an explicit declared rule.
- `HISTORICAL`: Participation in past investigations; contextual only, never establishes current ownership.
- `HUMAN_ASSERTION`: Manual user statement; never masquerades as or silently mutates declared configuration.
- `UNKNOWN`: No ownership source available; cleanly surfaced without guessing.

---

### 4. Service Ownership
Given any service (e.g. `payments-api`), the engine determines:
- Declared owner name (`declaredOwner`)
- Canonical team identifier (`declaredTeam`)
- Ownership source (`source`)
- Repository identity (`repository`)
- Environment and project scope
- Evidence provenance list
If unassigned, the engine outputs `Owner: Unknown` with zero fabricated teams.

---

### 5. Repository Ownership
- Project repository metadata is resolved via stored configuration (`Project.githubRepoOwner` and `Project.githubRepoName`).
- When configured, repository identity is formatted as `owner/repo`.
- If unconfigured, the system reports `Repository: Unknown`. Arbitrary URLs are never invented.

---

### 6. CODEOWNERS Parsing
Implemented in `apps/dashboard/src/lib/ownership/codeowners-parser.ts`:
- Supports canonical Git locations: `.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS`.
- Pattern matching: directory wildcards (`*`, `**`), trailing slashes, root-relative prefixes.
- Ordering semantics: standard Git precedence where later rules override earlier rules.
- Robustness: handles comments (`#`), trailing inline comments, malformed tokens, and excessive file sizes (up to 10,000 lines) with zero crashes.

---

### 7. Code Path Ownership
When investigation evidence provides stack frames, source paths, or telemetry file locations:
- Paths are normalized and matched against parsed CODEOWNERS rules.
- Yields `CodePathOwnershipResult` with matching rule pattern, source location, and commit SHA.
- Strictly does not create developer blame or fault attribution.

---

### 8. Ownership Evidence
Every ownership result returns an inspectable provenance list:
```typescript
interface OwnershipEvidenceItem {
    owner: string;
    ownerType: "TEAM" | "INDIVIDUAL" | "EXTERNAL_GROUP";
    source: "CODEOWNERS" | "SERVICE_CONFIG" | "HISTORICAL_INCIDENT" | "SOURCE_CORRELATION" | "HUMAN_ASSERTION";
    classification: "DECLARED" | "INFERRED" | "HISTORICAL" | "UNKNOWN" | "HUMAN_ASSERTION";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    scope: string;
    evidence: string;
    sourceLocation?: string;
    observedAt?: Date;
    commitSha?: string;
}
```
Users inspect **WHO**, **WHAT**, **WHY**, **SOURCE**, and **WHEN**.

---

### 9. Ownership Confidence
Confidence describes **evidence certainty**, NEVER probability of fault or developer responsibility:
- `HIGH`: Exact CODEOWNERS rule match or explicit `ServiceOwnership` config.
- `MEDIUM`: Service configuration with partial path match or detected conflict.
- `LOW`: Historical incident association or human assertions.

---

### 10. Ownership Conflicts
If service metadata specifies `Team Alpha` and CODEOWNERS specifies `Team Beta`:
- The engine marks status as `CONFLICT`.
- Neither source is silently discarded or arbitrarily preferred.
- Both sources, their exact locations, and human-readable explanation are surfaced in the UI.

---

### 11. Ownership Freshness
- Records capture `observedAt` timestamps and Git commit SHAs (`commitSha`) where available.
- Distinguishes observations across different commit versions (e.g., `commit_v1` vs `commit_v2`).

---

### 12. Historical Ownership
- Integrates with Pillar D `IncidentMemory`.
- Exposes historical incident count and participant context.
- Historical involvement does NOT establish current ownership; tagged strictly as `HISTORICAL`.

---

### 13. Investigation Integration
Mounted cleanly in `apps/dashboard/src/app/(dashboard)/projects/[id]/investigations/new/page.tsx` via `OwnershipContextPanel`:
- Summarizes affected services with causal roles.
- Highlights declared owners, conflict pills, code path ownership badges.
- Connected to `InvestigationStickyNav` via dedicated `#section-ownership-intelligence` anchor.

---

### 14. Topology Integration
- `apps/dashboard/src/lib/services/service-registry.ts` queries `ServiceOwnership` in parallel with telemetry aggregations.
- Canonical services and dependency nodes inherit declared team owners without re-computing topology graphs.

---

### 15. Differential Trace Integration
- When Differential Trace isolates an execution path divergence, the affected service and code area map directly to the corresponding declared owner without modifying differential statistics.

---

### 16. Incident Memory Integration
- Historical incident details show both owner at incident time and current declared owner where recorded in `ServiceOwnershipHistory`.

---

### 17. Collaboration Integration
- Human assertions recorded via `recordHumanOwnershipAssertion` are strictly labeled `HUMAN ASSERTION`.
- User comments never silently mutate declared ownership configurations.

---

### 18. Postmortem Integration
- `generateInvestigationPostmortem` incorporates factual engineering ownership metadata (`## 2. Impact & Engineering Ownership`).
- Factual statement: `payments-api is declared to be owned by Team Payments (Source: SERVICE_CONFIG)`.
- Zero accusatory or blame language.

---

### 19. AI Boundaries
- AI models may summarize ownership evidence and explain conflicts.
- AI models MUST NOT invent owners, assign fault, or convert historical participation into blame.

---

### 20. Database Changes
Added to `prisma/schema.prisma`:
1. `enum OwnershipClassification`: `DECLARED`, `INFERRED`, `HISTORICAL`, `UNKNOWN`, `HUMAN_ASSERTION`.
2. `enum OwnershipSourceType`: `CODEOWNERS`, `SERVICE_CONFIG`, `REPOSITORY_METADATA`, `HISTORICAL_INCIDENT`, `SOURCE_CORRELATION`, `MANUAL_ASSERTION`.
3. `model ServiceOwnership`:
   - `id`, `organizationId`, `projectId`, `serviceName`, `declaredOwner`, `declaredTeam`, `ownerType`, `classification`, `source`, `sourcePath`, `repositoryUrl`, `commitSha`, `confidenceLevel`, `metadata`, `createdAt`, `updatedAt`.
   - `@@unique([organizationId, projectId, serviceName, source])`
   - `@@index([organizationId, serviceName])`
   - `@@index([projectId, serviceName])`
4. `model ServiceOwnershipAssertion`:
   - Tracks human assertions with `authorId`, `statement`, `proposedOwner`, `scope`, and `classification: HUMAN_ASSERTION`.
5. `model ServiceOwnershipHistory`:
   - Tracks audit trail: `previousOwner`, `newOwner`, `source`, `sourceVersion`, `reason`, `changedAt`.

---

### 21. API Changes
Domain-level server actions in `apps/dashboard/src/actions/ownership.ts`:
- `getInvestigationOwnership(investigationId: string)`
- `getServiceOwnership(projectId: string, serviceName: string, sourcePath?: string)`
- `configureServiceOwnership(data: ...)`
- `recordHumanOwnershipAssertion(data: ...)`
- `getServiceOwnershipHistory(projectId: string, serviceName: string)`

---

### 22. Capability Enforcement
Server-side gating via `requireCapability(organizationId, "TEAM_OWNERSHIP_INTELLIGENCE")`:
- Developer and Free plan organizations receive `AuthorizationError: TEAM_PLAN_REQUIRED`.
- Team plan organizations are granted full access.

---

### 23. Tenant Isolation
- Every Prisma query filters by `organizationId`.
- Cross-tenant access is rejected server-side with zero data leakage.

---

### 24. Security Audit
- No client-supplied tokens or repository IDs are trusted.
- Tokens used server-side only; never returned to client or logged.

---

### 25. Path Security
`sanitizeRepositoryPath` in `codeowners-parser.ts`:
- Strips null bytes (`\0`).
- Rejects relative dot segments (`..`, `.`).
- Blocks root escaping (`../../etc/passwd`).

---

### 26. Performance Audit
- In-memory tenant-isolated cache (`codeowners-loader.ts`) with 60-second TTL.
- Batch queries for service ownerships in `service-registry.ts` and `ownership-engine.ts` prevent N+1 query patterns.

---

### 27. Adversarial Test Matrix
All 27 checks in `scripts/test-pillar-e-ownership.ts` passed:
1. `Test 58a`: Developer plan direct request rejected with `TEAM_PLAN_REQUIRED`.
2. `Test 58b`: Team plan organization successfully configures service ownership.
3. `Test 56`: Cross-organization user rejected from querying foreign service ownership.
4. `Test 57`: Cross-organization user rejected from writing foreign service ownership.
5. `Test 59`: Unconfigured service returns status `UNKNOWN` with zero fabricated teams.
6. `Test 60`: Disagreement surfaced as `CONFLICT` without silent overwrite.
7. `Test 61`: Multiple declared owners in CODEOWNERS rule strictly preserved.
8. `Test 62a`: Parser survives malformed lines and whitespace variations without throwing.
9. `Test 62b`: Valid rules remain fully functional despite adjacent malformed rules.
10. `Test 63`: Path sanitizer strictly rejects directory traversal (`../`), root escape, null bytes.
11. `Test 64`: Declared team returned without attributing fault to code author.
12. `Test 65`: Historical incident participation tagged `HISTORICAL` without overwriting `DECLARED` owner.
13. `Test 66`: Root-cause service strictly distinguished from impacted surface.
14. `Test 67`: Ownership mutation records verifiable audit history with previous and new owners.
15. `Test 68`: Ownership resolution operations NEVER mutate investigation `rootCause` or `confidenceScore`.
16. `Test 69`: Human assertions strictly tagged `HUMAN ASSERTION`.
17. `Test 70`: Loader prevents cross-tenant cache leakage.
18. `Test 71`: Distinct commit SHAs produce distinguishable, version-aware observations.
19. `Test 72`: Projects without repository metadata strictly report `Unknown`.
20. `Test 73`: Investigation without code path evidence leaves code ownership cleanly unavailable.
21. `Test 74`: Multi-service incident preserves independent ownership for all services.
22. `Test 75`: Generated postmortem and ownership outputs contain zero developer blame terminology.
23. `Test 27`: Confidence strictly describes certainty of evidence, never fault probability.
24. `Test 32`: Unmapped external identifiers (`@external-core-team`) preserved without fabricating Halo teams.
25. `Test 53`: Postmortem cleanly incorporates declared engineering ownership context without accusation.
26. `Test 22`: Topology and service registry cleanly inherit declared owner from `ServiceOwnership`.
27. `Test 90`: Deleting a project cleanly cascades and removes associated `ServiceOwnership` records.

---

### 28. Regression Results
All 8 verification suites run end-to-end:
1. `scripts/test-phase1-foundation.ts`: **24 / 24 PASSED**
2. `scripts/test-pillar-a-differential.ts`: **22 / 22 PASSED**
3. `scripts/test-pillar-b-topology.ts`: **25 / 25 PASSED**
4. `scripts/test-pillar-c-collaboration.ts`: **25 / 25 PASSED**
5. `scripts/test-multistep-cascade.ts`: **33 / 33 PASSED**
6. `scripts/test-adversarial-audit.ts`: **42 / 42 PASSED**
7. `scripts/test-pillar-d-memory.ts`: **25 / 25 PASSED**
8. `scripts/test-pillar-e-ownership.ts`: **27 / 27 PASSED**

**Grand Total: 223 / 223 CHECKS PASSED (100%)**

---

### 29. Files Changed
- `prisma/schema.prisma`: Added `OwnershipClassification`, `OwnershipSourceType`, `ServiceOwnership`, `ServiceOwnershipAssertion`, `ServiceOwnershipHistory`.
- `apps/dashboard/src/lib/ownership/codeowners-parser.ts`: Created CODEOWNERS pattern parser and path sanitizer.
- `apps/dashboard/src/lib/ownership/codeowners-loader.ts`: Created CODEOWNERS loader with local/GitHub discovery and cache isolation.
- `apps/dashboard/src/lib/ownership/ownership-engine.ts`: Created core ownership resolution engine with non-blame invariants and conflict detection.
- `apps/dashboard/src/actions/ownership.ts`: Created domain server actions with capability and tenant checks.
- `apps/dashboard/src/components/investigation/ownership/ownership-context-panel.tsx`: Created ownership context UI component.
- `apps/dashboard/src/components/investigation/sticky-nav.tsx`: Added Ownership category anchor.
- `apps/dashboard/src/app/(dashboard)/projects/[id]/investigations/new/page.tsx`: Integrated `OwnershipContextPanel` into investigation page.
- `apps/dashboard/src/lib/services/service-registry.ts`: Annotated services with declared ownership.
- `apps/dashboard/src/lib/investigation/incident-memory/postmortem-generator.ts`: Incorporated declared ownership metadata into postmortems.
- `scripts/test-pillar-e-ownership.ts`: 27-check exhaustive test suite.

---

### 30. Known Limitations
- When multiple CODEOWNERS rules match different components within a sub-package, the engine adheres to standard Git rule precedence (last matching rule wins) while preserving all declared owners listed on that rule.
- Local filesystem discovery for CODEOWNERS falls back to project default branch on GitHub when operating in distributed deployment environments without local working copies.

---

### 31. Final Verification
- `next build`: **0 errors (Compiled successfully in 6.9s, TypeScript 9.5s)**.
- Full regression suite: **223 / 223 tests passing (100%)**.
- Zero developer blame terminology verified across all generated outputs.
