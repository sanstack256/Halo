# PHASE 10 READINESS SPECIFICATION: CAUSAL SOURCE RECONSTRUCTION

```text
READINESS SPECIFICATION — NOT AN IMPLEMENTATION COMMIT.
PHASE 10 IMPLEMENTATION MUST BE A SEPARATE FUTURE CHANGE.
```

---

## 1. Objective & Core Problem Statement (§18)

Phase 9 established that Halo Trace’s causal determination, ownership assignment, and repair-boundary identification are 100% accurate across all 84 code incidents. However, in Architectural Archetype 0 (11 incidents), Halo identified the upstream caller (`src/*/caller_*.ts:dispatch*`) as the contract owner, but the caller source code was omitted from the investigation snapshot.

Consequently, Halo could not transition from:
```text
"Caller is the repair boundary"
```
to:
```text
"Here is the exact caller code, here is the exact broken call site,
here is the patch, and here is executable proof."
```

Phase 10 is the engineering milestone that closes this evidence gap through **Causal Source Reconstruction**.

---

## 2. Phase 10 Readiness Architecture (§19)

Phase 10 will implement the following end-to-end evidence pipeline:

```text
Runtime failure
    ↓
Stack / trace reconstruction
    ↓
Frame normalization
    ↓
Repository source resolution
    ↓
Caller source acquisition
    ↓
Call-site identification
    ↓
Argument-expression extraction
    ↓
Data-flow reconstruction
    ↓
Contract comparison
    ↓
Causal repair boundary
    ↓
Patch generation
    ↓
Hermetic environment
    ↓
Baseline reproduction
    ↓
Patch execution
    ↓
Behavioral validation
    ↓
Invariant validation
    ↓
Regression validation
    ↓
Counterexamples
    ↓
Verified repair
```

---

## 3. Source Resolution Requirements (§20)

To establish an authoritative repair boundary, Phase 10 must resolve the following 10 exact attributes:
1. **Exact repository identity:** Validated against VCS remote or repository manifest.
2. **Exact commit / release:** The git commit SHA active when the incident occurred.
3. **Exact source file:** Canonical path within the repository worktree.
4. **Exact source revision:** Immutable content hash of the target source file.
5. **Exact executing function:** Symbol identity within the caller AST.
6. **Exact caller frame:** Normalized stack frame pointing to the caller invocation site.
7. **Exact call site:** Precise line number, column number, and AST call expression.
8. **Exact argument expression:** The syntax node passed as arguments to the callee.
9. **Actual source lines:** Complete surrounding lines of the caller function.
10. **Caller-callee contract relationship:** Pre-conditions, invariants, and expected argument shapes.

### Source Provenance Types
Phase 10 must explicitly distinguish:
- **Runtime Source:** Ephemeral source captured during exception telemetry.
- **Repository Source:** Verifiable source checked out from Git commit / branch.
- **Snapshot Source:** Source lines bundled into the investigation snapshot.
- **Generated Source:** Synthesized test harness or reproduction code.
- **Stale Source:** Cached source that does not match the incident commit SHA.

---

## 4. Prohibition Against Source Fabrication (§21)

To protect the zero-false-positive guarantee, Phase 10 must adhere to strict negative invariants:
- **Never create missing caller implementations:** If caller source is absent, fail closed.
- **Never infer source lines from stack frames alone:** Stack traces provide frame metadata, not code.
- **Never reconstruct code from a function name alone:** Symbol names do not imply logic.
- **Never generate synthetic caller code and represent it as repository code.**
- **Never claim a source snippet is authoritative unless its repository and revision identity are established.**
- **When source cannot be resolved:** **FAIL CLOSED** with an explicit unproven status.

---

## 5. Call-Site & Argument Data-Flow Reconstruction (§22)

Phase 10 must analyze the argument data-flow at the caller call site. For Archetype 0:
- **Caller Function:** `dispatch()` in `caller_*.ts`.
- **Callee Function:** `requireTenant()` in `callee_*.ts`.
- **Actual Call Expression:** `requireTenant(context)`.
- **Argument Expression:** `context`.
- **Context Origin:** Data-flow analysis tracing where `context` is initialized or received.
- **Core Forensic Question:**
  > *"What value reaches `tenantId` at this call site?"*

The system must not stop at noting that `dispatch` called `requireTenant`; it must prove how `tenantId` became undefined at that specific call site.

---

