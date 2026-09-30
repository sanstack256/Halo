# PHASE 9 — RECOMPUTED AUTHORITATIVE PROOF FUNNEL

```text
105 total scenarios
├── 84 code scenarios
│   ├── 63 environments reconstructed (75.0%)
│   │   ├── 63 baseline reproduced (100.0%)
│   │   │   ├── 52 behavioral pass (82.5%)
│   │   │   │   ├── 52 invariant pass (100.0%)
│   │   │   │   │   ├── 52 regression pass (100.0%)
│   │   │   │   │   │   └── 52 fully verified repairs (82.5% of reconstructed, 61.9% of code)
│   │   │   │   │   └── 0 regression failures
│   │   │   │   └── 0 invariant failures
│   │   │   └── 11 behavioral failures (17.5% — harness parameter mismatch)
│   │   └── 0 baseline reproduction failures
│   └── 21 environment blocked (25.0% of code scenarios)
│       ├── 11 blocked by database dependency (Index 3)
│       └── 10 blocked by secret boundary DATABASE_URL (Index 6)
└── 21 non-code scenarios
    ├── 11 external service outages (valid refusal, 0 false patches)
    └── 10 deployment regressions (valid rollback superiority, 0 false patches)
```
