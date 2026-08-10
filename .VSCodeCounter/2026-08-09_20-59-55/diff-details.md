# Diff Details

Date : 2026-08-09 20:59:55

Directory /Users/nssanjeev/Development/Halo

Total : 50 files,  7312 codes, 290 comments, 1121 blanks, all 8723 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [apps/dashboard/package.json](/apps/dashboard/package.json) | JSON | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/investigations/new/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/investigations/new/page.tsx) | TypeScript JSX | 833 | 45 | 121 | 999 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/issues/\[issueId\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/issues/%5BissueId%5D/page.tsx) | TypeScript JSX | 20 | 0 | 3 | 23 |
| [apps/dashboard/src/lib/investigation/evidence.ts](/apps/dashboard/src/lib/investigation/evidence.ts) | TypeScript | 92 | 0 | 22 | 114 |
| [apps/dashboard/src/lib/investigation/run.ts](/apps/dashboard/src/lib/investigation/run.ts) | TypeScript | 23 | 0 | 6 | 29 |
| [apps/dashboard/tsconfig.json](/apps/dashboard/tsconfig.json) | JSON with Comments | -1 | 0 | 0 | -1 |
| [packages/investigation-engine/src/engine.ts](/packages/investigation-engine/src/engine.ts) | TypeScript | 69 | 0 | 16 | 85 |
| [packages/investigation-engine/src/pipeline/aggregate.ts](/packages/investigation-engine/src/pipeline/aggregate.ts) | TypeScript | -58 | 0 | -29 | -87 |
| [packages/investigation-engine/src/pipeline/build-context.ts](/packages/investigation-engine/src/pipeline/build-context.ts) | TypeScript | 90 | 0 | 19 | 109 |
| [packages/investigation-engine/src/pipeline/change-detector.ts](/packages/investigation-engine/src/pipeline/change-detector.ts) | TypeScript | -32 | 0 | -8 | -40 |
| [packages/investigation-engine/src/pipeline/changes.ts](/packages/investigation-engine/src/pipeline/changes.ts) | TypeScript | 27 | 0 | -10 | 17 |
| [packages/investigation-engine/src/pipeline/correlate.ts](/packages/investigation-engine/src/pipeline/correlate.ts) | TypeScript | 131 | 31 | -1 | 161 |
| [packages/investigation-engine/src/pipeline/evaluate.ts](/packages/investigation-engine/src/pipeline/evaluate.ts) | TypeScript | 325 | 9 | 64 | 398 |
| [packages/investigation-engine/src/pipeline/hypotheses.ts](/packages/investigation-engine/src/pipeline/hypotheses.ts) | TypeScript | 539 | 29 | 113 | 681 |
| [packages/investigation-engine/src/pipeline/impact.ts](/packages/investigation-engine/src/pipeline/impact.ts) | TypeScript | 72 | 0 | 10 | 82 |
| [packages/investigation-engine/src/pipeline/normalize.ts](/packages/investigation-engine/src/pipeline/normalize.ts) | TypeScript | 41 | 0 | 1 | 42 |
| [packages/investigation-engine/src/pipeline/rank.ts](/packages/investigation-engine/src/pipeline/rank.ts) | TypeScript | 114 | 0 | 19 | 133 |
| [packages/investigation-engine/src/pipeline/recommend.ts](/packages/investigation-engine/src/pipeline/recommend.ts) | TypeScript | 174 | 0 | 29 | 203 |
| [packages/investigation-engine/src/pipeline/report.ts](/packages/investigation-engine/src/pipeline/report.ts) | TypeScript | 99 | 0 | 14 | 113 |
| [packages/investigation-engine/src/pipeline/root-cause.ts](/packages/investigation-engine/src/pipeline/root-cause.ts) | TypeScript | 46 | 0 | 10 | 56 |
| [packages/investigation-engine/src/pipeline/timeline.ts](/packages/investigation-engine/src/pipeline/timeline.ts) | TypeScript | 16 | 0 | -4 | 12 |
| [packages/investigation-engine/src/pipeline/validate.ts](/packages/investigation-engine/src/pipeline/validate.ts) | TypeScript | 209 | 25 | 26 | 260 |
| [packages/investigation-engine/src/rules/commit-attribution.ts](/packages/investigation-engine/src/rules/commit-attribution.ts) | TypeScript | 68 | 0 | 21 | 89 |
| [packages/investigation-engine/src/rules/cross-service.ts](/packages/investigation-engine/src/rules/cross-service.ts) | TypeScript | 51 | 0 | 16 | 67 |
| [packages/investigation-engine/src/rules/deployment-before-error.ts](/packages/investigation-engine/src/rules/deployment-before-error.ts) | TypeScript | 6 | 0 | -13 | -7 |
| [packages/investigation-engine/src/rules/different-service.ts](/packages/investigation-engine/src/rules/different-service.ts) | TypeScript | 6 | 0 | -4 | 2 |
| [packages/investigation-engine/src/rules/distributed-trace.ts](/packages/investigation-engine/src/rules/distributed-trace.ts) | TypeScript | 72 | 0 | 11 | 83 |
| [packages/investigation-engine/src/rules/evidence-signals.ts](/packages/investigation-engine/src/rules/evidence-signals.ts) | TypeScript | 339 | 34 | 111 | 484 |
| [packages/investigation-engine/src/rules/index.ts](/packages/investigation-engine/src/rules/index.ts) | TypeScript | 16 | 0 | 1 | 17 |
| [packages/investigation-engine/src/rules/infrastructure-failure.ts](/packages/investigation-engine/src/rules/infrastructure-failure.ts) | TypeScript | 122 | 0 | 26 | 148 |
| [packages/investigation-engine/src/rules/multiple-errors.ts](/packages/investigation-engine/src/rules/multiple-errors.ts) | TypeScript | 98 | 13 | 42 | 153 |
| [packages/investigation-engine/src/rules/pre-existing-error.ts](/packages/investigation-engine/src/rules/pre-existing-error.ts) | TypeScript | 70 | 0 | 22 | 92 |
| [packages/investigation-engine/src/rules/recovery.ts](/packages/investigation-engine/src/rules/recovery.ts) | TypeScript | 126 | 0 | 30 | 156 |
| [packages/investigation-engine/src/rules/same-service.ts](/packages/investigation-engine/src/rules/same-service.ts) | TypeScript | 8 | 0 | -2 | 6 |
| [packages/investigation-engine/src/rules/shared-dependency.ts](/packages/investigation-engine/src/rules/shared-dependency.ts) | TypeScript | 151 | 0 | 28 | 179 |
| [packages/investigation-engine/src/rules/time-window.ts](/packages/investigation-engine/src/rules/time-window.ts) | TypeScript | 21 | 0 | -4 | 17 |
| [packages/investigation-engine/src/types/context.ts](/packages/investigation-engine/src/types/context.ts) | TypeScript | 27 | 0 | 21 | 48 |
| [packages/investigation-engine/src/types/evidence-score.ts](/packages/investigation-engine/src/types/evidence-score.ts) | TypeScript | 0 | 0 | -4 | -4 |
| [packages/investigation-engine/src/types/evidence.ts](/packages/investigation-engine/src/types/evidence.ts) | TypeScript | 13 | 104 | 13 | 130 |
| [packages/investigation-engine/src/types/finding.ts](/packages/investigation-engine/src/types/finding.ts) | TypeScript | 28 | 0 | 10 | 38 |
| [packages/investigation-engine/src/types/graph.ts](/packages/investigation-engine/src/types/graph.ts) | TypeScript | 7 | 0 | -5 | 2 |
| [packages/investigation-engine/src/types/hypothesis.ts](/packages/investigation-engine/src/types/hypothesis.ts) | TypeScript | 15 | 0 | 4 | 19 |
| [packages/investigation-engine/src/types/investigation.ts](/packages/investigation-engine/src/types/investigation.ts) | TypeScript | 27 | 0 | 9 | 36 |
| [packages/investigation-engine/src/types/reason.ts](/packages/investigation-engine/src/types/reason.ts) | TypeScript | 7 | 0 | 2 | 9 |
| [packages/investigation-engine/src/types/recommendation.ts](/packages/investigation-engine/src/types/recommendation.ts) | TypeScript | 8 | 0 | 5 | 13 |
| [packages/investigation-engine/test/engine.test.ts](/packages/investigation-engine/test/engine.test.ts) | TypeScript | 3,185 | 0 | 354 | 3,539 |
| [packages/sdk/src/halo.ts](/packages/sdk/src/halo.ts) | TypeScript | 2 | 0 | 4 | 6 |
| [packages/sdk/src/types.ts](/packages/sdk/src/types.ts) | TypeScript | 5 | 0 | 2 | 7 |
| [packages/sdk/tsconfig.json](/packages/sdk/tsconfig.json) | JSON with Comments | 1 | 0 | 0 | 1 |
| [pnpm-lock.yaml](/pnpm-lock.yaml) | YAML | 3 | 0 | 0 | 3 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details