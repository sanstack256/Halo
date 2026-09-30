# Phase 10 Forensic Verification — Negative Tests Audit (§27)

| Test ID | Fail-Closed Condition Tested | Expected Status | Observed Status | Fails Closed |
|---|---|---|---|:---:|
| `NEG_01` | Commit SHA absent from incident telemetry | `COMMIT_NOT_IDENTIFIED` | `COMMIT_NOT_IDENTIFIED` | **YES (PASS)** |
| `NEG_02` | File absent from registered commit tree | `SOURCE_NOT_FOUND` | `SOURCE_NOT_FOUND` | **YES (PASS)** |
| `NEG_03` | SHA-256 digest tampered / mismatched | `REVISION_MISMATCH` | `REVISION_MISMATCH` | **YES (PASS)** |
| `NEG_04` | Callee not called in caller AST | `CALLEE_MISMATCH` | `CALLEE_MISMATCH` | **YES (PASS)** |
| `NEG_05` | Multiple call sites without line hint | `CALL_SITE_UNRESOLVED` | `CALL_SITE_UNRESOLVED` | **YES (PASS)** |
| `NEG_06` | Dynamic argument with unresolvable data flow | `ARGUMENT_DATAFLOW_UNRESOLVED` | `ARGUMENT_DATAFLOW_UNRESOLVED` | **YES (PASS)** |
| `NEG_07` | Sandbox construction with caller source unavailable | `CALLER_SOURCE_UNAVAILABLE` | `CALLER_SOURCE_UNAVAILABLE` | **YES (PASS)** |
