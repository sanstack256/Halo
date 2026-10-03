# HALO TRACE — PHASE 8 FORENSIC ENGINEERING REPORT
## Pillar G — Evidence Synthesis & Investigation Reasoning

---

## 1. Executive Summary

Phase 8 / Pillar G implements **Evidence Synthesis & Investigation Reasoning** in Halo Trace.

The core mission of Pillar G is to transform the heterogeneous evidence produced across Pillars 1 through F (Runtime Failure Reconstruction, Differential Trace Analysis, Cross-Service Topology, User Session Replay, Collaborative Rooms, Failure Memory, Ownership Intelligence, and Change Intelligence) into a **deterministic, inspectable investigation synthesis**.

Pillar G answers the central question:
> **Given everything Halo has actually observed, what is established, what is supported by multiple independent evidence dimensions, what is contradicted, and what remains unknown?**

Key achievements:
- **Zero Hallucination / Zero Speculation:** Missing data is explicitly characterized as `UNKNOWN`, `NOT_OBSERVED`, or `UNAVAILABLE`.
- **Zero Blame:** Strictly maintains the invariant that author $\ne$ owner $\ne$ participant $\ne$ culprit. No developer fault attribution or blame ranking is generated.
- **Root Cause & Confidence Immutability:** The canonical investigation conclusions (`investigation.rootCause` and `investigation.confidenceScore`) remain authoritative and 100% immutable. Pillar G synthesizes evidence *around* the canonical conclusion; it never replaces, upgrades, or recalculates it.
- **Deterministic Independence:** Raw telemetry repetition does not inflate support. Multiple runtime events belong to a single source category (`RUNTIME`). True independence requires distinct source categories (`RUNTIME`, `CHANGE`, `DIFFERENTIAL`, `DEPLOYMENT`, `TOPOLOGY`, `OWNERSHIP`, `MEMORY`, `COLLABORATION`).
- **Comprehensive Verification:** 70 / 70 adversarial checks in the Pillar G test suite passed (100%). Across all 10 suites in the regression matrix, 341 / 341 checks passed (100%).

---

## 2. Existing Evidence Architecture

Halo Trace previously captured evidence across independent subsystems:
- **Telemetry & Traces:** Error events, request IDs, W3C trace contexts, breadcrumbs, and multi-runtime stack frames.
- **Pillar A (Differential Trace Analysis):** Contrast between failing executions and healthy baseline runs, isolating duration deltas, novel parameters, and structural execution halts.
- **Pillar B (Cross-Service Topology):** Microservice dependency graphs, failure propagation paths, and error concentration heatmaps.
- **Pillar C (Collaborative Rooms):** Live multi-engineer presence, evidence-anchored annotations, and peer verdicts.
- **Pillar D (Organizational Failure Memory):** Recurring failure patterns, historical incident signatures, and automated postmortems.
- **Pillar E (Ownership Intelligence):** Declared team ownership from CODEOWNERS, service configuration catalogs, and conflict detection.
- **Pillar F (Change Intelligence):** Correlated Git commits, pull requests, deployments, line-level diff intersections, and temporal windows.

Prior to Pillar G, engineers had to manually traverse these distinct panels to synthesize what happened. Pillar G unifies these streams into a cohesive, evidence-backed narrative.

---

## 3. Pillar G Boundary

### What Pillar G Owns:
- Evidence normalization across pillars into canonical evidence claims.
- Explicit synthesis status determination: `ESTABLISHED`, `SUPPORTED`, `CONTRADICTED`, `UNKNOWN`, `UNAVAILABLE`.
- Independent evidence verification without record count inflation.
- Surfacing contradictions and explicit unknowns.
- Minimum sufficient evidence chain reconstruction.
- Structured 9-part investigation narrative generation.
- Evidence provenance tracking with inspectable references.

### What Pillar G Explicitly Does NOT Own:
- Does NOT collect raw telemetry, git commits, or topology spans.
- Does NOT replace or recalculate root cause or confidence scores.
- Does NOT execute automatic remediation (no rollback, no ticket creation, no alerts).
- Does NOT introduce generic chatbots or free-form LLM speculation.
- Does NOT attribute blame or fault to developers.

---

## 4. Evidence Status Model

