# HALO TRACE — PHASE 7 / PILLAR F FORENSIC MASTER REPORT
## Change Intelligence & Causal Change Analysis

---

### 1. Executive Summary

Phase 7 implements **Pillar F: Change Intelligence & Causal Change Analysis** for Halo Trace. The core mission of this pillar is to allow Halo to answer:
> *"What changed in the system before this failure, which parts of those changes intersect with the observed failure, and what evidence supports or weakens that relationship?"*

The system establishes a multi-dimensional evidence correlation engine that strictly distinguishes:
```text
CHANGE OBSERVED
        ↓
CHANGE TEMPORALLY RELATED
        ↓
CHANGE AFFECTS RELEVANT SERVICE
        ↓
CHANGE INTERSECTS RELEVANT CODE PATH
        ↓
BEHAVIORAL DIVERGENCE OBSERVED
        ↓
CAUSAL RELATIONSHIP SUPPORTED BY EVIDENCE
```

#### Core Invariants Enforced:
1. **Temporal Proximity ≠ Causation:** Temporal proximity is evaluated as merely one signal. Changes occurring before failure without service or code path intersection remain strictly `TEMPORALLY_RELATED` and are never called causal.
2. **Author ≠ Owner ≠ Culprit:** Commit authors appear exclusively as historical metadata. No author ranking, developer blame scores, or culprit metrics exist.
3. **No Fake Telemetry:** Unobserved commits, deployments, PRs, or lines are represented as `UNKNOWN`, `NOT_OBSERVED`, or `UNAVAILABLE`.
4. **Contradictions Explicitly Weakened & Surfaced:** If a change occurred in the same service but modified files outside the reconstructed failing stack, contradictions are explicitly surfaced and prevent false upgrades.
5. **Root Cause & Confidence Immutability:** Change intelligence operations NEVER modify canonical `investigation.rootCause` or `investigation.confidenceScore`.
6. **No Automatic Remediation or Chatbots:** No automatic rollbacks, code mutators, or generic AI chat features are introduced.

---

### 2. Existing Change Architecture

Prior to Phase 7:
- Basic regression detection (`regression-detector.ts`) existed to scan GitHub commits for the earliest appearance of an issue, but lacked multi-dimensional evidence dimensions, line-level hunk evaluation, explicit contradiction surfacing, durable database persistence, and integration with Pillars B, C, D, and E.
- The `Release` model tracked deployment versions and event counts, but was not structurally linked to unified change candidate representations.

Phase 7 establishes a unified, durable change evidence pipeline without creating duplicate investigation models or mutating existing conclusions.

---

### 3. Change Sources

Supported canonical change sources:
- `GIT_COMMIT`: Verified repository commits containing commit SHA, author, timestamp, parent SHA, and diff patches.
- `DEPLOYMENT_EVENT`: Production rollout records linked to versions or commit SHAs.
- `PULL_REQUEST`: Pull request metadata, merge timestamps, and branch references.
- `CONFIGURATION_CHANGE`: Service configuration updates (e.g. database pool timeouts, thread limits).
- `DEPENDENCY_CHANGE`: Package and library upgrades (e.g. SDK version increments).
- `FEATURE_FLAG_CHANGE`: Dynamic flag toggles and percentage rollouts.

---

### 4. Git Evidence Collection

The Git evidence collector (`apps/dashboard/src/lib/change-intelligence/git-collector.ts`):
- Connects directly to project-configured GitHub repositories (`githubRepoOwner`, `githubRepoName`, `githubToken`).
- Scopes commit queries strictly to the investigation window.
- Retains parent commit SHA, short SHA, commit message, author name, author date, and detailed file patch hunks.
- Implements tenant-scoped caching (`${organizationId}::${projectId}::...`) with a 60s TTL to prevent cross-tenant cache leakage.
- Safely handles missing repository credentials or network errors by returning structured unavailable states (`hasGitConfig: false`) rather than manufacturing fake commits.

---

### 5. Deployment Evidence

- Reuses existing `Release` telemetry and `ChangeObservation` records with `sourceType = DEPLOYMENT_EVENT`.
- Correlates releases using exact `commitSha` matching or `deploymentReference` equality.
- When deployment telemetry is absent, the engine explicitly outputs `deploymentLinkage = "NOT_OBSERVED"` and logs an uncertainty notice (`"Deployment evidence not observed in release telemetry"`).

---

### 6. Change Timeline

Constructs a strictly sorted chronological timeline of:
- `COMMIT`
- `DEPLOYMENT`
- `CONFIGURATION`
- `FEATURE_FLAG`
- `FAILURE_ONSET` (derived from the first ERROR or anomaly event in telemetry)

Chronology alone does not produce causal classification; each item retains explicit provenance and relationship tags.

