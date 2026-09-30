# Phase 10 Forensic Verification — AST Call-Site Audit (§11, §12)

| Scenario ID | Caller File | Caller Function | Callee Symbol | AST Line:Col | Unique Discovery | Status |
|---|---|---|---|:---:|:---:|:---:|
| BENCHMARK_SCENARIO_0001 | `src/auth/caller_client.ts` | `dispatchclient` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0011 | `src/identity/caller_pipeline.ts` | `dispatchpipeline` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0021 | `src/checkout/caller_client.ts` | `dispatchclient` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0031 | `src/catalog/caller_pipeline.ts` | `dispatchpipeline` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0041 | `src/analytics/caller_client.ts` | `dispatchclient` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0051 | `src/fulfillment/caller_pipeline.ts` | `dispatchpipeline` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0061 | `src/search/caller_client.ts` | `dispatchclient` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0071 | `src/customer/caller_pipeline.ts` | `dispatchpipeline` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0081 | `src/payment/caller_client.ts` | `dispatchclient` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0091 | `src/auth/caller_pipeline.ts` | `dispatchpipeline` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |
| BENCHMARK_SCENARIO_0101 | `src/identity/caller_client.ts` | `dispatchclient` | `requireTenant` | Line 7:5 | YES (1 of 1) | **VERIFIED** |

**Audit Finding**: Call site is located via TypeScript AST traversal (`ts.isCallExpression`) matching the imported symbol, not hardcoded line numbers.
