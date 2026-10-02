# HALO TRACE — FORENSIC MASTER ENGINEERING REPORT
## PHASE 4 / PILLAR C: COLLABORATIVE LIVE INVESTIGATION ROOMS

**Timestamp:** 2026-10-02  
**Author:** Antigravity AI & Halo Core Platform Engineering Team  
**Scope:** Phase 4 / Pillar C Only (Collaborative Live Investigation Rooms)  
**Strict Exclusions Preserved:** Zero organizational failure memory, zero incident similarity clustering, zero automated postmortems, zero ownership intelligence, zero code attribution, zero generic chat/Slack clone, zero Developer-plan leakage.

---

### EXECUTIVE SUMMARY

In Phase 4 / Pillar C, Halo’s canonical single-user incident investigation has been transformed into a durable, multi-engineer collaborative live investigation room. Halo does NOT build a detached chat app or secondary store of truth: the canonical `Investigation` and its underlying telemetry `Event` models remain authoritative. Peer verdicts, evidence-anchored comments, and user-suggested causal relations attach directly to Halo’s evidence graph, causal chains, differential traces, topology, and replay timelines.

Critically, **deterministic engine telemetry and human consensus remain strictly partitioned**. Human peer verdicts (`SUPPORTED`, `DISPUTED`, `NEEDS_EVIDENCE`) are recorded as peer opinions; they NEVER mutate or overwrite Halo’s deterministic `rootCause` or `confidenceScore`. Furthermore, human-proposed relationships are explicitly categorized as `HUMAN_PROPOSED` and are mathematically excluded from `OBSERVED` or `INFERRED` telemetry classifications.

---

### 1. Existing Investigation Architecture

Halo’s canonical investigation architecture centers on:
1. **`Investigation` Model:** Durable parent record storing `projectId`, `title`, `summary`, `rootCause`, `confidenceScore`, `status` (`DRAFT`, `ANALYZING`, `COMPLETED`, `ARCHIVED`), and `recommendation`.
2. **`Event` Telemetry Model:** Immutable raw events linked to `Project` and `Environment`, carrying `traceId`, `spanId` (via metadata), `service`, `operation`, `severity`, and payload timestamps.
3. **`EvidenceGraph` & `CausalChain`:** Deterministically constructed by analyzing temporal proximity and structural linkage (shared `traceId`, `requestId`, `sessionId`) across services.
4. **Deterministic Root Cause Rule:** The engine asserts `rootCause` if and only if evidence confidence meets or exceeds `MIN_ROOT_CAUSE_CONFIDENCE` (70.0). If below 70, `rootCause` remains honestly `null`.

---

### 2. Existing Team Foundation

Reuses Phase 1 Team Foundation without duplicate models:
- **Membership & Roles:** Canonical `OrganizationMember` with `Role` (`OWNER`, `ADMIN`, `MEMBER`) and `MembershipStatus` (`ACTIVE`, `INVITED`, `SUSPENDED`).
- **Capability Registry:** `hasCapability(plan, capability)` backed by `PLANS[plan].capabilities`.
- **Tenant Scoping:** Dual-barrier validation through `requireProjectAccess(projectId)` and `requireCapability(orgId, "TEAM_INVESTIGATION_ROOMS")`. All client-provided IDs (`organizationId`, `userId`, `projectId`) are discarded in favor of session resolution.

---

### 3. Collaboration Architecture

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
                   │    COLLABORATIVE INVESTIGATION LAYER      │
                   ├───────────────────────────────────────────┤
                   │ • Ephemeral Presence (TTL Heartbeat, SSE) │
                   │ • Evidence-Anchored Comments (Tombstones) │
                   │ • Multi-Engineer Peer Verdicts (Explicit) │
                   │ • Human-Proposed Relations (Segregated)   │
                   │ • Append-Oriented Activity Stream         │
                   └───────────────────────────────────────────┘
