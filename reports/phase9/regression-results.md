# PHASE 9 — REGRESSION VERIFICATION RESULTS

```text
idden Repo 1: Null dereference on optional metadata  312ms
       ✓ Hidden Repo [HIDDEN_REPO_02]: Hidden Repo 2: JSON parse error without schema validation  310ms
       ✓ Hidden Repo [HIDDEN_REPO_03]: Hidden Repo 3: Reduce of empty array without initial accumulator  304ms
       ✓ Hidden Repo [HIDDEN_REPO_06]: Hidden Repo 6: External timeout with transient 503  556ms
       ✓ Hidden Repo [HIDDEN_REPO_07]: Hidden Repo 7: Null dereference on optional metadata  301ms
       ✓ Hidden Repo [HIDDEN_REPO_10]: Hidden Repo 10: State machine transition error  333ms
 ✓ src/lib/investigation/recommendation-engine/__tests__/evaluation/tempting-wrong-fixes.test.ts (4 tests) 2ms
 ✓ src/lib/investigation/recommendation-engine/__tests__/architectural-memory.test.ts (3 tests) 2ms
 ✓ src/lib/investigation/recommendation-engine/__tests__/evaluation/arbitrary-architecture-generalization.test.ts (4 tests) 3ms
 ✓ src/lib/investigation/recommendation-engine/__tests__/evaluation/stability-capacity-and-leak.test.ts (6 tests) 13919ms
       ✓ remains functionally invariant when test files and locations are mutated  331ms
       ✓ produces identical engineering decisions across 5 repeated trials with identical evidence  790ms
       ✓ detects staleness when evidence is altered post-generation  314ms
       ✓ runs 10 concurrent recommendations across distinct subsystems without context leakage  1513ms
       ✓ executes 100 consecutive recommendation runs without memory exhaustion or unbounded growth  10968ms
 ✓ src/lib/investigation/recommendation-engine/__tests__/evaluation/reliability-benchmark.test.ts (3 tests) 29553ms
     ✓ evaluates a representative 100-scenario sample across all 10 archetypes with high performance  9455ms
     ✓ verifies zero false-negative refusals across the full 2,000-scenario corpus  19998ms

 Test Files  54 passed (54)
      Tests  480 passed (480)
   Start at  10:07:31
   Duration  30.72s (transform 4.55s, setup 0ms, import 17.49s, tests 63.13s, environment 3ms)


```
