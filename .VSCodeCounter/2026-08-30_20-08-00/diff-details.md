# Diff Details

Date : 2026-08-30 20:08:00

Directory /Users/nssanjeev/Development/Halo

Total : 93 files,  9159 codes, 1171 comments, 1067 blanks, all 11397 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [apps/dashboard/package.json](/apps/dashboard/package.json) | JSON | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/actions/issue.ts](/apps/dashboard/src/actions/issue.ts) | TypeScript | -24 | 1 | -2 | -25 |
| [apps/dashboard/src/actions/project-github.ts](/apps/dashboard/src/actions/project-github.ts) | TypeScript | 280 | 25 | 51 | 356 |
| [apps/dashboard/src/actions/project.ts](/apps/dashboard/src/actions/project.ts) | TypeScript | 12 | 0 | 3 | 15 |
| [apps/dashboard/src/actions/replay.ts](/apps/dashboard/src/actions/replay.ts) | TypeScript | 155 | 13 | 17 | 185 |
| [apps/dashboard/src/app/(auth)/layout.tsx](/apps/dashboard/src/app/(auth)/layout.tsx) | TypeScript JSX | 1 | 0 | 1 | 2 |
| [apps/dashboard/src/app/(dashboard)/error.tsx](/apps/dashboard/src/app/(dashboard)/error.tsx) | TypeScript JSX | 38 | 0 | 4 | 42 |
| [apps/dashboard/src/app/(dashboard)/layout.tsx](/apps/dashboard/src/app/(dashboard)/layout.tsx) | TypeScript JSX | 5 | 0 | 1 | 6 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/investigations/new/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/investigations/new/page.tsx) | TypeScript JSX | 311 | 8 | 25 | 344 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/settings/github-settings-card.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/settings/github-settings-card.tsx) | TypeScript JSX | 333 | 1 | 24 | 358 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/settings/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/settings/page.tsx) | TypeScript JSX | 49 | 2 | 8 | 59 |
| [apps/dashboard/src/app/(dashboard)/projects/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/page.tsx) | TypeScript JSX | 5 | 0 | 0 | 5 |
| [apps/dashboard/src/app/(dashboard)/settings/project/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/project/page.tsx) | TypeScript JSX | 4 | 0 | 3 | 7 |
| [apps/dashboard/src/app/(dashboard)/settings/project/project-settings-form.tsx](/apps/dashboard/src/app/(dashboard)/settings/project/project-settings-form.tsx) | TypeScript JSX | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/app/(dashboard)/settings/repos/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/repos/page.tsx) | TypeScript JSX | 16 | 0 | 4 | 20 |
| [apps/dashboard/src/app/api/ingest/events/route.ts](/apps/dashboard/src/app/api/ingest/events/route.ts) | TypeScript | 44 | 2 | 3 | 49 |
| [apps/dashboard/src/app/api/ingest/replay/route.ts](/apps/dashboard/src/app/api/ingest/replay/route.ts) | TypeScript | 27 | 2 | 2 | 31 |
| [apps/dashboard/src/components/investigation/causal-chain-view.tsx](/apps/dashboard/src/components/investigation/causal-chain-view.tsx) | TypeScript JSX | 621 | 16 | 33 | 670 |
| [apps/dashboard/src/components/investigation/runtime-reconstruction-view.tsx](/apps/dashboard/src/components/investigation/runtime-reconstruction-view.tsx) | TypeScript JSX | 513 | 12 | 33 | 558 |
| [apps/dashboard/src/components/overview/sidebar.tsx](/apps/dashboard/src/components/overview/sidebar.tsx) | TypeScript JSX | 2 | 0 | 0 | 2 |
| [apps/dashboard/src/components/projects/create-project-dialog.tsx](/apps/dashboard/src/components/projects/create-project-dialog.tsx) | TypeScript JSX | 22 | 0 | 4 | 26 |
| [apps/dashboard/src/components/replay/replay-player-client.tsx](/apps/dashboard/src/components/replay/replay-player-client.tsx) | TypeScript JSX | 223 | 12 | 18 | 253 |
| [apps/dashboard/src/components/ui/relative-time.tsx](/apps/dashboard/src/components/ui/relative-time.tsx) | TypeScript JSX | 8 | 0 | 0 | 8 |
| [apps/dashboard/src/generated/prisma/internal/prismaNamespace.ts](/apps/dashboard/src/generated/prisma/internal/prismaNamespace.ts) | TypeScript | 6 | 0 | 0 | 6 |
| [apps/dashboard/src/generated/prisma/internal/prismaNamespaceBrowser.ts](/apps/dashboard/src/generated/prisma/internal/prismaNamespaceBrowser.ts) | TypeScript | 6 | 0 | 0 | 6 |
| [apps/dashboard/src/generated/prisma/models/Project.ts](/apps/dashboard/src/generated/prisma/models/Project.ts) | TypeScript | 315 | 0 | 0 | 315 |
| [apps/dashboard/src/generated/prisma/models/Release.ts](/apps/dashboard/src/generated/prisma/models/Release.ts) | TypeScript | 39 | 0 | 0 | 39 |
| [apps/dashboard/src/lib/auth.ts](/apps/dashboard/src/lib/auth.ts) | TypeScript | 13 | 0 | 1 | 14 |
| [apps/dashboard/src/lib/cors.ts](/apps/dashboard/src/lib/cors.ts) | TypeScript | 21 | 2 | 2 | 25 |
| [apps/dashboard/src/lib/email.ts](/apps/dashboard/src/lib/email.ts) | TypeScript | 5 | 0 | 0 | 5 |
| [apps/dashboard/src/lib/investigation/evidence.ts](/apps/dashboard/src/lib/investigation/evidence.ts) | TypeScript | 3 | 2 | 3 | 8 |
| [apps/dashboard/src/lib/investigation/interpreter.ts](/apps/dashboard/src/lib/investigation/interpreter.ts) | TypeScript | 191 | 101 | 12 | 304 |
| [apps/dashboard/src/lib/investigation/occurrence-isolation.ts](/apps/dashboard/src/lib/investigation/occurrence-isolation.ts) | TypeScript | 27 | 12 | 5 | 44 |
| [apps/dashboard/src/lib/investigation/recommendations.ts](/apps/dashboard/src/lib/investigation/recommendations.ts) | TypeScript | 433 | 106 | 67 | 606 |
| [apps/dashboard/src/lib/investigation/runtime/ast-resolver.ts](/apps/dashboard/src/lib/investigation/runtime/ast-resolver.ts) | TypeScript | 197 | 39 | 36 | 272 |
| [apps/dashboard/src/lib/investigation/runtime/call-chain.ts](/apps/dashboard/src/lib/investigation/runtime/call-chain.ts) | TypeScript | 115 | 35 | 22 | 172 |
| [apps/dashboard/src/lib/investigation/runtime/context-collector.ts](/apps/dashboard/src/lib/investigation/runtime/context-collector.ts) | TypeScript | 397 | 48 | 56 | 501 |
| [apps/dashboard/src/lib/investigation/runtime/github-source-provider.ts](/apps/dashboard/src/lib/investigation/runtime/github-source-provider.ts) | TypeScript | 215 | 48 | 40 | 303 |
| [apps/dashboard/src/lib/investigation/runtime/github-source-utils.ts](/apps/dashboard/src/lib/investigation/runtime/github-source-utils.ts) | TypeScript | 101 | 13 | 20 | 134 |
| [apps/dashboard/src/lib/investigation/runtime/reconstruction-engine.ts](/apps/dashboard/src/lib/investigation/runtime/reconstruction-engine.ts) | TypeScript | 122 | 32 | 21 | 175 |
| [apps/dashboard/src/lib/investigation/runtime/redaction.ts](/apps/dashboard/src/lib/investigation/runtime/redaction.ts) | TypeScript | 60 | 21 | 17 | 98 |
| [apps/dashboard/src/lib/investigation/runtime/source-resolver.ts](/apps/dashboard/src/lib/investigation/runtime/source-resolver.ts) | TypeScript | 118 | 49 | 23 | 190 |
| [apps/dashboard/src/lib/investigation/runtime/stack-parser.ts](/apps/dashboard/src/lib/investigation/runtime/stack-parser.ts) | TypeScript | 180 | 56 | 38 | 274 |
| [apps/dashboard/src/lib/investigation/runtime/telemetry-gaps.ts](/apps/dashboard/src/lib/investigation/runtime/telemetry-gaps.ts) | TypeScript | 121 | 24 | 11 | 156 |
| [apps/dashboard/src/lib/investigation/runtime/types.ts](/apps/dashboard/src/lib/investigation/runtime/types.ts) | TypeScript | 152 | 43 | 17 | 212 |
| [apps/dashboard/src/lib/prisma.ts](/apps/dashboard/src/lib/prisma.ts) | TypeScript | 6 | 0 | 1 | 7 |
| [apps/dashboard/src/lib/session.ts](/apps/dashboard/src/lib/session.ts) | TypeScript | 8 | 0 | 0 | 8 |
| [package.json](/package.json) | JSON | 6 | 0 | 0 | 6 |
| [packages/investigation-engine/package.json](/packages/investigation-engine/package.json) | JSON | 3 | 0 | 0 | 3 |
| [packages/investigation-engine/src/engine.ts](/packages/investigation-engine/src/engine.ts) | TypeScript | 19 | 1 | 2 | 22 |
| [packages/investigation-engine/src/graph/builder.ts](/packages/investigation-engine/src/graph/builder.ts) | TypeScript | -95 | -4 | -17 | -116 |
| [packages/investigation-engine/src/graph/propagation.ts](/packages/investigation-engine/src/graph/propagation.ts) | TypeScript | 52 | 0 | 11 | 63 |
| [packages/investigation-engine/src/hypotheses/cascading-failure.ts](/packages/investigation-engine/src/hypotheses/cascading-failure.ts) | TypeScript | 51 | 0 | 7 | 58 |
| [packages/investigation-engine/src/hypotheses/database-failure.ts](/packages/investigation-engine/src/hypotheses/database-failure.ts) | TypeScript | 42 | 0 | 6 | 48 |
| [packages/investigation-engine/src/hypotheses/deployment.ts](/packages/investigation-engine/src/hypotheses/deployment.ts) | TypeScript | -9 | 0 | 0 | -9 |
| [packages/investigation-engine/src/hypotheses/network-protocol.ts](/packages/investigation-engine/src/hypotheses/network-protocol.ts) | TypeScript | 61 | 0 | 8 | 69 |
| [packages/investigation-engine/src/hypotheses/runtime-exception.ts](/packages/investigation-engine/src/hypotheses/runtime-exception.ts) | TypeScript | 28 | 3 | 16 | 47 |
| [packages/investigation-engine/src/index.ts](/packages/investigation-engine/src/index.ts) | TypeScript | 6 | 0 | 0 | 6 |
| [packages/investigation-engine/src/pipeline/correlate.ts](/packages/investigation-engine/src/pipeline/correlate.ts) | TypeScript | 214 | 17 | 20 | 251 |
| [packages/investigation-engine/src/pipeline/rank.ts](/packages/investigation-engine/src/pipeline/rank.ts) | TypeScript | 33 | -9 | 0 | 24 |
| [packages/investigation-engine/src/pipeline/recommend.ts](/packages/investigation-engine/src/pipeline/recommend.ts) | TypeScript | 696 | 81 | 7 | 784 |
| [packages/investigation-engine/src/rules/pre-existing-error.ts](/packages/investigation-engine/src/rules/pre-existing-error.ts) | TypeScript | 6 | 0 | 1 | 7 |
| [packages/investigation-engine/src/runtime/ast-resolver.ts](/packages/investigation-engine/src/runtime/ast-resolver.ts) | TypeScript | 197 | 39 | 36 | 272 |
| [packages/investigation-engine/src/runtime/call-chain.ts](/packages/investigation-engine/src/runtime/call-chain.ts) | TypeScript | 115 | 35 | 22 | 172 |
| [packages/investigation-engine/src/runtime/redaction.ts](/packages/investigation-engine/src/runtime/redaction.ts) | TypeScript | 60 | 0 | 12 | 72 |
| [packages/investigation-engine/src/runtime/source-resolver.ts](/packages/investigation-engine/src/runtime/source-resolver.ts) | TypeScript | 97 | 8 | 15 | 120 |
| [packages/investigation-engine/src/runtime/stack-parser.ts](/packages/investigation-engine/src/runtime/stack-parser.ts) | TypeScript | 180 | 56 | 38 | 274 |
| [packages/investigation-engine/src/runtime/types.ts](/packages/investigation-engine/src/runtime/types.ts) | TypeScript | 156 | 3 | 17 | 176 |
| [packages/investigation-engine/src/types/graph.ts](/packages/investigation-engine/src/types/graph.ts) | TypeScript | 67 | 0 | 0 | 67 |
| [packages/investigation-engine/src/types/hypothesis.ts](/packages/investigation-engine/src/types/hypothesis.ts) | TypeScript | 28 | 0 | 13 | 41 |
| [packages/investigation-engine/src/types/investigation.ts](/packages/investigation-engine/src/types/investigation.ts) | TypeScript | 3 | 0 | 1 | 4 |
| [packages/investigation-engine/src/types/recommendation.ts](/packages/investigation-engine/src/types/recommendation.ts) | TypeScript | 57 | 90 | 23 | 170 |
| [packages/investigation-engine/test/causal-chains-and-hypotheses.test.ts](/packages/investigation-engine/test/causal-chains-and-hypotheses.test.ts) | TypeScript | 626 | 9 | 67 | 702 |
| [packages/investigation-engine/test/github-source-utils.test.ts](/packages/investigation-engine/test/github-source-utils.test.ts) | TypeScript | 74 | 0 | 13 | 87 |
| [packages/investigation-engine/test/investigation-bugs.test.ts](/packages/investigation-engine/test/investigation-bugs.test.ts) | TypeScript | 90 | 4 | 11 | 105 |
| [packages/investigation-engine/test/occurrence-isolation.test.ts](/packages/investigation-engine/test/occurrence-isolation.test.ts) | TypeScript | 33 | 0 | 5 | 38 |
| [packages/investigation-engine/test/runtime-reconstruction-scenarios.test.ts](/packages/investigation-engine/test/runtime-reconstruction-scenarios.test.ts) | TypeScript | 111 | 0 | 13 | 124 |
| [packages/investigation-engine/test/runtime-reconstruction.test.ts](/packages/investigation-engine/test/runtime-reconstruction.test.ts) | TypeScript | 236 | 11 | 51 | 298 |
| [packages/replay/dist/index.cjs](/packages/replay/dist/index.cjs) | JavaScript | 8 | 0 | 0 | 8 |
| [packages/replay/dist/index.d.cts](/packages/replay/dist/index.d.cts) | TypeScript | 1 | 0 | 0 | 1 |
| [packages/replay/dist/index.d.ts](/packages/replay/dist/index.d.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [packages/replay/dist/index.js](/packages/replay/dist/index.js) | JavaScript | 8 | 0 | 0 | 8 |
| [packages/replay/src/recorder.ts](/packages/replay/src/recorder.ts) | TypeScript | 8 | 0 | 3 | 11 |
| [packages/replay/src/uploader.ts](/packages/replay/src/uploader.ts) | TypeScript | 2 | 5 | 1 | 8 |
| [packages/sdk/dist/index.cjs](/packages/sdk/dist/index.cjs) | JavaScript | 52 | 3 | 0 | 55 |
| [packages/sdk/dist/index.d.cts](/packages/sdk/dist/index.d.cts) | TypeScript | 5 | 8 | 0 | 13 |
| [packages/sdk/dist/index.d.ts](/packages/sdk/dist/index.d.ts) | TypeScript | 5 | 8 | 0 | 13 |
| [packages/sdk/dist/index.js](/packages/sdk/dist/index.js) | JavaScript | 52 | 3 | 0 | 55 |
| [packages/sdk/src/halo.ts](/packages/sdk/src/halo.ts) | TypeScript | 57 | 9 | 8 | 74 |
| [packages/sdk/src/test-checkout-scenario.ts](/packages/sdk/src/test-checkout-scenario.ts) | TypeScript | 207 | 57 | 31 | 295 |
| [packages/sdk/src/types.ts](/packages/sdk/src/types.ts) | TypeScript | 0 | 5 | 0 | 5 |
| [pnpm-lock.yaml](/pnpm-lock.yaml) | YAML | 7 | 0 | 0 | 7 |
| [prisma/migrations/20260830\_add\_github\_integration\_to\_project/migration.sql](/prisma/migrations/20260830_add_github_integration_to_project/migration.sql) | MS SQL | 5 | 4 | 2 | 11 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details