```

The collaboration layer is additive and read/write-anchored to the canonical investigation. Telemetry events and engine models remain completely read-only and immutable.

---

### 4. Investigation Room Model

- **No Second Investigation Entity:** The existing canonical `Investigation` model serves as the authoritative investigation room. There is NO `CollaborativeInvestigation` duplicate.
- **Context Boundaries:** The room is strictly scoped to `projectId`, `investigationId`, and `organizationId`.
- **Durable Record Guarantee:** When an investigation is launched or viewed, the server guarantees a durable database record in `prisma.investigation`.

---

### 5. Participant Model

- Collaborators are verified through `requireAuthenticatedUser()` and `requireProjectAccess()`.
- Active participants expose: `userId`, `userName`, `userEmail`, `currentArea`, `tabCount`, and `lastSeen`.
- Multi-browser tabs opened by the same user on the same investigation collapse into a single active participant entry with `tabCount >= 2`, eliminating duplicate engineer avatars.

---

### 6. Presence Architecture

- **Ephemeral In-Memory State:** Managed by `collaborationHub` (`apps/dashboard/src/lib/investigation/collaboration-hub.ts`).
- **No Database Thrashing:** Presence heartbeats update in-memory maps only; they are NOT written to `InvestigationActivity` or PostgreSQL database tables.
- **Coarse Investigation Area Tracking:** Tracks high-level contextual surfaces: `OVERVIEW`, `EVIDENCE`, `CAUSAL_CHAIN`, `EVIDENCE_GRAPH`, `TOPOLOGY`, `DIFFERENTIAL_TRACE`, `REPLAY`, `HYPOTHESES`, `RECOMMENDATION`. Zero pixel tracking or intrusive mouse coordinate broadcasting.

---

### 7. Activity Model

- **Model:** `prisma.investigationActivity`.
- **Types:** `MEMBER_JOINED`, `MEMBER_LEFT`, `COMMENT_ADDED`, `COMMENT_EDITED`, `COMMENT_DELETED`, `VERDICT_RECORDED`, `EVIDENCE_ANNOTATED`, `RELATIONSHIP_PROPOSED`.
- **Properties:** Append-oriented, server-generated timestamps (`createdAt`), foreign keys to `actorId` and `investigationId`, optional `targetType` and `targetId`.
- **Navigation Links:** Every activity entry provides anchor links directly into the referenced hypothesis, evidence, topology node, or causal edge.

---

### 8. Comment Model

- **Model:** `prisma.investigationComment`.
- **Contextual Targets:** `INVESTIGATION`, `HYPOTHESIS`, `EVIDENCE`, `CAUSAL_EDGE`, `TOPOLOGY_NODE`, `REPLAY`.
- **Content:** Markdown string, author name, timestamp, and optional `replayTimestampMs`.
- **Author Authorization:** Authors can edit their comments. Regular `MEMBER` users cannot edit or delete another user's comments. Admins/owners retain moderation deletion rights.

---

### 9. Evidence-Linked Annotation Model

- A comment targeting `EVIDENCE` or a verdict referencing evidence requires a real `evidenceId` (telemetry `Event.id`) existing within the project.
- Fabricated or cross-project event IDs are validated server-side and immediately rejected (`"One or more referenced evidence IDs do not exist in project telemetry"`).
- Clicking an evidence comment navigates directly to the span/event in the trace timeline or causal graph.

---

### 10. Hypothesis Collaboration

- Hypotheses rendered in `CausalChainView` dynamically mount `PeerVerdictCard` components.
- Engineers can review automated hypotheses, inspect supporting evidence items, and state positions.
- Human activity does not modify the underlying hypothesis score or automated confidence.

---

### 11. Human Verdict Model

- **Model:** `prisma.investigationVerdict`.
- **States:** `SUPPORTED`, `DISPUTED`, `NEEDS_EVIDENCE`, `UNRESOLVED`.
- **Constraints:** Uniquely keyed per `[investigationId, hypothesisId, authorId]`.
- **Reasoning & Proof:** Supports optional text reasoning and validated `evidenceReferences`.

---

### 12. System Root Cause vs Human Assessment

| Dimension | Halo Engine Root Cause | Human Peer Verdicts |
| :--- | :--- | :--- |
| **Origin** | Algorithmic telemetry correlation | Verified human engineering assessment |
| **Storage Field** | `Investigation.rootCause` | `InvestigationVerdict.verdict` |
| **Confidence Metric** | `Investigation.confidenceScore` (0–100%) | Human stance (`SUPPORTED`, `DISPUTED`, etc.) |
| **Voting Automations** | Strictly forbidden | Consensus visualized without engine override |
| **Engine Independence** | Remains `null` if telemetry confidence < 70% | Engineers can dispute/support freely |

---

### 13. Realtime Transport

- **Implementation:** Server-Sent Events (SSE) route at `/api/investigations/[id]/events`.
- **Push Pipeline:** Client opens a single persistent SSE connection. Actions trigger `collaborationHub.broadcast(investigationId, domainEvent)` which streams JSON data events to all connected clients.
- **Client Fallback:** If SSE disconnects, client periodically heartbeats via Server Actions and refreshes state on reconnect.

---

### 14. Reconnect Semantics

- On reconnect or page refresh, client invokes `getInvestigationCollaborationState(investigationId)`.
- Authoritative server state (active participants, comments, peer verdicts, durable activities) is returned in full.
- No stale client-side cache overwrites newer server state.

---

### 15. Idempotency

- Mutation APIs accept an optional client-generated `idempotencyKey`.
- If a client retries a comment or verdict submission over a fluctuating network, existing records with that key are retrieved and returned without creating duplicates.

---

### 16. Concurrency Control

- **Concurrent Comments:** Multiple engineers posting comments simultaneously persist as distinct rows in PostgreSQL without race collisions.
- **Concurrent Opposing Verdicts:** Handled via database `upsert` keyed on `[investigationId, hypothesisId, authorId]`. Both opposing stances remain visible simultaneously.
- **Tombstones:** Deleted comments set `isDeleted = true`, preventing dangling foreign key references and preserving activity history explainability.

---

### 17. API Changes

| Endpoint / Action | Method | Capability Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/investigations/[id]/events` | `GET` (SSE) | `TEAM_INVESTIGATION_ROOMS` | Realtime event stream for presence & collaboration |
| `getInvestigationCollaborationState` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Fetches presence, comments, verdicts, and activity |
| `sendPresenceHeartbeat` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Heartbeat updating ephemeral active presence |
| `addInvestigationComment` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Adds evidence-anchored contextual comment |
| `editInvestigationComment` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Updates comment text (author only) |
| `deleteInvestigationComment` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Tombstones comment (author or admin) |
| `recordPeerVerdict` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Records or updates human peer verdict |
| `proposeHumanRelation` | Server Action | `TEAM_INVESTIGATION_ROOMS` | Proposes human causal link (`HUMAN_PROPOSED`) |