---

### 7. Service Association

Associates changes with services exclusively through verified evidence:
- Explicit `serviceAssociation` recorded on the change observation.
- Repository configuration matching `ServiceOwnership.repositoryUrl`.
- Deployment metadata linking the change to a specific service.
Unrelated repositories or services are classified with `serviceIntersection = "NONE"` and flagged as contradictions.

---

### 8. Code Path Association

Extracts failing file locations from:
- Telemetry event metadata (`metadata.filePath`, `metadata.filename`).
- Stack traces (`event.stack`) parsed into relative paths and line numbers.
Paths are normalized and matched using `doesPathIntersect()`:
- Exact path matches.
- Suffix segment matches (e.g., `src/payments/checkout.ts` intersects `payments/checkout.ts`).
- Dissimilar files (e.g. `pages/index.tsx` vs `src/payments/checkout.ts`) yield `fileIntersection = "NONE"`.

---

### 9. Line-Level Intersection

Evaluates unified diff patches against the failing stack frame's line number:
- `HIGH`: Failing line number falls directly within an added/modified hunk range (`@@ -a,b +c,d @@`).
- `MEDIUM`: Failing line number is within 10 lines of a modified hunk range.
- `NONE`: Patch is present, but failing line is distant from modified hunks (weakening signal).
- `UNAVAILABLE`: When only file-level evidence exists (no patch or no stack line number). It is NEVER defaulted to `false`.

---

### 10. Behavioral Differential

Integrates with Pillar A Differential Trace Analysis:
- Compares failing execution durations and status codes against historical baselines for the same service and operation.
- If runtime divergence is mathematically isolated in the area touched by the change, `behavioralDivergence` is rated `HIGH`.
- If baseline data is missing, it is rated `INSUFFICIENT_EVIDENCE`. Absence of divergence is never treated as proof of absence of causality.

---

### 11. Change Relationship Classification

The deterministic classification hierarchy:
1. Outside window / post-failure: `UNRELATED`.
2. Within window: `TEMPORALLY_RELATED`.
3. Within window + same affected service: `SERVICE_RELATED`.
4. Same service + changed file intersects failing path: `CODE_PATH_RELATED`.
5. Intersecting code path + differential divergence: `BEHAVIORALLY_RELATED`.
6. Multiple independent dimensions (temporal + service + code path + differential + deployment linkage): `STRONGLY_SUPPORTED`.

---

### 12. Contradictory Evidence

Surfaces contradictions explicitly:
- Commit occurred before failure BUT targeted an unaffected service.
- Commit targeted the failing service BUT touched files unrelated to the failing stack.
- Failing stack line was outside modified diff hunks.
Contradictions downgrade relationships and are displayed prominently in the investigation UI.

---

### 13. Change Evidence Explainability

Every change candidate includes a structured `ChangeEvidenceExplanation`:
- `matchingSignals`: Verified signals (e.g., `"Change occurred 4m before failure"`, `"Modified line range intersects failing stack"`).
- `missingSignals`: Unobserved dimensions (e.g., `"Direct production causality evidence not observed"`).
- `contradictingSignals`: Disconfirming evidence.
- `evidenceReferences`: Trace and event IDs backing the analysis.
- `explanation`: Human-readable summary synthesized from active evidence.

---

### 14. Multiple Change Handling

When multiple changes occur within the investigation window:
- All candidates are preserved independently.
- Candidates are sorted deterministically by relationship strength, then author timestamp.
- No candidate is picked as a "single culprit."

---

### 15. Deployment-to-Commit Mapping

- Direct linkage when `release.commitSha === cand.commitSha`.
- Revision linkage when `cand.deploymentReference === release.version`.
- The engine never guesses that the latest commit equals the deployed commit.

---

### 16. Pull Request Context

When pull request metadata exists:
- Captures PR number, title, author, and merge timestamp.
- Missing PR metadata is rendered as `null` / unobserved.

---

### 17. Configuration / Feature Flag / Dependency Evidence

- Fully supported through `ChangeSourceType` enums: `CONFIGURATION_CHANGE`, `FEATURE_FLAG_CHANGE`, `DEPENDENCY_CHANGE`.
- Evaluated on the same timeline and evidence rules without fabricating synthetic commits.

---

### 18. Ownership Integration

Reuses Pillar E:
- Resolves declared service and code path owners via `resolveServiceOwnership` and CODEOWNERS rules.
- Strictly maintains: `Commit Author != Declared Owner != Culprit`.

---

### 19. Topology Integration

Reuses Pillar B:
- Reads canonical topology origin and impacted surface (`affectedServices`).
- Annotates blast radius without recomputing topology graphs.

---

### 20. Differential Integration

