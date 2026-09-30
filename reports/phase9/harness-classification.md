# PHASE 9 — HARNESS MISMATCH CLASSIFICATION TABLE

| Scenario | Mismatch | Primary Cause | Evidence | Action | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `BENCHMARK_SCENARIO_0001` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0011` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0021` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0031` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0041` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0051` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0061` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0071` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0081` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0091` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |
| `BENCHMARK_SCENARIO_0101` | Parameter `tenantId` undefined passed directly to callee | `HARNESS_DEFECT` | Harness line 395 hardcoded `{ tenantId: undefined }` in direct callee runner; snapshot omitted caller source | Retain fail-closed gate; reject artificial pass | `FAIL_CLOSED_SOUND` |

## Aggregate Classification Breakdown

- **Total Mismatch Cases:** 11
- **HARNESS_DEFECT (Primary):** 11 (100.0%)
- **INSUFFICIENT_EVIDENCE (Secondary / Contributing):** 11 (100.0%)
- **REPAIR_DEFECT:** 0
- **ENVIRONMENT_DEFECT:** 0
- **FIXTURE_DEFECT:** 11 (Caller source lines missing from benchmark item snapshot)
- **EXPECTED_BEHAVIOR_DEFECT:** 0
- **DEPENDENCY_RUNTIME_MISMATCH:** 0
- **SCENARIO_CLASSIFICATION_DEFECT:** 0
- **LEGITIMATE_VARIATION:** 0