---

### 18. Database Changes

The following schema extensions were added to `prisma/schema.prisma` and applied via `prisma db push`:
```prisma
enum InvestigationCommentTargetType {
  INVESTIGATION
  HYPOTHESIS
  EVIDENCE
  CAUSAL_EDGE
  TOPOLOGY_NODE
  REPLAY
}

enum PeerVerdictType {
  SUPPORTED
  DISPUTED
  NEEDS_EVIDENCE
  UNRESOLVED
}

enum InvestigationActivityType {
  MEMBER_JOINED
  MEMBER_LEFT
  COMMENT_ADDED
  COMMENT_EDITED
  COMMENT_DELETED
  VERDICT_RECORDED
  EVIDENCE_ANNOTATED
  RELATIONSHIP_PROPOSED
}

model InvestigationComment {
  id              String                         @id @default(cuid())
  investigationId String
  authorId        String
  authorName      String
  authorEmail     String
  targetType      InvestigationCommentTargetType @default(INVESTIGATION)
  targetId        String?
  evidenceId      String?
  replayTimestampMs Int?
  content         String
  isDeleted       Boolean                        @default(false)
  idempotencyKey  String?
  createdAt       DateTime                       @default(now())
  updatedAt       DateTime                       @updatedAt

  investigation   Investigation                  @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  author          User                           @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([investigationId, createdAt])
  @@index([authorId])
  @@index([idempotencyKey])
}

model InvestigationVerdict {
  id                 String          @id @default(cuid())
  investigationId    String
  hypothesisId       String
  authorId           String
  authorName         String
  authorEmail        String
  verdict            PeerVerdictType
  reasoning          String?
  evidenceReferences String[]        @default([])
  idempotencyKey     String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  investigation      Investigation   @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  author             User            @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@unique([investigationId, hypothesisId, authorId])
  @@index([investigationId])
  @@index([idempotencyKey])
}

model InvestigationActivity {
  id              String                    @id @default(cuid())
  investigationId String
  actorId         String
  actorName       String
  actorEmail      String
  type            InvestigationActivityType
  summary         String
  targetType      String?
  targetId        String?
  metadata        Json?
  createdAt       DateTime                  @default(now())

  investigation   Investigation             @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  actor           User                      @relation(fields: [actorId], references: [id], onDelete: Cascade)

  @@index([investigationId, createdAt])
  @@index([actorId])
}

model InvestigationProposedRelation {
  id              String        @id @default(cuid())
  investigationId String
  authorId        String
  sourceId        String
  targetId        String
  relationType    String
  classification  String        @default("HUMAN_PROPOSED")
  reasoning       String?
  evidenceIds     String[]      @default([])
  createdAt       DateTime      @default(now())

  investigation   Investigation @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  author          User          @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([investigationId])
}
```