Reuses Pillar A:
- Queries existing baseline runs to detect runtime execution anomalies.
- Zero duplication of differential trace algorithms.

---

### 21. Incident Memory Integration

Reuses Pillar D:
- Correlates historical recurring failure patterns from `IncidentMemory`.
- Historical patterns provide organizational context but never override current telemetry.

---

### 22. Collaboration Integration

Reuses Pillar C:
- Investigators can annotate and comment on change observations.
- Human comments remain strictly tagged as `HUMAN_ASSERTION` and never masquerade as system causal facts.

---

### 23. Replay Integration

- Correlates user replay action timestamps with the change timeline.
- Purely observational; does not infer causality from user behavior.

---

### 24. Postmortem Integration

Extended `generateInvestigationPostmortem()` in `postmortem-generator.ts`:
- Added `## 9. Change Context` section.
- Synthesizes factual change observations, deployment linkages, and direct causal evidence notices without blame language.

---

### 25. Database Changes

Updated `prisma/schema.prisma`:
- Added enums `ChangeSourceType` and `ChangeRelationshipType`.
- Added model `ChangeObservation` with fields for commit, author, deployment, PR, changed files, line counts, and relations to `Organization` and `Project`.
- Added unique constraint `@@unique([projectId, changeKey])` for deterministic idempotency.
- Added performance indexes on `organizationId`, `projectId`, `createdAt`, `commitSha`, and `authorTimestamp`.

---

### 26. API / Server Actions

Implemented in `apps/dashboard/src/actions/change-intelligence.ts`:
- `getInvestigationChanges(investigationId: string)`
- `getChangeDetails(changeId: string, projectId: string)`
- `getChangeImpact(changeId: string, investigationId: string)`
- `recordChangeObservation(params: IngestChangeObservationInput)`

---

### 27. Capability Enforcement

- Registered semantic capability `TEAM_CHANGE_INTELLIGENCE` with `minimumPlan: "TEAM"` in `apps/dashboard/src/lib/capabilities.ts`.
- Server actions enforce `requireCapability(orgId, "TEAM_CHANGE_INTELLIGENCE")`, throwing `AuthorizationError("TEAM_PLAN_REQUIRED", ...)` for Developer and Free plans.

---

### 28. Tenant Isolation

- Authorization checks verify authenticated identity and project access before executing any change operation.
- Cross-organization queries and injections are strictly rejected with `AuthorizationError("NOT_A_MEMBER", ...)`.

---

### 29. Security Audit

- Zero credential leakage: PATs, GitHub tokens, and secrets are excluded from returned change objects.
- Path traversal protection: `sanitizeRepositoryPath()` rejects `../`, `./`, root escapes, and null bytes (`\0`).

---

### 30. Performance Audit

- Batch-queries observations, events, and releases with bounded limit clauses (`take: 30`, `take: 100`).
- Avoids N+1 queries by pre-fetching project metadata and caching Git commits with a 60-second TTL.

---

### 31. Adversarial Test Matrix

All 48 test cases in `scripts/test-pillar-f-change-intelligence.ts`:
1. Developer plan blocked with `TEAM_PLAN_REQUIRED`: **PASS**
2. Free plan blocked with `TEAM_PLAN_REQUIRED`: **PASS**
3. Team plan allowed access: **PASS**
4. Tenant isolation (cross-org read rejected): **PASS**
5. Project isolation (cross-project write rejected): **PASS**
6. Real commit metadata representation: **PASS**
7. Idempotent commit ingestion: **PASS**
8. Temporal relationship without false causation: **PASS**
9. Unaffected service remains temporal: **PASS**
10. Target service intersection detected: **PASS**
11. Changed file matches failing path: **PASS**
12. Unrelated file does not match path: **PASS**
13. Changed lines intersect stack location: **PASS**
14. Missing line data remains UNAVAILABLE: **PASS**
15. Differential divergence strengthens relationship: **PASS**
16. Absence of divergence prevents false upgrade: **PASS**
17. Deployment linkage connects commit SHA: **PASS**
18. Missing deployment explicitly NOT_OBSERVED: **PASS**
19. Multiple commits independently represented: **PASS**
20. Deployment preserves individual commits: **PASS**
21. Real PR metadata preserved: **PASS**
22. Missing PR remains unavailable: **PASS**
23. Contradictory evidence surfaced: **PASS**
24. Historical incident does not override current telemetry: **PASS**
25. Pillar E ownership attached to changed files: **PASS**
26. Commit author never becomes owner: **PASS**
27. Zero developer blame attribution: **PASS**
28. Root cause immutability: **PASS**
29. Confidence score immutability: **PASS**
30. Topology reuse: **PASS**
31. Differential engine reuse: **PASS**
32. Replay timeline correlation: **PASS**
33. Collaboration comments remain human assertion: **PASS**
34. Path traversal attempts rejected: **PASS**
35. Secret isolation (no tokens exposed): **PASS**
36. Cross-tenant cache isolation: **PASS**
37. Historical commit versioning: **PASS**
38. Missing Git connection handled cleanly: **PASS**
39. Missing repository metadata handled without invention: **PASS**
40. Missing source path leaves code path unavailable: **PASS**
41. Configuration change observation: **PASS**
42. Feature flag change observation: **PASS**
43. Dependency change observation: **PASS**
44. Postmortem change context integration: **PASS**
45. Zero generic AI / chatbot features: **PASS**
46. Zero developer blame words in generated prose: **PASS**
47. Zero automatic remediation / rollback behavior: **PASS**
48. Regression safety (all checks passed): **PASS**

