# HALO TRACE — FORENSIC MASTER ENGINEERING REPORT
## PHASE 5 / PILLAR D: ORGANIZATIONAL FAILURE MEMORY & INCIDENT INTELLIGENCE

**Timestamp:** 2026-10-02  
**Author:** Antigravity AI & Halo Core Platform Engineering Team  
**Scope:** Phase 5 / Pillar D Only (Organizational Failure Memory & Incident Intelligence)  
**Strict Boundaries Enforced:** Zero ownership intelligence, zero code attribution, zero automatic developer assignment, zero CODEOWNERS integration, zero incident command center, zero generic AI chatbot, zero Developer-plan leakage.

---

### EXECUTIVE SUMMARY

In Phase 5 / Pillar D, Halo’s incident intelligence platform has been endowed with a durable, explainable organizational failure memory. Prior investigated incidents now serve as structured engineering evidence and context rather than disappearing into siloed history.

Critically, **historical similarity provides investigative context; current telemetry remains authoritative for current causality**. A 95% historical structural similarity match NEVER mutates, overwrites, or inflates the current investigation's `rootCause` or `confidenceScore`. Furthermore, the engine explicitly distinguishes identical symptoms from identical causes: when service and operation match but causal chains diverge, the engine flags `"symptomMatchWithDifferentCause = true"`, alerting engineers to differing failure propagation paths.

---

### 1. Existing Investigation Architecture

Halo’s canonical investigation core consists of:
1. **`Investigation` Model:** Durable parent record storing `projectId`, `title`, `summary`, `rootCause`, `confidenceScore`, `status` (`DRAFT`, `ANALYZING`, `COMPLETED`, `ARCHIVED`), and `recommendation`.
2. **`Event` Telemetry Model:** Immutable raw events carrying `traceId`, `spanId` (via metadata), `service`, `operation`, `severity`, and payload timestamps.
3. **`EvidenceGraph` & `CausalChain`:** Deterministically constructed by analyzing temporal proximity and structural linkage (shared `traceId`, `requestId`, `sessionId`) across services.
4. **Deterministic Root Cause Rule:** The engine asserts `rootCause` if and only if evidence confidence meets or exceeds `MIN_ROOT_CAUSE_CONFIDENCE` (70.0). If below 70, `rootCause` remains honestly `null`.

---

### 2. Historical Memory Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          CANONICAL INVESTIGATION             │
                  │  rootCause, confidenceScore, status, summary │
                  └──────────────────────┬───────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌─────────────────┐            ┌───────────────────┐            ┌───────────────────┐
│ Evidence Graph  │            │ Differential Trace│            │ Cross-Service Top │
│ & Causal Chains │            │ & Divergence Data │            │ & Health Heatmaps │
└────────┬────────┘            └─────────┬─────────┘            └─────────┬─────────┘
         │                               │                                │
         └───────────────────────────────┼────────────────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │    ORGANIZATIONAL FAILURE MEMORY LAYER    │
                   ├───────────────────────────────────────────┤
                   │ • Materialized IncidentMemory (Versioned) │
                   │ • Deterministic 6-Dimension Similarity    │
                   │ • Recurring FailurePattern Clustering     │
                   │ • Evidence-Backed Postmortem Synthesis    │
                   │ • Strict Human vs System Knowledge Split  │
                   └───────────────────────────────────────────┘