Pillar G establishes a strict deterministic vocabulary:

1. **`ESTABLISHED`:** Directly observed from authoritative telemetry or deterministic records.
   - *Examples:* Telemetry error event occurred, stack trace frame executed, release deployment recorded, commit exists in repository, service registered in catalog.
2. **`SUPPORTED`:** Not directly observed as a single self-contained fact, but verified by the convergence of multiple independent evidence dimensions ($\ge 2$).
   - *Example:* Suspect commit intersects failing service, code path intersects stack frame, and differential baseline diverged.
3. **`CONTRADICTED`:** A proposed relationship is directly weakened or disconfirmed by verified evidence.
   - *Example:* Commit authored before failure, but modified files belong to an unrelated repository/service that does not intersect the failing stack.
4. **`UNKNOWN`:** The system lacks sufficient evidence to determine the relationship.
   - *Example:* Direct production causal link between commit and runtime failure was not observed.
5. **`UNAVAILABLE`:** The relevant source could not be accessed or does not exist.
   - *Example:* Source maps missing, deployment pipeline telemetry not configured.

*Invariants:* `UNKNOWN` is never collapsed into `CONTRADICTED`. `UNAVAILABLE` is never silently treated as false.

---

## 5. Evidence Claim Model

Synthesized claims are represented deterministically by `EvidenceClaim` in `apps/dashboard/src/lib/evidence-synthesis/types.ts`:

```typescript
export interface EvidenceClaim {
    claimId: string;
    investigationId: string;
    statement: string;
    status: EvidenceStatus;
    sourceTypes: EvidenceSourceType[];
    evidenceReferences: EvidenceReference[];
    supportingClaims: string[];
    contradictingClaims: string[];
    independentSourceCount: number;
    firstObservedAt?: string | Date;
    lastObservedAt?: string | Date;
    relatedServices: string[];
    relatedOperations: string[];
    relatedCodePaths: string[];
    metadata?: Record<string, unknown>;
}
```

Every claim is traceable to canonical evidence. Claims without evidence references are invalid and rejected during synthesis.

---

## 6. Evidence Source Taxonomy

Pillar G normalizes all existing pillar outputs into explicit source categories:
- `RUNTIME`: Application error events, exceptions, durations, and HTTP statuses.
- `TRACE`: W3C distributed trace spans and request identifiers.
- `STACK`: Parsed application call frames, line numbers, and functions.
- `DIFFERENTIAL`: Contrast against healthy baseline executions.
- `TOPOLOGY`: Service dependencies, directed call edges, and propagation paths.
- `REPLAY`: Recorded user interaction chunks, DOM mutations, and network requests.
- `CHANGE`: Git commits, diff hunks, branches, and modified files.
- `DEPLOYMENT`: Release versions, build commit SHAs, and deployment timestamps.
- `OWNERSHIP`: CODEOWNERS rules, service catalogs, and declared team owners.
- `MEMORY`: Historical incident matches, recurring patterns, and postmortems.
- `COLLABORATION`: Peer verdicts and investigator notes.
- `POSTMORTEM`: Factual retrospective summaries.

---

## 7. Independent Evidence Semantics

To prevent false confidence, Pillar G strictly differentiates raw record volume from independent evidence dimensions:
- 100 telemetry events all belong to `RUNTIME` $\rightarrow$ `independentSourceCount = 1`.
- 1 runtime error + 1 git commit $\rightarrow$ `independentSourceCount = 2` (`RUNTIME` + `CHANGE`).
- 1 runtime error + 1 differential divergence $\rightarrow$ `independentSourceCount = 2` (`RUNTIME` + `DIFFERENTIAL`).
- 1 commit + 1 release deployment $\rightarrow$ `independentSourceCount = 2` (`CHANGE` + `DEPLOYMENT`).

Support is earned through multi-dimensional convergence across categories, never through record repetition.

---

## 8. Evidence Chain

Pillar G implements a deterministic evidence chain connecting the incident onset to underlying code and deployment boundaries:

```text
FAILURE (Runtime)
  ↓ [OBSERVED_IN]
SERVICE (Topology)
  ↓ [PROPAGATED_TO]
STACK FRAME (Stack)
  ↓ [INTERSECTS]
CHANGED FILE (Change)
  ↓ [CORRELATED_WITH]
COMMIT (Change)
  ↓ [DEPLOYED_AS]
DEPLOYMENT (Deployment)
```

