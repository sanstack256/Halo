# Phase 10 Forensic Verification — Patch Audit & Minimality (§15, §16, §45, §46)

| Scenario ID | Target File | Target Symbol | Classification | Symptom Masking | Proposed Snippet |
|---|---|---|---|:---:|---|
| BENCHMARK_SCENARIO_0001 | `src/auth/caller_client.ts` | `dispatchclient` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0011 | `src/identity/caller_pipeline.ts` | `dispatchpipeline` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0021 | `src/checkout/caller_client.ts` | `dispatchclient` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0031 | `src/catalog/caller_pipeline.ts` | `dispatchpipeline` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0041 | `src/analytics/caller_client.ts` | `dispatchclient` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0051 | `src/fulfillment/caller_pipeline.ts` | `dispatchpipeline` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0061 | `src/search/caller_client.ts` | `dispatchclient` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0071 | `src/customer/caller_pipeline.ts` | `dispatchpipeline` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0081 | `src/payment/caller_client.ts` | `dispatchclient` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0091 | `src/auth/caller_pipeline.ts` | `dispatchpipeline` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
| BENCHMARK_SCENARIO_0101 | `src/identity/caller_client.ts` | `dispatchclient` | `SYMPTOM_MASKING` | YES (REJECT) | `{ userId: request.user?.id || "user-1", tenantId: ...` |
