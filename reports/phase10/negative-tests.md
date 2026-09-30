# Phase 10 — Negative Tests & Fail-Closed Guardrails Audit (§57, §63)

## Guardrail Verification Matrix

| Test Case | Condition Tested | Expected Status | Observed Status | Verdict |
|---|---|---|---|---|
| Missing Commit SHA | Commit SHA absent from incident | `COMMIT_NOT_IDENTIFIED` / Fail-Closed | `COMMIT_NOT_IDENTIFIED` | PASS |
| Missing Source File | File path missing in commit tree | `SOURCE_NOT_FOUND` / Fail-Closed | `SOURCE_NOT_FOUND` | PASS |
| Hash Mismatch | Content hash differs from expected | `REVISION_MISMATCH` / Fail-Closed | `REVISION_MISMATCH` | PASS |
| Callee Not Called | Caller AST contains no call to callee | `CALLEE_MISMATCH` | `CALLEE_MISMATCH` | PASS |
| Ambiguous Call Sites | Multiple calls to callee without line hint | `CALL_SITE_UNRESOLVED` (2 candidates) | `CALL_SITE_UNRESOLVED` | PASS |
| Ambiguous Data Flow | Dynamic argument without local AST binding | `ARGUMENT_DATAFLOW_UNRESOLVED` | `ARGUMENT_DATAFLOW_UNRESOLVED` | PASS |
| Missing Caller in Sandbox | Hermetic environment without caller source | `CALLER_SOURCE_UNAVAILABLE` / Blocked | `CALLER_SOURCE_UNAVAILABLE` | PASS |

## Conclusion

All 7 negative test scenarios fail closed immediately without heuristics, speculative guesses, or fabricated code.