Every edge includes:
- `from`, `to` node IDs
- `relationship`: `OBSERVED_IN`, `CAUSED_EXECUTION_OF`, `CALLED`, `PROPAGATED_TO`, `INTERSECTS`, `DEPLOYED_AS`, `OWNED_BY`, `CORRELATED_WITH`, `TEMPORALLY_RELATED`
- `status`: `OBSERVED`, `SUPPORTED`, `INFERRED`, `UNKNOWN`, `CONTRADICTED`
- `evidenceReferences` with non-empty provenance
- `evidenceCount`

---

## 9. Cross-Pillar Correlation

Pillar G deterministically connects evidence across pillar boundaries:
- **Runtime $\leftrightarrow$ Change:** Failing stack file (`src/services/checkout.ts:184`) matched with Git modified file path.
- **Change $\leftrightarrow$ Deployment:** Suspect commit SHA matched with release build SHA.
- **Service $\leftrightarrow$ Ownership:** Primary failing service mapped to declared team owner.
- **Runtime $\leftrightarrow$ Topology:** Affected service boundaries and propagation paths.
- **Incident $\leftrightarrow$ Memory:** Failure signature matched with historical incident memory.
- **Investigation $\leftrightarrow$ Collaboration:** Peer verdicts and investigator notes preserved with author attribution.

---

## 10. Claim Deduplication

Equivalent statements targeting the same entities are merged:
- Equivalent claims combine their `evidenceReferences`.
- Unique source categories are aggregated.
- `independentSourceCount` is recalculated based on unique categories.
- Status is preserved or upgraded if independent evidence warrants support.

---

## 11. Claim Conflicts

When evidence sources disagree, Pillar G highlights the conflict rather than silently resolving it:
- CODEOWNERS declaring Team Payments vs. manual configuration declaring Team Logistics $\rightarrow$ `CONTRADICTED` with references to both sources.
- Opposing peer verdicts (e.g. `SUPPORTED` vs `DISPUTED`) remain concurrently visible in the collaboration context.

---

## 12. Unknown Handling

Unknowns are first-class investigation deliverables:
- Missing deployment records $\rightarrow$ `UNAVAILABLE`.
- Missing source maps $\rightarrow$ `UNAVAILABLE`.
- Direct causal proof between change and failure $\rightarrow$ `UNKNOWN`.
- No matching historical incident $\rightarrow$ `UNKNOWN`.

---

## 13. Contradiction Handling

Contradictory evidence is surfaced in a dedicated narrative section and badge:
- Commits authored prior to failure in unrelated repositories are marked `CONTRADICTED` and explained.
- Contradictions prevent relationships from being upgraded to `STRONGLY_SUPPORTED`.

---

## 14. Support Determination

A claim or relationship achieves `SUPPORTED` status when:
1. Multiple independent source dimensions ($\ge 2$) converge on the relationship.
2. No direct contradiction disconfirms the relationship.
3. The relationship is not directly observable as a single self-contained atomic event.

---

## 15. Evidence Explainability

Every supported conclusion exposes:
- **Supporting evidence:** Specific dimensions verifying the conclusion (`Runtime Telemetry`, `Stack Execution`, `Change Intelligence`, `Deployment Telemetry`).
- **Contradicting evidence:** Any conflicting observations.
- **Missing evidence:** Specific telemetry streams that were absent (`Direct Production Causal Proof`, `Production Deployment Telemetry`).

---

## 16. Root Cause Presentation

Pillar G displays the canonical root cause from `investigation.rootCause`. It strictly enforces:
- `rootCause` is never overwritten, modified, or regenerated.
- `confidenceScore` is never inflated, decreased, or altered.
- Pillar G contextualizes the canonical conclusion with supporting evidence dimensions.

---

## 17. Root Cause Evidence Mapping

Pillar G maps all active evidence dimensions around the root cause:
- **Observed Sources:** `RUNTIME`, `STACK`, `CHANGE`, `DEPLOYMENT`, `OWNERSHIP`, `MEMORY`, `COLLABORATION`.
- **Supported Dimensions:** Specific pillars verifying the conclusion.
- **Unknown Dimensions:** Explicitly acknowledged epistemic boundaries.