## 6. Source Evidence Data Model (§23)

Every piece of source code utilized by the recommendation and proof engine must be structured with cryptographic provenance:

```typescript
export interface SourceEvidenceCarrier {
    repository: string;
    commitSha: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
    symbol: string;
    sourceHash: string; // SHA-256
    retrievalMethod: "LOCAL_WORKTREE" | "GIT_ARCHIVE" | "TELEMETRY_SNAPSHOT" | "SOURCE_RESOLVER";
    sourceType: SourceType;
    evidenceConfidence: "CONFIRMED_EXACT" | "INFERRED_REVISION" | "UNVERIFIED";
}

export type SourceType =
    | "WORKTREE"
    | "GIT_COMMIT"
    | "REPOSITORY"
    | "UPLOADED_SOURCE"
    | "TELEMETRY_CAPTURED"
    | "GENERATED"
    | "UNKNOWN";
```

> [!CRITICAL]
> `GENERATED` source must **NEVER** be treated as authoritative repository code.

---

## 7. Telemetry Ingestion Requirements (§24)

If caller source lines are to be captured via enhanced telemetry, the ingestion pipeline must carry:
- Repository URL / identity
- Application release / semantic version
- Git commit SHA
- Module / package identity
- Source map reference / SHA
- Normalized stack frames (both callee and caller)
- Distributed trace ID & request correlation ID
- Runtime version & service identity

### Secret & Privacy Boundaries
- **No secret ingestion:** Telemetry must never capture passwords, tokens, API keys, session secrets, or personal data.
- **Redaction:** Caller arguments and variables must be sanitized before ingestion.

---

## 8. Primary Acceptance Corpus: The 11 Archetype-0 Scenarios (§25)

The 11 Archetype-0 scenarios (`BENCHMARK_SCENARIO_0001`, `0011`, `0021`, ..., `0101`) will serve as the primary acceptance benchmark for Phase 10:

```text
Benchmark caller source
    ↓
Source resolver
    ↓
Actual dispatch implementation
    ↓
Actual requireTenant call site
    ↓
Actual argument data-flow
    ↓
Baseline failure reproduction
    ↓
Caller patch generation
    ↓
Patched caller execution
    ↓
Behavioral proof
    ↓
Invariant proof
    ↓
Regression proof
    ↓
Counterexample proof
    ↓
Verified repair
```

Phase 10 will **not** be considered successful merely because the caller source was resolved. It will succeed only when the generated caller patch executes in the hermetic sandbox and passes all proof gates.

---

## 9. Explicit Fail-Closed Failure Modes (§26)

Phase 10 must reject unproven states using granular error classifications:
- `SOURCE_NOT_FOUND`: Repository source cannot be located for the caller frame.
- `REPOSITORY_NOT_IDENTIFIED`: Incident telemetry does not identify target repository.
- `COMMIT_NOT_IDENTIFIED`: Commit SHA is missing or ambiguous.
- `SOURCE_REVISION_MISMATCH`: Local source hash differs from incident commit hash.
- `CALLER_FRAME_UNRESOLVED`: Stack trace lacks sufficient caller frame information.
- `CALL_SITE_UNRESOLVED`: AST parser cannot locate the callee invocation inside the caller.
- `ARGUMENT_DATAFLOW_UNRESOLVED`: Value flow into the call site cannot be determined.
- `PATCH_TARGET_UNRESOLVED`: Proposed patch cannot be mapped to an exact line range.
- `BASELINE_NOT_REPRODUCED`: Repaired module does not reproduce incident failure in baseline.
- `PATCH_NOT_EXECUTED`: Patch fails syntax check or build compilation.
- `BEHAVIOR_NOT_PROVEN`: Post-patch execution does not eliminate failure.
- `INVARIANT_NOT_PROVEN`: System state invariant violated post-patch.
- `REGRESSION_NOT_PROVEN`: Existing test suite fails post-patch.
- `COUNTEREXAMPLE_NOT_PROVEN`: Counterexample test detects invariant boundary failure.

---

## 10. Readiness Conclusion (§34)

The highest-information next capability for Halo Trace is **not another recommendation heuristic**.

It is complete **causal source reconstruction**:
```text
runtime frame
→ repository source
→ caller
→ call site
→ argument data flow
→ contract violation
→ repair boundary
→ executable patch
→ proof.
```

The 11 Archetype-0 scenarios represent the empirical acceptance corpus for this capability.