---

### 32. Regression Results

Full regression verification executed across all 9 test suites:

| Suite | Description | Checks Passed | Total Checks | Pass Rate |
|---|---|:---:|:---:|:---:|
| **Phase 1** | Foundation, Auth, Tenant Isolation, Downgrade Safety | 24 | 24 | 100% |
| **Pillar A** | Differential Trace Engine & Baseline Anomaly Analysis | 22 | 22 | 100% |
| **Pillar B** | Cross-Service Topology, Dependency Graphs & Blast Radius | 25 | 25 | 100% |
| **Pillar C** | Collaborative Investigation Rooms & Presence | 25 | 25 | 100% |
| **Cascade** | Multi-Step Cascade & Replay Correlation | 33 | 33 | 100% |
| **Adversarial** | Concurrency, Correlation, Authority & Out-of-Order | 42 | 42 | 100% |
| **Pillar D** | Organizational Failure Memory & Incident Intelligence | 25 | 25 | 100% |
| **Pillar E** | Ownership Intelligence & Engineering Responsibility | 27 | 27 | 100% |
| **Pillar F** | Change Intelligence & Causal Change Analysis | 48 | 48 | 100% |
| **GRAND TOTAL** | **All Automated Verification Checks** | **271** | **271** | **100%** |

---

### 33. Files Changed

1. `prisma/schema.prisma` — Added `ChangeSourceType`, `ChangeRelationshipType`, and `ChangeObservation` models and relations.
2. `apps/dashboard/src/lib/capabilities.ts` — Registered `TEAM_CHANGE_INTELLIGENCE` with `minimumPlan: "TEAM"`.
3. `apps/dashboard/src/lib/change-intelligence/types.ts` — Domain types, evidence dimensions, and candidate models.
4. `apps/dashboard/src/lib/change-intelligence/path-utils.ts` — Path sanitization, normalization, and line hunk matching.
5. `apps/dashboard/src/lib/change-intelligence/git-collector.ts` — Git commit collector, tenant cache, and idempotent ingestion.
6. `apps/dashboard/src/lib/change-intelligence/change-engine.ts` — Deterministic multi-dimensional change correlation engine.
7. `apps/dashboard/src/actions/change-intelligence.ts` — Secure Server Actions for change retrieval, impact, and ingestion.
8. `apps/dashboard/src/lib/investigation/incident-memory/postmortem-generator.ts` — Added `## 9. Change Context` without developer blame.
9. `apps/dashboard/src/components/investigation/changes/change-intelligence-panel.tsx` — Change Intelligence UI component.
10. `apps/dashboard/src/app/(dashboard)/projects/[id]/investigations/new/page.tsx` — Capability-gated mounting of Change Intelligence panel.
11. `apps/dashboard/src/components/investigation/sticky-nav.tsx` — Added `section-change-intelligence` navigation anchoring.
12. `scripts/test-pillar-f-change-intelligence.ts` — 48-check adversarial test suite for Pillar F.

---

### 34. Known Limitations

1. **Private Repository Token Dependency:** For live GitHub diff retrieval, a valid Personal Access Token must be stored in the project's settings. Without a token, the engine gracefully reports `"Git repository configured but access token is unavailable"` while still correlating persisted database observations.
2. **Minified Stack Traces:** If JavaScript bundles are minified in production without source maps, stack frames report bundle file paths (e.g., `bundle-xyz.js:1:1234`), which will not match repository source paths unless source map resolution is enabled.

---

### 35. Final Verification

- **Production Build:** `pnpm --filter dashboard build` completed with **0 errors, 100% clean Next.js compilation in 5.4s, TypeScript check in 8.5s**.
- **Test Matrix:** 271 / 271 checks passing across 9 test suites.
- **Stop Condition:** Verified all requirements for Pillar F; no unrequested future pillars or remediation features implemented.