---

## 18. Causal Chain Presentation

Pillar G consumes the existing causal chain from the investigation engine, enriching every edge with verified evidence references, timestamps, and causal classifications (`Observed`, `Inferred`).

---

## 19. Investigation Narrative

The investigation narrative is assembled deterministically from structured claims into 9 cohesive sections:
1. What happened
2. Where it happened
3. How the failure propagated
4. What changed
5. Why Halo supports the investigation conclusion
6. What contradicts it
7. Historical context
8. Ownership context
9. What remains unknown

---

## 20. "What Happened"

Contains only established facts observed in authoritative runtime telemetry:
- Exact occurrence timestamps.
- Service and operation names.
- Exceptions, error types, and HTTP status codes.

---

## 21. "How the Failure Propagated"

Traces the execution path from entry boundary to exception:
- Request entry into service.
- Function calls across stack frames.
- Propagation to client/gateway boundary.

---

## 22. "What Changed"

Synthesizes change observations:
- Correlated commits and pull requests.
- Modified files intersecting the stack.
- Deployed releases.
- Explicit note if no changes were observed.

---

## 23. "Why Halo Supports the Investigation Conclusion"

Presents the multi-dimensional independent evidence chain:
- Runtime stack execution proof.
- Change intelligence diff intersection.
- Deployment timeline alignment.
- Differential divergence from baseline.

---

## 24. "What Contradicts It"

Explicitly surfaces any contradictory evidence:
- Unrelated repository modifications.
- Non-intersecting code paths.
- Ownership configuration conflicts.
- If none: "No contradicting evidence observed."

---

## 25. "What Remains Unknown"

Documents the exact boundaries of system knowledge:
- Direct production causality proof: `UNKNOWN`.
- Unconfigured deployment pipelines: `UNAVAILABLE`.
- Truncated stack traces / missing source maps: `UNAVAILABLE`.

---

## 26. Historical Context

Presents organizational failure memory as comparative context, never as current causation:
- Matches with recurring failure signatures.
- Explicitly labeled: "(Historical context only; not current cause)".

---

## 27. Ownership Context

Exposes declared engineering ownership for affected services:
- Declared team from CODEOWNERS or service catalog.
- Conflict state if declarations disagree.
- Zero blame terminology: author $\ne$ owner $\ne$ culprit.

---

## 28. Collaboration Context

Integrates human investigator actions while preserving the boundary between system telemetry and human opinion:
- Peer verdicts and comments are attributed to authors.
- Human notes are tagged `isHumanAssertion: true` and never converted into system telemetry facts.

---

## 29. Evidence Provenance

Every synthesized claim and chain edge includes inspectable provenance:
- Target ID (event ID, commit SHA, release ID).
- Source category.
- Timestamp and metadata.
- Interactive provenance inspector modal in the UI.

---

## 30. UI Integration

- **Component:** `EvidenceSynthesisPanel` mounted in `apps/dashboard/src/components/investigation/synthesis/evidence-synthesis-panel.tsx`.
- **Location:** Anchored to `#section-evidence-synthesis` in `projects/[id]/investigations/new/page.tsx`.
- **Sticky Navigation:** Integrated into `InvestigationStickyNav` under the `synthesis` category.
- **Aesthetics:** Dense, developer-focused, using Halo dark tokens with clear semantic status badges (`ESTABLISHED`, `SUPPORTED`, `CONTRADICTED`, `UNKNOWN`, `UNAVAILABLE`).

---

## 31. Server Actions

Exported from `apps/dashboard/src/actions/evidence-synthesis.ts`:
- `getInvestigationSynthesis(investigationId: string)`: Resolves full deterministic evidence synthesis.
- `getEvidenceClaim(claimId: string, projectId: string)`: Retrieves details for a specific claim within an investigation.
- `getEvidenceChain(investigationId: string)`: Resolves the minimum sufficient evidence chain.

All actions enforce user authentication, project access, tenant isolation, and capability verification.

---

## 32. Capability Enforcement