---

### 19. Security Model

1. **Server-Side Capability Enforcement:** `requireCapability(orgId, "TEAM_INVESTIGATION_ROOMS")` blocks Free and Developer accounts with HTTP 403 / `TEAM_PLAN_REQUIRED`.
2. **Project Authorization:** Callers must have active membership in the organization owning the project.
3. **No Client Trust:** Client cannot inject `userId`, `organizationId`, or `projectId`.
4. **Role Escalation Protection:** Regular `MEMBER` users cannot edit or delete peers' comments.

---

### 20. Tenant Isolation

1. **Cross-Tenant Blocking:** Users from Organization A querying or mutating investigations in Organization B are rejected with `PROJECT_NOT_FOUND` or `ORGANIZATION_NOT_FOUND`.
2. **Telemetry Cross-Reference Validation:** Evidence IDs referenced in comments or peer verdicts must belong to the investigation's project.
3. **SSE Channel Security:** Subscribing to `/api/investigations/[id]/events` authenticates session and project authorization before opening the SSE stream.

---

### 21. UI Changes

- **`InvestigationCollaborativeRoom` (`apps/dashboard/src/components/investigation/collaboration/investigation-collaborative-room.tsx`):** Header bar displaying live active engineer avatars, area indicators, multi-tab counters, connection status, and sliding collaboration activity drawer.
- **`InvestigationActivityFeed` (`apps/dashboard/src/components/investigation/collaboration/investigation-activity-feed.tsx`):** Filterable activity feed (`ALL`, `COMMENTS`, `VERDICTS`, `EVIDENCE`) with timestamped chronological cards and direct anchor links.
- **`PeerVerdictCard` (`apps/dashboard/src/components/investigation/collaboration/peer-verdict-card.tsx`):** Rendered within each hypothesis card in `CausalChainView`. Displays Halo engine confidence alongside peer verdict chips, supporting reasoning, and interactive verdict buttons (`SUPPORT`, `DISPUTE`, `NEEDS EVIDENCE`).
- **`EvidenceCommentDrawer` (`apps/dashboard/src/components/investigation/collaboration/evidence-comment-drawer.tsx`):** Floating drawer enabling engineering comments anchored to specific telemetry events, topology services, or replay timestamps.
- **Sticky Nav Integration:** Added `Live Room` category and status indicator to `sticky-nav.tsx`.

---

### 22. Performance Findings

- **Zero DB Writes on Heartbeats:** Ephemeral presence uses in-memory maps with 25-second TTL.
- **Bounded Queries:** Activities and comments query indexed fields `[investigationId, createdAt]` bounded to the specific investigation.
- **Single Connection Architecture:** A single SSE stream per browser tab handles all investigation domain events.
- **Fast Build:** Next.js Turbopack production build compiled in 5.8s with zero TypeScript errors.

---

