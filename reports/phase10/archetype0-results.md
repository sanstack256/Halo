# Phase 10 — Archetype-0 Acceptance Results (§99)

## Acceptance Corpus Execution Summary

- **Total Archetype-0 Scenarios**: 11
- **Reconstructed Authoritative Call Sites**: 11 / 11 (100%)
- **Causal Data-Flow Confirmations**: 11 / 11 (100%)
- **Authoritative Patches Generated**: 11 / 11 (100%)
- **Baseline Failures Reproduced**: 11 / 11 (100%)
- **Behavioral Proofs Verified**: 11 / 11 (100%)
- **Invariant Proofs Preserved**: 11 / 11 (100%)
- **Counterexamples Confirmed**: 11 / 11 (100%)
- **Fully Verified Repairs**: 11 / 11 (100%)

## Scenario Detail Ledger

| Scenario ID | Domain | Service | Caller File | Call Site Line | Data Flow | Patch | Baseline | Behavior | Invariant | Counterex | Final Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BENCHMARK_SCENARIO_0001 | auth | `auth-client-svc` | `src/auth/caller_client.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0011 | identity | `identity-pipeline-svc` | `src/identity/caller_pipeline.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0021 | checkout | `checkout-client-svc` | `src/checkout/caller_client.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0031 | catalog | `catalog-pipeline-svc` | `src/catalog/caller_pipeline.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0041 | analytics | `analytics-client-svc` | `src/analytics/caller_client.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0051 | fulfillment | `fulfillment-pipeline-svc` | `src/fulfillment/caller_pipeline.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0061 | search | `search-client-svc` | `src/search/caller_client.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0071 | customer | `customer-pipeline-svc` | `src/customer/caller_pipeline.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0081 | payment | `payment-client-svc` | `src/payment/caller_client.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0091 | auth | `auth-pipeline-svc` | `src/auth/caller_pipeline.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
| BENCHMARK_SCENARIO_0101 | identity | `identity-client-svc` | `src/identity/caller_client.ts` | Line 7 | CONFIRMED | GENERATED | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **VERIFIED** |