```

The memory layer sits directly above the canonical investigation system, referencing existing entities rather than duplicating raw events or traces.

---

### 3. Canonical Source of Truth

- **No Second Investigation Entity:** The existing canonical `Investigation` remains the authoritative truth.
- **Derived & Rebuildable:** `IncidentMemory` and `FailurePattern` are materialized derived views that can be completely dropped and regenerated from canonical database records at any time.
- **Cascading Integrity:** Deleting an investigation immediately deletes its derived `IncidentMemory` via PostgreSQL foreign key cascade (`onDelete: Cascade`).

---

### 4. Incident Memory Model

- **Model:** `prisma.incidentMemory`.
- **Identity:** Anchored to `investigationId` (`@unique`).
- **Attributes:** `fingerprint`, `title`, `normalizedTitle`, `primaryService`, `primaryOperation`, `errorType`, `rootCause`, `confidenceScore`, `status`, `affectedServices`, `causalChainSummary`, `topologyEdges`, `evidenceReferences`, `humanVerdicts`, `recommendations`, `memoryVersion`.
- **Tenant Scope:** Scoped to `organizationId` and `projectId`.

---

### 5. Historical Incident Eligibility

- **Eligibility Boundary:** Only investigations with `status: "COMPLETED"` and associated telemetry are admitted to organizational memory.
- **In-Flight Incidents Excluded:** Unfinished investigations (`QUEUED`, `RUNNING`, `FAILED`) do not pollute organizational memory.

---

### 6. Incident Normalization

Implemented in `apps/dashboard/src/lib/investigation/incident-memory/normalizer.ts`:
- **Dynamic Variable Removal:** Strips UUIDs (`[0-9a-f]{8}-...`), hex/hash IDs (`0x...`), numeric path IDs (`/users/12345` -> `/users/:id`), query params (`=123` -> `=:id`), and timestamps (`2026-10-02T...` -> `<TIMESTAMP>`).
- **Operation Normalization:** Normalizes HTTP/RPC endpoints into parameterized templates.
- **Deterministic Fingerprinting:** Generates `service::operation::errorType` structural keys.

---

### 7. Similarity Model

Implemented in `apps/dashboard/src/lib/investigation/incident-memory/similarity-engine.ts`:
- **6 Weighted Evidence Dimensions:**
  1. `SERVICE` (weight 25)
  2. `OPERATION` (weight 20)
  3. `ERROR` (weight 20)
  4. `CAUSAL_STRUCTURE` (weight 15)
  5. `TOPOLOGY` (weight 10)
  6. `FAILURE_PROPAGATION` (weight 10)
- **Score Formula:** $\text{Score} = \frac{\sum \text{Earned Weights}}{\sum \text{Evaluated Weights}} \times 100$.
- **Classifications:**
  - $\ge 75\%$: `STRONG_STRUCTURAL_MATCH`
  - $50 - 74\%$: `MODERATE_STRUCTURAL_MATCH`
  - $25 - 49\%$: `WEAK_PARTIAL_MATCH`
  - $< 25\%$: `NO_MEANINGFUL_MATCH`

---

### 8. Similarity Explainability

Matches are never a black-box percentage. Every match exposes:
- **`matchingDimensions`:** Explicit list of matching facets (e.g. `["SERVICE", "OPERATION", "ERROR"]`).
- **`differingDimensions`:** Explicit list of diverging facets (e.g. `["CAUSAL_STRUCTURE", "TOPOLOGY"]`).
- **`signals`:** Granular evidence statements referencing actual service names and hop counts.
- **`explanation`:** Human-readable narrative detailing why the incidents match and where they diverge.

---

### 9. Similarity vs Causality (Core Invariant)

- **Similarity is Context:** Historical similarity provides investigative context; current telemetry remains authoritative for current causality.
- **Zero Root Cause Mutation:** Historical matches NEVER alter current investigation `rootCause` or `confidenceScore`.
- **Same Symptom, Differing Cause:** When service and endpoint match but causal chains differ, the engine sets `symptomMatchWithDifferentCause = true`, warning engineers not to assume identical root causes.

---

### 10. Recurring Failure Detection

- Recurring failure patterns are derived when structurally similar failures occur $\ge 2$ times within an organization.
- Aggregates occurrences across incidents without forcing them into a synthetic single incident.

---

### 11. Failure Pattern Model

- **Model:** `prisma.failurePattern`.
- **Key:** `@unique([organizationId, patternKey])`.
- **Attributes:** `title`, `primaryService`, `affectedServices`, `incidentCount`, `firstSeenAt`, `lastSeenAt`, `commonCausalSummary`, `investigationIds`.

---

### 12. Pattern Evolution

- Tracks temporal evolution: `firstSeenAt` vs `lastSeenAt`.
- Accumulates distinct affected services to track blast radius expansion over time.

---

### 13. Historical Resolution Memory

- Preserves what previous investigations concluded:
  - Automated engine root cause (if confidence $\ge 70\%$)
  - Peer verdicts (`SUPPORTED`, `DISPUTED`, `NEEDS_EVIDENCE`)
  - Preserved investigator comments
  - Generated recommendations

---

### 14. Human vs System Knowledge

- Algorithmic root cause is strictly separated from human verdicts.
- Human verdicts retain author attribution: `"Alice Engineer supported Hypothesis 1"`.
- Human opinions are never converted into system facts.

---

### 15. Historical Evidence Provenance

- All statements in incident memory link directly to canonical `eventId`s and `traceId`s in PostgreSQL.
- Fabricated or cross-project event references are rejected.

---

### 16. Differential Trace Integration

- Reuses Pillar A `computeDifferentialTrace`.
- Highlights whether current divergence patterns resemble historical execution divergences.

---

### 17. Topology Integration

- Reuses Pillar B dependency graph structures.
- Compares dependency edges between current and historical incidents (`commonEdges` vs `divergingEdges`).

---

### 18. Collaboration Integration

- Reuses Pillar C `InvestigationVerdict`, `InvestigationComment`, and `InvestigationProposedRelation`.
- Preserves peer disagreement and comments with attribution in historical previews.

---

### 19. Replay Integration

- If a historical incident has an associated `ReplaySession`, the UI links directly to the player without copying chunks.

---

### 20. Postmortem Generation

Implemented in `apps/dashboard/src/lib/investigation/incident-memory/postmortem-generator.ts`:
- **Sections:**
  1. Executive Summary
  2. Impact & Detection
  3. Verified Causal Chain
  4. Root Cause (Engine vs Human)
  5. What We Know
  6. What Remains Uncertain (Epistemic Honesty)
  7. Recommendations
  8. Historical Context & Recurring Patterns
- **Export:** Formatted as structured Markdown ready for clipboard copy.

---

### 21. AI Boundaries (Zero Hallucination)

- AI and synthesis algorithms MUST NOT invent unobserved metrics, services, or root causes.
- Missing telemetry is explicitly stated: `"Not observed in telemetry / Unknown"`.
- Factual statements reference verified event IDs.

---

### 22. Database Changes

Added to `prisma/schema.prisma`:
```prisma
model IncidentMemory {
  id                  String              @id @default(cuid())
  investigationId     String              @unique
  projectId           String
  organizationId      String
  fingerprint         String
  title               String
  normalizedTitle     String
  primaryService      String
  primaryOperation    String?
  errorType           String?
  rootCause           String?
  confidenceScore     Float?
  status              InvestigationStatus @default(COMPLETED)
  affectedServices    String[]            @default([])
  causalChainSummary  Json?
  topologyEdges       Json?
  evidenceReferences  String[]            @default([])
  humanVerdicts       Json?
  recommendations     Json?
  memoryVersion       Int                 @default(1)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  investigation       Investigation       @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  project             Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  organization        Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, createdAt])
  @@index([projectId, createdAt])
  @@index([organizationId, fingerprint])
  @@index([primaryService])
}