### 23. Test Matrix (Pillar C Collaboration Suite)

The dedicated test suite `scripts/test-pillar-c-collaboration.ts` covers 25 comprehensive checks:

| # | Test Name | Invariant Verified | Status |
| :---: | :--- | :--- | :---: |
| 1 | Test 53 | Developer plan blocked with `TEAM_PLAN_REQUIRED` | ✓ PASS |
| 2 | Test 54 | Team plan allowed to access collaboration state | ✓ PASS |
| 3 | Test 50 | Cross-organization user rejected from foreign investigation | ✓ PASS |
| 4 | Test 51 | Cross-organization comment injection rejected | ✓ PASS |
| 5 | Test 58 | Alice Tab 1 registers active presence | ✓ PASS |
| 6 | Test 59 | Same user with 2 browser tabs collapses into 1 engineer (`tabCount = 2`) | ✓ PASS |
| 7 | Test 58b | Multiple distinct engineers tracked concurrently in room | ✓ PASS |
| 8 | Test 58c | Ephemeral presence heartbeats are NOT persisted as durable activity logs | ✓ PASS |
| 9 | Test 18 | Fabricated evidence IDs are rejected from comment anchoring | ✓ PASS |
| 10 | Test 18b | Legitimate evidence-anchored comment successfully persisted | ✓ PASS |
| 11 | Test 33 | IdempotencyKey prevents duplicate comment creation on network retry | ✓ PASS |
| 12 | Test 54 | Concurrent comments from multiple engineers both persist without conflict | ✓ PASS |
| 13 | Test 52 | Member cannot edit another engineer's comment | ✓ PASS |
| 14 | Test 35 | Author can edit their own comment | ✓ PASS |
| 15 | Test 52b | Member is rejected when attempting to delete another engineer's comment | ✓ PASS |
| 16 | Test 36 | Deleted comments preserve tombstone history (`isDeleted: true`) | ✓ PASS |
| 17 | Test 22 | Fabricated evidence IDs are rejected from peer verdicts | ✓ PASS |
| 18 | Test 55 | Opposing peer verdicts remain concurrently visible without automatic conflict resolution | ✓ PASS |
| 19 | Test 64a | Human peer verdicts NEVER mutate canonical engine `rootCause` | ✓ PASS |
| 20 | Test 64b | Human peer verdicts NEVER overwrite deterministic `confidenceScore` | ✓ PASS |
| 21 | Test 63a | Human-suggested relation is strictly tagged as `HUMAN_PROPOSED` | ✓ PASS |
| 22 | Test 63b | Human-suggested relation is NEVER conflated with `OBSERVED` or `INFERRED` telemetry | ✓ PASS |
| 23 | Test 62 | Collaboration actions NEVER mutate underlying raw telemetry events | ✓ PASS |
| 24 | Test 13 | All meaningful collaboration actions recorded in activity stream | ✓ PASS |
| 25 | Test 31 | Activity stream maintains deterministic server-ordered timestamps | ✓ PASS |

---

### 24. Regression Results

All 5 existing test suites were executed sequentially against the updated codebase:

| Suite | Script | Checks | Result |
| :--- | :--- | :---: | :---: |
| **Phase 1 Team Foundation** | `test-phase1-foundation.ts` | 24 / 24 | **100% PASS** |
| **Pillar A Differential Trace** | `test-pillar-a-differential.ts` | 22 / 22 | **100% PASS** |
| **Pillar B Cross-Service Topology** | `test-pillar-b-topology.ts` | 25 / 25 | **100% PASS** |
| **Multi-Step Cascade & Replay** | `test-multistep-cascade.ts` | 33 / 33 | **100% PASS** |
| **Adversarial Concurrency Audit** | `test-adversarial-audit.ts` | 42 / 42 | **100% PASS** |
| **Pillar C Live Collaborative Rooms** | `test-pillar-c-collaboration.ts` | 25 / 25 | **100% PASS** |
| **GRAND TOTAL** | **ALL 6 SUITES** | **171 / 171** | **100% PASS** |

---

### 25. Known Limitations

