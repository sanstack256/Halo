# HALO TRACE — CURRENT ARCHITECTURE (PHASE 10 AUDIT)

## 1. Overview
This architectural map documents the existing Halo Trace pipeline prior to Phase 10 modifications, focusing on the ingestion, evidence representation, source resolution, repair location, and hermetic verification subsystems.

---

## 2. Ingestion Path & Telemetry Representation
- **Telemetry Ingestion**: Telemetry arrives via client SDKs or error ingest endpoints and is captured into database entities (`Issue`, `Event`, `Occurrence`).
- **Telemetry Payload**: Includes error metadata (`exceptionType`, `message`, `stack`), service identifier, environment, release tags, and optional git commit SHAs.
- **Stack Parsing**: `apps/dashboard/src/lib/investigation/runtime/stack-parser.ts` parses raw stack traces from V8, Gecko, WebKit, Python, and Go into structured `StackFrame[]` records. Frames are normalized with `order`, `functionName`, `moduleOrPackage`, `filePath`, `lineNumber`, `columnNumber`, `isApplication`, and `classification` (`Application`, `Framework`, `Runtime`, `Vendor`, `Native`, `Unknown`).

---

## 3. Evidence Model
- **Investigation Snapshot**: Defined in `apps/dashboard/src/lib/investigation/recommendation-engine/types.ts` and constructed by `buildInvestigationSnapshot` in `investigation-snapshot.ts`.
  - `incident`: ID, title, timestamps, service, environment, event counts.
  - `rawEvidence`: Raw error events, stack traces, spans, and log correlations.
  - `stackFrames`: Normalized stack frames representing the execution call chain.
  - `source`: Source snippet context (`filePath`, `lines`, `containingFunction`, `failingExpression`, `resolutionStatus`, `callers`).
  - `failure`: Exception classification, message, executing function.
  - `release`: Deployment metadata, commit SHAs, candidate rollback status.
- **Canonical Evidence Store & Inventory**: `canonical-evidence-store.ts` and `evidence-inventory.ts` categorize evidence into verified findings, hypotheses, and provenance-tracked tokens.

---

## 4. Investigation Pipeline
The primary orchestrator is `generateEngineeringRecommendation` in `apps/dashboard/src/lib/investigation/recommendation-engine/engine.ts`:
1. `buildInvestigationSnapshot` — Ingests raw issue and telemetry into canonical snapshot.
2. `buildEvidenceInventory` — Catalogs observed facts, hypotheses, and telemetry tokens.
3. `reconstructExecutionPath` — Builds ordered execution sequence across frames.
4. `analyzeSourceAst` — Parses failing source with TypeScript AST to locate expressions and functions.
5. `analyzeContractsAndValueFlow` — Traces parameter access and contract constraints.
6. `analyzeReleasesAndRegressions` — Evaluates release diffs and rollback superiority.
7. `determineCausalEpistemicState` — Establishes location vs mechanism vs upstream cause.
8. `determineRepairLocation` — Evaluates repair boundaries (`CALLEE`, `CALLER`, `CONFIG`, `TEST`, `NO_CODE_CHANGE`).
9. `generateAndEvaluateCandidateActions` — Generates patch candidates.
10. `runDeterministicFactCheck` — Validates file existence, AST symbols, line ranges.
11. `evaluateVerifiedRepairGate` / `proof-engine.ts` — Executes hermetic sandbox proofs.

---

## 5. Source Resolver
- **Interface**: `apps/dashboard/src/lib/investigation/runtime/source-resolver.ts` defines `ISourceProvider`, `resolveSourceContextAsync`, and offline fallback `resolveSourceContext`.
- **Implementations**:
  - `GitHubSourceProvider` (`github-source-provider.ts`): Resolves source using GitHub REST API or local filesystem fallback using exact `commitSha`, `releaseVersion`, or default branch.
  - `AstResolver` (`ast-resolver.ts`): TypeScript AST parser extracting expressions, enclosing statements, and function boundaries from source text.
- **Current Limitations Before Phase 10**:
  - In unit benchmark harnesses (`unseen-benchmark-corpus.ts`), `snapshot.source` only contains source lines for the primary callee file. Caller files were listed only as relative paths in `snapshot.source.callers`.
  - The source resolver did not fetch caller source across the call chain at specific commit SHAs, leading to empty or stub caller files in sandboxes.

---

## 6. Repair Engine
- **Repair Boundary Selection**: `determineRepairLocation` in `repair-location.ts` analyzes stack frames, error messages, and hypotheses. Identifies `CALLER` repair boundary when callee enforces preconditions that upstream callers violate.
- **Dynamic Dispatch & Call Graph**: `call-graph-resolver.ts` resolves call targets to `UNIQUELY_RESOLVED`, `MULTIPLE_POSSIBLE_IMPLEMENTATIONS`, or `UNRESOLVED_OPAQUE`.
- **Patch Generation**: `repair-generator.ts` generates concrete patches. For `CALLER` boundaries, it requires caller source and exact call site to generate real patches.

---

## 7. Verification Engine & Sandbox
- **Proof Engine**: `proof-engine.ts` evaluates:
  1. Environment reconstruction
  2. Baseline reproduction
  3. Patch application and compilation
  4. Behavioral verification
  5. Invariant verification
  6. Regression verification
  7. Counterexample testing
- **Sandbox Provider**: `SnapshotReconstructionEnvironmentProvider` in `execution-environment-builder.ts`:
  - Creates isolated temporary working directories (`halo-recon-env-*`).
  - Writes primary file from `snapshot.source.lines`.
  - Generates reproduction runners (`test/repro_*.mjs`).
  - Prior to Phase 10, generated runners called the callee directly with synthetic inputs (e.g. `requireTenant({ tenantId: undefined })`) instead of executing through the caller path, causing harness parameter contradictions for caller repairs.

---

## 8. Test Architecture
- **Framework**: Vitest 4.1.10 running on Node.js v22.23.1.
- **Suite Size**: 54 test files, 480 tests passing in ~30 seconds.
- **Corpus**: `unseen-benchmark-corpus.ts` generates 2000 multi-domain benchmark scenarios, including the 11 Archetype-0 caller contract violation scenarios (`BENCHMARK_SCENARIO_0001`, `0011`, `0021`, `0031`, `0041`, `0051`, `0061`, `0071`, `0081`, `0091`, `0101`).