model FailurePattern {
  id                  String        @id @default(cuid())
  organizationId      String
  projectId           String?
  patternKey          String
  title               String
  primaryService      String
  affectedServices    String[]      @default([])
  incidentCount       Int           @default(1)
  firstSeenAt         DateTime
  lastSeenAt          DateTime
  commonCausalSummary Json?
  investigationIds    String[]      @default([])
  version             Int           @default(1)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  organization        Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, patternKey])
  @@index([organizationId, lastSeenAt])
  @@index([primaryService])
}
```

---

### 23. API Changes

| Server Action | Capability Required | Description |
| :--- | :--- | :--- |
| `generateIncidentMemory` | `TEAM_ORGANIZATIONAL_MEMORY` | Materializes or refreshes derived incident memory |
| `getRelevantHistoricalIncidents` | `TEAM_ORGANIZATIONAL_MEMORY` | Retrieves and ranks similar historical incidents within org |
| `getHistoricalIncidentDetails` | `TEAM_ORGANIZATIONAL_MEMORY` | Fetches full historical incident context for preview drawer |
| `getRecurringFailurePatterns` | `TEAM_ORGANIZATIONAL_MEMORY` | Fetches clustered recurring patterns for organization |
| `generateInvestigationPostmortemAction` | `TEAM_ORGANIZATIONAL_MEMORY` | Synthesizes evidence-backed postmortem |

---

### 24. Capability / Entitlement

- Backed by `TEAM_ORGANIZATIONAL_MEMORY` in `capabilities.ts`.
- Developer and Free plans are strictly blocked server-side with `TEAM_PLAN_REQUIRED`.

---

### 25. Security Audit

- All actions resolve identity via `requireAuthenticatedUser()`.
- Client-supplied `organizationId` or `projectId` are discarded.
- Role and project permissions verified via `requireProjectAccess()`.

---

### 26. Tenant Isolation

- Historical search scopes strictly to `where: { organizationId: currentOrgId }`.
- Organization A cannot view Organization B incidents, failure patterns, or postmortems.

---

### 27. Performance Audit

- **Bounded Queries:** Historical retrieval limits search space to 50 completed incidents per query (`take: 50`), avoiding unbounded memory consumption.
- **Indexed Search:** Indexed on `[organizationId, createdAt]`, `[organizationId, fingerprint]`, and `[primaryService]`.
- **Fast Build:** Next.js production build compiled in 6.3s with 0 errors.

---

### 28. Cache / Index Strategy

- Database indexes directly support the query access paths:
  - `@@index([organizationId, createdAt])` for organization candidate retrieval.
  - `@@unique([organizationId, patternKey])` for single-query pattern aggregation.
  - `@@unique([investigationId])` for O(1) canonical incident lookups.

---

### 29. Test Matrix (Pillar D Memory Suite)

The dedicated test suite `scripts/test-pillar-d-memory.ts` covers 25 comprehensive checks:

| # | Test Name | Invariant Verified | Status |
| :---: | :--- | :--- | :---: |
| 1 | Test 89 | Developer plan organization is strictly blocked with `TEAM_PLAN_REQUIRED` | ✓ PASS |
| 2 | Test 78a | `IncidentMemory` is uniquely anchored to canonical `Investigation` | ✓ PASS |
| 3 | Test 78b | Normalized service, errorType, and canonical rootCause faithfully captured | ✓ PASS |
| 4 | Test 92 | Repeated memory generation is 100% idempotent (no duplicate records) | ✓ PASS |
| 5 | Test 91 | Derived incident memory explicitly exposes derivation version (`memoryVersion: 1`) | ✓ PASS |
| 6 | Test 79a | Successfully retrieved relevant historical incidents within the same organization | ✓ PASS |
| 7 | Test 79b | Top match exhibits verified structural overlap across `SERVICE`, `OPERATION`, and `ERROR` | ✓ PASS |
| 8 | Test 79c | Similarity response provides structured evidence signals and human-readable explanation | ✓ PASS |
| 9 | Test 80 | Unrelated services and failure types are classified as `NO_MEANINGFUL_MATCH` (score = 0) | ✓ PASS |
| 10 | Test 86 | Incident with no historical match returns clean zero-fabrication empty state | ✓ PASS |
| 11 | Test 81a | Incident with same service and endpoint is retrieved as a structural symptom match | ✓ PASS |
| 12 | Test 81b | Engine explicitly flags `symptomMatchWithDifferentCause = true` when causal paths diverge | ✓ PASS |
| 13 | Test 81c | Differing dimensions explicitly preserve the causal divergence | ✓ PASS |
| 14 | Test 85a | Historical similarity matches NEVER mutate current investigation `rootCause` | ✓ PASS |
| 15 | Test 85b | Historical similarity NEVER inflates current engine `confidenceScore` | ✓ PASS |
| 16 | Test 82a | Recurring failure pattern automatically clustered across $\ge 2$ matching incidents | ✓ PASS |
| 17 | Test 82b | Pattern correctly tracks `primaryService` and incident count ($\ge 3$ occurrences) | ✓ PASS |
| 18 | Test 82c | Recurring pattern explicitly links all participating canonical investigation IDs | ✓ PASS |
| 19 | Test 83 | Historical human disagreement is preserved with explicit author attribution without fake consensus | ✓ PASS |
| 20 | Test 84 | Engine root cause remains distinct from human peer verdicts | ✓ PASS |
| 21 | Test 87 | Cross-organization user rejected from accessing foreign historical incident | ✓ PASS |
| 22 | Test 94a | Postmortem synthesized cleanly from canonical investigation | ✓ PASS |
| 23 | Test 95 | Postmortem statements are linked to verified telemetry event IDs | ✓ PASS |
| 24 | Test 94b | Postmortem explicitly distinguishes human peer verdicts from engine root cause | ✓ PASS |
| 25 | Test 90 | Deleting an investigation immediately cascades and removes derived `IncidentMemory` | ✓ PASS |

---

### 30. Regression Results

All 7 test suites were executed sequentially against the updated codebase:

| Suite | Script | Checks | Result |
| :--- | :--- | :---: | :---: |
| **Phase 1 Team Foundation** | `test-phase1-foundation.ts` | 24 / 24 | **100% PASS** |
| **Pillar A Differential Trace** | `test-pillar-a-differential.ts` | 22 / 22 | **100% PASS** |
| **Pillar B Cross-Service Topology** | `test-pillar-b-topology.ts` | 25 / 25 | **100% PASS** |
| **Pillar C Collaborative Live Rooms** | `test-pillar-c-collaboration.ts` | 25 / 25 | **100% PASS** |
| **Multi-Step Cascade & Replay** | `test-multistep-cascade.ts` | 33 / 33 | **100% PASS** |
| **Adversarial Concurrency Audit** | `test-adversarial-audit.ts` | 42 / 42 | **100% PASS** |
| **Pillar D Organizational Failure Memory** | `test-pillar-d-memory.ts` | 25 / 25 | **100% PASS** |
| **GRAND TOTAL** | **ALL 7 SUITES** | **196 / 196** | **100% PASS** |

---

### 31. Known Limitations

1. **Semantic Vector Search:** Pillar D relies entirely on deterministic structural similarity across 6 evidence dimensions. While vector embeddings could be introduced in the future for fuzzy text matching, deterministic structural matching was prioritized to maintain 100% explainability and zero hallucination.
2. **Cross-Organization Memory:** Strictly forbidden by design. Organizations cannot share failure patterns with other organizations.
3. **Future Capabilities Excluded:** In accordance with instructions, Ownership Intelligence, Code Attribution, and Incident Command Center are NOT implemented in this phase.

---

### 32. Files Changed

1. `prisma/schema.prisma` — Added `IncidentMemory` and `FailurePattern` models with relations and indexes.
2. `apps/dashboard/src/lib/investigation/incident-memory/normalizer.ts` — String, endpoint, and error normalization utilities.
3. `apps/dashboard/src/lib/investigation/incident-memory/similarity-engine.ts` — Deterministic 6-dimension similarity engine.
4. `apps/dashboard/src/lib/investigation/incident-memory/generator.ts` — Derived memory generator & recurring pattern clusterer.
5. `apps/dashboard/src/lib/investigation/incident-memory/postmortem-generator.ts` — Evidence-backed postmortem synthesizer.
6. `apps/dashboard/src/actions/incident-memory.ts` — Server actions for memory generation, retrieval, patterns, and postmortems.
7. `apps/dashboard/src/components/investigation/memory/similar-incident-card.tsx` — Similar incident card with matches vs differences.
8. `apps/dashboard/src/components/investigation/memory/recurring-patterns-card.tsx` — Recurring failure patterns card.
9. `apps/dashboard/src/components/investigation/memory/postmortem-modal.tsx` — Postmortem generation and markdown export modal.
10. `apps/dashboard/src/components/investigation/memory/historical-context-section.tsx` — Master historical memory section.
11. `apps/dashboard/src/components/investigation/sticky-nav.tsx` — Added History category to investigation sticky nav.
12. `apps/dashboard/src/app/(dashboard)/projects/[id]/investigations/new/page.tsx` — Mounted `HistoricalContextSection` with capability check.
13. `scripts/test-pillar-d-memory.ts` — 25-check verification suite for Pillar D.

---

### 33. Final Verification

- [x] **Phase 1 remains passing (24/24)**
- [x] **Pillar A remains passing (22/22)**
- [x] **Pillar B remains passing (25/25)**
- [x] **Pillar C remains passing (25/25)**
- [x] **Multi-Step Cascade remains passing (33/33)**
- [x] **Adversarial Audit remains passing (42/42)**
- [x] **Pillar D memory suite passes (25/25)**
- [x] **Historical memory references canonical investigations**
- [x] **No duplicate telemetry model was created**
- [x] **No duplicate investigation model was created**
- [x] **Historical incidents are tenant-isolated**
- [x] **Project authorization is enforced**
- [x] **Developer cannot access Team memory APIs (`TEAM_PLAN_REQUIRED`)**
- [x] **Free cannot access Team memory APIs**
- [x] **Historical similarity is explainable with matches and differences**
- [x] **Similarity does not equal causality**
- [x] **Similarity does not modify current root cause**
- [x] **Similarity does not modify current confidence**
- [x] **Same symptom/different cause is handled correctly (`symptomMatchWithDifferentCause`)**
- [x] **Recurring failures are derived from actual evidence**
- [x] **Recurring pattern does not automatically imply recurring root cause**
- [x] **Historical disagreements remain visible**
- [x] **Human opinions remain attributed**
- [x] **Historical recommendations remain attributed to previous investigations**
- [x] **Historical recommendations do not automatically become current recommendations**
- [x] **Historical topology is evidence-backed**
- [x] **Historical differential trace uses the existing engine**
- [x] **Historical replay uses the existing replay system**
- [x] **Historical collaboration context uses existing collaboration records**
- [x] **Missing historical data is represented as unavailable**
- [x] **No historical data is fabricated**
- [x] **No AI-generated fact is accepted without source evidence**
- [x] **Generated postmortems are evidence-backed**
- [x] **Postmortems expose uncertainty**
- [x] **Historical memory can be refreshed**
- [x] **Historical memory generation is idempotent**
- [x] **Concurrent memory generation is safe**
- [x] **Deleted/inaccessible projects cannot leak historical memory**
- [x] **Derived memory has a version (`memoryVersion: 1`)**
- [x] **Large historical datasets remain bounded**
- [x] **No obvious N+1 queries exist**
- [x] **No generic AI chat was introduced**
- [x] **No ownership intelligence was introduced**
- [x] **No code attribution was introduced**
- [x] **TypeScript passes cleanly with 0 errors**
- [x] **Production build passes cleanly**