1. **Distributed Horizontal Presence:** Presence state is currently maintained in-memory within the dashboard runtime (`collaborationHub`). In a multi-instance container deployment, Redis pub/sub or PostgreSQL `pg_notify` should back the hub to distribute presence across horizontal pods.
2. **Audio/Video Calls:** Outside project scope. Out-of-band communication tools (Google Meet, Slack Huddles) should be used alongside Halo investigation rooms.
3. **Pillar D Capabilities:** Intentionally excluded (organizational memory, incident similarity clustering, automated postmortems).

---

### 26. Files Changed

1. `prisma/schema.prisma` — Added models `InvestigationComment`, `InvestigationVerdict`, `InvestigationActivity`, `InvestigationProposedRelation` and enums.
2. `apps/dashboard/src/lib/capabilities.ts` — Registered `TEAM_COLLABORATIVE_INVESTIGATION` and `TEAM_INVESTIGATION_ROOMS`.
3. `apps/dashboard/src/lib/session.ts` — Added `HALO_TEST_USER_EMAIL` override for headless integration tests.
4. `apps/dashboard/src/lib/investigation/collaboration-hub.ts` — In-memory presence manager with TTL, multi-tab deduplication, and SSE broadcaster.
5. `apps/dashboard/src/actions/collaboration.ts` — Server Actions for presence heartbeats, evidence-anchored comments, peer verdicts, and human relations.
6. `apps/dashboard/src/app/api/investigations/[id]/events/route.ts` — Realtime Server-Sent Events route.
7. `apps/dashboard/src/components/investigation/collaboration/investigation-collaborative-room.tsx` — Live room presence header & SSE subscriber.
8. `apps/dashboard/src/components/investigation/collaboration/investigation-activity-feed.tsx` — Append-oriented collaborative activity drawer.
9. `apps/dashboard/src/components/investigation/collaboration/peer-verdict-card.tsx` — Human peer verdict card with engine separation.
10. `apps/dashboard/src/components/investigation/collaboration/evidence-comment-drawer.tsx` — Contextual comment composer.
11. `apps/dashboard/src/components/investigation/causal-chain-view.tsx` — Embedded `PeerVerdictCard` into hypothesis cards.
12. `apps/dashboard/src/components/investigation/sticky-nav.tsx` — Added Live Room navigation item.
13. `apps/dashboard/src/app/(dashboard)/projects/[id]/investigations/new/page.tsx` — Wired durable investigation creation with collaborative room header.
14. `scripts/test-pillar-c-collaboration.ts` — 25-check verification suite.

---

### 27. Final Verification

- [x] **Phase 1 remains passing (24/24)**
- [x] **Pillar A remains passing (22/22)**
- [x] **Pillar B remains passing (25/25)**
- [x] **Multi-step cascade remains passing (33/33)**
- [x] **Adversarial audit remains passing (42/42)**
- [x] **Pillar C collaboration suite passes (25/25)**
- [x] **Team collaboration capability is server-enforced (`TEAM_PLAN_REQUIRED`)**
- [x] **Developer cannot bypass collaboration APIs**
- [x] **Free cannot bypass collaboration APIs**
- [x] **Organization and project tenant isolation works**
- [x] **Presence is real and expires on heartbeat TTL**
- [x] **Multiple tabs from the same user collapse to 1 engineer with `tabCount`**
- [x] **Activity is durable; presence is not persisted to activity table**
- [x] **Comments are investigation-contextual and anchor to real evidence**
- [x] **Fabricated evidence IDs are rejected**
- [x] **Human-proposed relations are strictly tagged `HUMAN_PROPOSED`**
- [x] **Human peer verdicts are distinct from Halo confidence**
- [x] **Human peer verdicts NEVER overwrite or mutate engine `rootCause` or `confidenceScore`**
- [x] **Concurrent comments and opposing verdicts persist without collision**
- [x] **Realtime updates stream via SSE without reloading the page**
- [x] **Collaboration actions cannot mutate raw telemetry or replay events**
- [x] **No generic chat, Slack clone, or future Pillar D features implemented**
- [x] **TypeScript passes cleanly with 0 errors**
- [x] **Production build passes cleanly**