Registered `TEAM_EVIDENCE_SYNTHESIS` in `apps/dashboard/src/lib/capabilities.ts`:
- `minimumPlan: "TEAM"`
- Server actions call `requireCapability(organizationId, "TEAM_EVIDENCE_SYNTHESIS")`.
- Developer and Free plans are strictly blocked with `TEAM_PLAN_REQUIRED`.

---

## 33. Tenant Isolation

- Authorization checks query the owning organization of the investigation and project.
- Cross-tenant requests are rejected with `NOT_A_MEMBER` or authorization errors.
- In-memory synthesis cache keys are scoped to `${organizationId}::${projectId}::${investigationId}`.

---

## 34. Security Audit

- **Secret Scrubbing:** All tokens (`ghp_`, `github_pat_`, Bearer tokens, secrets, API keys) are sanitized to `[REDACTED]` in statements and provenance labels.
- **Path Sanitization:** File paths are sanitized via `sanitizeRepositoryPath` to prevent directory traversal.
- **Authorization Propagation:** Access to synthesis requires access to the project; unauthorized users cannot bypass access rules via synthesis actions.

---

## 35. Performance Audit

- **Derived Architecture:** Synthesis is derived on demand, avoiding database bloat and schema migrations.
- **Batch Queries:** Batches retrieval of events, ownerships, changes, and replay records in parallel using `Promise.all`.
- **Tenant-Scoped Cache:** 60-second in-memory cache prevents redundant synthesis during rapid UI re-renders.
- **Cascade Clean:** Deleting an investigation immediately eliminates derived synthesis with zero orphan risk.

---

## 36. Adversarial Test Matrix

All 70 tests in `scripts/test-pillar-g-evidence-synthesis.ts` verified:

| Test Group | Test Cases | Status |
| :--- | :--- | :--- |
| **Group 1: Access Control** | Tests 1–5: Developer blocked, Free blocked, Team allowed, Cross-org rejected, Cross-project rejected | **PASS (5/5)** |
| **Group 2: Claim Creation** | Tests 6–10: Established fact, No-evidence rejection, Deduplication, Multi-source merge, Unknown preservation | **PASS (5/5)** |
| **Group 3: Independence** | Tests 11–15: Event counting rejected, Runtime+Change, Runtime+Diff, Change+Deploy, Redundant source rejected | **PASS (5/5)** |
| **Group 4: Status** | Tests 16–22: Observation $\rightarrow$ ESTABLISHED, Multi-dim $\rightarrow$ SUPPORTED, Contradiction $\rightarrow$ CONTRADICTED, Insufficient $\rightarrow$ UNKNOWN, Provider $\rightarrow$ UNAVAILABLE, UNKNOWN $\ne$ CONTRADICTED, UNAVAILABLE $\ne$ false | **PASS (7/7)** |
| **Group 5: Evidence Chain** | Tests 23–30: Chain reconstructed, Service preserved, Code-path preserved, Change attached, Deploy attached, Unverified rejected, Chronology $\ne$ Causality, Provenance on all edges | **PASS (8/8)** |
| **Group 6: Cross-Pillar** | Tests 31–37: Pillar A diff, Pillar B topo, Pillar C human assertions, Pillar D memory context, Pillar E ownership, Pillar F change, Replay observational | **PASS (7/7)** |
| **Group 7: Root Cause** | Tests 38–43: RootCause immutable, Confidence immutable, No replacement, No confidence increase, No confidence decrease, Causal root preserved | **PASS (6/6)** |
| **Group 8: Contradictions** | Tests 44–48: Contradicting service surfaced, Contradicting path surfaced, Contradicting change surfaced, Conflicting ownership visible, Narrative preserves contradictions | **PASS (5/5)** |
| **Group 9: Unknown Data** | Tests 49–53: Missing deploy UNAVAILABLE, Missing stack UNAVAILABLE, Code-path unavailable preserved, Missing memory UNKNOWN, No fabricated evidence | **PASS (5/5)** |
| **Group 10: Security/Cache**| Tests 54–57: Cross-tenant cache isolation, Evidence authorization, Secret sanitization, Deletion cascade safety | **PASS (4/4)** |
| **Group 11: Determinism** | Tests 58–60: Synthesis idempotent, Identical claims on same data, Evidence changes reflect in synthesis | **PASS (3/3)** |
| **Group 12: Narrative** | Tests 61–65: What Happened established-only, Why Supported has references, Contradictions surfaced, Unknowns explicit, No fake causal claims | **PASS (5/5)** |
| **Group 13: No-Blame/No-AI**| Tests 66–70: Author $\ne$ culprit, Owner $\ne$ culprit, Human note $\ne$ system fact, No generic chatbot, No automatic remediation | **PASS (5/5)** |
| **Total** | **70 Checks** | **PASS (70/70)** |

