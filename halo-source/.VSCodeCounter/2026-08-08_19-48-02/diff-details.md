# Diff Details

Date : 2026-08-08 19:48:02

Directory /Users/nssanjeev/Development/Halo

Total : 84 files,  2753 codes, 13 comments, 953 blanks, all 3719 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [apps/dashboard/src/actions/event.ts](/apps/dashboard/src/actions/event.ts) | TypeScript | 11 | 0 | 1 | 12 |
| [apps/dashboard/src/actions/project.ts](/apps/dashboard/src/actions/project.ts) | TypeScript | 37 | 0 | 9 | 46 |
| [apps/dashboard/src/app/(dashboard)/layout.tsx](/apps/dashboard/src/app/(dashboard)/layout.tsx) | TypeScript JSX | 2 | 0 | 7 | 9 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/events/\[eventId\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/events/%5BeventId%5D/page.tsx) | TypeScript JSX | 76 | 3 | 32 | 111 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/events/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/events/page.tsx) | TypeScript JSX | 14 | 5 | 7 | 26 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/issues/\[issueId\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/issues/%5BissueId%5D/page.tsx) | TypeScript JSX | 12 | 1 | 3 | 16 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/issues/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/issues/page.tsx) | TypeScript JSX | 44 | 1 | 24 | 69 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/layout.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/layout.tsx) | TypeScript JSX | 17 | 0 | 3 | 20 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/page.tsx) | TypeScript JSX | -2 | 0 | 4 | 2 |
| [apps/dashboard/src/app/(dashboard)/projects/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/page.tsx) | TypeScript JSX | 1 | 1 | 19 | 21 |
| [apps/dashboard/src/app/api/ingest/events/route.ts](/apps/dashboard/src/app/api/ingest/events/route.ts) | TypeScript | 48 | 0 | 17 | 65 |
| [apps/dashboard/src/app/api/ingest/message/route.ts](/apps/dashboard/src/app/api/ingest/message/route.ts) | TypeScript | -50 | 0 | -13 | -63 |
| [apps/dashboard/src/app/globals.css](/apps/dashboard/src/app/globals.css) | PostCSS | 40 | -11 | 74 | 103 |
| [apps/dashboard/src/components/events/breadcrumbs.tsx](/apps/dashboard/src/components/events/breadcrumbs.tsx) | TypeScript JSX | 56 | 0 | 12 | 68 |
| [apps/dashboard/src/components/events/stack-trace.tsx](/apps/dashboard/src/components/events/stack-trace.tsx) | TypeScript JSX | 19 | 0 | 2 | 21 |
| [apps/dashboard/src/components/events/tags.tsx](/apps/dashboard/src/components/events/tags.tsx) | TypeScript JSX | 38 | 0 | 6 | 44 |
| [apps/dashboard/src/components/events/user.tsx](/apps/dashboard/src/components/events/user.tsx) | TypeScript JSX | 66 | 0 | 13 | 79 |
| [apps/dashboard/src/components/issues/issue-card.tsx](/apps/dashboard/src/components/issues/issue-card.tsx) | TypeScript JSX | 28 | 4 | 16 | 48 |
| [apps/dashboard/src/components/overview/sidebar.tsx](/apps/dashboard/src/components/overview/sidebar.tsx) | TypeScript JSX | 6 | 0 | 28 | 34 |
| [apps/dashboard/src/components/overview/topbar.tsx](/apps/dashboard/src/components/overview/topbar.tsx) | TypeScript JSX | 30 | 0 | 4 | 34 |
| [apps/dashboard/src/components/projects/project-card.tsx](/apps/dashboard/src/components/projects/project-card.tsx) | TypeScript JSX | 67 | 0 | 37 | 104 |
| [apps/dashboard/src/components/projects/project-header.tsx](/apps/dashboard/src/components/projects/project-header.tsx) | TypeScript JSX | 11 | 0 | 6 | 17 |
| [apps/dashboard/src/components/projects/project-navigation.tsx](/apps/dashboard/src/components/projects/project-navigation.tsx) | TypeScript JSX | -1 | 0 | 4 | 3 |
| [apps/dashboard/src/components/projects/project-overview.tsx](/apps/dashboard/src/components/projects/project-overview.tsx) | TypeScript JSX | 9 | 0 | 20 | 29 |
| [apps/dashboard/src/components/projects/project-quick-start.tsx](/apps/dashboard/src/components/projects/project-quick-start.tsx) | TypeScript JSX | 13 | 0 | 16 | 29 |
| [apps/dashboard/src/components/projects/projects-grid.tsx](/apps/dashboard/src/components/projects/projects-grid.tsx) | TypeScript JSX | 55 | 0 | 23 | 78 |
| [apps/dashboard/src/components/ui/card.tsx](/apps/dashboard/src/components/ui/card.tsx) | TypeScript JSX | 1 | 0 | -3 | -2 |
| [apps/dashboard/src/components/ui/page-header.tsx](/apps/dashboard/src/components/ui/page-header.tsx) | TypeScript JSX | 4 | 0 | 0 | 4 |
| [apps/dashboard/src/components/ui/severity-badge.tsx](/apps/dashboard/src/components/ui/severity-badge.tsx) | TypeScript JSX | 16 | 0 | 4 | 20 |
| [apps/dashboard/src/generated/prisma/internal/prismaNamespace.ts](/apps/dashboard/src/generated/prisma/internal/prismaNamespace.ts) | TypeScript | 6 | 0 | 0 | 6 |
| [apps/dashboard/src/generated/prisma/internal/prismaNamespaceBrowser.ts](/apps/dashboard/src/generated/prisma/internal/prismaNamespaceBrowser.ts) | TypeScript | 6 | 0 | 0 | 6 |
| [apps/dashboard/src/generated/prisma/models/Event.ts](/apps/dashboard/src/generated/prisma/models/Event.ts) | TypeScript | 217 | 0 | 0 | 217 |
| [apps/dashboard/src/generated/prisma/models/Issue.ts](/apps/dashboard/src/generated/prisma/models/Issue.ts) | TypeScript | 39 | 0 | 0 | 39 |
| [package.json](/package.json) | JSON | 1 | 0 | -2 | -1 |
| [packages/investigation-engine/package.json](/packages/investigation-engine/package.json) | JSON | 18 | 0 | 0 | 18 |
| [packages/investigation-engine/src/engine.ts](/packages/investigation-engine/src/engine.ts) | TypeScript | 36 | 0 | 16 | 52 |
| [packages/investigation-engine/src/hypotheses/deployment-regression.ts](/packages/investigation-engine/src/hypotheses/deployment-regression.ts) | TypeScript | 6 | 0 | 4 | 10 |
| [packages/investigation-engine/src/index.ts](/packages/investigation-engine/src/index.ts) | TypeScript | 8 | 0 | 1 | 9 |
| [packages/investigation-engine/src/pipeline/aggregate.ts](/packages/investigation-engine/src/pipeline/aggregate.ts) | TypeScript | 58 | 0 | 29 | 87 |
| [packages/investigation-engine/src/pipeline/anomalies.ts](/packages/investigation-engine/src/pipeline/anomalies.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/pipeline/change-detector.ts](/packages/investigation-engine/src/pipeline/change-detector.ts) | TypeScript | 32 | 0 | 8 | 40 |
| [packages/investigation-engine/src/pipeline/changes.ts](/packages/investigation-engine/src/pipeline/changes.ts) | TypeScript | 20 | 0 | 15 | 35 |
| [packages/investigation-engine/src/pipeline/correlate.ts](/packages/investigation-engine/src/pipeline/correlate.ts) | TypeScript | 40 | 0 | 17 | 57 |
| [packages/investigation-engine/src/pipeline/hypotheses.ts](/packages/investigation-engine/src/pipeline/hypotheses.ts) | TypeScript | 14 | 0 | 4 | 18 |
| [packages/investigation-engine/src/pipeline/impact.ts](/packages/investigation-engine/src/pipeline/impact.ts) | TypeScript | 6 | 0 | 3 | 9 |
| [packages/investigation-engine/src/pipeline/normalize.ts](/packages/investigation-engine/src/pipeline/normalize.ts) | TypeScript | 10 | 0 | 2 | 12 |
| [packages/investigation-engine/src/pipeline/rank.ts](/packages/investigation-engine/src/pipeline/rank.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/pipeline/recommend.ts](/packages/investigation-engine/src/pipeline/recommend.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/pipeline/report.ts](/packages/investigation-engine/src/pipeline/report.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/pipeline/timeline.ts](/packages/investigation-engine/src/pipeline/timeline.ts) | TypeScript | 25 | 0 | 10 | 35 |
| [packages/investigation-engine/src/pipeline/validate.ts](/packages/investigation-engine/src/pipeline/validate.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/rules/deployment-before-error.ts](/packages/investigation-engine/src/rules/deployment-before-error.ts) | TypeScript | 43 | 0 | 20 | 63 |
| [packages/investigation-engine/src/rules/different-service.ts](/packages/investigation-engine/src/rules/different-service.ts) | TypeScript | 39 | 0 | 12 | 51 |
| [packages/investigation-engine/src/rules/index.ts](/packages/investigation-engine/src/rules/index.ts) | TypeScript | 17 | 0 | 3 | 20 |
| [packages/investigation-engine/src/rules/multiple-errors.ts](/packages/investigation-engine/src/rules/multiple-errors.ts) | TypeScript | 37 | 0 | 11 | 48 |
| [packages/investigation-engine/src/rules/same-service.ts](/packages/investigation-engine/src/rules/same-service.ts) | TypeScript | 37 | 0 | 10 | 47 |
| [packages/investigation-engine/src/rules/scoring/deploymment.ts](/packages/investigation-engine/src/rules/scoring/deploymment.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/rules/scoring/release.ts](/packages/investigation-engine/src/rules/scoring/release.ts) | TypeScript | 10 | 0 | 3 | 13 |
| [packages/investigation-engine/src/rules/scoring/service.ts](/packages/investigation-engine/src/rules/scoring/service.ts) | TypeScript | 0 | 0 | 1 | 1 |
| [packages/investigation-engine/src/rules/service.ts](/packages/investigation-engine/src/rules/service.ts) | TypeScript | 9 | 0 | 3 | 12 |
| [packages/investigation-engine/src/rules/time-window.ts](/packages/investigation-engine/src/rules/time-window.ts) | TypeScript | 45 | 0 | 15 | 60 |
| [packages/investigation-engine/src/types/change.ts](/packages/investigation-engine/src/types/change.ts) | TypeScript | 16 | 0 | 6 | 22 |
| [packages/investigation-engine/src/types/evidence-score.ts](/packages/investigation-engine/src/types/evidence-score.ts) | TypeScript | 5 | 0 | 4 | 9 |
| [packages/investigation-engine/src/types/evidence.ts](/packages/investigation-engine/src/types/evidence.ts) | TypeScript | 21 | 0 | 8 | 29 |
| [packages/investigation-engine/src/types/graph.ts](/packages/investigation-engine/src/types/graph.ts) | TypeScript | 24 | 0 | 9 | 33 |
| [packages/investigation-engine/src/types/hypothesis.ts](/packages/investigation-engine/src/types/hypothesis.ts) | TypeScript | 12 | 0 | 10 | 22 |
| [packages/investigation-engine/src/types/impact.ts](/packages/investigation-engine/src/types/impact.ts) | TypeScript | 6 | 0 | 3 | 9 |
| [packages/investigation-engine/src/types/investigation.ts](/packages/investigation-engine/src/types/investigation.ts) | TypeScript | 17 | 0 | 9 | 26 |
| [packages/investigation-engine/src/types/reason.ts](/packages/investigation-engine/src/types/reason.ts) | TypeScript | 6 | 0 | 5 | 11 |
| [packages/investigation-engine/src/types/recommendation.ts](/packages/investigation-engine/src/types/recommendation.ts) | TypeScript | 5 | 0 | 2 | 7 |
| [packages/investigation-engine/src/types/rule-result.ts](/packages/investigation-engine/src/types/rule-result.ts) | TypeScript | 5 | 0 | 2 | 7 |
| [packages/investigation-engine/src/types/timeline.ts](/packages/investigation-engine/src/types/timeline.ts) | TypeScript | 17 | 0 | 7 | 24 |
| [packages/investigation-engine/test/engine.test.ts](/packages/investigation-engine/test/engine.test.ts) | TypeScript | 88 | 0 | 43 | 131 |
| [packages/investigation-engine/test/investigation.ts](/packages/investigation-engine/test/investigation.ts) | TypeScript | 53 | 0 | 28 | 81 |
| [packages/investigation-engine/tsconfig.json](/packages/investigation-engine/tsconfig.json) | JSON with Comments | 17 | 0 | 7 | 24 |
| [packages/sdk/src/capture.ts](/packages/sdk/src/capture.ts) | TypeScript | 50 | 2 | 4 | 56 |
| [packages/sdk/src/halo.ts](/packages/sdk/src/halo.ts) | TypeScript | 112 | 0 | 39 | 151 |
| [packages/sdk/src/index.ts](/packages/sdk/src/index.ts) | TypeScript | 8 | 0 | 1 | 9 |
| [packages/sdk/src/queue.ts](/packages/sdk/src/queue.ts) | TypeScript | 45 | 4 | 13 | 62 |
| [packages/sdk/src/types.ts](/packages/sdk/src/types.ts) | TypeScript | 35 | 0 | 16 | 51 |
| [pnpm-lock.yaml](/pnpm-lock.yaml) | YAML | 757 | 0 | 168 | 925 |
| [pnpm-workspace.yaml](/pnpm-workspace.yaml) | YAML | 1 | 0 | 0 | 1 |
| [prisma/migrations/20260807105620\_add\_event\_context/migration.sql](/prisma/migrations/20260807105620_add_event_context/migration.sql) | MS SQL | 5 | 2 | 2 | 9 |
| [prisma/migrations/20260808081855\_add\_event\_user/migration.sql](/prisma/migrations/20260808081855_add_event_user/migration.sql) | MS SQL | 1 | 1 | 1 | 3 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details