---

## 37. Regression Results

All 10 test suites executed against the active codebase and database:

```text
Phase 1 (Foundation):                     24 / 24  PASS (100%)
Pillar A (Differential Trace):             22 / 22  PASS (100%)
Pillar B (Cross-Service Topology):         25 / 25  PASS (100%)
Pillar C (Collaborative Investigation):    25 / 25  PASS (100%)
Cascade & Replay (Multi-Step):             33 / 33  PASS (100%)
Adversarial Concurrency Audit:             42 / 42  PASS (100%)
Pillar D (Organizational Failure Memory):  25 / 25  PASS (100%)
Pillar E (Ownership Intelligence):         27 / 27  PASS (100%)
Pillar F (Change Intelligence):            48 / 48  PASS (100%)
Pillar G (Evidence Synthesis):             70 / 70  PASS (100%)
----------------------------------------------------------------
Grand Total:                              341 / 341 PASS (100%)
```

---

## 38. Files Changed

1. `apps/dashboard/src/lib/capabilities.ts`: Added `TEAM_EVIDENCE_SYNTHESIS` to `TeamCapability` and `CAPABILITY_METADATA` (`minimumPlan: "TEAM"`).
2. `apps/dashboard/src/lib/evidence-synthesis/types.ts`: Created domain types for `EvidenceStatus`, `EvidenceSourceType`, `EvidenceClaim`, `EvidenceChain`, `EvidenceChainNode`, `EvidenceChainEdge`, and `InvestigationNarrative`.
3. `apps/dashboard/src/lib/evidence-synthesis/synthesis-engine.ts`: Created deterministic evidence synthesis engine with tenant caching, claim deduplication, contradiction handling, and 9-part narrative construction.
4. `apps/dashboard/src/actions/evidence-synthesis.ts`: Created authenticated, tenant-scoped server actions: `getInvestigationSynthesis`, `getEvidenceClaim`, `getEvidenceChain`.
5. `apps/dashboard/src/components/investigation/synthesis/evidence-synthesis-panel.tsx`: Created evidence synthesis UI panel with 9-part narrative view, interactive minimum sufficient chain, and structured claims.
6. `apps/dashboard/src/components/investigation/sticky-nav.tsx`: Added `synthesis` category and icon to sticky navigation.
7. `apps/dashboard/src/app/(dashboard)/projects/[id]/investigations/new/page.tsx`: Gated and mounted `EvidenceSynthesisPanel` for Team plan organizations.
8. `scripts/test-pillar-g-evidence-synthesis.ts`: Created 70-check adversarial test suite covering all specified requirements.

---

## 39. Known Limitations

- **Source Map Availability:** When client or server telemetry lacks source maps, stack frame execution paths remain explicitly `UNAVAILABLE`.
- **Git Provider Connectivity:** Repositories not yet connected via GitHub OAuth or lacking change observations will report change telemetry as `UNAVAILABLE` rather than hallucinating changes.
- **External Causal Limits:** In accordance with epistemic honesty, direct causal proof linking a commit to a production crash remains `UNKNOWN` unless formally observed in trace propagation.

---

## 40. Final Verification

- All 70 Pillar G adversarial checks pass (100%).
- All 271 baseline regression checks pass (100%).
- Combined test total: **341 / 341 PASS (100%)**.
- Next.js production build (`pnpm --filter dashboard build`) compiles with zero TypeScript errors and zero lint errors.
- Canonical investigation conclusions (`rootCause`, `confidenceScore`) remain 100% immutable.
- Zero blame terminology, zero generic chatbots, and zero automatic remediation mechanisms introduced.
- Phase 8 / Pillar G is **COMPLETE**.
